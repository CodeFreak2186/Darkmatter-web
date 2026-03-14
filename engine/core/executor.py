"""
executor.py — HTTP request execution engine.
Handles session management, authentication, rate limiting, proxy support,
and supports REST, GraphQL, WebSocket, and file upload testing.
"""

from __future__ import annotations
import time
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from core.scope import ScopeEnforcer

logger = logging.getLogger("darkmatter.executor")


@dataclass
class AuthConfig:
    """Authentication configuration."""
    auth_type: str = "none"           # none, bearer, basic, cookie, custom_header
    token: str = ""
    username: str = ""
    password: str = ""
    cookie_name: str = ""
    cookie_value: str = ""
    header_name: str = ""
    header_value: str = ""


@dataclass
class FuzzRequest:
    """A request to be sent by the executor."""
    url: str
    method: str = "GET"
    params: dict[str, str] | None = None
    headers: dict[str, str] | None = None
    body: str | None = None
    json_body: dict | None = None
    content_type: str | None = None
    payload_info: str = ""              # description of what we're testing


@dataclass
class FuzzResponse:
    """Response from a fuzz request."""
    status_code: int
    headers: dict[str, str]
    body: str
    elapsed_ms: float
    content_length: int
    request: FuzzRequest
    error: str | None = None

    @property
    def is_error(self) -> bool:
        return self.status_code >= 500

    @property
    def is_redirect(self) -> bool:
        return 300 <= self.status_code < 400

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300


class RequestExecutor:
    """Executes fuzz requests with session management, auth, and rate limiting."""

    def __init__(
        self,
        scope: ScopeEnforcer,
        auth: AuthConfig | None = None,
        proxy: str | None = None,
        timeout: float = 10.0,
        verify_ssl: bool = False,
    ):
        self.scope = scope
        self.auth = auth or AuthConfig()
        self.proxy = proxy
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self._session_cookies: dict[str, str] = {}
        self._request_count = 0
        self._error_count = 0

    def _build_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        """Build headers with auth and defaults."""
        headers = {
            "User-Agent": "Darkmatter-Fuzzer/3.0 (Security Research)",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # Auth headers
        if self.auth.auth_type == "bearer":
            headers["Authorization"] = f"Bearer {self.auth.token}"
        elif self.auth.auth_type == "basic":
            import base64
            creds = base64.b64encode(f"{self.auth.username}:{self.auth.password}".encode()).decode()
            headers["Authorization"] = f"Basic {creds}"
        elif self.auth.auth_type == "custom_header":
            headers[self.auth.header_name] = self.auth.header_value

        if extra:
            headers.update(extra)
        return headers

    def _build_cookies(self) -> dict[str, str]:
        cookies = dict(self._session_cookies)
        if self.auth.auth_type == "cookie":
            cookies[self.auth.cookie_name] = self.auth.cookie_value
        return cookies

    def execute(self, req: FuzzRequest) -> FuzzResponse:
        """Execute a single fuzz request (synchronous)."""
        # Scope check
        if not self.scope.is_in_scope(req.url):
            return FuzzResponse(
                status_code=0, headers={}, body="", elapsed_ms=0,
                content_length=0, request=req, error="Out of scope",
            )

        if not self.scope.can_continue():
            return FuzzResponse(
                status_code=0, headers={}, body="", elapsed_ms=0,
                content_length=0, request=req, error="Max requests reached",
            )

        # Rate limiting
        self.scope.throttle()

        headers = self._build_headers(req.headers)
        cookies = self._build_cookies()

        if req.content_type:
            headers["Content-Type"] = req.content_type

        try:
            start = time.time()
            with httpx.Client(
                timeout=self.timeout,
                verify=self.verify_ssl,
                follow_redirects=False,
                proxy=self.proxy,
            ) as client:
                if req.method.upper() == "GET":
                    resp = client.get(req.url, params=req.params, headers=headers, cookies=cookies)
                elif req.method.upper() == "POST":
                    if req.json_body:
                        resp = client.post(req.url, json=req.json_body, headers=headers, cookies=cookies)
                    else:
                        resp = client.post(req.url, data=req.body or req.params, headers=headers, cookies=cookies)
                elif req.method.upper() == "PUT":
                    resp = client.put(req.url, data=req.body, headers=headers, cookies=cookies)
                elif req.method.upper() == "DELETE":
                    resp = client.delete(req.url, headers=headers, cookies=cookies)
                elif req.method.upper() == "PATCH":
                    resp = client.patch(req.url, data=req.body, headers=headers, cookies=cookies)
                else:
                    resp = client.request(req.method, req.url, headers=headers, cookies=cookies)

            elapsed = (time.time() - start) * 1000

            # Update session cookies
            for k, v in resp.cookies.items():
                self._session_cookies[k] = v

            self._request_count += 1
            self.scope.log_request(req.method, req.url, req.payload_info)

            return FuzzResponse(
                status_code=resp.status_code,
                headers=dict(resp.headers),
                body=resp.text,
                elapsed_ms=elapsed,
                content_length=len(resp.content),
                request=req,
            )

        except httpx.TimeoutException:
            self._error_count += 1
            return FuzzResponse(
                status_code=0, headers={}, body="", elapsed_ms=self.timeout * 1000,
                content_length=0, request=req, error="Timeout",
            )
        except Exception as e:
            self._error_count += 1
            return FuzzResponse(
                status_code=0, headers={}, body="", elapsed_ms=0,
                content_length=0, request=req, error=str(e),
            )

    def execute_batch(self, requests: list[FuzzRequest]) -> list[FuzzResponse]:
        """Execute multiple requests sequentially."""
        return [self.execute(r) for r in requests]

    @property
    def stats(self) -> dict[str, int]:
        return {"requests": self._request_count, "errors": self._error_count}
