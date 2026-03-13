
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
        build_prompt=lambda t, d, p: f"""You are an Nmap/Shodan agent scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines nmap output", "ports": [{{"port":80,"protocol":"tcp","state":"open","service":"http","version":"1.2","risk":"low"}}], "findings": [{{"severity":"high","title":"Vuln","endpoint":"22/tcp","description":"...","recommendation":"...","cvss":7.5,"tool":"Nmap", "poc": "nmap --script=ssh-auth-methods 22/tcp"}}] }}"""
    ),
    AgentConfig(
        name="Dirb Agent",
        tool_name="Gobuster + Dirb",
        icon="📁",
        json_key="dirb",
        build_command=lambda t, d, p: f"gobuster dir -u {t} -w /usr/share/wordlists/dirb/common.txt -x php,js,bak,env -t 50 -k",
        build_prompt=lambda t, d, p: f"""You are a Gobuster agent scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines gobuster", "directories": [{{"path":"/admin","status":200,"size":4821,"type":"directory","interesting":true}}], "findings": [{{"severity":"medium","title":"Vuln","endpoint":"/admin","description":"...","recommendation":"...","cvss":5.0,"tool":"Gobuster", "poc": "gobuster dir -u {t} -w /usr/share/wordlists/dirb/common.txt -x php"}}] }}"""
    ),
    AgentConfig(
        name="Nikto Agent",
        tool_name="Nikto + WhatWeb",
        icon="🌐",
        json_key="nikto",
        build_command=lambda t, d, p: f"nikto -h {t} -ssl -Tuning 123456789abc && whatweb -a 3 {t}",
        build_prompt=lambda t, d, p: f"""You are a Nikto scanner scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines Nikto", "findings": [{{"severity":"medium","title":"Missing CSP","endpoint":"/","description":"...","recommendation":"...","cvss":5.3,"tool":"Nikto", "poc": "nikto -h {t} -Tuning 8"}}] }}"""
    ),
    AgentConfig(
        name="SQLMap Agent",
        tool_name="SQLMap + XSStrike",
        icon="💉",
        json_key="sqlmap",
        build_command=lambda t, d, p: f'sqlmap -u "{t}/?id=1" --dbs --level=5 --batch && python3 xsstrike.py -u "{t}"',
        build_prompt=lambda t, d, p: f"""You are a SQLMap injection agent scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines sqlmap", "findings": [{{"severity":"critical","title":"SQLi","endpoint":"/?id=1","description":"...","recommendation":"...","cvss":9.8,"tool":"SQLMap", "poc": "sqlmap -u \\"{t}/?id=1\\" --dbs"}}] }}"""
    ),
    AgentConfig(
        name="Metasploit Agent",
        tool_name="Metasploit + Hydra",
        icon="⚡",
        json_key="metasploit",
        build_command=lambda t, d, p: f'msfconsole -q -x "use auxiliary/scanner/http/http_login..." && hydra -L users.txt {d} http-post-form',
        build_prompt=lambda t, d, p: f"""You are a Metasploit agent targeting {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines msf6", "findings": [{{"severity":"critical","title":"Default Creds","endpoint":"/admin","description":"...","recommendation":"...","cvss":9.8,"tool":"Metasploit", "poc": "hydra -L users.txt -P passwords.txt {d} http-post-form \\"/login.php:user=^USER^&pass=^PASS^:F=Login Failed\\""}}] }}"""
    ),
    AgentConfig(
        name="SSL Agent",
        tool_name="testssl + SSLScan",
        icon="🔒",
        json_key="ssl",
        build_command=lambda t, d, p: f"testssl.sh --color 0 {d}:443 && sslscan {d}",
        build_prompt=lambda t, d, p: f"""You are an SSL agent scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines testssl", "findings": [{{"severity":"high","title":"TLS 1.0","endpoint":":443","description":"...","recommendation":"...","cvss":7.4,"tool":"testssl", "poc": "testssl.sh --protocols {d}"}}] }}"""
    ),
    AgentConfig(
        name="OSINT Agent",
        tool_name="Amass + theHarvester",
        icon="🕵️",
        json_key="osint",
        build_command=lambda t, d, p: f"amass enum -passive -d {d} && theHarvester -d {d} -b all",
        build_prompt=lambda t, d, p: f"""You are an OSINT agent scanning {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines amass", "findings": [{{"severity":"high","title":"Dev Subdomain","endpoint":"dev.{d}","description":"...","recommendation":"...","cvss":7.5,"tool":"Amass", "poc": "amass enum -d {d}"}}] }}"""
    ),
    AgentConfig(
        name="Burp Agent",
        tool_name="Burp Suite + CORS",
        icon="🛡️",
        json_key="burp",
        build_command=lambda t, d, p: f"python3 cors_scanner.py -u {t} && python3 ssrf_scanner.py -u {t}",
        build_prompt=lambda t, d, p: f"""You are a Burp proxy scanning headers for {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines CORS scan", "findings": [{{"severity":"high","title":"CORS Wildcard","endpoint":"/api","description":"...","recommendation":"...","cvss":8.1,"tool":"Burp", "poc": "curl -I -H \\"Origin: evil.com\\" {t}/api"}}] }}"""
    ),
    AgentConfig(
        name="Cloud Agent",
        tool_name="ScoutSuite + Pacu",
        icon="☁️",
        json_key="cloud",
        build_command=lambda t, d, p: f"scout aws --no-browser && pacu --session {d} --run-all",
        build_prompt=lambda t, d, p: f"""You are a Cloud Security agent scanning AWS/GCP config for {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines ScoutSuite", "findings": [{{"severity":"high","title":"S3 Bucket Public","endpoint":"s3://bucket","description":"...","recommendation":"...","cvss":7.5,"tool":"ScoutSuite", "poc": "aws s3 ls s3://bucket"}}] }}"""
    ),
    AgentConfig(
        name="Container Agent",
        tool_name="Trivy + Kube-hunter",
        icon="🐳",
        json_key="container",
        build_command=lambda t, d, p: f"trivy image {d}:latest && kube-hunter --remote {d}",
        build_prompt=lambda t, d, p: f"""You are a Container/K8s agent scanning deployments at {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines Trivy output", "findings": [{{"severity":"critical","title":"K8s Dashboard Exposed","endpoint":"/api/v1/namespaces/kubernetes-dashboard/","description":"...","recommendation":"...","cvss":9.0,"tool":"kube-hunter", "poc": "kubectl get service kubernetes-dashboard -n kubernetes-dashboard"}}] }}"""
    ),
    AgentConfig(
        name="API Agent",
        tool_name="Kiterunner + RESTler",
        icon="🔌",
        json_key="api",
        build_command=lambda t, d, p: f"kr scan {t} -w routes-large.kite && restler --target {t}",
        build_prompt=lambda t, d, p: f"""You are an API/GraphQL agent scanning {t}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines Kiterunner", "findings": [{{"severity":"high","title":"BOLA / IDOR","endpoint":"/api/v1/users/99","description":"...","recommendation":"...","cvss":8.5,"tool":"Kiterunner", "poc": "curl -X GET {t}/api/v1/users/1"}}] }}"""
    ),
    AgentConfig(
        name="Secret Agent",
        tool_name="Nuclei + TruffleHog",
        icon="🔑",
        json_key="secrets",
        build_command=lambda t, d, p: f"nuclei -u {t} -t exposures/ && trufflehog --no-update {t}",
        build_prompt=lambda t, d, p: f"""You are a Secret Scanner looking for leaked API keys on {t}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines Nuclei output", "findings": [{{"severity":"critical","title":"AWS Key Leak","endpoint":"/.env","description":"...","recommendation":"...","cvss":9.5,"tool":"Nuclei", "poc": "curl {t}/.env"}}] }}"""
    ),
    AgentConfig(
        name="WAF Agent",
        tool_name="WafW00f + WhatWaf",
        icon="🧱",
        json_key="waf",
        build_command=lambda t, d, p: f"wafw00f {t} -a && whatwaf -u {t}",
        build_prompt=lambda t, d, p: f"""You are a WAF fingerprinting agent analyzing {t}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines WafW00f", "findings": [{{"severity":"info","title":"Cloudflare WAF Detected","endpoint":"/","description":"...","recommendation":"...","cvss":0.0,"tool":"WafW00f", "poc": "wafw00f {t}"}}] }}"""
    ),
    AgentConfig(
        name="AD Identity Agent",
        tool_name="CrackMapExec + BloodHound",
        icon="🎭",
        json_key="ad",
        build_command=lambda t, d, p: f"cme smb {d} -u '' -p '' && bloodhound-python -d {d} -u null -p null -c All",
        build_prompt=lambda t, d, p: f"""You are an Active Directory/Identity agent enumerating {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines CrackMapExec", "findings": [{{"severity":"high","title":"SMB Null Session","endpoint":"139/tcp","description":"...","recommendation":"...","cvss":7.0,"tool":"CrackMapExec", "poc": "cme smb {d} -u '' -p '' --shares"}}] }}"""
    ),
    AgentConfig(
        name="Takeover Agent",
        tool_name="Subzy + Nuclei",
        icon="🚩",
        json_key="takeover",
        build_command=lambda t, d, p: f"subzy run --targets subdomains.txt && nuclei -tags takeover -u {t}",
        build_prompt=lambda t, d, p: f"""You are a Subdomain Takeover agent analyzing {d}. Return ONLY valid JSON:
{{ "toolOutput": "5 lines Subzy output", "findings": [{{"severity":"high","title":"Subdomain Takeover","endpoint":"shop.{d}","description":"...","recommendation":"...","cvss":8.5,"tool":"Subzy", "poc": "subzy run --target shop.{d}"}}] }}"""
    )
]


def build_batch_prompt(target: str, domain: str, profile: str, context: str = "") -> str:
    """Build a single prompt that asks for ALL agents in one JSON response."""
    
    agent_blocks = []
    for agent in AGENTS:
        # We grab the example JSON output from their prompt wrapper
        prompt_example = agent.build_prompt(target, domain, profile).split("Return ONLY valid JSON:")[1].strip()
        agent_blocks.append(f"  \"{agent.json_key}\": {prompt_example}")
        
    json_structure = "{\n" + ",\n".join(agent_blocks) + "\n}"
    
    context_str = f"\nREAL RECONNAISSANCE DATA FOUND:\n{context}\n" if context else ""
    
    return f"""You are an elite AI Red Team conducting a comprehensive penetration test.
Target: {target}  |  Domain: {domain}  |  Profile: {profile}
{context_str}
CRITICAL RULES:
- Respond ONLY with a single valid JSON object.
- DO NOT hallucinate vulnerabilities that cannot exist based on the recon data.
- If the recon data shows specific tech (e.g., Next.js, Nginx), target your "findings" to those.
- Keep EVERY toolOutput to 5 lines MAX.
- Keep ALL description/recommendation fields to 1 sentence MAX.
- Generate a REAL Proof-of-Concept (PoC) command for every finding.
- Return this JSON structure:
{json_structure}

Be realistic. If the recon data is limited, provide common architectural findings for {domain}."""

