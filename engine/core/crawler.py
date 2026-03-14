"""
crawler.py — Attack surface discovery.
Crawls target, extracts endpoints, forms, parameters, JS-discovered routes,
API paths, and builds a complete attack surface map.
"""

from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse, parse_qs
from typing import Any

import httpx

logger = logging.getLogger("darkmatter.crawler")


@dataclass
class FormField:
    """A form input field."""
    name: str
    field_type: str            # text, password, hidden, file, email, number, etc.
    value: str | None = None   # default/pre-filled value
    required: bool = False
    pattern: str | None = None # HTML pattern attribute


@dataclass
class FormTarget:
    """A discovered HTML form."""
    action: str
    method: str
    fields: list[FormField] = field(default_factory=list)
    enctype: str = "application/x-www-form-urlencoded"


@dataclass
class Endpoint:
    """A discovered endpoint with its parameters."""
    url: str
    method: str = "GET"
    params: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    body: str | None = None
    content_type: str | None = None
    source: str = "crawl"       # crawl, js, form, api, sitemap
    depth: int = 0
    forms: list[FormTarget] = field(default_factory=list)


@dataclass
class AttackSurface:
    """Complete attack surface for a target."""
    target: str
    endpoints: list[Endpoint] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)
    cookies: dict[str, str] = field(default_factory=dict)
    response_headers: dict[str, str] = field(default_factory=dict)
    js_files: list[str] = field(default_factory=list)
    api_paths: list[str] = field(default_factory=list)


class Crawler:
    """Attack surface discovery engine."""

    # Patterns to extract from HTML/JS
    LINK_PATTERN = re.compile(r'href=["\']([^"\']+)["\']', re.I)
    FORM_PATTERN = re.compile(
        r'<form[^>]*action=["\']?([^"\'>\s]*)["\']?[^>]*method=["\']?(\w+)["\']?[^>]*>(.*?)</form>',
        re.I | re.S,
    )
    INPUT_PATTERN = re.compile(
        r'<input[^>]*name=["\']([^"\']+)["\'][^>]*type=["\']?(\w+)?["\']?[^>]*/?>',
        re.I,
    )
    JS_SRC_PATTERN = re.compile(r'<script[^>]*src=["\']([^"\']+)["\']', re.I)
    JS_API_PATTERN = re.compile(
        r"""(?:fetch|axios\.(?:get|post|put|delete|patch)|\.ajax|XMLHttpRequest)\s*\(\s*[`"']([^`"']+)[`"']""",
        re.I,
    )
    JS_ROUTE_PATTERN = re.compile(
        r"""["\']/(api|v\d|graphql|rest|auth|user|admin|dashboard|search|upload|download|webhook)[^"\']*["\']""",
        re.I,
    )

    def __init__(self, max_depth: int = 3, timeout: float = 10.0):
        self.max_depth = max_depth
        self.timeout = timeout
        self.visited: set[str] = set()

    async def crawl(self, target: str) -> AttackSurface:
        """Crawl target and build attack surface."""
        surface = AttackSurface(target=target)

        async with httpx.AsyncClient(
            timeout=self.timeout, follow_redirects=True, verify=False,
        ) as client:
            await self._crawl_url(client, target, surface, depth=0)

        # Deduplicate
        seen_urls = set()
        unique = []
        for ep in surface.endpoints:
            key = f"{ep.method}:{ep.url}"
            if key not in seen_urls:
                seen_urls.add(key)
                unique.append(ep)
        # Add common endpoints for basic probing
        base_url = surface.target.rstrip("/")
        for path in COMMON_ENDPOINTS:
            ep_url = f"{base_url}{path}"
            if ep_url not in seen_urls:
                seen_urls.add(ep_url)
                unique.append(Endpoint(url=ep_url, source="probe", depth=0))

        surface.endpoints = unique

        logger.info(
            f"Crawl complete: {len(surface.endpoints)} endpoints, "
            f"{len(surface.js_files)} JS files, {len(surface.api_paths)} API paths"
        )
        return surface

    async def _crawl_url(
        self, client: httpx.AsyncClient, url: str, surface: AttackSurface, depth: int,
    ):
        """Recursively crawl a URL."""
        if depth > self.max_depth or url in self.visited:
            return
        self.visited.add(url)

        try:
            resp = await client.get(url)
        except Exception as e:
            logger.debug(f"Failed to fetch {url}: {e}")
            return

        body = resp.text
        base_domain = urlparse(surface.target).netloc

        # Capture response headers & cookies
        if depth == 0:
            surface.response_headers = dict(resp.headers)
            surface.cookies = dict(resp.cookies)
            surface.technologies = self._detect_tech(resp)

        # Extract links
        for match in self.LINK_PATTERN.finditer(body):
            href = match.group(1)
            full_url = urljoin(url, href)
            parsed = urlparse(full_url)
            if parsed.netloc == base_domain and full_url not in self.visited:
                params = {k: v[0] for k, v in parse_qs(parsed.query).items()} if parsed.query else {}
                surface.endpoints.append(Endpoint(
                    url=full_url.split("?")[0], method="GET",
                    params=params, source="crawl", depth=depth + 1,
                ))
                if depth + 1 <= self.max_depth:
                    await self._crawl_url(client, full_url, surface, depth + 1)

        # Extract forms
        for form_match in self.FORM_PATTERN.finditer(body):
            action = urljoin(url, form_match.group(1) or url)
            method = (form_match.group(2) or "GET").upper()
            form_html = form_match.group(3)
            fields = []
            for inp in self.INPUT_PATTERN.finditer(form_html):
                fields.append(FormField(
                    name=inp.group(1),
                    field_type=inp.group(2) or "text",
                ))
            form = FormTarget(action=action, method=method, fields=fields)
            surface.endpoints.append(Endpoint(
                url=action, method=method, source="form", depth=depth,
                forms=[form],
                params={f.name: f.value or "" for f in fields},
            ))

        # Extract JS files
        for js_match in self.JS_SRC_PATTERN.finditer(body):
            js_url = urljoin(url, js_match.group(1))
            if js_url not in surface.js_files:
                surface.js_files.append(js_url)
                await self._parse_js(client, js_url, surface)

        # Inline JS API paths
        for api_match in self.JS_API_PATTERN.finditer(body):
            path = api_match.group(1)
            full = urljoin(url, path)
            if full not in surface.api_paths:
                surface.api_paths.append(full)
                surface.endpoints.append(Endpoint(
                    url=full, method="GET", source="js", depth=depth,
                ))

        for route_match in self.JS_ROUTE_PATTERN.finditer(body):
            path = "/" + route_match.group(0).strip("\"'")
            full = urljoin(url, path)
            if full not in surface.api_paths:
                surface.api_paths.append(full)
                surface.endpoints.append(Endpoint(
                    url=full, method="GET", source="js", depth=depth,
                ))

    async def _parse_js(self, client: httpx.AsyncClient, js_url: str, surface: AttackSurface):
        """Parse a JS file for API endpoints."""
        try:
            resp = await client.get(js_url)
            body = resp.text
            base = surface.target

            for match in self.JS_API_PATTERN.finditer(body):
                path = match.group(1)
                full = urljoin(base, path)
                if full not in surface.api_paths:
                    surface.api_paths.append(full)
                    surface.endpoints.append(Endpoint(
                        url=full, method="GET", source="js", depth=0,
                    ))

            for match in self.JS_ROUTE_PATTERN.finditer(body):
                raw = match.group(0).strip("\"'")
                full = urljoin(base, raw)
                if full not in surface.api_paths:
                    surface.api_paths.append(full)
                    surface.endpoints.append(Endpoint(
                        url=full, method="GET", source="js", depth=0,
                    ))
        except Exception:
            pass

    def _detect_tech(self, resp: httpx.Response) -> list[str]:
        """Detect technologies from response headers."""
        techs = []
        headers = {k.lower(): v for k, v in resp.headers.items()}
        if "x-powered-by" in headers:
            techs.append(headers["x-powered-by"])
        if "server" in headers:
            techs.append(headers["server"])
        body = resp.text.lower()
        tech_sigs = {
            "react": "react", "next.js": "__next", "vue": "vue",
            "angular": "ng-", "django": "csrfmiddlewaretoken",
            "laravel": "laravel_session", "wordpress": "wp-content",
            "express": "express", "flask": "werkzeug",
        }
        for name, sig in tech_sigs.items():
            if sig in body or sig in str(headers):
                techs.append(name)
        return list(set(techs))


# ── Common endpoints to always probe ──

COMMON_ENDPOINTS = [
    "/.env", "/.git/HEAD", "/.git/config", "/robots.txt", "/sitemap.xml",
    "/api", "/api/v1", "/api/v2", "/graphql", "/admin", "/login",
    "/wp-admin", "/wp-login.php", "/.well-known/security.txt",
    "/server-status", "/server-info", "/.htaccess", "/backup",
    "/config.php", "/phpinfo.php", "/debug", "/trace", "/actuator",
    "/actuator/health", "/swagger.json", "/openapi.json",
    "/.DS_Store", "/web.config", "/crossdomain.xml",
]
