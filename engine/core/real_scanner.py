"""
real_scanner.py — Real network-based security probe engine.
Performs ACTUAL checks against the target using Python requests/socket.
No simulated data. Every finding is grounded in a real HTTP response.
"""

import socket
import ssl
import json
import time
import asyncio
import re
from urllib.parse import urlparse, urljoin
from dataclasses import dataclass, field
from typing import Optional
import httpx


@dataclass
class RawFinding:
    severity: str
    title: str
    endpoint: str
    evidence: str          # The actual HTTP response / header / value proving this
    description: str
    recommendation: str
    tool: str


class RealScanner:
    """
    Performs actual HTTP/network tests against a target.
    Every finding is backed by a real network response (evidence).
    """

    COMMON_PATHS = [
        "/.env", "/.git/HEAD", "/.git/config", "/robots.txt", "/sitemap.xml",
        "/api", "/api/v1", "/api/v2", "/graphql", "/admin", "/login",
        "/wp-admin", "/wp-login.php", "/.well-known/security.txt",
        "/server-status", "/server-info", "/.htaccess", "/backup",
        "/config.json", "/phpinfo.php", "/debug", "/trace",
        "/actuator", "/actuator/health", "/swagger.json", "/openapi.json",
        "/.DS_Store", "/web.config", "/crossdomain.xml", "/package.json",
        "/.npmrc", "/.dockerignore", "/Dockerfile", "/docker-compose.yml",
        "/config.php", "/database.yml", "/credentials.json", "/secrets.json",
        "/user", "/users", "/users/1", "/admin/users", "/system/info",
    ]

    SECURITY_HEADERS = {
        "Strict-Transport-Security": ("high", "HSTS Missing — Forces HTTPS"),
        "X-Frame-Options": ("medium", "Clickjacking Protection Missing"),
        "X-Content-Type-Options": ("medium", "MIME Sniffing Attack Possible"),
        "Content-Security-Policy": ("medium", "No CSP — XSS easier to exploit"),
        "X-XSS-Protection": ("low", "XSS Browser Protection Disabled"),
        "Referrer-Policy": ("low", "Referrer Leakage Possible"),
        "Permissions-Policy": ("low", "No Permissions Policy"),
    }

    INTERESTING_HEADERS = [
        "X-Powered-By", "Server", "X-Generator", "X-AspNet-Version",
        "X-Runtime", "Via", "X-Cache",
    ]

    def __init__(self, target: str, timeout: float = 10.0):
        self.target = target.rstrip("/")
        self.timeout = timeout
        self.findings: list[RawFinding] = []
        self.session_headers = {
            "User-Agent": "Mozilla/5.0 (compatible; DarkmatterScanner/3.0)",
        }

    async def run_all(self, on_progress=None) -> list[RawFinding]:
        """Run all real checks and return findings."""
        def log(msg):
            if on_progress:
                on_progress("scan", msg)

        log("Starting real HTTP security scan...")

        async with httpx.AsyncClient(
            headers=self.session_headers,
            timeout=self.timeout,
            follow_redirects=True,
            verify=False,
        ) as client:
            log("Phase 1: Analysing response headers...")
            await self._check_headers(client, log)

            log("Phase 2: Probing common sensitive paths...")
            await self._check_exposed_paths(client, log)

            log("Phase 3: Testing CORS policy...")
            await self._check_cors(client, log)

            log("Phase 4: Checking cookie security flags...")
            await self._check_cookies(client, log)

            log("Phase 5: SSL/TLS certificate analysis...")
            await self._check_ssl(log)

            log("Phase 6: Testing open redirect...")
            await self._check_open_redirect(client, log)

            log("Phase 7: Checking for basic IDOR / BOLA...")
            await self._check_idor(client, log)

            log("Phase 8: Checking for server info disclosure...")
            await self._check_server_disclosure(client, log)

        log(f"Scan complete. {len(self.findings)} real findings discovered.")
        return self.findings

    async def _check_headers(self, client: httpx.AsyncClient, log):
        try:
            r = await client.get(self.target)
            headers = {k.lower(): v for k, v in r.headers.items()}

            # Missing security headers
            for header, (sev, title) in self.SECURITY_HEADERS.items():
                if header.lower() not in headers:
                    self.findings.append(RawFinding(
                        severity=sev,
                        title=title,
                        endpoint=self.target,
                        evidence=f"HTTP Response did not contain '{header}' header. Status: {r.status_code}",
                        description=f"The response from {self.target} is missing the '{header}' security header.",
                        recommendation=f"Add the '{header}' header to all server responses.",
                        tool="Header Inspector"
                    ))

            # Interesting tech disclosure headers
            for header in self.INTERESTING_HEADERS:
                val = headers.get(header.lower())
                if val:
                    self.findings.append(RawFinding(
                        severity="info",
                        title=f"Technology Disclosure: {header}",
                        endpoint=self.target,
                        evidence=f"{header}: {val}",
                        description=f"Server reveals technology stack via the '{header}' header.",
                        recommendation="Remove or obfuscate this header to reduce attack surface.",
                        tool="Header Inspector"
                    ))
                    log(f"  ↳ Found: {header}: {val}")

        except Exception as e:
            log(f"  ✗ Header check failed: {e}")

    async def _check_exposed_paths(self, client: httpx.AsyncClient, log):
        SENSITIVE_PATTERNS = [".env", ".git", "config", "secret", "backup",
                               "admin", "phpinfo", "debug", "actuator",
                               "swagger", "openapi", "package.json"]

        # Get homepage content for comparison (SPA detection)
        try:
            home_resp = await client.get(self.target)
            home_body = home_resp.text
            home_len = len(home_body)
        except Exception:
            home_body = ""
            home_len = 0

        tasks = [client.get(urljoin(self.target, path)) for path in self.COMMON_PATHS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        import typing
        for path, result in zip(self.COMMON_PATHS, results):
            if isinstance(result, Exception):
                continue
                
            res = typing.cast(httpx.Response, result)
            url = str(res.url)

            if res.status_code == 200:
                body = res.text
                
                # Check for False Positives (SPA Routing)
                if len(body) == home_len or (home_len > 0 and abs(len(body) - home_len) < 50):
                    continue
                if "<!doctype html" in body.lower()[:100] and path not in ["/admin", "/login", "/wp-admin"]:
                    # Sensitive files shouldn't be HTML
                    if any(x in path for x in [".env", ".git", "config", "json", "yml", "xml", "Store"]):
                        continue

                # Phase 4: Strict Payload Verification
                if ".env" in path and "=" not in body: continue
                if ".git/config" in path and "[core]" not in body: continue
                if ".git/HEAD" in path and "ref:" not in body: continue
                if "package.json" in path:
                    try: json.loads(body)
                    except: continue

                body_preview = body[:300].strip()
                is_sensitive = any(p in path for p in SENSITIVE_PATTERNS)
                sev = "critical" if is_sensitive else "medium"

                self.findings.append(RawFinding(
                    severity=sev,
                    title=f"Exposed Path: {path}",
                    endpoint=url,
                    evidence=f"HTTP {res.status_code} — Body Preview: {body_preview[:200]}",
                    description=f"The path '{path}' returned HTTP 200 and passed content validation.",
                    recommendation=f"Restrict access to '{path}' or remove it from the server.",
                    tool="Path Prober"
                ))
                log(f"  ↳ [FOUND 200] {url}")

    async def _check_cors(self, client: httpx.AsyncClient, log):
        try:
            r = await client.get(self.target, headers={"Origin": "https://evil.com"})
            acao = r.headers.get("Access-Control-Allow-Origin", "")
            acac = r.headers.get("Access-Control-Allow-Credentials", "")

            if acao == "*":
                self.findings.append(RawFinding(
                    severity="high",
                    title="CORS Wildcard — Cross-Origin Access Open",
                    endpoint=self.target,
                    evidence=f"Access-Control-Allow-Origin: {acao}",
                    description="Server allows all origins. An attacker can read API responses from any website.",
                    recommendation="Restrict CORS to trusted domains only.",
                    tool="CORS Checker"
                ))
                log(f"  ↳ CORS Wildcard found!")

            elif "evil.com" in acao:
                sev = "critical" if "true" in acac.lower() else "high"
                self.findings.append(RawFinding(
                    severity=sev,
                    title="CORS Misconfiguration — Arbitrary Origin Reflected",
                    endpoint=self.target,
                    evidence=f"Access-Control-Allow-Origin: {acao}\nAccess-Control-Allow-Credentials: {acac}",
                    description="Server reflects back our evil.com origin. If credentials=true, this is fully exploitable.",
                    recommendation="Validate 'Origin' against a strict allowlist.",
                    tool="CORS Checker"
                ))
                log(f"  ↳ CORS Origin Reflection found!")

        except Exception as e:
            log(f"  ✗ CORS check failed: {e}")

    async def _check_cookies(self, client: httpx.AsyncClient, log):
        try:
            r = await client.get(self.target)
            for cookie in r.cookies.jar:
                issues = []
                if not cookie.secure:
                    issues.append("missing Secure flag")
                if not cookie.has_nonstandard_attr("HttpOnly"):
                    issues.append("missing HttpOnly flag")
                if not cookie.has_nonstandard_attr("SameSite"):
                    issues.append("missing SameSite flag")

                if issues:
                    self.findings.append(RawFinding(
                        severity="medium",
                        title=f"Insecure Cookie: {cookie.name}",
                        endpoint=self.target,
                        evidence=f"Cookie '{cookie.name}' is {', '.join(issues)}.",
                        description=f"Session cookie '{cookie.name}' lacks security flags: {', '.join(issues)}.",
                        recommendation="Set Secure, HttpOnly, and SameSite=Strict on all cookies.",
                        tool="Cookie Analyzer"
                    ))
                    log(f"  ↳ Insecure cookie: {cookie.name} ({', '.join(issues)})")

        except Exception as e:
            log(f"  ✗ Cookie check failed: {e}")

    async def _check_ssl(self, log):
        parsed = urlparse(self.target)
        host = parsed.hostname
        port = parsed.port or 443

        if parsed.scheme != "https":
            self.findings.append(RawFinding(
                severity="high",
                title="No HTTPS — Plaintext Communication",
                endpoint=self.target,
                evidence=f"Target URL uses scheme: {parsed.scheme}",
                description="The target does not use HTTPS. All traffic is plaintext and susceptible to MITM.",
                recommendation="Deploy a TLS certificate and force HTTPS redirects.",
                tool="SSL Checker"
            ))
            return

        try:
            ctx = ssl.create_default_context()
            conn = await asyncio.to_thread(
                lambda: ctx.wrap_socket(
                    socket.create_connection((host, port), timeout=self.timeout),
                    server_hostname=host
                )
            )
            cert = conn.getpeercert()
            conn.close()

            # Check expiry
            expire_str = cert.get("notAfter", "")
            from datetime import datetime
            if expire_str:
                expire = datetime.strptime(expire_str, "%b %d %H:%M:%S %Y %Z")
                days_left = (expire - datetime.utcnow()).days
                if days_left < 30:
                    self.findings.append(RawFinding(
                        severity="high",
                        title=f"SSL Certificate Expires in {days_left} Days",
                        endpoint=host,
                        evidence=f"Certificate notAfter: {expire_str}",
                        description=f"The TLS certificate for {host} expires in {days_left} days.",
                        recommendation="Renew the SSL certificate immediately.",
                        tool="SSL Checker"
                    ))
                    log(f"  ↳ SSL cert expires in {days_left} days!")
                else:
                    log(f"  ↳ SSL cert valid. Expires: {expire_str} ({days_left} days left)")

        except ssl.SSLError as e:
            self.findings.append(RawFinding(
                severity="high",
                title="SSL Error Detected",
                endpoint=host,
                evidence=str(e),
                description=f"SSL handshake error: {e}",
                recommendation="Check the TLS configuration for the server.",
                tool="SSL Checker"
            ))
        except Exception as e:
            log(f"  ✗ SSL check failed: {e}")

    async def _check_open_redirect(self, client: httpx.AsyncClient, log):
        test_urls = [
            f"{self.target}/?redirect=https://evil.com",
            f"{self.target}/redirect?url=https://evil.com",
            f"{self.target}/login?next=https://evil.com",
            f"{self.target}/out?dest=https://evil.com",
        ]
        for url in test_urls:
            try:
                r = await client.get(url, follow_redirects=False)
                location = r.headers.get("Location", "")
                if "evil.com" in location:
                    self.findings.append(RawFinding(
                        severity="high",
                        title="Open Redirect Detected",
                        endpoint=url,
                        evidence=f"HTTP {r.status_code} — Location: {location}",
                        description="Server redirects to attacker-controlled URL without validation.",
                        recommendation="Validate redirect destinations against a strict allowlist.",
                        tool="Redirect Prober"
                    ))
                    log(f"  ↳ Open redirect at: {url}")
                    break
            except Exception:
                pass

    async def _check_idor(self, client: httpx.AsyncClient, log):
        """Probe for basic IDOR patterns."""
        idor_paths = [
            "/api/v1/users/1", "/api/v1/users/2", "/api/users/1",
            "/user/1", "/user/2", "/profile/1",
            "/api/v1/orders/1", "/api/v1/products/1",
        ]
        for path in idor_paths:
            url = urljoin(self.target, path)
            try:
                r = await client.get(url)
                if r.status_code == 200 and len(r.text) > 50:
                    try:
                        data = r.json()
                        # If it returned structured data without auth, likely IDOR
                        self.findings.append(RawFinding(
                            severity="high",
                            title=f"Potential BOLA/IDOR at {path}",
                            endpoint=url,
                            evidence=f"HTTP 200 — Response: {str(data)[:300]}",
                            description=f"Unauthenticated access to user-specific data at '{path}'.",
                            recommendation="Enforce object-level authorization checks.",
                            tool="IDOR Prober"
                        ))
                        log(f"  ↳ Potential IDOR: {url}")
                    except Exception:
                        pass
            except Exception:
                pass

    async def _check_server_disclosure(self, client: httpx.AsyncClient, log):
        try:
            r = await client.get(self.target)
            # Check for error-based disclosure
            error_patterns = [
                "stack trace", "traceback", "exception", "mysql_fetch",
                "ORA-", "pg_connect", "Fatal error", "Warning:", "undefined index",
                "SQL syntax", "You have an error in your SQL"
            ]
            body = r.text.lower()
            for pattern in error_patterns:
                if pattern.lower() in body:
                    self.findings.append(RawFinding(
                        severity="high",
                        title=f"Error/Debug Information Disclosure",
                        endpoint=self.target,
                        evidence=f"Body contains '{pattern}' — may expose stack trace or DB errors",
                        description=f"The page at {self.target} appears to leak debug/error information.",
                        recommendation="Disable debug mode and configure proper error handling.",
                        tool="Disclosure Detector"
                    ))
                    log(f"  ↳ Debug disclosure: '{pattern}'")
                    break
        except Exception as e:
            log(f"  ✗ Server disclosure check failed: {e}")


def findings_to_dict(findings: list[RawFinding]) -> list[dict]:
    return [{
        "severity": f.severity,
        "title": f.title,
        "endpoint": f.endpoint,
        "evidence": f.evidence,
        "description": f.description,
        "recommendation": f.recommendation,
        "tool": f.tool,
        "cvss": {"critical": 9.5, "high": 7.5, "medium": 5.0, "low": 2.5, "info": 0.0}.get(f.severity, 0.0),
    } for f in findings]
