"""
validator.py — False-positive reduction & severity scoring.
Re-tests detections, applies CVSS-style scoring, and filters noise.
"""

from __future__ import annotations
import logging
from dataclasses import dataclass
from core.detector import Detection
from core.executor import RequestExecutor, FuzzRequest
from core.classifier import AttackVector

logger = logging.getLogger("darkmatter.validator")


CVSS_MAP = {
    "critical": 9.5,
    "high": 7.5,
    "medium": 5.5,
    "low": 3.0,
    "info": 1.0,
}

REMEDIATION: dict[AttackVector, str] = {
    AttackVector.SQLI: "Use parameterized queries/prepared statements. Never concatenate user input into SQL.",
    AttackVector.XSS: "Encode all output. Implement Content-Security-Policy. Use HTTPOnly cookies.",
    AttackVector.SSTI: "Sanitize template inputs. Use sandboxed template engines. Never pass user input to template.render().",
    AttackVector.RCE: "Never pass user input to system commands. Use allowlists. Run with least privileges.",
    AttackVector.LFI: "Validate file paths against allowlist. Disable directory traversal. Use chroot/jail.",
    AttackVector.SSRF: "Validate and whitelist all server-side URL requests. Block internal IPs.",
    AttackVector.IDOR: "Implement proper authorization checks on every resource access. Use UUIDs instead of sequential IDs.",
    AttackVector.OPEN_REDIRECT: "Whitelist allowed redirect destinations. Validate redirect URLs server-side.",
    AttackVector.CSRF: "Implement CSRF tokens. Use SameSite cookie attribute.",
    AttackVector.AUTH_BYPASS: "Enforce authentication on all routes. Use secure session management.",
    AttackVector.HEADER_INJECTION: "Validate and sanitize all header values. Use strict Content-Type.",
}


class Validator:
    """Validates detections and reduces false positives."""

    def __init__(self, executor: RequestExecutor | None = None, retest_count: int = 2):
        self.executor = executor
        self.retest_count = retest_count

    def validate_all(self, detections: list[Detection]) -> list[Detection]:
        """Validate and enrich all detections."""
        validated = []
        seen_keys: set[str] = set()

        for det in detections:
            # Deduplicate
            key = f"{det.vector}:{det.endpoint}:{det.param_name}:{det.category}"
            if key in seen_keys:
                continue
            seen_keys.add(key)

            # Enrich
            det = self._enrich(det)

            # Filter low-confidence
            if det.confidence < 0.4:
                logger.debug(f"Filtered (low confidence {det.confidence:.2f}): {det.evidence}")
                continue

            # Retest if executor is available
            if self.executor and det.confidence < 0.8:
                det = self._retest(det)
                if det.confidence < 0.4:
                    continue

            validated.append(det)

        # Sort by severity
        sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        validated.sort(key=lambda d: (sev_order.get(d.severity, 5), -d.confidence))

        return validated

    def _enrich(self, det: Detection) -> Detection:
        """Add CVSS score, remediation, PoC, and description."""
        # CVSS
        det.cvss = CVSS_MAP.get(det.severity, 5.0)

        # Adjust severity based on vector
        if det.vector in (AttackVector.SQLI, AttackVector.RCE, AttackVector.SSTI):
            if det.confidence >= 0.8:
                det.severity = "critical"
                det.cvss = 9.5 + (det.confidence - 0.8)

        # Remediation
        det.recommendation = REMEDIATION.get(det.vector, "Review and fix the vulnerability.")

        # Description
        if not det.description:
            det.description = f"{det.vector.value.upper()} detected via {det.category} on {det.param_name}"

        # PoC (curl command)
        req = det.endpoint
        if det.payload and det.param_name:
            det.poc = f'curl -v "{req}?{det.param_name}={det.payload}"'

        # False positive risk assessment
        if det.category == "signature_match" and det.confidence >= 0.85:
            det.false_positive_risk = "low"
        elif det.category == "reflection":
            det.false_positive_risk = "medium"
        elif det.category in ("content_diff", "status_change"):
            det.false_positive_risk = "high"
        else:
            det.false_positive_risk = "medium"

        return det

    def _retest(self, det: Detection) -> Detection:
        """Re-send the payload to verify reproducibility."""
        if not self.executor:
            return det

        confirmed = 0
        for _ in range(self.retest_count):
            req = FuzzRequest(
                url=det.endpoint,
                method=det.method,
                params={det.param_name: det.payload} if det.method == "GET" else None,
                body=f"{det.param_name}={det.payload}" if det.method == "POST" else None,
                payload_info=f"Retest: {det.evidence}",
            )
            resp = self.executor.execute(req)
            if not resp.error and det.payload.lower() in resp.body.lower():
                confirmed += 1

        if confirmed == self.retest_count:
            det.confidence = min(1.0, det.confidence + 0.2)
            det.false_positive_risk = "low"
        elif confirmed == 0:
            det.confidence *= 0.3  # likely false positive
            det.false_positive_risk = "high"

        return det
