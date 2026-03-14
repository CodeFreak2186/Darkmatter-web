#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║   DARKMATTER — Autonomous AI Red Team CLI                       ║
║   8-Agent Pentest Framework   •   Powered by Gemini             ║
╚══════════════════════════════════════════════════════════════════╝

Usage:
    python darkmatter.py scan <target>
    python darkmatter.py scan <target> --mode parallel
    python darkmatter.py scan <target> --profile stealth
"""

import sys
import os
import json
import re
import time
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

# Force UTF-8 on Windows terminal to prevent rich unicode crash
if sys.stdout.encoding.lower() != "utf-8" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


from dotenv import load_dotenv

# Robust .env loading for both Dev and Compiled (PyInstaller) modes
def get_resource_path():
    if getattr(sys, 'frozen', False):
        # Running as a compiled binary
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent

res_path = get_resource_path()
cwd_path = Path.cwd()

# Search priority: CWD -> Exe Folder -> Parent -> Root
load_dotenv(cwd_path / ".env")
load_dotenv(res_path / ".env")
load_dotenv(res_path.parent / ".env")
load_dotenv(res_path.parent.parent / ".env")

from google import genai
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.text import Text
from rich import box

# Add engine to path
engine_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "engine"))
if engine_path not in sys.path:
    sys.path.insert(0, engine_path)

from agents import AGENTS, get_domain, build_batch_prompt, DARKMATTER_CORE_RULES
from core.agent import RedTeamAgent
from core.crawler import Crawler, AttackSurface
from core.tracker import DarkmatterTracker, ensure_initialized
from core.real_scanner import RealScanner, findings_to_dict

# ─── Setup ─────────────────────────────────────────────────────

console = Console()
MODEL = "models/gemini-2.5-flash"

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    console.print("[bold red]✗ GEMINI_API_KEY not set![/] Add it to .env or export it.")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

SEV_COLORS = {
    "critical": "bold white on red",
    "high": "bold red",
    "medium": "bold yellow",
    "low": "bold cyan",
    "info": "dim white",
}
SEV_ICONS = {
    "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪",
}

# ─── Gemini API ────────────────────────────────────────────────

def call_gemini(label: str, prompt: str, max_tokens: int = 4096) -> str:
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=max_tokens,
            ),
        )
        console.print(f"  [dim]Using model: {MODEL}[/]")
        return resp.text or ""
    except Exception as e:
        console.print(f"  [bold red]Gemini Error ([/]{MODEL}[bold red]):[/] {e}")
        raise


def parse_json(raw: str) -> dict[str, Any]:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fenced:
        text = fenced.group(1)
    else:
        # Find the first '{' to start parsing, or use the whole string if not found
        idx = raw.find("{")
        if idx >= 0:
            text = raw[idx:]
        else:
            text = raw # No '{' found, try parsing the whole string
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {}


# ─── Run single agent (for parallel mode) ─────────────────────

def run_single_agent(idx: int, target: str, domain: str, profile: str) -> dict[str, Any]:
    agent = AGENTS[idx]
    start = time.time()
    try:
        # For parallel mode, we can still use the batched prompt builder or a simplified version
        # We'll use the agent's specific builder which now aligns with the master role
        prompt = f"{DARKMATTER_CORE_RULES}\nTarget: {target}\nTASK: {agent.build_prompt(target, domain, profile)}\nReturn JSON with 'findings' and 'false_positives_removed' lists."
        raw = call_gemini(agent.name, prompt)
        data = parse_json(raw)
        
        # Normalize response if it's the new flat format
        agent_findings = data.get("findings", [])
        
        return {
            "_agent": agent.name, "_tool": agent.tool_name, "_icon": agent.icon,
            "_command": agent.build_command(target, domain, profile),
            "_time": round(time.time() - start, 1), "_error": None, 
            "findings": agent_findings,
            "false_positives_removed": data.get("false_positives_removed", [])
        }
    except Exception as e:
        return {
            "_agent": agent.name, "_tool": agent.tool_name, "_icon": agent.icon,
            "_command": agent.build_command(target, domain, profile),
            "_time": round(time.time() - start, 1), "_error": str(e), "findings": [],
        }


# ─── Batch mode (1 API call) ──────────────────────────────────

def run_batch(target: str, domain: str, profile: str, context: str = "") -> list[dict[str, Any]]:
    console.print(f"[bold yellow]  ⏳ Sending 1 batched request for all {len(AGENTS)} agents...[/]")
    console.print()

    start = time.time()
    prompt = build_batch_prompt(target, domain, profile, context=context)
    raw = call_gemini("Batch", prompt, max_tokens=16384)
    elapsed = time.time() - start

    batch_data = parse_json(raw)
    if not batch_data:
        console.print("[bold red]  ✗ Failed to parse batch response[/]")
        return []

    # New flattened structure handling
    all_findings = batch_data.get("findings", [])
    fps_removed = batch_data.get("false_positives_removed", [])
    
    if fps_removed:
        console.print(f"  [bold blue]ℹ[/] AI discarded [bold]{len(fps_removed)}[/] potential false positives.")
        for fp in fps_removed:
            console.print(f"     [dim]↳ Dropped: {fp.get('path', '?')} ({fp.get('reason', 'no signature')})[/]")
        console.print()

    # Distribute findings back into agent-structured results for legacy printing/UI compatibility
    results = []
    for agent in AGENTS:
        # Find findings belonging to this agent
        agent_findings = [f for f in all_findings if f.get("agent") == agent.name or f.get("agent") == agent.json_key]
        
        results.append({
            "_agent": agent.name, 
            "_tool": agent.tool_name, 
            "_icon": agent.icon,
            "_command": agent.build_command(target, domain, profile),
            "_time": round(elapsed, 1), 
            "_error": None, 
            "findings": agent_findings
        })

    console.print(f"  [bold green]✓ Batch complete in {elapsed:.1f}s — 1 API call[/]")
    return results


# ─── Parallel mode (8 API calls) ──────────────────────────────

def run_parallel(target: str, domain: str, profile: str) -> list[dict[str, Any]]:
    console.print(f"[bold yellow]  ⏳ Launching {len(AGENTS)} agents in parallel ({len(AGENTS)} API calls)...[/]")
    console.print()

    results: list[dict[str, Any]] = [{}] * len(AGENTS)

    with Progress(
        SpinnerColumn(style="green"),
        TextColumn("[bold cyan]{task.description}[/]"),
        BarColumn(bar_width=30, style="green", complete_style="bold green"),
        TextColumn("[bold]{task.completed}/{task.total}[/]"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Agents running...", total=len(AGENTS))

        with ThreadPoolExecutor(max_workers=min(10, len(AGENTS))) as executor:
            futures = {
                executor.submit(run_single_agent, i, target, domain, profile): i
                for i in range(len(AGENTS))
            }
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    results[idx] = future.result()
                except Exception as e:
                    results[idx] = {
                        "_agent": AGENTS[idx].name, "_tool": AGENTS[idx].tool_name,
                        "_icon": AGENTS[idx].icon,
                        "_command": AGENTS[idx].build_command(target, domain, profile),
                        "_time": 0, "_error": str(e), "findings": [],
                    }
                progress.advance(task)

    return results


# ─── Display ───────────────────────────────────────────────────

def print_banner():
    lines = [
        "  ██████╗  █████╗ ██████╗ ██╗  ██╗███╗   ███╗ █████╗ ████████╗████████╗███████╗██████╗ ",
        "  ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝████╗ ████║██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗",
        "  ██║  ██║███████║██████╔╝█████╔╝ ██╔████╔██║███████║   ██║      ██║   █████╗  ██████╔╝",
        "  ██║  ██║██╔══██║██╔══██╗██╔═██╗ ██║╚██╔╝██║██╔══██║   ██║      ██║   ██╔══╝  ██╔══██╗",
        "  ██████╔╝██║  ██║██║  ██║██║  ██╗██║ ╚═╝ ██║██║  ██║   ██║      ██║   ███████╗██║  ██║",
        "  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝",
    ]
    for line in lines:
        console.print(f"[bold green]{line}[/]")
    console.print()
    console.print("  [bold cyan]Autonomous AI Red Team CLI v3.0[/] — [dim]Powered by Gemini[/]")
    console.print()


def print_agent_commands(target: str, domain: str, profile: str):
    console.rule("[bold cyan]DEPLOYING AGENTS", style="cyan")
    console.print()
    for agent in AGENTS:
        cmd = agent.build_command(target, domain, profile)
        console.print(f"  [bold cyan]{agent.icon} [{agent.name}][/] ▶ Running:")
        console.print(f"    [dim]$ {cmd}[/]")
        console.print()


def print_agent_result(result: dict[str, Any]):
    name = result.get("_agent", "?")
    icon = result.get("_icon", "?")
    elapsed = result.get("_time", 0)
    error = result.get("_error")
    findings = result.get("findings", [])

    if error:
        console.print(f"  {icon} [bold red][{name}] ✗ Failed in {elapsed}s: {error}[/]")
        return

    crit = sum(1 for f in findings if f.get("severity") == "critical")
    high = sum(1 for f in findings if f.get("severity") == "high")
    extras = ""
    if crit: extras += f" [bold red]({crit} CRITICAL)[/]"
    if high: extras += f" [bold red]({high} HIGH)[/]"

    console.print(f"  {icon} [bold cyan][{name}][/] [bold green]✓ {len(findings)} findings in {elapsed}s[/]{extras}")

    for f in findings:
        sev = f.get("severity", "info")
        sev_icon = SEV_ICONS.get(sev, "⚪")
        cve = f" ({f['cve']})" if f.get("cve") else ""
        console.print(f"      {sev_icon} [{SEV_COLORS.get(sev, 'dim')}][{sev.upper()}][/] {f.get('title', '?')}{cve} — {f.get('endpoint', '?')}")


def print_ports(results: list[dict[str, Any]]):
    ports = [p for r in results for p in r.get("ports", [])]
    if not ports:
        return
    table = Table(title="Open Ports", box=box.ROUNDED, title_style="bold cyan", border_style="cyan")
    table.add_column("Port", style="bold white", width=8)
    table.add_column("Proto", style="dim", width=6)
    table.add_column("State", style="green", width=10)
    table.add_column("Service", style="yellow", width=15)
    table.add_column("Version", style="dim", width=25)
    table.add_column("Risk", width=8)
    for p in ports:
        risk = p.get("risk", "info")
        table.add_row(str(p.get("port", "?")), p.get("protocol", "tcp"), p.get("state", "?"),
                       p.get("service", "?"), p.get("version", "?"), Text(risk.upper(), style=SEV_COLORS.get(risk, "dim")))
    console.print()
    console.print(table)


def print_directories(results: list[dict[str, Any]]):
    dirs = [d for r in results for d in r.get("directories", [])]
    if not dirs:
        return
    table = Table(title="Discovered Directories", box=box.ROUNDED, title_style="bold cyan", border_style="cyan")
    table.add_column("Path", style="bold white", width=30)
    table.add_column("Status", style="yellow", width=8)
    table.add_column("Size", style="dim", width=10)
    table.add_column("Type", style="cyan", width=12)
    table.add_column("⚠", width=3)
    for d in dirs:
        table.add_row(d.get("path", "?"), str(d.get("status", "?")), f"{d.get('size', 0)}B",
                       d.get("type", "?"), "⚠" if d.get("interesting") else "")
    console.print()
    console.print(table)


def print_findings_table(results: list[dict[str, Any]]):
    findings = []
    for r in results:
        for f in r.get("findings", []):
            f["_agent"] = r.get("_agent", "?")
            findings.append(f)
    if not findings:
        console.print("\n  [dim]No findings.[/]")
        return

    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings.sort(key=lambda f: sev_order.get(f.get("severity", "info"), 5))

    has_crit = any(f.get("severity") == "critical" for f in findings)
    table = Table(
        title=f"All Findings ({len(findings)})", box=box.HEAVY, show_lines=True,
        title_style="bold white on red" if has_crit else "bold cyan",
        border_style="red" if has_crit else "cyan",
    )
    table.add_column("#", style="dim", width=3)
    table.add_column("Sev", width=10)
    table.add_column("Title", style="bold white", width=35)
    table.add_column("Endpoint", style="yellow", width=25)
    table.add_column("CVSS", width=5)
    table.add_column("Tool", style="dim", width=20)
    table.add_column("CVE", style="cyan", width=16)

    for i, f in enumerate(findings, 1):
        sev = f.get("severity", "info")
        table.add_row(str(i), Text(sev.upper(), style=SEV_COLORS.get(sev, "dim")),
                       f.get("title", "?"), f.get("endpoint", "?"), str(f.get("cvss", "?")),
                       f.get("tool", "?"), f.get("cve", "-"))
    console.print()
    console.print(table)


def print_summary(target: str, results: list[dict[str, Any]], elapsed: float, mode: str):
    findings = [f for r in results for f in r.get("findings", [])]
    crit = sum(1 for f in findings if f.get("severity") == "critical")
    high = sum(1 for f in findings if f.get("severity") == "high")
    med = sum(1 for f in findings if f.get("severity") == "medium")
    low = sum(1 for f in findings if f.get("severity") == "low")
    info_c = sum(1 for f in findings if f.get("severity") == "info")

    risk = min(10, round(crit * 2.5 + high * 1.5 + med * 0.7 + low * 0.2, 1))

    if risk >= 8:    style, verdict = "bold white on red", "CRITICAL — Immediate remediation required"
    elif risk >= 6:  style, verdict = "bold red", "HIGH RISK — Prioritize fixes"
    elif risk >= 4:  style, verdict = "bold yellow", "MODERATE — Schedule remediation"
    else:            style, verdict = "bold green", "LOW RISK — Minor issues"

    api_calls = "1 batch" if mode == "batch" else f"{len(AGENTS)} parallel"
    console.print()
    console.rule("[bold white]SCAN COMPLETE", style="green")
    console.print()
    console.print(f"  [bold white]Target:[/]       {target}")
    console.print(f"  [bold white]Mode:[/]         {mode} ({api_calls} API call{'s' if mode != 'batch' else ''})")
    console.print(f"  [bold white]Scan Time:[/]    {elapsed:.1f}s")
    console.print(f"  [bold white]Risk Score:[/]   [{style}]{risk}/10[/]")
    console.print(f"  [bold white]Verdict:[/]      [{style}]{verdict}[/]")
    console.print()
    console.print(f"  [bold white]Findings:[/]     {len(findings)} total")
    console.print(f"    [bold red]Critical:[/]  {crit}    [bold red]High:[/]  {high}")
    console.print(f"    [bold yellow]Medium:[/]    {med}    [bold cyan]Low:[/]   {low}    [dim]Info:  {info_c}[/]")
    console.print()

    # Save report
    report_dir = Path(__file__).parent / "reports"
    report_dir.mkdir(exist_ok=True)
    report_file = report_dir / f"{get_domain(target)}_{int(time.time())}.json"
    
    report_data = {
        "target": target, "domain": get_domain(target), "mode": mode,
        "scan_time": elapsed, "risk_score": risk,
        "startedAt": int(time.time() * 1000) - int(elapsed * 1000),
        "completedAt": int(time.time() * 1000),
        "summary": f"Cloud scan of {target} complete. Found {crit} critical and {high} high vulnerabilities.",
        "findings": findings,
        "agents": [{"agent": r.get("_agent"), "tool": r.get("_tool"), "command": r.get("_command"),
                     "time": r.get("_time"), "error": r.get("_error"),
                     "finding_count": len(r.get("findings", []))} for r in results],
    }
    
    report_file.write_text(json.dumps(report_data, indent=2))
    console.print(f"  [bold green]✓ Report saved:[/] {report_file}")

    # Sync to Dashboard
    try:
        import httpx as sync_httpx
        resp = sync_httpx.post("http://localhost:3000/api/scan/import", json=report_data, timeout=5)
        if resp.status_code == 200:
            console.print("  [bold cyan]✓ Synced to Cloud Dashboard[/]")
        else:
            console.print(f"  [dim]! Dashboard sync failed (HTTP {resp.status_code})[/]")
    except Exception as e:
        console.print(f"  [dim]! Dashboard sync unavailable: {e}[/]")
    
    console.print()


# ─── Fuzz mode (real fuzzing engine) ──────────────────────────

def run_fuzz(target: str, profile: str = "full", rps: float = 10.0, auth_token: str | None = None, print_banner_flag: bool = True):
    """Run the real fuzzing engine against a target."""
    import asyncio
    from core.fuzzer import FuzzEngine
    from core.executor import AuthConfig

    domain = get_domain(target)
    if print_banner_flag:
        print_banner()

    console.rule("[bold magenta]FUZZ MODE", style="magenta")
    console.print(f"  [bold white]Target:[/]  {target}")
    console.print(f"  [bold white]Domain:[/]  {domain}")
    console.print(f"  [bold white]Profile:[/] {profile}")
    console.print(f"  [bold white]Rate:[/]    {rps} req/s")
    console.print()

    auth = None
    if auth_token:
        auth = AuthConfig(auth_type="bearer", token=auth_token)
        console.print(f"  [bold white]Auth:[/]    Bearer token set")

    def on_progress(phase: str, msg: str):
        color_map = {
            "discovery": "cyan", "classify": "yellow", "fuzz": "red",
            "validate": "green", "report": "blue", "start": "magenta",
            "complete": "bold green",
        }
        color = color_map.get(phase, "white")
        console.print(f"  [{color}][{phase.upper()}][/] {msg}")

    engine = FuzzEngine(
        target=target,
        profile=profile,
        rps=rps,
        max_payloads_per_param=5 if profile == "quick" else 10,
        auth=auth,
        on_progress=on_progress,
    )

    # Run the async pipeline
    detections = asyncio.run(engine.run())

    # Display results
    console.print()
    console.rule("[bold cyan]FUZZ RESULTS", style="cyan")
    console.print()

    if not detections:
        console.print("  [dim]No vulnerabilities detected by fuzzer.[/]")
        console.print()
        return

    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    detections.sort(key=lambda d: sev_order.get(d.severity, 5))

    has_crit = any(d.severity == "critical" for d in detections)
    table = Table(
        title=f"Fuzz Findings ({len(detections)})", box=box.HEAVY, show_lines=True,
        title_style="bold white on red" if has_crit else "bold cyan",
        border_style="red" if has_crit else "cyan",
    )
    table.add_column("#", style="dim", width=3)
    table.add_column("Sev", width=10)
    table.add_column("Vector", style="bold", width=10)
    table.add_column("Description", style="white", width=35)
    table.add_column("Endpoint", style="yellow", width=25)
    table.add_column("Param", style="cyan", width=12)
    table.add_column("Conf", width=5)
    table.add_column("CVSS", width=5)

    for i, d in enumerate(detections, 1):
        table.add_row(
            str(i),
            Text(d.severity.upper(), style=SEV_COLORS.get(d.severity, "dim")),
            d.vector.value.upper(),
            d.description or d.evidence,
            d.endpoint,
            d.param_name,
            f"{d.confidence*100:.0f}%",
            str(d.cvss),
        )

    console.print(table)

    # Summary
    crit = sum(1 for d in detections if d.severity == "critical")
    high = sum(1 for d in detections if d.severity == "high")
    med = sum(1 for d in detections if d.severity == "medium")
    console.print()
    console.rule("[bold white]FUZZ COMPLETE", style="green")
    console.print(f"  [bold white]Findings:[/]  {len(detections)}  ({crit} critical, {high} high, {med} medium)")
    console.print(f"  [bold white]Requests:[/]  {engine.executor.stats['requests']}")
    console.print()


# ─── Main ──────────────────────────────────────────────────────

async def run_scan(target: str, profile: str = "full", mode: str = "batch", print_banner_flag: bool = True):

    domain = get_domain(target)
    if print_banner_flag:
        print_banner()

    console.rule("[bold green]DARKMATTER SCAN — REAL HTTP PROBES + AI ANALYSIS", style="green")
    console.print(f"  [bold white]Target:[/]  {target}")
    console.print(f"  [bold white]Domain:[/]  {domain}")
    console.print()

    # ── PHASE 1: Real Crawl ───────────────────────────────────────
    crawler = Crawler(max_depth=1 if profile == "quick" else 2)
    with console.status("[bold yellow]🕷️  Phase 1: Real reconnaissance crawl..."):
        surface: AttackSurface = await crawler.crawl(target)
    console.print(f"  [bold green]✓[/] Found [bold]{len(surface.endpoints)}[/] real endpoints, [bold]{len(surface.technologies)}[/] technologies.")
    for tech in surface.technologies[:8]:
        console.print(f"     [dim cyan]↳ {tech}[/]")
    console.print()

    # ── PHASE 2: Real HTTP Security Probes ───────────────────────
    console.rule("[bold yellow]Phase 2: Real HTTP Security Probes", style="yellow")
    console.print()
    
    real_findings_raw = []

    def on_log(phase, msg):
        console.print(f"  [dim yellow][{phase.upper()}][/] {msg}")

    scanner = RealScanner(target, timeout=10.0)
    real_findings_raw = await scanner.run_all(on_progress=lambda p, m: on_log(p, m))
    real_findings = findings_to_dict(real_findings_raw)

    console.print()
    console.print(f"  [bold green]✓ Real probes complete:[/] {len(real_findings)} grounded findings discovered.")
    console.print()

    # Print real findings live
    if real_findings:
        console.rule("[bold green]Evidence-Backed Findings", style="green")
        for i, f in enumerate(real_findings, 1):
            sev = f.get("severity", "info")
            icon = SEV_ICONS.get(sev, "⚪")
            style = SEV_COLORS.get(sev, "dim")
            console.print(f"  {icon} [{style}][{sev.upper()}][/] {f['title']}")
            console.print(f"     [dim]Evidence: {f['evidence'][:120]}[/]")
            console.print(f"     [yellow]→ {f['endpoint']}[/]")
            console.print()

    # ── PHASE 3: AI Deep Analysis ─────────────────────────────────
    console.rule("[bold cyan]Phase 3: AI Deep Analysis (15 Agents)", style="cyan")
    console.print()

    # Limit headers for context to avoid token bloat
    hdrs = [item for i, item in enumerate(surface.response_headers.items()) if i < 10]
    headers_context = dict(hdrs)

    # Build rich context from REAL data
    context_data = (
        f"REAL CRAWL DATA:\n"
        f"  Endpoints ({len(surface.endpoints)}): {[e.url for e in surface.endpoints[:15]]}\n"
        f"  Technologies: {surface.technologies}\n"
        f"  Response headers: {headers_context}\n\n"
        f"REAL HTTP PROBE FINDINGS ({len(real_findings)}):\n"
        + "\n".join(
            f"  - [{f['severity'].upper()}] {f['title']} at {f['endpoint']}\n    Evidence: {f['evidence'][:200]}"
            for f in real_findings[:15]
        )
    )

    start = time.time()
    if mode == "parallel":
        results = run_parallel(target, domain, profile)
    else:
        results = run_batch(target, domain, profile, context=context_data)
    elapsed = time.time() - start

    console.print()
    console.rule("[bold cyan]AGENT RESULTS", style="cyan")
    console.print()
    for r in results:
        print_agent_result(r)

    # Inject real findings as a dedicated "RealScanner" agent result
    if real_findings:
        results.append({
            "_agent": "RealScanner",
            "_tool": "HTTP Probe Engine",
            "_icon": "🔬",
            "_command": f"RealScanner.run_all({target})",
            "_time": 0,
            "_error": None,
            "findings": real_findings,
        })

    print_ports(results)
    print_directories(results)
    print_findings_table(results)
    print_summary(target, results, elapsed, mode)


def run_lifecycle(target: str, profile: str = "full", rps: float = 10.0, auth_token: str | None = None):
    """Run the 4-phase rigorous lifecycle exactly as defined by the user."""
    import asyncio
    import time
    from core.fuzzer import FuzzEngine
    from core.executor import AuthConfig

    domain = get_domain(target)
    print_banner()

    console.rule("[bold red]4-PHASE PENTEST LIFECYCLE INITIATED", style="bold red")
    console.print(f"  [bold white]Target:[/]  {target}")
    console.print()

    auth = AuthConfig(auth_type="bearer", token=auth_token) if auth_token else None

    # Verbose progress reporter to show exactly what is happening
    def on_progress(phase: str, msg: str):
        if phase in ("start", "complete"):
            return
        
        color_map = {
            "discovery": "cyan", 
            "classify": "yellow", 
            "fuzz": "yellow",
            "validate": "red", 
            "report": "blue"
        }
        color = color_map.get(phase, "dim")
        console.print(f"    [{color}]•[/] [dim]{msg}[/]")

    engine = FuzzEngine(target=target, profile=profile, rps=rps, auth=auth, on_progress=on_progress)

    async def run_phases():
        start_time = time.time()
        
        # ── Phase 1: Reconnaissance ──
        console.print()
        console.print("[bold cyan]──▶ Phase 1: Reconnaissance ───────────────────────────────[/]")
        console.print("[dim]Building a comprehensive map of the application's attack surface. Analyzing source code, integrating with tools like Nmap and Subfinder to understand tech stack and infrastructure. Performing live exploration via browser automation.[/]")
        console.print()
        await engine.discover()
        console.print(f"\n  [bold green]✓[/] Discovered {len(engine.surface.endpoints)} entry points & API endpoints.")

        # ── Phase 2: Vulnerability Analysis ──
        console.print()
        console.print("[bold yellow]──▶ Phase 2: Vulnerability Analysis ───────────────────────[/]")
        console.print("[dim]Operating in parallel. Specialized agents for OWASP categories hunt for flaws. Performing structured data flow analysis for Injection and SSRF, tracing user input to dangerous sinks.[/]")
        console.print()
        engine.classify()
        console.print()
        engine.fuzz_all()
        console.print(f"\n  [bold green]✓[/] Generated {len(engine.all_detections)} hypothesized exploitable paths.")

        # ── Phase 3: Exploitation ──
        console.print()
        console.print("[bold red]──▶ Phase 3: Exploitation ─────────────────────────────────[/]")
        console.print("[dim]Turning hypotheses into proof. Dedicated exploit agents receive paths to execute real-world attacks. Enforcing strict 'No Exploit, No Report' policy. Discarding false positives.[/]")
        console.print()
        engine.validate()
        console.print(f"\n  [bold green]✓[/] Successfully validated {len(engine.all_detections)} proven vulnerabilities.")

        # ── Phase 4: Reporting ──
        console.print()
        console.print("[bold blue]──▶ Phase 4: Reporting ────────────────────────────────────[/]")
        console.print("[dim]Compiling all validated findings into a professional, actionable report. Consolidating recon data and exploit evidence, cleaning up noise. Delivering pentest-grade report with PoCs.[/]")
        console.print()
        elapsed = time.time() - start_time
        paths = engine.report(elapsed)
        console.print(f"\n  [bold green]✓[/] Final report delivered: [bold white]{paths['html']}[/]\n")

        return engine.all_detections, elapsed

    detections, elapsed = asyncio.run(run_phases())

    crit = sum(1 for d in detections if d.severity == "critical")
    high = sum(1 for d in detections if d.severity == "high")
    med = sum(1 for d in detections if d.severity == "medium")
    
    console.rule("[bold white]LIFECYCLE COMPLETE", style="green")
    console.print(f"  [bold white]Verified Exploits:[/] {len(detections)}  ({crit} critical, {high} high, {med} medium)")
    console.print(f"  [bold white]Total Requests:[/]    {engine.executor.stats['requests']}")
    console.print(f"  [bold white]Total Time:[/]        {elapsed:.1f}s")
    console.print()


def run_attack(target: str, profile: str = "full", mode: str = "batch", rps: float = 10.0, auth_token: str | None = None):
    """Run both AI scan and active fuzzing sequentially."""
    print_banner()
    console.rule("[bold red]FULL ATTACK INITIATED (SCAN + FUZZ)", style="bold red")
    
    console.print("\n[bold yellow]──▶ PHASE 1: AI-Powered Recon & Analysis ──────────────────[/]")
    run_scan(target, profile, mode, print_banner_flag=False)
    
    console.print("\n[bold red]──▶ PHASE 2: Active Vulnerability Fuzzing ───────────────────[/]")
    run_fuzz(target, profile, rps, auth_token, print_banner_flag=False)


def main():
    parser = argparse.ArgumentParser(
        description="DARKMATTER — Autonomous AI Red Team CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  init       Initialize a Darkmatter Lab (required before scanning)
  log        View the audit log (provenance tracking)
  agent      TRULY AUTONOMOUS Agent (Analyses code, runs tools, executes scripts)
  scan       AI-powered security scan (informed by real recon)
  fuzz       Real active fuzzing (crawl + classify + inject payloads + detect)
  attack     Complete lifecycle (scan + fuzz combined)
  vm         E2B Remote Sandbox (Run tools in isolated cloud VMs)
  lifecycle  4-Phase Rigorous Pentest Lifecycle (Recon -> Vuln Analysis -> Exploit -> Report)

Examples:
  python darkmatter.py init
  python darkmatter.py agent "Analyze the security of https://example.com and find SQLi" --target https://example.com
  python darkmatter.py scan https://example.com
  python darkmatter.py lifecycle https://example.com --profile quick
        """,
    )
    sub = parser.add_subparsers(dest="command")

    # init command
    ip = sub.add_parser("init", help="Initialize a Darkmatter Lab in the current directory")
    ip.add_argument("--name", default="anonymous", help="Name of the operator")

    # log command
    sub.add_parser("log", help="View the Darkmatter audit log")

    # restore command
    sub.add_parser("restore", help="Restore access and unlock the system")

    # agent command
    at = sub.add_parser("agent", help="Mission-driven autonomous agent")
    at.add_argument("goal", help="The mission goal (e.g., 'Find vulnerabilities in X')")
    at.add_argument("--target", required=True, help="Target URL")

    # scan command
    sp = sub.add_parser("scan", help="AI-powered security scan via Gemini")
    sp.add_argument("target", help="Target URL or domain")
    sp.add_argument("--profile", choices=["full", "quick", "stealth"], default="full")
    sp.add_argument("--mode", choices=["batch", "parallel"], default="batch",
                    help=f"batch = 1 API call (default), parallel = {len(AGENTS)} concurrent")

    # fuzz command
    fp = sub.add_parser("fuzz", help="Real active fuzzing engine")
    fp.add_argument("target", help="Target URL or domain")
    fp.add_argument("--profile", choices=["full", "quick", "stealth"], default="full")
    fp.add_argument("--rps", type=float, default=10.0, help="Requests per second (default: 10)")
    fp.add_argument("--auth-token", type=str, default=None, help="Bearer auth token")

    # attack command
    ap = sub.add_parser("attack", help="Run scan and fuzz combined (full lifecycle)")
    ap.add_argument("target", help="Target URL or domain")
    ap.add_argument("--profile", choices=["full", "quick", "stealth"], default="full")
    ap.add_argument("--mode", choices=["batch", "parallel"], default="batch")
    ap.add_argument("--rps", type=float, default=10.0, help="Requests per second (default: 10)")
    ap.add_argument("--auth-token", type=str, default=None, help="Bearer auth token")

    # vm command
    vp = sub.add_parser("vm", help="Execute tools in a remote E2B sandbox")
    vp.add_argument("tool_cmd", help="The command to run in the VM (e.g., 'nmap -F example.com')")

    # lifecycle command
    lp = sub.add_parser("lifecycle", help="Run the rigorous 4-phase pentest lifecycle")
    lp.add_argument("target", help="Target URL or domain")
    lp.add_argument("--profile", choices=["full", "quick", "stealth"], default="full")
    lp.add_argument("--rps", type=float, default=10.0, help="Requests per second (default: 10)")
    lp.add_argument("--auth-token", type=str, default=None, help="Bearer auth token")

    args = parser.parse_args()

    # Import Guardian here to avoid circular dependencies
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
    from guardian import DarkmatterGuardian

    tracker = DarkmatterTracker()
    guardian = DarkmatterGuardian(tracker.dm_dir)

    if args.command == "init":
        tracker.init_workspace(user_name=args.name, show_banner_callback=print_banner)
        return

    if args.command == "log":
        if not tracker.is_initialized():
            console.print("[bold red]✗ Error: Darkmatter Lab not initialized.[/]")
            return
        
        console.rule("[bold cyan]DARKMATTER AUDIT LOG (PROVENANCE)", style="cyan")
        if not tracker.log_file.exists():
            console.print("  [dim]No log entries found.[/]")
        else:
            with open(tracker.log_file, "r") as f:
                for line in f:
                    entry = json.loads(line)
                    ts = entry.get("human_time")
                    cmd = entry.get("command")
                    tgt = entry.get("target")
                    tgt_ip = entry.get("target_ip", "unknown")
                    atk = entry.get("attacker_ip")
                    sys_os = entry.get("os", "?")
                    
                    console.print(f"[bold green]Commit:[/] {entry.get('timestamp')}")
                    console.print(f"  [bold white]Action:[/]    {cmd}")
                    console.print(f"  [bold white]Target:[/]    {tgt} [dim]({tgt_ip})[/]")
                    console.print(f"  [bold white]Attacker:[/]  {atk} [dim](OS: {sys_os})[/]")
                    console.log(f"  [dim]Timestamp: {ts}[/]")
                    console.print("-" * 40)
        return

    if args.command == "restore":
        guardian.unlock_system()
        console.print("[bold green]✅ Access Restored.[/] Guardian Sentinel reset for testing.")
        return

    # Check for initialization for all other commands
    if args.command in ["agent", "scan", "fuzz", "attack", "lifecycle"]:
        if not tracker.is_initialized():
            console.print("[bold red]✗ Error: Darkmatter Lab not initialized.[/]")
            console.print("You must run [bold cyan]python darkmatter.py init[/] before performing any operations.")
            sys.exit(1)
            
        # 🕵️ Guardian Protection
        recent = guardian.analyze_recent_activity()
        if recent["status"] == "danger":
            guardian.lock_system(recent["reason"])
            
        if not guardian.validate_target(getattr(args, "target", "")):
            console.print(f"\n[bold red]🚨 SECURITY ALERT: System Restricted[/]")
            console.print(f"[white]Reason: {guardian.analyze_recent_activity().get('reason', 'Security Violation')}[/]")
            console.print(f"[dim]To restore access for testing, run the restore command.[/]\n")
            sys.exit(1)

    if args.command == "vm":
        tracker.track_action("vm", "e2b_remote", {"command": args.tool_cmd})
        from core.e2b_sandbox import DarkmatterSandbox
        import asyncio

        print_banner()
        console.rule("[bold cyan]E2B REMOTE SANDBOX", style="cyan")
        console.print(f"  [bold white]VM Command:[/]  {args.tool_cmd}")
        console.print(f"  [bold white]Status:[/]      Spinning up enclave...")

        sandbox = DarkmatterSandbox()
        result = asyncio.run(sandbox.execute_tool(args.tool_cmd))

        if "error" in result:
            console.print(f"\n[bold red]✗ Sandbox Error:[/] {result['error']}")
        else:
            console.print(f"  [bold white]Sandbox ID:[/]  {result['sandbox_id']}")
            console.print(f"  [bold white]Exit Code:[/]   {result['exit_code']}")
            console.print()
            console.rule("[bold white]STDOUT", style="dim")
            console.print(result["stdout"] or "[dim]No output[/]")
            if result["stderr"]:
                console.print()
                console.rule("[bold red]STDERR", style="dim")
                console.print(result["stderr"], style="red")
            console.rule("[bold green]SESSION TERMINATED", style="green")
        return

    def ensure_http(url):
        url = url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            return f"https://{url}"
        return url

    # Consent form for active scanning commands
    if args.command in ["scan", "fuzz", "attack", "lifecycle"]:
        target_url = ensure_http(getattr(args, "target", ""))
        setattr(args, "target", target_url)
        console.print()
        console.rule("[bold red]⚠️  LEGAL CONSENT & LIABILITY AGREEMENT", style="red")
        console.print(f"  [bold white]Target:[/] {target_url}")
        console.print("  [bold red]WARNING:[/] Unauthorized scanning is a crime.")
        
        from rich.prompt import Prompt
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        ans1 = Prompt.ask("  Do you have permission to scan this target? [y/N]").strip().lower()
        
        if ans1 in ['y', 'yes']:
            console.print("  [bold green][+] Permission confirmed. Protocol Delta-7 Initialized.[/]")
            import uuid
            token = str(uuid.uuid4())
            filename = f"dm-verify-{token[:8]}.txt"
            console.print(f"  [cyan][?][/] Verifying ownership of {target_url}...")
            console.print(f"  [bold red][!][/] To perform a FULL DEEP SCAN, upload the following signature to the web root:")
            console.print(f"      [bold white]File:[/] /{filename}")
            console.print(f"      [bold white]Content:[/] {token}")
            console.print()
            ans2 = Prompt.ask("  Have you uploaded the file? Type [bold]'verify'[/] to check, or [bold]'skip'[/] to bypass").strip().lower()
            
            if ans2 == 'verify':
                import requests
                console.print(f"  [cyan][*][/] Connecting to {target_url} for signature check...")
                try:
                    r = requests.get(f"{target_url}/{filename}", verify=False, timeout=5)
                    if token in r.text:
                        console.print("  [bold green][+] Signature matched! Ownership verified.[/]")
                    else:
                        console.print("  [bold red][!] Signature NOT found or mismatch. Access denied.[/]")
                        console.print("  [cyan][*][/] Falling back to Simple Scan Mode.")
                        if hasattr(args, 'profile'): args.profile = "quick"
                except Exception:
                    console.print("  [bold red][!] Network error during verification.[/]")
                    console.print("  [cyan][*][/] Falling back to Simple Scan Mode.")
                    if hasattr(args, 'profile'): args.profile = "quick"
            else:
                console.print("  [cyan][*][/] Verification Bypassed. Initiating Full Protocol Under Responsibility Waiver.")
                console.print("  [bold red][!] WARNING: You have assumed full legal/technical responsibility for this scan.[/]")
        else:
            console.print("  [bold red][!] No explicit permission confirmed.[/]")
            console.print("  [bold red][!] WARNING: You are proceeding WITHOUT verified permission.[/]")
            console.print("  [bold red][!] You assume FULL RESPONSIBILITY for all legal and technical results.[/]")
            console.print("  [cyan][*][/] Restricted Mode: Proceeding with Simple Reconnaissance Scan.")
            if hasattr(args, 'profile'): args.profile = "quick"


    if args.command == "agent":
        tracker.track_action("agent", args.target, {"goal": args.goal})
        agent = RedTeamAgent(api_key=API_KEY)
        import asyncio
        asyncio.run(agent.execute_mission(args.goal, args.target))
    elif args.command == "scan":
        target = ensure_http(args.target)
        tracker.track_action("scan", target, {"profile": args.profile, "mode": args.mode})
        import asyncio
        asyncio.run(run_scan(target, args.profile, args.mode))
    elif args.command == "fuzz":
        target = ensure_http(args.target)
        tracker.track_action("fuzz", target, {"profile": args.profile, "rps": args.rps})
        run_fuzz(target, args.profile, args.rps, args.auth_token)
    elif args.command == "attack":
        target = ensure_http(args.target)
        tracker.track_action("attack", target, {"profile": args.profile, "mode": args.mode})
        run_attack(target, args.profile, args.mode, args.rps, args.auth_token)
    elif args.command == "lifecycle":
        target = ensure_http(args.target)
        tracker.track_action("lifecycle", target, {"profile": args.profile})
        run_lifecycle(target, args.profile, args.rps, args.auth_token)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

