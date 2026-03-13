# 🌌 DARKMATTER: Master Project Documentation

Welcome to the definitive guide for **DARKMATTER**, an autonomous AI-driven Red Team framework. This document outlines every capability, architectural component, and operational mode of the system.

---

## 🏛️ 1. Project Overview & Vision
DARKMATTER is designed to bridge the gap between automated scanners and human-led penetration tests. It uses a **coordinated swarm of 15 AI agents** (powered by Gemini 2.5 Flash) and a **rigorous fuzzer engine** to discover, analyze, and exploit vulnerabilities with zero false positives.

---

## 🤖 2. The 15-Agent AI Swarm
Each agent is a specialized LLM persona with distinct tools and prompting logic.

| Agent | Focus Area | Primary Tools |
| :--- | :--- | :--- |
| **🔍 Nmap Agent** | Infrastructure & Port Scanning | Nmap, Shodan |
| **📁 Dirb Agent** | Directory Brute-forcing | Gobuster, Dirb |
| **🌐 Nikto Agent** | Web Server Vulnerabilities | Nikto, WhatWeb |
| **💉 SQLMap Agent** | Database Injection | SQLMap, XSStrike |
| **⚡ Metasploit Agent** | Exploitation & Credential Stuffing | MSFConsole, Hydra |
| **🔒 SSL Agent** | Encryption & TLS Security | Testssl.sh, SSLScan |
| **🕵️ OSINT Agent** | Open Source Intelligence | Amass, TheHarvester |
| **🛡️ Burp Agent** | Request Header & CORS Analysis | Custom CORS/SSRF Scanners |
| **☁️ Cloud Agent** | AWS/GCP/Azure Misconfigurations | ScoutSuite, Pacu |
| **🐳 Container Agent** | Docker & Kubernetes Security | Trivy, Kube-hunter |
| **🔌 API Agent** | REST/GraphQL/SOAP Security | Kiterunner, RESTler |
| **🔑 Secret Agent** | Leaked Keys & Sensitive Data | Nuclei, TruffleHog |
| **🧱 WAF Agent** | Firewall Bypass & Fingerprinting | WafW00f, WhatWaf |
| **🎭 AD Identity Agent** | Active Directory & Identity | CrackMapExec, BloodHound |
| **🚩 Takeover Agent** | Subdomain Takeover | Subzy, Nuclei |

---

## ⚡ 3. The 4-Phase Pentest Lifecycle
Behind the CLI's `lifecycle` command is a multi-stage engine that ensures precision.

### Phase 1: Reconnaissance (Discovery)
- **Crawler**: Depth-first/Breadth-first exploration of the target.
- **Surface Mapping**: Identifies URL parameters, forms, JS files, and API endpoints.
- **Scope Enforcement**: Uses `ScopeEnforcer` to stay within legal/requested boundaries.

### Phase 2: Vulnerability Analysis (Classify & Target)
- **Input Classifier**: Analyzes every parameter to determine if it's a URL, Path, JSON key, or Credential field.
- **Vector Mapping**: Assigns specific attack vectors (SQLi, XSS, SSRF) based on input classification.

### Phase 3: Exploitation (Fuzz & Validate)
- **Payload Engine**: Generates targeted payloads for identified vectors.
- **Request Executor**: Executes fuzzed requests with real-time rate limiting (RPS).
- **No Exploit, No Report Policy**: The `Validator` module attempts a Proof-of-Concept for every detection. If it doesn't trigger a measurable impact, it's discarded.

### Phase 4: Reporting
- **Multi-Format Out**: Generates interactive HTML dashboards, JSON logs, and terminal tables.
- **Risk Scoring**: Calculates a CVSS-based risk score for the entire target.

---

## 🖥️ 4. Mission Control (Web Interface)
Located in `nextapp/`, this is the visual command center for the operator.

### 📊 Security Dashboard
Provides a Birds-Eye view of the attack surface, active threats, and risk scores. Features real-time charts and finding cards.

### ✈️ Autopilot
An AI-powered autonomous attacker. You give it a high-level goal (e.g., "Find a way into the admin console"), and it plans and executes multi-round attack chains independently.

### ⌨️ Kali Terminal
A web-based terminal interface designed for low-latency manual command execution. It allows you to run CLI tools directly from the browser.

### 🛠️ Web IDE
A full-featured code editor (Monaco-based) for writing custom exploit scripts, editing payloads, or analyzing harvested source code.

### 📡 Threat Radar
A 3D visualization using Three.js and GlobeWireframe that shows active monitoring dots and intercepted packets across a global map.

---

## 🛠️ 5. Technical Architecture
The project is split into two primary environments:

- **CLI Engine (Python)**:
  - `core/`: The "Brain". Contains `fuzzer`, `detector`, `payloads`, and `validator`.
  - `darkmatter.py`: The entry point orchestrating the `argparse` subcommands.
- **Web App (Next.js)**:
  - `api/`: Backend routes that interface with the AI models and job runners.
  - `components/`: High-performance UI components using Framer Motion and GSAP.

---

## 🚀 6. Operational Modes

### 1. AI Scan (`scan`)
Fast reconnaissance. Gemini simulates tool output based on its knowledge of the target's tech stack. Useful for quick preliminary analysis.

### 2. Active Fuzz (`fuzz`)
Real-world traffic. The engine crawls the site and injects thousands of payloads to find real vulnerabilities.

### 3. Full Lifecycle (`lifecycle`)
The "Gold Standard". Runs everything from Discovery to Reporting in a single, verified pipeline.

---

## 🛡️ Responsible Usage
DARKMATTER is a professional-grade tool. Ensure you have explicit permission before scanning any target.

> **Secure the Future. Master the Dark.**
