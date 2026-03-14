<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run devvv
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======

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
>>>>>>> main
