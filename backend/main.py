
import os
import sys
import asyncio
import json
import uuid
import time
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()
API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Add engine to path
engine_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "engine"))
if engine_path not in sys.path:
    sys.path.insert(0, engine_path)

# Import engine logic
from core.fuzzer import FuzzEngine
from core.executor import AuthConfig
from agents import get_domain, AGENTS, build_batch_prompt
from core.agent import RedTeamAgent
from core.crawler import Crawler
from core.tracker import DarkmatterTracker
from guardian import DarkmatterGuardian

from database import get_supabase

# Initialize Security & Governance
tracker = DarkmatterTracker()
guardian = DarkmatterGuardian(tracker.dm_dir)

app = FastAPI(title="DARKMATTER Backend", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Data Models ───────────────────────────────────────────────

class ScanRequest(BaseModel):
    target: str
    profile: str = "quick"
    mode: str = "scan" # scan, fuzz, agent
    goal: Optional[str] = None

# ─── Endpoints ─────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "3.0"}

@app.post("/api/scan/start")
async def start_scan(request: ScanRequest):
    # 🕵️ Guardian Check
    recent = guardian.analyze_recent_activity()
    if recent["status"] == "danger":
        guardian.lock_system(recent["reason"])
    
    if not guardian.validate_target(request.target):
        return {
            "jobId": None, 
            "status": "blocked", 
            "error": "SECURITY VIOLATION: Target restricted.",
            "reason": "System is in Restricted Mode. Only lab-testing targets are allowed."
        }

    job_id = str(uuid.uuid4())
    
    # Audit Tracking
    tracker.track_action(f"web_{request.mode}", request.target, {"profile": request.profile})
    
    # Pre-log to Supabase
    supabase = get_supabase()
    if supabase:
        try:
            supabase.table("scans").insert({
                "job_id": job_id,
                "target": request.target,
                "status": "pending",
                "mode": request.mode,
                "profile": request.profile,
                "created_at": "now()"
            }).execute()
        except Exception as e:
            print(f"Supabase error: {e}")

    return {"jobId": job_id, "status": "initialized", "target": request.target}

@app.get("/api/scan/stream/{job_id}")
async def stream_scan(request: Request, job_id: str, target: str, mode: str = "scan", profile: str = "quick", goal: Optional[str] = None):
    
    async def event_generator():
        queue = asyncio.Queue()
        findings_collector = []
        
        def push_event(event_type: str, data: dict):
            queue.put_nowait((event_type, data))

        async def run_scan_logic():
            start_time = time.time()
            try:
                def on_progress(phase: str, msg: str):
                    push_event("terminal", {"phase": phase, "log": msg})
                    push_event("status", {"message": f"{phase.capitalize()}: {msg}"})

                if mode == "scan":
                    # 1. Recon Phase
                    on_progress("recon", "🕸️ Deep Reconnaissance Crawl...")
                    crawler = Crawler(max_depth=1 if profile == "quick" else 2)
                    surface = await crawler.crawl(target)
                    
                    on_progress("recon", f"✓ Found {len(surface.endpoints)} endpoints & {len(surface.technologies)} technologies.")
                    
                    # Push Technologies
                    for tech in surface.technologies:
                        push_event("finding", {
                            "severity": "info", "title": f"Tech: {tech}", "endpoint": target,
                            "path": "Detection confirmed", "description": f"Target uses {tech}.", "tool": "Crawler"
                        })

                    # 2. Parallel AI Pentest Phase
                    on_progress("analysis", f"🚀 Launching {len(AGENTS)} AI Agents in Parallel...")
                    domain = get_domain(target)
                    context = f"Endpoints: {[e.url for e in surface.endpoints[:10]]}\nTech: {surface.technologies}"
                    
                    async def run_agent_and_push(agent, index):
                        def sync_task():
                            try:
                                prompt = agent.build_prompt(target, domain, profile)
                                if context:
                                    prompt += f"\n\nREAL RECON CONTEXT:\n{context}"
                                
                                raw = RedTeamAgent(api_key=API_KEY)._call_ai(prompt)
                                first = raw.find("{")
                                last = raw.rfind("}")
                                if first != -1 and last != -1:
                                    data = json.loads(raw[first:last+1])
                                    return data.get("findings", [])
                            except Exception as e:
                                print(f"Agent {agent.name} error: {e}")
                            return []

                        # Run the sync AI call in a separate thread to keep SSE flowing
                        findings = await asyncio.to_thread(sync_task)
                        
                        on_progress("analysis", f"Agent {agent.name} complete ({len(findings)} findings).")
                        push_event("terminal", {"phase": "analysis", "log": f"[{agent.icon}] {agent.name} finished."})
                        
                        for f in findings:
                            finding = {
                                "severity": str(f.get("severity", "medium")).lower(),
                                "title": f.get("title", f"{agent.name} Finding"),
                                "endpoint": f.get("endpoint", "/"),
                                "path": f.get("endpoint", "/"),
                                "description": f.get("description", ""),
                                "tool": agent.tool_name,
                                "agent": agent.name
                            }
                            push_event("finding", finding)
                            findings_collector.append(finding)

                    # Launch all agents as concurrent tasks
                    agent_tasks = [run_agent_and_push(a, i) for i, a in enumerate(AGENTS)]
                    await asyncio.gather(*agent_tasks)

                elif mode == "fuzz":
                    engine = FuzzEngine(target=target, profile=profile, on_progress=on_progress)
                    surface = await engine.discover()
                    engine.classify()
                    detections = engine.fuzz_all()
                    validated = engine.validate()
                    
                    for det in validated:
                        finding = {
                            "severity": det.severity,
                            "title": f"{det.vector.value} Vulnerability",
                            "endpoint": det.request.url,
                            "description": det.evidence,
                            "tool": "Darkmatter Fuzzer"
                        }
                        push_event("finding", finding)
                        findings_collector.append(finding)

                elif mode == "agent":
                    # Mission-driven autonomous agent
                    actual_goal = goal or f"Find all critical vulnerabilities in {target}"
                    agent = RedTeamAgent(api_key=API_KEY, on_progress=lambda m: on_progress("agent", m))
                    
                    mission_result = await agent.execute_mission(actual_goal, target)
                    
                    for f in mission_result.get("findings", []):
                        finding = {
                            "severity": f.get("severity", "high"),
                            "title": f.get("title", "AI Agent Finding"),
                            "endpoint": f.get("endpoint", target),
                            "description": f.get("description", ""),
                            "tool": "Autonomous Agent"
                        }
                        push_event("finding", finding)
                        findings_collector.append(finding)

                # Summary & Store in Supabase
                elapsed = time.time() - start_time
                push_event("complete", {
                    "message": "Scan Complete",
                    "totalFindings": len(findings_collector),
                    "duration": f"{elapsed:.1f}s",
                    "riskScore": min(10, sum([5 if f["severity"] == "critical" else 3 if f["severity"] == "high" else 1 for f in findings_collector])),
                    "openPorts": 0, # Not implemented in this lite version
                    "directories": 0 # Not implemented in this lite version
                })

                # Sync to Supabase
                supabase = get_supabase()
                if supabase:
                    try:
                        supabase.table("scans").update({"status": "complete", "completed_at": "now()"}).eq("job_id", job_id).execute()
                        for f in findings_collector:
                            supabase.table("findings").insert({
                                "job_id": job_id,
                                "severity": f["severity"],
                                "title": f["title"],
                                "endpoint": f["endpoint"],
                                "description": f["description"],
                                "tool": f["tool"]
                            }).execute()
                    except Exception as e:
                        print(f"Supabase sync error: {e}")

            except Exception as e:
                import traceback
                traceback.print_exc()
                push_event("error", {"message": str(e)})
            
            await queue.put(None)

        task = asyncio.create_task(run_scan_logic())
        
        while True:
            if await request.is_disconnected():
                task.cancel()
                break
            
            item = await queue.get()
            if item is None: break
            
            event_type, data = item
            yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/guardian/status")
def guardian_status():
    return {
        "locked": guardian.is_locked(),
        "recent_analysis": guardian.analyze_recent_activity(),
        "allow_list": guardian.allow_list
    }

@app.post("/api/guardian/restore")
def guardian_restore():
    """Giving back the access (as requested)."""
    guardian.unlock_system()
    return {"status": "unlocked", "message": "Access restored for testing purposes."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
