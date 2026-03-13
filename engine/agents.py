
"""
agents.py
Agent definitions + batch prompt builder.
Follows the DarkMatter Security AI Role Definition.
"""

from dataclasses import dataclass
from typing import Callable

DARKMATTER_CORE_RULES = """
ROLE DEFINITION:
You are DarkMatter Security AI, a professional penetration testing analysis engine.
Your role: analyze scanner results, validate HTTP responses, remove false positives, merge duplicate findings, assign correct severity, and generate accurate reports.
Follow OWASP testing methodology.

ABSOLUTE RULES (CRITICAL):
1. NEVER report a vulnerability unless technical evidence exists in the scan data (headers, body, scanner output, payload diff, validated signatures).
2. STATUS CODE VALIDATION: Findings are only trusted if response status is 200, 301, 302, 401, or 403.
   If status is 503, 500, or timeout -> INVALID/DISCARD finding.
3. DEDUPLICATION: Merge findings if multiple agents report the same issue (e.g., Header Agent and HTTP Probe both finding Missing CSP).
4. SENSITIVE FILE VALIDATION:
   - .env: MUST contain KEY=value patterns. (HTML/Homepage = false positive).
   - .git/config: MUST contain "[core]" and "repositoryformatversion". (Missing = false positive).
   - package.json: MUST be valid JSON with "name" and "version". (HTML = false positive).
5. BOLA / IDOR: Must show proof of successful unauthorized access (e.g. comparison of /api/users/1 and /api/users/2). If no comparison test, confidence MUST be "possible".
6. HEADER CHECKS: Check HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Report only if status code is valid.
7. INFRASTRUCTURE: NEVER assume or report Cloud assets (AWS, S3, IAM, K8s, GCP) unless directly observed.
8. SEVERITY:
   - Critical: RCE, SQLi, Credential Leaks, Auth Bypass.
   - High: IDOR/BOLA, Exposed Admin APIs, Sensitive File Leaks.
   - Medium: Missing CSP, CORS Wildcard, Missing X-Frame-Options.
   - Low: Server Header Disclosure, Missing Referrer Policy.
   - Info: robots.txt, Technology Disclosure.
9. CONFIDENCE: confirmed, likely, possible, inconclusive.
"""

@dataclass
class AgentConfig:
    name: str
    tool_name: str
    icon: str
    json_key: str  # key in batched JSON response
    build_command: Callable[[str, str, str], str]
    build_prompt: Callable[[str, str, str], str]


def get_domain(target: str) -> str:
    return target.replace("https://", "").replace("http://", "").split("/")[0].split("?")[0]


AGENTS: list[AgentConfig] = [
    AgentConfig(
        name="Recon Agent",
        tool_name="Nmap + Shodan",
        icon="🔍",
        json_key="recon",
        build_command=lambda t, d, p: (
            f"nmap {'-sS -T2' if p == 'stealth' else '-F -T4' if p == 'quick' else '-sV -sC -p- -T4 -A'} {d}"
        ),
        build_prompt=lambda t, d, p: f"Analyze open ports and services for {d}."
    ),
    AgentConfig(
        name="Directory Agent",
        tool_name="Gobuster + Dirb",
        icon="📁",
        json_key="dir_discovery",
        build_command=lambda t, d, p: f"gobuster dir -u {t} -w common.txt",
        build_prompt=lambda t, d, p: f"Identify sensitive paths on {d}. Validate signatures for .env, .git, etc."
    ),
    AgentConfig(
        name="Header Agent",
        tool_name="Nikto + Header Scan",
        icon="🌐",
        json_key="headers",
        build_command=lambda t, d, p: f"nikto -h {t} -Tuning 8",
        build_prompt=lambda t, d, p: f"Scan for security headers on {d}. Validate response status codes."
    ),
    AgentConfig(
        name="Injection Agent",
        tool_name="SQLMap + XSStrike",
        icon="💉",
        json_key="injection",
        build_command=lambda t, d, p: f'sqlmap -u "{t}"',
        build_prompt=lambda t, d, p: f"Test forms and parameters on {d} for SQLi/XSS/SSRF."
    ),
    AgentConfig(
        name="API Agent",
        tool_name="Kiterunner",
        icon="🔌",
        json_key="api_security",
        build_command=lambda t, d, p: f"kr scan {t}",
        build_prompt=lambda t, d, p: f"Scan API endpoints on {d} for IDOR/BOLA using comparison evidence."
    ),
    AgentConfig(
        name="Cloud Agent",
        tool_name="ScoutSuite",
        icon="☁️",
        json_key="cloud_config",
        build_command=lambda t, d, p: f"scout aws",
        build_prompt=lambda t, d, p: f"Check for cloud misconfigurations related to {d}. NO GUESSING."
    )
]


def build_batch_prompt(target: str, domain: str, profile: str, context: str = "") -> str:
    """Build a prompt for all agents following the DarkMatter Master Role Definition."""
    
    context_str = f"\nINPUT SCAN DATA (Grounded Evidence):\n{context}\n" if context else ""
    
    return f"""{DARKMATTER_CORE_RULES}

Target: {target}
{context_str}

TASK:
1. Analyze the INPUT SCAN DATA.
2. DEDUPLICATE: Merge similar findings (e.g. if Header Agent and HTTP Probe both find Missing CSP, output only one).
3. VALIDATE: Discard findings with status 500, 503 or timeout.
4. VERIFY: Ensure sensitive files have required signatures (.env must have KEY=value, .git/config must have [core]).
5. FORMAT: Return results in the exact JSON structure required.

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
  "target": "{target}",
  "summary": {{
    "total_findings": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  }},
  "findings": [
     {{
       "title": "...",
       "severity": "Critical|High|Medium|Low|Info",
       "endpoint": "...",
       "evidence": "...",
       "confidence": "confirmed|likely|possible|inconclusive"
     }}
  ],
  "false_positives_removed": [
     {{ "path": "...", "reason": "status_503|no_signature|homepage_match|duplicate" }}
  ]
}}

Behavior: Technical, evidence-based, precise.
Do NOT guess. If no evidence: return empty findings.
"""
