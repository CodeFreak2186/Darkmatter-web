
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

from database import get_supabase

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
    job_id = str(uuid.uuid4())
    
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
async def stream_scan(request: Request, job_id: str, target: str, mode: str = "scan", profile: str = "quick"):
    
    async def event_generator():
        queue = asyncio.Queue()
        findings_collector = []
        
        def push_event(event_type: str, data: dict):
            queue.put_nowait((event_type, data))

        async def run_fuzzing():
            start_time = time.time()
            try:
                def on_progress(phase: str, msg: str):
                    push_event("terminal", {"phase": phase, "log": msg})

                engine = FuzzEngine(target=target, profile=profile, on_progress=on_progress)
                
                # Discovery
                push_event("status", {"message": "Phase 1: Discovery"})
                surface = await engine.discover()
                push_event("status", {"message": f"Found {len(surface.endpoints)} endpoints"})

                # Classification
                push_event("status", {"message": "Phase 2: Input Classification"})
                engine.classify()

                # Fuzzing
                push_event("status", {"message": "Phase 3: Active Pentesting"})
                detections = engine.fuzz_all()
                
                # Validation
                push_event("status", {"message": "Phase 4: Validation"})
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

                # Summary & Store in Supabase
                elapsed = time.time() - start_time
                push_event("complete", {
                    "message": "Scan Complete",
                    "findingsCount": len(validated),
                    "duration": f"{elapsed:.1f}s"
                })

                # Sync to Supabase
                supabase = get_supabase()
                if supabase:
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
                push_event("error", {"message": str(e)})
            
            await queue.put(None)

        task = asyncio.create_task(run_fuzzing())
        
        while True:
            if await request.is_disconnected():
                task.cancel()
                break
            
            item = await queue.get()
            if item is None: break
            
            event_type, data = item
            yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
