
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
    def __init__(self, api_key: str, model_name: str = "models/gemini-2.5-flash", on_progress: Callable = None):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self.history = []
        self.max_steps = 15
        self.on_progress = on_progress
        self.findings = []
        self.working_dir = Path("workspaces")
        self.working_dir.mkdir(exist_ok=True)

    def _log(self, msg: str, phase: str = "agent"):
        if self.on_progress:
            if asyncio.iscoroutinefunction(self.on_progress):
                asyncio.create_task(self.on_progress(msg))
            else:
                self.on_progress(msg)
        console.print(f"[{phase}] {msg}")

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
            self._log(f"AI Error: {e}", "error")
            return ""

    def run_command(self, cmd: str) -> str:
        self._log(f"🛠 Action: Running shell: {cmd}")
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=120
            )
            output = result.stdout + result.stderr
            return output if output else "[Empty Output]"
        except Exception as e:
            return f"Error: {str(e)}"

    def python_exec(self, code: str) -> str:
        self._log(f"🛠 Action: Executing Python code...")
        path = self.working_dir / f"script_{int(time.time())}.py"
        path.write_text(code)
        return self.run_command(f"python \"{path}\"")

    async def run_recon(self, target: str) -> str:
        self._log(f"🛠 Action: Running specialized crawler on {target}")
        crawler = Crawler(max_depth=2)
        surface = await crawler.crawl(target)
        summary = {
            "endpoints": [f"{e.method} {e.url}" for e in surface.endpoints[:20]],
            "tech": surface.technologies,
            "headers": surface.response_headers,
        }
        return json.dumps(summary, indent=2)

    async def execute_mission(self, goal: str, target: str) -> Dict[str, Any]:
        domain = get_domain(target)
        self._log(f"🚀 Mission Started: {goal}")
        
        system_prompt = f"""You are DARKMATTER AGENT, a professional autonomous red-team operator.
Your mission: {goal}
Target: {target} (Domain: {domain})

You act in a loop: THOUGHT -> ACTION -> OBSERVATION.
Available Actions:
1. `recon(url)`: Runs internal crawler.
2. `shell(command)`: Runs shell command.
3. `python(code)`: Executes python script.
4. `finish(summary)`: Completes mission.

CRITICAL: If you find a vulnerability, include it in your final summary in JSON format:
FINDING: {{"title": "...", "severity": "...", "endpoint": "...", "description": "..."}}
"""

        mission_log = [f"Mission started: {goal}"]
        
        for step in range(self.max_steps):
            prompt = system_prompt + "\n\n" + "\n".join(mission_log[-10:]) + f"\n\nStep {step+1}/{self.max_steps}\nTHOUGHT:"
            
            raw_response = self._call_ai(prompt)
            if not raw_response: break
            
            if "THOUGHT:" in raw_response:
                thought = raw_response.split("THOUGHT:")[1].split("ACTION:")[0].strip()
                self._log(f"🤔 Thought: {thought}")
            
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
                    obs = self.python_exec(code)
                elif action_part.startswith("finish("):
                    summary = action_part[7:-1]
                    self._log("✅ Mission Complete", "success")
                    # Extract findings from summary
                    findings = []
                    for line in summary.split("\n"):
                        if "FINDING:" in line:
                            try:
                                f_json = line.split("FINDING:")[1].strip()
                                findings.append(json.loads(f_json))
                            except: pass
                    return {"summary": summary, "findings": findings}
                else:
                    obs = "Error: Invalid action. Use recon(url), shell(cmd), python(code), finish(summary)."
                
                mission_log.append(f"STEP {step+1}:\nTHOUGHT: {thought}\nACTION: {action_part}\nOBSERVATION: {obs}")
            else: break
            
        return {"summary": "Timed out", "findings": []}

