
import os
import json
import time
from pathlib import Path
from typing import List

class DarkmatterGuardian:
    def __init__(self, dm_dir: Path):
        self.dm_dir = dm_dir
        self.restricted_file = dm_dir / "restricted.flag"
        self.audit_log = dm_dir / "audit.jsonl"
        self.allow_list = ["localhost", "127.0.0.1", "juice-shop.herokuapp.com", "vulnerable"]
        
    def is_locked(self) -> bool:
        """Check if the system is currently locked."""
        return self.restricted_file.exists()
        
    def lock_system(self, reason: str = "Unspecified security violation"):
        """Lock the system for security reasons."""
        self.restricted_file.write_text(json.dumps({
            "locked_at": int(time.time()),
            "reason": reason
        }))
        
    def unlock_system(self):
        """Unlock the system (Restore Access)."""
        if self.restricted_file.exists():
            self.restricted_file.unlink()
            
    def validate_target(self, target: str) -> bool:
        """Verify if a target is allowed under current restrictions."""
        if not self.is_locked():
            return True
        
        # In locked mode, only allow explicitly whitelisted targets
        return any(allowed in target.lower() for allowed in self.allow_list)

    def analyze_recent_activity(self) -> dict:
        """Analyze audit logs for suspicious patterns."""
        if not self.audit_log.exists():
            return {"status": "safe", "reason": "No logs found"}
            
        suspicious_keywords = [".gov", ".mil", "cia.gov", "fbi.gov", "bank", "finance"]
        
        try:
            with open(self.audit_log, "r") as f:
                lines = f.readlines()
                recent = lines[-20:] # Check last 20 actions
                
                for line in recent:
                    entry = json.loads(line)
                    target = entry.get("target", "").lower()
                    
                    if any(bad in target for bad in suspicious_keywords):
                        return {"status": "danger", "reason": f"Prohibited target detected: {target}", "target": target}
                        
            return {"status": "safe"}
        except Exception as e:
            return {"status": "error", "reason": str(e)}
