"""
agents.py
Agent definitions + batch prompt builder.
"""

from dataclasses import dataclass
from typing import Callable


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
        name="Nmap Agent",
        tool_name="Nmap + Shodan",
        icon="🔍",
        json_key="nmap",
        build_command=lambda t, d, p: (
            f"nmap {'-sS -T2' if p == 'stealth' else '-F -T4' if p == 'quick' else '-sV -sC -p- -T4 -A'} "
            f"--script=vuln,default,http-enum {d}"
        ),
        build_prompt=lambda t, d, p: f"""You are an Nmap/Shodan security agent. Simulate a full port scan of {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of nmap output",
  "ports": [{{"port":80,"protocol":"tcp","state":"open","service":"http","version":"nginx/1.24","risk":"low"}}],
  "findings": [{{"severity":"high","title":"Vuln","endpoint":"22/tcp","description":"1 sentence","recommendation":"1 sentence","cvss":7.5,"tool":"Nmap/Shodan","cve":"CVE-XXXX-XXXXX"}}]
}}
Rules: 5-8 ports, 2-4 findings. severity=critical|high|medium|low|info. Keep ALL strings SHORT.""",
    ),
    AgentConfig(
        name="Dirb Agent",
        tool_name="Gobuster + Dirb",
        icon="📁",
        json_key="dirb",
        build_command=lambda t, d, p: (
            f"gobuster dir -u {t} -w "
            f"{'/usr/share/wordlists/dirb/common.txt' if p == 'quick' else '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt'} "
            f"-x php,html,js,json,txt,bak,env,config -t 50 -k"
        ),
        build_prompt=lambda t, d, p: f"""You are a Gobuster/Dirb directory enumeration agent scanning {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of gobuster output",
  "directories": [{{"path":"/admin","status":200,"size":4821,"type":"directory","interesting":true}}],
  "findings": [{{"severity":"high","title":"Vuln","endpoint":"/admin","description":"1 sentence","recommendation":"1 sentence","cvss":8.1,"tool":"Gobuster"}}]
}}
Rules: 8-15 directories, 3-4 findings.""",
    ),
    AgentConfig(
        name="Nikto Agent",
        tool_name="Nikto + WhatWeb",
        icon="🌐",
        json_key="nikto",
        build_command=lambda t, d, p: f"nikto -h {t} -ssl -Tuning 123456789abc -maxtime 300s && whatweb -a 3 {t}",
        build_prompt=lambda t, d, p: f"""You are a Nikto/WhatWeb scanner scanning {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of Nikto output with OSVDB IDs",
  "findings": [{{"severity":"medium","title":"Missing CSP","endpoint":"/","description":"1 sentence","recommendation":"1 sentence","cvss":5.3,"tool":"Nikto"}}]
}}
Rules: 3-5 findings about headers, tech disclosure.""",
    ),
    AgentConfig(
        name="SQLMap Agent",
        tool_name="SQLMap + XSStrike",
        icon="💉",
        json_key="sqlmap",
        build_command=lambda t, d, p: (
            f'sqlmap -u "{t}/?id=1" --dbs --level=5 --risk=3 --batch --forms --random-agent '
            f'&& python3 XSStrike/xsstrike.py -u "{t}"'
        ),
        build_prompt=lambda t, d, p: f"""You are a SQLMap/XSStrike injection agent scanning {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of sqlmap output",
  "findings": [{{"severity":"critical","title":"SQL Injection","endpoint":"/?id=1","description":"1 sentence with payload","recommendation":"1 sentence","cvss":9.8,"tool":"SQLMap","cve":"CVE-XXXX-XXXXX"}}]
}}
Rules: 2-4 findings covering SQLi, XSS, SSTI.""",
    ),
    AgentConfig(
        name="Metasploit Agent",
        tool_name="Metasploit + Hydra",
        icon="⚡",
        json_key="metasploit",
        build_command=lambda t, d, p: (
            f'msfconsole -q -x "use auxiliary/scanner/http/http_login; set RHOSTS {d}; run" '
            f'&& hydra -L users.txt -P pass.txt {d} http-post-form "/login:u=^USER^&p=^PASS^:F=fail"'
        ),
        build_prompt=lambda t, d, p: f"""You are a Metasploit/Hydra exploit agent targeting {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of msf6 output",
  "findings": [{{"severity":"critical","title":"Default Creds","endpoint":"/admin/login","description":"1 sentence","recommendation":"1 sentence","cvss":9.8,"tool":"Metasploit/Hydra"}}]
}}
Rules: 2-4 findings about default creds, JWT, sessions.""",
    ),
    AgentConfig(
        name="SSL Agent",
        tool_name="testssl + SSLScan",
        icon="🔒",
        json_key="ssl",
        build_command=lambda t, d, p: f"testssl.sh --full --color 0 {d}:443 && sslscan --no-colour {d}",
        build_prompt=lambda t, d, p: f"""You are a testssl/SSLScan TLS agent scanning {d}:443 ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of testssl.sh output",
  "findings": [{{"severity":"high","title":"TLS 1.0","endpoint":":443","description":"1 sentence","recommendation":"1 sentence","cvss":7.4,"tool":"testssl/SSLScan","cve":"CVE-2014-3566"}}]
}}
Rules: 2-4 findings about weak TLS, HSTS, cert, ciphers.""",
    ),
    AgentConfig(
        name="OSINT Agent",
        tool_name="Amass + theHarvester",
        icon="🕵️",
        json_key="osint",
        build_command=lambda t, d, p: f"amass enum -passive -d {d} -o subdomains.txt && theHarvester -d {d} -b all -l 200",
        build_prompt=lambda t, d, p: f"""You are an Amass/theHarvester OSINT agent scanning {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of amass + theHarvester output",
  "findings": [{{"severity":"high","title":"Dev Subdomain","endpoint":"dev.{d}","description":"1 sentence","recommendation":"1 sentence","cvss":7.5,"tool":"Amass"}}]
}}
Rules: 2-4 findings about subdomains, DNS, emails.""",
    ),
    AgentConfig(
        name="Burp Agent",
        tool_name="Burp Suite + CORS/Header",
        icon="🛡️",
        json_key="burp",
        build_command=lambda t, d, p: f"curl -sI {t} | head -40 && python3 cors_scanner.py -u {t} && python3 ssrf_scanner.py -u {t}",
        build_prompt=lambda t, d, p: f"""You are a Burp Suite scanner analyzing headers, CORS, SSRF for {d} ({t}).
Return ONLY valid JSON, no markdown:
{{
  "toolOutput": "5-8 lines of HTTP headers + CORS/SSRF scan",
  "findings": [{{"severity":"high","title":"CORS Wildcard","endpoint":"/api/","description":"1 sentence","recommendation":"1 sentence","cvss":8.1,"tool":"Burp/CORS Scanner"}}]
}}
Rules: 2-4 findings about CORS, SSRF, redirects, headers.""",
    ),
]


def build_batch_prompt(target: str, domain: str, profile: str) -> str:
    """Build a single prompt that asks for ALL 8 agents in one JSON response."""
    return f"""You are an AI Red Team conducting a comprehensive penetration test. Be CONCISE.
Target: {target}  |  Domain: {domain}  |  Profile: {profile}

CRITICAL RULES:
- Respond ONLY with a single valid JSON object. No markdown fences, no extra text.
- Keep EVERY toolOutput to 5 lines MAX. Short sentences.
- Keep ALL description/recommendation fields to 1 sentence MAX.
- The entire response must stay under 6000 tokens.

Return this JSON structure (fill in realistic values for {domain}):
{{
  "nmap": {{
    "toolOutput": "5 lines nmap output",
    "ports": [{{"port":80,"protocol":"tcp","state":"open","service":"http","version":"nginx/1.24","risk":"low"}}],
    "findings": [{{"severity":"high","title":"SSH Exposed","endpoint":"22/tcp","description":"1 sentence","recommendation":"1 sentence","cvss":7.5,"tool":"Nmap","cve":"CVE-2023-38408"}}]
  }},
  "dirb": {{
    "toolOutput": "5 lines gobuster output",
    "directories": [{{"path":"/admin","status":200,"size":4821,"type":"directory","interesting":true}}],
    "findings": [{{"severity":"critical","title":"Exposed .git","endpoint":"/.git","description":"1 sentence","recommendation":"1 sentence","cvss":9.1,"tool":"Gobuster"}}]
  }},
  "nikto": {{
    "toolOutput": "5 lines nikto output",
    "findings": [{{"severity":"medium","title":"Missing CSP","endpoint":"/","description":"1 sentence","recommendation":"1 sentence","cvss":5.3,"tool":"Nikto"}}]
  }},
  "sqlmap": {{
    "toolOutput": "5 lines sqlmap output",
    "findings": [{{"severity":"critical","title":"SQL Injection","endpoint":"/?id=1","description":"1 sentence","recommendation":"1 sentence","cvss":9.8,"tool":"SQLMap","cve":"CVE-2023-23752"}}]
  }},
  "metasploit": {{
    "toolOutput": "5 lines msf6 output",
    "findings": [{{"severity":"critical","title":"Default Creds","endpoint":"/admin","description":"1 sentence","recommendation":"1 sentence","cvss":9.8,"tool":"Hydra"}}]
  }},
  "ssl": {{
    "toolOutput": "5 lines testssl output",
    "findings": [{{"severity":"high","title":"Weak TLS","endpoint":":443","description":"1 sentence","recommendation":"1 sentence","cvss":7.4,"tool":"testssl","cve":"CVE-2014-3566"}}]
  }},
  "osint": {{
    "toolOutput": "5 lines amass output",
    "findings": [{{"severity":"high","title":"Dev Subdomain","endpoint":"dev.{domain}","description":"1 sentence","recommendation":"1 sentence","cvss":7.5,"tool":"Amass"}}]
  }},
  "burp": {{
    "toolOutput": "5 lines header/CORS output",
    "findings": [{{"severity":"high","title":"CORS Wildcard","endpoint":"/api/","description":"1 sentence","recommendation":"1 sentence","cvss":8.1,"tool":"Burp"}}]
  }}
}}

Each agent should have 2-3 realistic findings for {domain}. Fill in realistic tool output. Keep total JSON compact."""
