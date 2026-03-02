"""
detector.py — Detection & analysis engine.
Signature-based, heuristic, timing, and differential response analysis.
"""

from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from core.classifier import AttackVector
from core.executor import FuzzResponse
from core.payloads import Payload

logger = logging.getLogger("darkmatter.detector")


@dataclass
class Detection:
    """A detected potential vulnerability."""
    vector: AttackVector
    confidence: float           # 0-1
    evidence: str               # what triggered the detection
    payload: str                # payload that triggered it
    endpoint: str
    method: str
    param_name: str
    severity: str               # critical, high, medium, low, info
    category: str               # e.g. "error_based", "reflected", "time_blind"
    response_code: int = 0
    response_time_ms: float = 0
    description: str = ""
    recommendation: str = ""
    cvss: float = 0.0
    poc: str = ""               # proof of concept (curl command)
    false_positive_risk: str = "medium"


# ── Signature databases ──

SQL_ERROR_SIGS = [
    (r"you have an error in your sql syntax", "MySQL syntax error"),
    (r"warning.*mysql_", "MySQL warning"),
    (r"unclosed quotation mark", "MSSQL unclosed quote"),
    (r"quoted string not properly terminated", "Oracle quote error"),
    (r"pg_query\(\).*ERROR", "PostgreSQL error"),
    (r"SQLite3::query", "SQLite error"),
    (r"ORA-\d{4,5}", "Oracle ORA error"),
    (r"JET Database Engine", "MS Access error"),
    (r"SQLSTATE\[", "PDO SQL error"),
    (r"microsoft ole db provider", "OLE DB error"),
    (r"syntax error.*at.*line \d+", "Generic SQL syntax error"),
    (r"unterminated.*string", "Unterminated string"),
]

XSS_REFLECT_SIGS = [
    (r"<script>alert\(1\)</script>", "Script tag reflected"),
    (r"onerror\s*=\s*alert", "Event handler reflected"),
    (r"onload\s*=\s*alert", "Onload reflected"),
    (r"javascript:", "javascript: protocol reflected"),
]

SSTI_SIGS = [
    (r"\b49\b", "Template expression evaluated (7*7=49)"),
    (r"__class__", "Python MRO chain reflected"),
    (r"<Config", "Config object leaked"),
]

RCE_SIGS = [
    (r"uid=\d+.*gid=\d+", "Unix id command output"),
    (r"root:.*:0:0:", "/etc/passwd content"),
    (r"www-data", "www-data user leaked"),
    (r"\bLinux\b.*\bx86_64\b", "Linux uname output"),
    (r"Windows.*NT", "Windows system info"),
]

LFI_SIGS = [
    (r"root:.*:0:0:root", "/etc/passwd content"),
    (r"\[boot loader\]", "Windows boot.ini"),
    (r"\[extensions\]", "Windows system.ini"),
    (r"<\?php", "PHP source code leaked"),
]

SSRF_SIGS = [
    (r"ami-id", "AWS metadata leaked"),
    (r"instance-id", "AWS instance metadata"),
    (r"local-hostname", "Cloud metadata"),
]

HEADER_SIGS = [
    (r"X-Powered-By", "Technology disclosure"),
    (r"Server:\s*\S+/[\d.]+", "Server version disclosure"),
]


class DetectionEngine:
    """Analyzes responses for vulnerability signatures."""

    def __init__(self):
        self.timing_threshold_ms = 4500   # for time-based blind detection
        self.baseline_times: dict[str, float] = {}

    def set_baseline(self, url: str, response_time_ms: float):
        """Set baseline response time for an endpoint."""
        self.baseline_times[url] = response_time_ms

    def analyze(
        self,
        response: FuzzResponse,
        baseline: FuzzResponse | None,
        payload: Payload,
        param_name: str,
    ) -> list[Detection]:
        """Analyze a response for vulnerabilities."""
        detections: list[Detection] = []

        if response.error:
            return detections

        body = response.body.lower()
        url = response.request.url

        # 1. Signature-based detection
        detections.extend(self._check_signatures(response, payload, param_name))

        # 2. Reflection detection
        if payload.value.lower() in body:
            det = Detection(
                vector=payload.vector,
                confidence=0.7,
                evidence=f"Payload reflected in response body",
                payload=payload.value,
                endpoint=url,
                method=response.request.method,
                param_name=param_name,
                severity="medium",
                category="reflection",
            )
            if payload.vector == AttackVector.XSS:
                det.severity = "high"
                det.confidence = 0.85
            detections.append(det)

        # 3. Timing analysis
        if baseline and "time" in payload.category.lower() or "blind" in payload.category.lower():
            baseline_time = baseline.elapsed_ms
            if response.elapsed_ms > baseline_time + self.timing_threshold_ms:
                detections.append(Detection(
                    vector=payload.vector,
                    confidence=0.75,
                    evidence=f"Response delayed by {response.elapsed_ms - baseline_time:.0f}ms (baseline: {baseline_time:.0f}ms)",
                    payload=payload.value,
                    endpoint=url,
                    method=response.request.method,
                    param_name=param_name,
                    severity="high",
                    category="time_blind",
                    response_time_ms=response.elapsed_ms,
                ))

        # 4. Differential analysis (compare with baseline)
        if baseline:
            detections.extend(self._differential_analysis(response, baseline, payload, param_name))

        # 5. Error-based detection
        if response.status_code == 500:
            detections.append(Detection(
                vector=payload.vector,
                confidence=0.5,
                evidence=f"Server error (500) triggered by payload",
                payload=payload.value,
                endpoint=url,
                method=response.request.method,
                param_name=param_name,
                severity="medium",
                category="error_triggered",
                response_code=500,
            ))

        return detections

    def _check_signatures(
        self, response: FuzzResponse, payload: Payload, param_name: str,
    ) -> list[Detection]:
        """Check for known vulnerability signatures."""
        detections = []
        body = response.body

        sig_map: dict[AttackVector, list[tuple[str, str]]] = {
            AttackVector.SQLI: SQL_ERROR_SIGS,
            AttackVector.XSS: XSS_REFLECT_SIGS,
            AttackVector.SSTI: SSTI_SIGS,
            AttackVector.RCE: RCE_SIGS,
            AttackVector.LFI: LFI_SIGS,
            AttackVector.SSRF: SSRF_SIGS,
        }

        sigs = sig_map.get(payload.vector, [])
        for pattern, desc in sigs:
            if re.search(pattern, body, re.I):
                detections.append(Detection(
                    vector=payload.vector,
                    confidence=0.9,
                    evidence=f"Signature match: {desc}",
                    payload=payload.value,
                    endpoint=response.request.url,
                    method=response.request.method,
                    param_name=param_name,
                    severity=payload.severity,
                    category="signature_match",
                    response_code=response.status_code,
                ))
                break  # one signature match per payload is enough

        return detections

    def _differential_analysis(
        self,
        response: FuzzResponse,
        baseline: FuzzResponse,
        payload: Payload,
        param_name: str,
    ) -> list[Detection]:
        """Compare fuzzed response with baseline."""
        detections = []

        # Status code changed
        if response.status_code != baseline.status_code:
            if response.status_code in (302, 301) and baseline.status_code == 200:
                detections.append(Detection(
                    vector=payload.vector,
                    confidence=0.6,
                    evidence=f"Redirect triggered (was {baseline.status_code}, now {response.status_code})",
                    payload=payload.value,
                    endpoint=response.request.url,
                    method=response.request.method,
                    param_name=param_name,
                    severity="medium",
                    category="status_change",
                ))

        # Significant content length change
        len_diff = abs(response.content_length - baseline.content_length)
        if baseline.content_length > 0:
            ratio = len_diff / baseline.content_length
            if ratio > 0.5:  # 50% content length change
                detections.append(Detection(
                    vector=payload.vector,
                    confidence=0.55,
                    evidence=f"Response size changed by {ratio*100:.0f}% ({baseline.content_length} → {response.content_length})",
                    payload=payload.value,
                    endpoint=response.request.url,
                    method=response.request.method,
                    param_name=param_name,
                    severity="low",
                    category="content_diff",
                ))

        return detections


    def check_headers(self, response: FuzzResponse) -> list[Detection]:
        """Check response headers for security issues."""
        detections = []
        headers = {k.lower(): v for k, v in response.headers.items()}

        missing_headers = {
            "strict-transport-security": ("Missing HSTS", "medium", "Add Strict-Transport-Security header"),
            "content-security-policy": ("Missing CSP", "medium", "Add Content-Security-Policy header"),
            "x-content-type-options": ("Missing X-Content-Type-Options", "low", "Add X-Content-Type-Options: nosniff"),
            "x-frame-options": ("Missing X-Frame-Options", "medium", "Add X-Frame-Options: DENY"),
            "x-xss-protection": ("Missing X-XSS-Protection", "low", "Add X-XSS-Protection: 1; mode=block"),
        }

        for header, (title, sev, rec) in missing_headers.items():
            if header not in headers:
                detections.append(Detection(
                    vector=AttackVector.XSS,
                    confidence=1.0,
                    evidence=f"Security header not present: {header}",
                    payload="N/A",
                    endpoint=response.request.url,
                    method=response.request.method,
                    param_name="header",
                    severity=sev,
                    category="missing_header",
                    description=title,
                    recommendation=rec,
                ))

        # Check CORS
        acao = headers.get("access-control-allow-origin", "")
        if acao == "*":
            detections.append(Detection(
                vector=AttackVector.XSS,
                confidence=0.9,
                evidence="CORS wildcard: Access-Control-Allow-Origin: *",
                payload="N/A",
                endpoint=response.request.url,
                method=response.request.method,
                param_name="header",
                severity="high",
                category="cors_misconfiguration",
                description="CORS wildcard origin allows any domain to access resources",
                recommendation="Restrict CORS to trusted origins only",
            ))

        return detections
