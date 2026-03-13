
"""
agent.py — Truly autonomous agent loop for Darkmatter.
Uses ReAct (Reasoning + Acting) to execute real tools and scripts.
"""

import json
import os
import subprocess
import sys
import time
import logging
from typing import List, Dict, Any, Callable
from pathlib import Path

from google import genai
from rich.console import Console
from rich.panel import Panel
from rich.live import Live
from rich.markdown import Markdown
from rich.spinner import Spinner

from core.crawler import Crawler, AttackSurface
from core.fuzzer import FuzzEngine
from agents import get_domain

console = Console()
logger = logging.getLogger("darkmatter.agent")

class RedTeamAgent:
    def __init__(self, api_key: str, model_name: str = "models/gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self.history = []
        self.max_steps = 15
        self.working_dir = Path("workspaces")
        self.working_dir.mkdir(exist_ok=True)

    def _call_ai(self, prompt: str) -> str:
        try:
            resp = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=8192,
                )
            )
            return resp.text or ""
        except Exception as e:
            console.print(f"[bold red]AI Error:[/] {e}")
            return ""

    def run_command(self, cmd: str) -> str:
        console.print(f"  [bold cyan]🛠 Action:[/] Running shell: [dim]{cmd}[/]")
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=120
            )
            output = result.stdout + result.stderr
            return output if output else "[Empty Output]"
        except Exception as e:
            return f"Error: {str(e)}"

    def python_exec(self, code: str) -> str:
        console.print(f"  [bold cyan]🛠 Action:[/] Executing Python code...")
        path = self.working_dir / f"script_{int(time.time())}.py"
        path.write_text(code)
        return self.run_command(f"python \"{path}\"")

    async def run_recon(self, target: str) -> str:
        console.print(f"  [bold cyan]🛠 Action:[/] Running specialized crawler on [dim]{target}[/]")
        crawler = Crawler(max_depth=2)
        surface = await crawler.crawl(target)
        # Convert surface to a concise summary for the AI
        summary = {
            "endpoints": [f"{e.method} {e.url}" for e in surface.endpoints[:20]],
            "tech": surface.technologies,
            "headers": surface.response_headers,
            "js_files": surface.js_files[:10]
        }
        return json.dumps(summary, indent=2)

    async def execute_mission(self, goal: str, target: str):
        domain = get_domain(target)
        mission_id = f"{domain}_{int(time.time())}"
        
        system_prompt = f"""You are DARKMATTER AGENT, a professional autonomous red-team operator.
Your mission: {goal}
Target: {target} (Domain: {domain})

You act in a loop: THOUGHT -> ACTION -> OBSERVATION.
Available Actions:
1. `recon(url)`: Runs the internal crawler to map attack surface.
2. `shell(command)`: Runs a real shell command (Windows/PowerShell).
3. `python(code)`: Executes a python script (useful for custom fuzzers/exploit scripts).
4. `finish(summary)`: Completes the mission with a final report.

GUIDELINES:
- Start with reconnaissance.
- Analyze real outputs. DO NOT simulate or guess.
- If a tool like nmap is missing, write a python-based port scanner using `python(code)`.
- Be thorough but efficient.
- Use `finish` when you have verified vulnerabilities or exhausted options.

FORMAT YOUR RESPONSE AS:
THOUGHT: [Brief reasoning]
ACTION: [Action name]([Parameters])
"""

        mission_log = [f"Mission started: {goal}"]
        
        console.print(Panel(f"[bold cyan]Mission:[/]\n{goal}\n\n[bold white]Target:[/] {target}", title="DARKMATTER AUTONOMOUS MODE", border_style="green"))

        for step in range(self.max_steps):
            prompt = system_prompt + "\n\n" + "\n".join(mission_log[-10:]) + f"\n\nStep {step+1}/{self.max_steps}\nTHOUGHT:"
            
            with console.status(f"[bold yellow]Agent Thinking (Step {step+1})..."):
                raw_response = self._call_ai(prompt)
            
            if not raw_response:
                break
            
            # Print thought
            if "THOUGHT:" in raw_response:
                thought = raw_response.split("THOUGHT:")[1].split("ACTION:")[0].strip()
                console.print(f"\n[bold yellow]🤔 Thought (Step {step+1}):[/]\n{thought}")
            
            if "ACTION:" in raw_response:
                action_part = raw_response.split("ACTION:")[1].strip()
                
                obs = ""
                if action_part.startswith("recon("):
                    url = action_part[6:-1].strip("'\"")
                    obs = await self.run_recon(url)
                elif action_part.startswith("shell("):
                    cmd = action_part[6:-1].strip("'\"")
                    obs = self.run_command(cmd)
                elif action_part.startswith("python("):
                    code = action_part[7:-1].strip("'\"")
                    if action_part.endswith(")\n"): code = action_part[7:-2] # handle multiline
                    obs = self.python_exec(code)
                elif action_part.startswith("finish("):
                    summary = action_part[7:-1]
                    console.print(Panel(summary, title="MISSION COMPLETE", border_style="bold green"))
                    return
                else:
                    obs = "Error: Invalid action format. Use recon(url), shell(cmd), python(code), or finish(summary)."
                
                console.print(f"  [dim]Observation (truncated): {obs[:500]}...[/]")
                mission_log.append(f"STEP {step+1}:\nTHOUGHT: {thought}\nACTION: {action_part}\nOBSERVATION: {obs}")
            else:
                console.print("[red]Error: AI failed to provide an action.[/]")
                break
        
        console.print("[bold red]Mission timed out before completion.[/]")

