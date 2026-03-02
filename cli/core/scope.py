"""
scope.py — Scope enforcement & ethical safeguards.
Ensures fuzzing only targets allowed domains, respects rate limits,
and logs all activity for audit trail.
"""

from __future__ import annotations
import re
import time
import logging
from dataclasses import dataclass, field
from urllib.parse import urlparse

logger = logging.getLogger("darkmatter.scope")


@dataclass
class ScopeConfig:
    """Scope configuration."""
    allowed_domains: list[str] = field(default_factory=list)
    excluded_paths: list[str] = field(default_factory=lambda: [
        "/logout", "/signout", "/delete", "/admin/destroy",
        "/api/v*/admin/delete", "*.pdf", "*.zip", "*.exe",
    ])
    max_requests_per_second: float = 10.0
    max_total_requests: int = 10000
    respect_robots_txt: bool = True
    allowed_methods: list[str] = field(default_factory=lambda: ["GET", "POST", "PUT", "PATCH"])
    max_depth: int = 5


class ScopeEnforcer:
    """Enforces scope boundaries and rate limiting."""

    def __init__(self, config: ScopeConfig):
        self.config = config
        self.request_count = 0
        self._last_request_time = 0.0
        self._request_log: list[dict] = []

    def is_in_scope(self, url: str) -> bool:
        """Check if a URL is within the allowed scope."""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Check domain whitelist
        if self.config.allowed_domains:
            if not any(
                domain == d or domain.endswith(f".{d}")
                for d in self.config.allowed_domains
            ):
                logger.warning(f"BLOCKED: {url} — domain not in scope")
                return False

        # Check excluded paths
        path = parsed.path.lower()
        for pattern in self.config.excluded_paths:
            pattern_re = pattern.replace("*", ".*")
            if re.match(pattern_re, path):
                logger.warning(f"BLOCKED: {url} — path excluded: {pattern}")
                return False

        return True

    def check_method(self, method: str) -> bool:
        """Check if HTTP method is allowed."""
        return method.upper() in self.config.allowed_methods

    def throttle(self):
        """Rate limiting — blocks until safe to send next request."""
        if self.config.max_requests_per_second <= 0:
            return

        min_interval = 1.0 / self.config.max_requests_per_second
        elapsed = time.time() - self._last_request_time
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)

        self._last_request_time = time.time()
        self.request_count += 1

    def can_continue(self) -> bool:
        """Check if we haven't hit the max request limit."""
        return self.request_count < self.config.max_total_requests

    def log_request(self, method: str, url: str, payload: str | None = None):
        """Audit log for every request."""
        entry = {
            "timestamp": time.time(),
            "method": method,
            "url": url,
            "payload_preview": (payload[:100] + "...") if payload and len(payload) > 100 else payload,
            "request_number": self.request_count,
        }
        self._request_log.append(entry)
        logger.debug(f"REQ #{self.request_count}: {method} {url}")

    def get_audit_log(self) -> list[dict]:
        return self._request_log.copy()

    @classmethod
    def from_target(cls, target: str, rps: float = 10.0) -> "ScopeEnforcer":
        """Create a scope enforcer from a target URL."""
        domain = urlparse(target).netloc.lower()
        config = ScopeConfig(
            allowed_domains=[domain],
            max_requests_per_second=rps,
        )
        return cls(config)
