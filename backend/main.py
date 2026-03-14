
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
from agents import get_domain, AGENTS, build_batch_prompt, DARKMATTER_CORE_RULES
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

@app.get("/api/verify/token")
def get_verify_token(target: str):
    token = guardian.generate_verification_token(target)
    return {"token": token, "filename": f"darkmatter-{token}.txt"}

@app.post("/api/verify/check")
async def check_verification(request: Request):
    data = await request.json()
    target = data.get("target")
    token = data.get("token")
    if not target or not token:
        return {"verified": False, "error": "Missing target or token"}
    
    is_verified = await guardian.verify_permission(target, token)
    return {"verified": is_verified}

@app.get("/api/scan/stream/{job_id}")
async def stream_scan(request: Request, job_id: str, target: str, mode: str = "scan", profile: str = "quick", goal: Optional[str] = None, verified: bool = False):
    if not target:
        async def error_gen():
            yield f"event: error\ndata: {json.dumps({'message': 'Invalid target: URL cannot be empty'})}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")
    
    async def event_generator():
        queue = asyncio.Queue()
        findings_collector = []
        
        def push_event(event_type: str, data: dict, sync_db: bool = False):
            queue.put_nowait((event_type, data))
            if sync_db and event_type == "finding":
                supabase = get_supabase()
                if supabase:
                    try:
                        supabase.table("findings").insert({
                            "job_id": job_id,
                            "severity": data.get("severity", "medium"),
                            "title": data.get("title", "Unknown"),
                            "endpoint": data.get("endpoint", "/"),
                            "description": data.get("description", ""),
                            "tool": data.get("tool", "AI Agent")
                        }).execute()
                    except: pass

        async def run_scan_logic():
            start_time = time.time()
            try:
                def on_progress(phase: str, msg: str):
                    push_event("terminal", {"phase": phase, "log": msg})
                    push_event("status", {"message": f"{phase.capitalize()}: {msg}"})

                if mode == "scan":
                    # 1. Recon Phase — Real Crawl
                    on_progress("recon", "🕸️ Real Reconnaissance Crawl starting...")
                    crawler = Crawler(max_depth=1 if profile == "quick" else 2)
                    surface = await crawler.crawl(target)
                    on_progress("recon", f"✓ Found {len(surface.endpoints)} endpoints & {len(surface.technologies)} technologies.")
                    
                    for tech in surface.technologies:
                        push_event("finding", {
                            "severity": "info", "title": f"Tech: {tech}", "endpoint": target,
                            "path": "Detection confirmed", "description": f"Target uses {tech}.", "tool": "Crawler"
                        }, sync_db=True)

                    # 2. Real HTTP Security Probes
                    from core.real_scanner import RealScanner, findings_to_dict
                    on_progress("probe", "🔬 Running real HTTP security probes...")
                    
                    scanner = RealScanner(target)
                    
                    real_findings_raw = await scanner.run_all(
                        on_progress=lambda p, m: push_event("terminal", {"phase": p, "log": m})
                    )
                    real_findings = findings_to_dict(real_findings_raw)
                    on_progress("probe", f"✓ {len(real_findings)} real evidence-backed findings discovered.")
                    
                    for f in real_findings:
                        push_event("finding", f, sync_db=True)
                        findings_collector.append(f)

                    # 3. Parallel AI Deep Analysis
                    if verified:
                        on_progress("analysis", f"🚀 Verified: Launching {len(AGENTS)} AI Agents in Parallel...")
                        domain = get_domain(target)
                        context = f"Endpoints: {[e.url for e in surface.endpoints[:10]]}\nTech: {surface.technologies}"
                        
                        async def run_agent_and_push(agent, index):
                            def sync_task():
                                try:
                                    agent_task = agent.build_prompt(target, domain, profile)
                                    prompt = f"{DARKMATTER_CORE_RULES}\nTarget: {target}\nTASK: {agent_task}\nReturn JSON with 'findings' and 'false_positives_removed' lists."
                                    if context:
                                        prompt += f"\n\nREAL RECON CONTEXT:\n{context}"
                                    
                                    raw = RedTeamAgent(api_key=API_KEY)._call_ai(prompt)
                                    
                                    # Robust JSON extraction
                                    data = {}
                                    try:
                                        import re
                                        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
                                        if fenced:
                                            text = fenced.group(1)
                                        else:
                                            text = raw

                                        # Find the start of JSON
                                        first_brace = text.find("{")
                                        first_bracket = text.find("[")
                                        idx = -1
                                        if first_brace != -1 and first_bracket != -1:
                                            idx = min(first_brace, first_bracket)
                                        else:
                                            idx = max(first_brace, first_bracket)
                                            
                                        if idx != -1:
                                            end_idx = text.rfind("}") if text[idx] == "{" else text.rfind("]")
                                            if end_idx != -1:
                                                text = text[idx:end_idx+1]
                                            else:
                                                text = text[idx:]
                                                
                                        parsed = json.loads(text.strip())
                                        if isinstance(parsed, list):
                                            data = {"findings": parsed}
                                        elif isinstance(parsed, dict):
                                            data = parsed
                                    except Exception as je:
                                        print(f"JSON Parse Error for {agent.name}: {je}")
                                        print(f"Raw output was: {raw[:100]}...")
                                        data = {"findings": []}
                                        
                                    return data.get("findings", [])
                                except Exception as e:
                                    print(f"Agent {agent.name} error: {e}")
                                return []

                            import time
                            start_agent_time = time.time()
                            try:
                                findings = await asyncio.to_thread(sync_task)
                                status = "done"
                                error = None
                            except Exception as e:
                                findings = []
                                status = "error"
                                error = str(e)
                            
                            elapsed = time.time() - start_agent_time
                            push_event("agent_report", {
                                "agentName": agent.name,
                                "toolName": agent.tool_name,
                                "toolOutput": f"{len(findings)} findings discovered" if status == "done" else f"Error: {error}",
                                "timeTaken": elapsed,
                                "status": status
                            })
                            
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
                                push_event("finding", finding, sync_db=True)
                                findings_collector.append(finding)

                        # Launch all agents as concurrent tasks
                        agent_tasks = [run_agent_and_push(a, i) for i, a in enumerate(AGENTS)]
                        await asyncio.gather(*agent_tasks)
                    else:
                        on_progress("analysis", "🛡️ Unverified Target: Deep AI Analysis Restricted. Simple scan mode enabled.")
                        push_event("terminal", {"phase": "analysis", "log": "[!] Deep scan requires ownership verification. File missing on target."})

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
                    "riskScore": min(10, sum([5 if f.get("severity") == "critical" else 3 if f.get("severity") == "high" else 1 for f in findings_collector])),
                    "openPorts": 0,
                    "directories": 0
                })

                # Final status update
                supabase = get_supabase()
                if supabase:
                    try:
                        supabase.table("scans").update({"status": "complete", "completed_at": "now()"}).eq("job_id", job_id).execute()
                    except Exception as e:
                        print(f"Supabase final sync error: {e}")

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
