
# 🌌 DARKMATTER — Autonomous AI Red Team Engine

Darkmatter is a Truly Autonomous AI Red Team Engine designed for continuous security verification. It coordinates 15+ AI agents to map attack surfaces, find vulnerabilities, and generate verifiable Proof-of-Concepts (PoCs).

## 🏗️ Architecture

- **`/engine`**: The brain of the operation. Contains the ReAct autonomous agent, fuzzing engine, and 15 specialized security agents.
- **`/backend`**: FastAPI high-performance API. Orchestrates engine runs and syncs findings to Supabase.
- **`/cli`**: Local terminal control. Features Git-like provenance tracking (`init`, `log`) for auditability.
- **`nextapp/` (Root)**: Premium Next.js frontend with realtime terminal and dashboard.

## 🚀 Quick Start

### 1. Initialize the Engine (CLI)
Navigate to `cli/` and set up your lab environment:
```powershell
./darkmatter init --name "YourName"
```

### 2. Start the Backend (FastAPI)
Navigate to `backend/`:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

### 3. Launch the Frontend (Next.js)
In the root directory:
```bash
npm run dev
```

## 🛠️ Security & Audit (Provenance)
Darkmatter includes a built-in provenance system. Every scan is tracked with:
- Target IP Resolution
- Attacker IP & OS Logging
- Lab ID Association

Use `darkmatter log` to view the audit trail.

## 🗄️ Database Setup
Darkmatter uses **Supabase** for persistent storage. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for the SQL schema.

## 🎭 AI Agents
Includes specialized agents for:
- 🔍 Nmap & Infrastructure
- 📁 Directory & File Discovery
- 💉 SQL Injection & XSS
- 🔓 Auth & Credential Stuffing
- 🐳 Container & K8s Security
- 🕵️ OSINT & Subdomain Takeover
- ... and 8 more.

---
**Disclaimer**: This tool is for authorized security testing only.
