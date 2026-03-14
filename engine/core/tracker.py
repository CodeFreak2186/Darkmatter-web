import os
import json
import time
import socket
import requests
import uuid
from pathlib import Path
from rich.console import Console

# Import Supabase from backend if possible
try:
    import sys
    backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    from database import get_supabase
except ImportError:
    def get_supabase(): return None

console = Console()

class DarkmatterTracker:
    def __init__(self, workspace_path: str = "."):
        self.workspace = self._find_lab_root(Path(workspace_path).resolve())
        self.dm_dir = self.workspace / ".darkmatter"
        self.log_file = self.dm_dir / "audit.jsonl"
        self.config_file = self.dm_dir / "config.json"

    def _find_lab_root(self, start_path: Path) -> Path:
        """Search upwards for a .darkmatter directory, like git searchs for .git."""
        current = start_path
        while current.parent != current:  # stop at root
            if (current / ".darkmatter").exists():
                return current
            current = current.parent
        return start_path # fallback to current if not found

    def is_initialized(self) -> bool:
        return (self.dm_dir.exists() and self.config_file.exists())

    def init_workspace(self, user_name: str = "anonymous", show_banner_callback=None):
        if self.is_initialized():
            console.print("[bold yellow]⚠ This directory is already an initialized Darkmatter Lab.[/]")
            return

        if show_banner_callback:
            show_banner_callback()

        self.dm_dir.mkdir(parents=True, exist_ok=True)
        
        config = {
            "initialized_at": int(time.time()),
            "owner": user_name,
            "version": "3.0",
            "lab_id": os.urandom(8).hex()
        }
        
        self.config_file.write_text(json.dumps(config, indent=2))
        
        console.print(f"[bold green]✨ Initialized Darkmatter Lab in {self.workspace}[/]")
        console.print(f"[dim]Lab ID: {config['lab_id']}[/]")
        
        self.track_action("init", "localhost", {"user": user_name})

    def get_attacker_ip(self) -> str:
        try:
            # Try to get public IP
            resp = requests.get("https://api.ipify.org", timeout=3)
            return resp.text
        except:
            try:
                # Fallback to local IP
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except:
                return "127.0.0.1"

    def track_action(self, command: str, target: str, metadata: dict = None):
        if not self.is_initialized():
            return

        attacker_ip = self.get_attacker_ip()
        
        # Resolve target IP
        target_ip = "unknown"
        try:
            domain = target.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
            target_ip = socket.gethostbyname(domain)
        except:
            pass
            
        log_entry = {
            "timestamp": int(time.time()),
            "human_time": time.ctime(),
            "command": command,
            "target": target,
            "target_ip": target_ip,
            "attacker_ip": attacker_ip,
            "os": os.name,
            "metadata": metadata or {}
        }
        
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
            
        # Optional Supabase Sync
        self.sync_to_supabase(command, target, log_entry)

    def sync_to_supabase(self, command: str, target: str, entry: dict):
        supabase = get_supabase()
        if not supabase:
            return

        try:
            # If it's a scan/attack start, create a record
            if command in ["scan", "fuzz", "attack", "lifecycle", "agent"]:
                job_id = str(uuid.uuid4())
                supabase.table("scans").insert({
                    "job_id": job_id,
                    "target": target,
                    "status": "running",
                    "mode": command,
                    "profile": entry.get("metadata", {}).get("profile", "full"),
                    "created_at": "now()"
                }).execute()
        except Exception as e:
            pass

def ensure_initialized():
    tracker = DarkmatterTracker()
    if not tracker.is_initialized():
        console.print("[bold red]✗ Error: Darkmatter Lab not initialized in this directory.[/]")
        console.print("Run [bold cyan]python darkmatter.py init[/] to set up the lab environment.")
        sys.exit(1)
    return tracker
