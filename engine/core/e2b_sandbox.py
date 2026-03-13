
import os
import asyncio
from e2b import Sandbox

# Tools that need installation in the base VM
TOOL_INSTALL_MAP = {
    "nmap":       "sudo apt-get update -qq && sudo apt-get install -y nmap",
    "nikto":      "sudo apt-get install -y nikto",
    "dirb":       "sudo apt-get install -y dirb",
    "gobuster":   "sudo apt-get install -y gobuster",
    "sqlmap":     "sudo apt-get install -y sqlmap",
    "hydra":      "sudo apt-get install -y hydra",
    "whois":      "sudo apt-get install -y whois",
    "host":       "sudo apt-get install -y bind9-host",
    "dig":        "sudo apt-get install -y dnsutils",
    "testssl.sh": "sudo apt-get install -y testssl.sh",
    "sslscan":    "sudo apt-get install -y sslscan",
    "wafw00f":    "pip install wafw00f -q",
    "subfinder":  "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
    "nuclei":     "go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest",
}


class DarkmatterSandbox:
    """
    E2B-powered sandboxed environment for executing pentest tools.
    Spins up isolated Debian VMs via e2b.dev.
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("E2B_API_KEY")

    def _get_tools_to_install(self, command: str) -> list:
        """Detect which tools in the command need to be pre-installed."""
        needed = []
        for tool, install_cmd in TOOL_INSTALL_MAP.items():
            if command.startswith(tool) or f" {tool} " in command or f"/{tool}" in command:
                needed.append((tool, install_cmd))
        return needed

    async def execute_tool(self, command: str, target: str = "", on_log=None) -> dict:
        """
        Runs a real command in the E2B sandbox.
        Automatically installs required tools.
        Streams stdout/stderr in real-time via on_log callback.
        """
        if not self.api_key:
            return {"error": "E2B_API_KEY is missing in your .env file."}

        os.environ["E2B_API_KEY"] = self.api_key

        def log(msg: str):
            print(msg)
            if on_log:
                on_log(msg)

        def run_sync():
            try:
                with Sandbox.create(timeout=300) as sb:
                    log(f"[E2B] ✓ Sandbox ready. ID: {sb.sandbox_id}")

                    # Auto-install missing tools
                    tools_needed = self._get_tools_to_install(command)
                    if tools_needed:
                        for tool_name, install_cmd in tools_needed:
                            log(f"[E2B] 📦 Installing {tool_name}...")
                            install_result = sb.commands.run(install_cmd, timeout=120)
                            if install_result.exit_code != 0:
                                log(f"[E2B] ⚠️  Install warning for {tool_name}: {install_result.stderr[:200]}")
                            else:
                                log(f"[E2B] ✓ {tool_name} installed.")

                    log(f"[E2B] 🔥 Executing: {command}")
                    log("─" * 60)

                    # Execute the actual command
                    result = sb.commands.run(command, timeout=120)

                    return {
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "exit_code": result.exit_code,
                        "sandbox_id": sb.sandbox_id,
                        "command": command,
                    }
            except Exception as e:
                return {"error": str(e)}

        return await asyncio.to_thread(run_sync)
