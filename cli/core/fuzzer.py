"""
fuzzer.py — Core fuzzing engine.
Orchestrates crawling → classification → payload selection → execution → detection → validation.
"""

from __future__ import annotations
import asyncio
import logging
from typing import Callable, Any

from core.scope import ScopeEnforcer
from core.crawler import Crawler, AttackSurface, Endpoint, COMMON_ENDPOINTS
from core.classifier import InputClassifier, ClassifiedInput, AttackVector
from core.payloads import PayloadEngine, Payload
from core.executor import RequestExecutor, FuzzRequest, FuzzResponse, AuthConfig
from core.detector import DetectionEngine, Detection
from core.validator import Validator
from core.reporter import Reporter

logger = logging.getLogger("darkmatter.fuzzer")


class FuzzEngine:
    """Main fuzzing orchestrator."""

    def __init__(
        self,
        target: str,
        profile: str = "full",
        rps: float = 10.0,
        max_payloads_per_param: int = 5,
        auth: AuthConfig | None = None,
        proxy: str | None = None,
        on_progress: Callable[[str, str], None] | None = None,
    ):
        self.target = target
        self.profile = profile
        self.on_progress = on_progress or (lambda phase, msg: None)

        # Initialize all modules
        self.scope = ScopeEnforcer.from_target(target, rps=rps)
        self.crawler = Crawler(max_depth=3 if profile != "quick" else 1)
        self.classifier = InputClassifier()
        self.payloads = PayloadEngine()
        self.executor = RequestExecutor(
            scope=self.scope, auth=auth, proxy=proxy,
        )
        self.detector = DetectionEngine()
        self.validator = Validator(
            executor=self.executor,
            on_progress=lambda msg: self.on_progress("validate", msg)
        )
        self.reporter = Reporter()

        self.max_payloads_per_param = max_payloads_per_param
        self.surface: AttackSurface | None = None
        self.all_detections: list[Detection] = []

    # ── Phase 1: Discovery ─────────────────────────────────────

    async def discover(self) -> AttackSurface:
        """Crawl and discover attack surface."""
        self.on_progress("discovery", f"Crawling {self.target}...")
        self.surface = await self.crawler.crawl(self.target)

        # Add common probe endpoints
        self.on_progress("discovery", "Probing common paths...")
        for path in COMMON_ENDPOINTS:
            from urllib.parse import urljoin
            url = urljoin(self.target, path)
            if self.scope.is_in_scope(url):
                self.surface.endpoints.append(Endpoint(url=url, source="probe"))

        self.on_progress("discovery", (
            f"Found {len(self.surface.endpoints)} endpoints, "
            f"{len(self.surface.js_files)} JS files, "
            f"{len(self.surface.api_paths)} API paths"
        ))
        return self.surface

    # ── Phase 2: Classify ──────────────────────────────────────

    def classify(self) -> list[ClassifiedInput]:
        """Classify all discovered inputs."""
        if not self.surface:
            return []

        self.on_progress("classify", "Classifying inputs...")
        all_inputs: list[ClassifiedInput] = []

        for ep in self.surface.endpoints:
            if ep.params:
                inputs = self.classifier.classify_all(ep.params, "query")
                all_inputs.extend(inputs)

            for form in ep.forms:
                form_params = {f.name: f.value or "" for f in form.fields}
                inputs = self.classifier.classify_all(form_params, "body")
                all_inputs.extend(inputs)

        self.on_progress("classify", f"Classified {len(all_inputs)} input parameters")
        return all_inputs

    # ── Phase 3: Fuzz ──────────────────────────────────────────

    def fuzz_endpoint(self, endpoint: Endpoint) -> list[Detection]:
        """Fuzz a single endpoint with targeted payloads."""
        detections: list[Detection] = []

        if not self.scope.is_in_scope(endpoint.url) or not self.scope.can_continue():
            return detections

        # Get baseline response
        baseline_req = FuzzRequest(
            url=endpoint.url, method=endpoint.method,
            params=endpoint.params if endpoint.method == "GET" else None,
            body="&".join(f"{k}={v}" for k, v in endpoint.params.items()) if endpoint.method == "POST" and endpoint.params else None,
            payload_info="baseline",
        )
        baseline = self.executor.execute(baseline_req)
        if baseline.error:
            return detections

        # Check headers on baseline
        header_detections = self.detector.check_headers(baseline)
        detections.extend(header_detections)

        # Classify parameters
        params = endpoint.params or {}
        for param_name, param_value in params.items():
            classified = self.classifier.classify(param_name, param_value, "query")

            # Get targeted payloads
            payloads = self.payloads.get_all_payloads(
                classified.attack_vectors,
                max_per_vector=self.max_payloads_per_param,
            )
            
            self.on_progress("fuzz", f"    -> Targeting '{param_name}' ({classified.input_type.value}) with {len(payloads)} payloads")

            for payload in payloads:
                if not self.scope.can_continue():
                    break

                self.on_progress("fuzz", f"      [Injected] {payload.vector.value.upper()} ({payload.category}) -> {payload.value[:40]}")

                # Build fuzzed request
                fuzzed_params = dict(params)
                fuzzed_params[param_name] = payload.value

                fuzz_req = FuzzRequest(
                    url=endpoint.url,
                    method=endpoint.method,
                    params=fuzzed_params if endpoint.method == "GET" else None,
                    body="&".join(f"{k}={v}" for k, v in fuzzed_params.items()) if endpoint.method == "POST" else None,
                    payload_info=f"{payload.vector.value}:{payload.category}",
                )

                response = self.executor.execute(fuzz_req)
                if response.error:
                    continue

                # Detect
                new_detections = self.detector.analyze(
                    response, baseline, payload, param_name,
                )
                if new_detections:
                    for det in new_detections:
                        self.on_progress("fuzz", f"        [!] Possible hit: {det.severity.upper()} {det.vector.value} - {det.evidence}")
                detections.extend(new_detections)

        return detections

    def fuzz_all(self) -> list[Detection]:
        """Fuzz all discovered endpoints."""
        if not self.surface:
            return []

        total = len(self.surface.endpoints)
        self.on_progress("fuzz", f"Fuzzing {total} endpoints...")

        for i, endpoint in enumerate(self.surface.endpoints):
            if not self.scope.can_continue():
                self.on_progress("fuzz", "Request limit reached. Stopping.")
                break

            self.on_progress("fuzz", f"[{i+1}/{total}] {endpoint.method} {endpoint.url}")
            detections = self.fuzz_endpoint(endpoint)
            self.all_detections.extend(detections)

        self.on_progress("fuzz", f"Fuzzing complete — {len(self.all_detections)} raw detections")
        return self.all_detections

    # ── Phase 4: Validate ──────────────────────────────────────

    def validate(self) -> list[Detection]:
        """Validate and deduplicate findings."""
        self.on_progress("validate", f"Validating {len(self.all_detections)} detections...")
        validated = self.validator.validate_all(self.all_detections)
        self.on_progress("validate", f"Validated: {len(validated)} confirmed findings")
        self.all_detections = validated
        return validated

    # ── Phase 5: Report ────────────────────────────────────────

    def report(self, scan_time: float = 0) -> dict[str, str]:
        """Generate reports."""
        self.on_progress("report", "Generating reports...")
        paths = self.reporter.generate(
            self.target, self.all_detections, self.surface, scan_time, "fuzz",
        )
        self.on_progress("report", f"Reports saved: {', '.join(paths.values())}")
        return paths

    # ── Full pipeline ──────────────────────────────────────────

    async def run(self) -> list[Detection]:
        """Run the complete fuzzing pipeline."""
        import time
        start = time.time()

        self.on_progress("start", f"DARKMATTER Fuzzer targeting {self.target}")

        # Phase 1: Discover
        await self.discover()

        # Phase 2: Classify
        self.classify()

        # Phase 3: Fuzz
        self.fuzz_all()

        # Phase 4: Validate
        self.validate()

        # Phase 5: Report
        elapsed = time.time() - start
        self.report(elapsed)

        self.on_progress("complete", (
            f"Done in {elapsed:.1f}s — {len(self.all_detections)} findings, "
            f"{self.executor.stats['requests']} requests"
        ))

        return self.all_detections
