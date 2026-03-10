import asyncio
import time
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Import the core engine tools from our CLI framework
from core.fuzzer import FuzzEngine
from core.executor import AuthConfig
from agents import get_domain
from darkmatter import run_parallel, run_batch

# Define the FastAPI app
app = FastAPI(title="DARKMATTER Fuzzing Framework API", version="3.0")

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in prod if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Data Models ───────────────────────────────────────────────

class FuzzRequestPayload(BaseModel):
    target: str
    profile: str = "quick"
    rps: float = 10.0
    auth_token: Optional[str] = None
    mode: str = "lifecycle"  # "scan", "fuzz", or "lifecycle"

# ─── Endpoints ─────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "3.0", "message": "DARKMATTER is online."}


@app.post("/api/scan/start")
async def start_scan(payload: FuzzRequestPayload):
    """
    Starts a background scan and returns a unique stream ID.
    Because we want to stream directly, we can just return a job ID and have the 
    frontend connect to the stream endpoint.
    """
    import uuid
    job_id = str(uuid.uuid4())
    # In a real heavy app, we'd spawn a background task and hold the Queue in memory.
    # For simplicity, we just return the job ID and let the frontend initiate the SSE connection
    # which will block and run the scanner.
    return {"jobId": job_id, "status": "initialized", "target": payload.target}


@app.get("/api/scan/stream/{job_id}")
async def stream_scan(request: Request, job_id: str, target: str, profile: str = "quick", mode: str = "lifecycle", rps: float = 10.0):
    """
    Streams the output of the cybersecurity scanner back to the frontend in real-time
    using Server-Sent Events (SSE).
    """

    async def event_generator():
        # A queue to hold our live progress messages
        queue = asyncio.Queue()

        def push_event(event_type: str, data: dict):
            # Non-blocking put
            queue.put_nowait((event_type, data))

        # We need to run the heavy scanning in a background task
        # so our generator loop can concurrently yield the queued items.
        async def run_fuzzing_engine():
            domain = get_domain(target)
            push_event("status", {"status": "running", "phase": "init", "message": f"Starting DARKMATTER against {target}"})

            try:
                if mode == "scan":
                    # Run AI mapping (Gemini)
                    push_event("status", {"status": "running", "phase": "recon", "message": "Running AI mapping agents..."})
                    
                    if profile == "full":
                        results = await asyncio.to_thread(run_parallel, target, domain, profile)
                    else:
                        results = await asyncio.to_thread(run_batch, target, domain, profile)

                    for agent_res in results:
                        push_event("agent_report", {
                            "agentName": agent_res["_agent"],
                            "toolName": agent_res["_tool"],
                            "toolOutput": agent_res.get("toolOutput", "No raw output"),
                            "timeTaken": agent_res.get("_time", 0)
                        })
                        for finding in agent_res.get("findings", []):
                            push_event("finding", finding)
                        for port in agent_res.get("ports", []):
                            push_event("port", port)
                        for dir_res in agent_res.get("directories", []):
                            push_event("directory", dir_res)
                    
                    push_event("complete", {"message": "AI Scan complete."})

                elif mode in ("fuzz", "lifecycle"):
                    # Run actual active lifecycle engine
                    auth = AuthConfig(auth_type="bearer", token="token") if False else None # Optional hook
                    
                    loop = asyncio.get_running_loop()
                    def on_progress(phase: str, msg: str):
                        # Safely route sync progress events back to async queue
                        loop.call_soon_threadsafe(push_event, "terminal", {"phase": phase, "log": msg})
                        if phase == "validate" and "Confirmed reproducible" in msg:
                            vector = msg.split(": ")[1]
                            loop.call_soon_threadsafe(push_event, "finding", {
                                "severity": "high", "title": f"Verified {vector}", "endpoint": "unknown", 
                                "description": "Active Fuzzer validated this attack path.", "tool": "Core Engine"
                            })

                    engine = FuzzEngine(target=target, profile=profile, rps=rps, auth=auth, on_progress=on_progress)
                    
                    push_event("terminal", {"phase": "start", "log": f"──▶ Phase 1: Reconnaissance ───────────"})
                    await engine.discover()
                    push_event("terminal", {"phase": "start", "log": f"──▶ Phase 2: Vulnerability Analysis ───────────"})
                    await asyncio.to_thread(engine.classify)
                    await asyncio.to_thread(engine.fuzz_all)
                    push_event("terminal", {"phase": "start", "log": f"──▶ Phase 3: Exploitation ───────────"})
                    await asyncio.to_thread(engine.validate)
                    push_event("terminal", {"phase": "start", "log": f"──▶ Phase 4: Reporting ───────────"})
                    paths = await asyncio.to_thread(engine.report, 0.0)

                    push_event("complete", {
                        "message": "Active Fuzzing Complete",
                        "reportHtml": paths.get("html", ""),
                        "findingsCount": len(engine.all_detections)
                    })

            except Exception as e:
                push_event("error", {"message": str(e)})
                import traceback
                print(traceback.format_exc())

            # Send a poison pill to stop the generator
            await queue.put(None)

        # Start the task
        task = asyncio.create_task(run_fuzzing_engine())

        # Yield events as they come in from the queue
        while True:
            # If client disconnects, stop task
            if await request.is_disconnected():
                task.cancel()
                break

            item = await queue.get()
            if item is None:
                break
            
            event_type, data = item
            # Format as SSE
            yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
