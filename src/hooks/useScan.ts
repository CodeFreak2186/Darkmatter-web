/**
 * useScan.ts
 * Custom React hook for orchestrating the AI security scan.
 * Handles scan lifecycle: start → stream → results
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────

export type ScanPhase = 'input' | 'policy' | 'scanning' | 'results';
export type ScanStatus = 'pending' | 'running' | 'complete' | 'error';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
    id: number;
    severity: Severity;
    title: string;
    endpoint: string;
    description: string;
    agent: string;
    recommendation?: string;
    cvss?: number;
    tool?: string;
    cve?: string;
    evidence?: string;
    confidence?: 'confirmed' | 'likely' | 'possible' | 'inconclusive';
}

export interface PortResult {
    port: number;
    protocol: 'tcp' | 'udp';
    state: 'open' | 'closed' | 'filtered';
    service: string;
    version: string;
    risk: 'high' | 'medium' | 'low' | 'info';
}

export interface DirResult {
    path: string;
    status: number;
    size: number;
    type: 'directory' | 'file' | 'redirect';
    interesting: boolean;
}

export interface AgentToolReport {
    agentName: string;
    toolName: string;
    toolCommand: string;
    toolOutput: string;
    timeTaken: number;
    ports?: PortResult[];
    directories?: DirResult[];
}

export interface ScanHistoryItem {
    id: string;
    target: string;
    profile: string;
    status: ScanStatus;
    startedAt: number;
    completedAt?: number;
    findingCount: number;
    riskScore: number | null;
}

export interface AgentStep {
    agent: string;
    toolName: string;
    toolCommand: string;
    status: 'pending' | 'running' | 'done' | 'error';
    message: string;
    findings: number;
    time: number;
}

export interface ScanLog {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'error' | 'warn';
}

// ─── Agent configuration ──────────────────────────────────────

export const AGENT_CONFIG: Record<string, { toolName: string; icon: string; description: string }> = {
    'Nmap Agent': {
        toolName: 'Nmap + Shodan',
        icon: '🔍',
        description: 'Port scanning & OS detection',
    },
    'Dirb Agent': {
        toolName: 'Gobuster / Dirb',
        icon: '📁',
        description: 'Directory & endpoint brute-force',
    },
    'Nikto Agent': {
        toolName: 'Nikto + WhatWeb',
        icon: '🌐',
        description: 'Web vulnerability & tech fingerprint',
    },
    'SQLMap Agent': {
        toolName: 'SQLMap + XSStrike',
        icon: '💉',
        description: 'Injection testing (SQL, XSS, SSTI)',
    },
    'Metasploit Agent': {
        toolName: 'Metasploit + Hydra',
        icon: '⚡',
        description: 'Auth & exploit framework',
    },
    'SSL Agent': {
        toolName: 'testssl + SSLScan',
        icon: '🔒',
        description: 'TLS/SSL cipher & certificate analysis',
    },
    'OSINT Agent': {
        toolName: 'Amass + theHarvester',
        icon: '🕵️',
        description: 'DNS recon, subdomain enum & OSINT',
    },
    'Burp Agent': {
        toolName: 'Burp Suite + CORS/Header',
        icon: '🛡️',
        description: 'CORS, SSRF, headers & API security',
    },
};

const AGENT_ORDER = Object.keys(AGENT_CONFIG);

// ─── Hook ─────────────────────────────────────────────────────

export function useScan() {
    const [phase, setPhase] = useState<ScanPhase>('input');
    const [target, setTarget] = useState('');
    const [scanId, setScanId] = useState<string | null>(null);
    const [status, setStatus] = useState<ScanStatus>('pending');
    const [findings, setFindings] = useState<Finding[]>([]);
    const [agents, setAgents] = useState<AgentStep[]>(
        AGENT_ORDER.map(a => ({
            agent: a,
            toolName: AGENT_CONFIG[a].toolName,
            toolCommand: '',
            status: 'pending',
            message: 'Waiting...',
            findings: 0,
            time: 0,
        }))
    );
    const [logs, setLogs] = useState<ScanLog[]>([]);
    const [progress, setProgress] = useState(0);
    const [riskScore, setRiskScore] = useState<number | null>(null);
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [overall, setOverall] = useState('Initializing scan engine...');
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agentReports, setAgentReports] = useState<AgentToolReport[]>([]);
    const [allPorts, setAllPorts] = useState<PortResult[]>([]);
    const [allDirectories, setAllDirectories] = useState<DirResult[]>([]);
    const [verificationToken, setVerificationToken] = useState<string | null>(null);
    const [verificationFilename, setVerificationFilename] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);
    const currentAgentRef = useRef<number>(-1);
    const agentFindingCountsRef = useRef<Record<string, number>>({});

    // ─── Helpers ────────────────────────────────────────────

    const addLog = useCallback((msg: string, type: ScanLog['type'] = 'info') => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [...prev, { time, msg, type }]);
    }, []);

    const updateAgent = useCallback((agentName: string, updates: Partial<AgentStep>) => {
        setAgents(prev =>
            prev.map(a => (a.agent === agentName ? { ...a, ...updates } : a))
        );
    }, []);

    // ─── Load history ──────────────────────────────────────

    const loadHistory = useCallback(async () => {
        try {
            const res = await fetch('/api/scan/history');
            if (res.ok) {
                const data = await res.json();
                setHistory(data.scans || []);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // ─── Verification ──────────────────────────────────────

    const fetchVerificationToken = useCallback(async (url: string) => {
        try {
            const res = await fetch(`http://localhost:8000/api/verify/token?target=${encodeURIComponent(url)}`);
            if (res.ok) {
                const data = await res.json();
                setVerificationToken(data.token);
                setVerificationFilename(data.filename);
            }
        } catch (err) {
            console.error('Failed to fetch verification token', err);
        }
    }, []);

    const checkVerification = useCallback(async () => {
        if (!target || !verificationToken) return false;
        try {
            const res = await fetch('http://localhost:8000/api/verify/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, token: verificationToken }),
            });
            if (res.ok) {
                const data = await res.json();
                setIsVerified(data.verified);
                return data.verified;
            }
        } catch (err) {
            console.error('Verification check failed', err);
        }
        return false;
    }, [target, verificationToken]);

    // ─── Start scan ────────────────────────────────────────

    const startScan = useCallback(async (url: string, profile = 'full') => {
        setIsLoading(true);
        setError(null);
        setTarget(url);
        setIsVerified(false);
        setVerificationToken(null);
        
        // Enter policy phase first
        setPhase('policy');
        await fetchVerificationToken(url);
        setIsLoading(false);
    }, [fetchVerificationToken]);

    const confirmScan = useCallback(async (profile = 'full', verified = false) => {
        setIsLoading(true);
        setError(null);
        setFindings([]);
        setAgentReports([]);
        setLogs([]);
        setProgress(0);
        setRiskScore(null);
        setSummary(null);
        setAgentReports([]);
        setAllPorts([]);
        setAllDirectories([]);
        setOverall('Initializing scan engine...');
        setAgents(AGENT_ORDER.map(a => ({
            agent: a,
            toolName: AGENT_CONFIG[a].toolName,
            toolCommand: '',
            status: 'pending',
            message: 'Waiting...',
            findings: 0,
            time: 0,
        })));
        currentAgentRef.current = -1;
        agentFindingCountsRef.current = {};

        try {
            // Note: We use the actual API URL here. 
            // In a real app this would be proxied or use base URL.
            const res = await fetch('http://localhost:8000/api/scan/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, profile }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to start scan');
            }

            const data = await res.json();
            setScanId(data.jobId);
            setPhase('scanning');
            setStatus('running');
            setIsLoading(false);

            addLog(`DARKMATTER AI Security Scanner initialized`, 'info');
            addLog(`Target: ${target}`, 'info');
            addLog(`Profile: ${profile} | Mode: ${verified ? 'Verification Confirmed (Full Scan)' : 'Unverified (Simple Scan)'}`, 'info');
            
            if (verified) {
                addLog(`Launching 8 specialized security agents...`, 'info');
            } else {
                addLog(`Running in Simple Mode - 2 specialized security agents only.`, 'info');
            }

            startStreaming(data.jobId, target, verified);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsLoading(false);
        }
    }, [addLog, target]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── SSE Streaming ────────────────────────────────────

    const startStreaming = useCallback((id: string, targetAddr: string, verified = false) => {
        if (eventSourceRef.current) eventSourceRef.current.close();

        const agentStartTimes: Record<string, number> = {};

        // Added verified parameter to stream URL
        const es = new EventSource(`http://localhost:8000/api/scan/stream/${id}?target=${encodeURIComponent(targetAddr)}&verified=${verified}`);
        eventSourceRef.current = es;

        es.addEventListener('terminal', (e) => {
            const data = JSON.parse(e.data);
            if (data.phase === 'analysis' && (data.log.includes('Launching') || data.log.includes('AI Agents'))) {
                setAgents(prev => prev.map(a => 
                    a.status === 'pending' ? { ...a, status: 'running', message: 'Analyzing target...' } : a
                ));
            }
        });

        es.addEventListener('finding', (e) => {
            const finding: Finding = JSON.parse(e.data);

            if (finding.agent) {
                agentFindingCountsRef.current[finding.agent] = (agentFindingCountsRef.current[finding.agent] || 0) + 1;
                
                // Update finding count live for the agent
                updateAgent(finding.agent, {
                    findings: agentFindingCountsRef.current[finding.agent]
                });
            }

            setFindings(prev => [...prev, finding]);

            // Log the finding with tool context
            const toolTag = finding.tool ? `[${finding.tool}]` : '';
            const cveTag = finding.cve ? ` (${finding.cve})` : '';
            const logType = finding.severity === 'critical' || finding.severity === 'high' ? 'error'
                : finding.severity === 'medium' ? 'warn' : 'info';
            addLog(`${toolTag} [${finding.severity.toUpperCase()}] ${finding.title}${cveTag} — ${finding.endpoint}`, logType);
        });

        es.addEventListener('port', (e) => {
            const port: PortResult = JSON.parse(e.data);
            setAllPorts(prev => [...prev, port]);
        });

        es.addEventListener('directory', (e) => {
            const dir: DirResult = JSON.parse(e.data);
            setAllDirectories(prev => [...prev, dir]);
        });

        es.addEventListener('agent_report', (e) => {
            const report: AgentToolReport & { status?: string } = JSON.parse(e.data);
            setAgentReports(prev => [...prev, report]);
            
            const isError = report.status === 'error';
            updateAgent(report.agentName, {
                status: isError ? 'error' : 'done',
                toolCommand: report.toolCommand,
                time: report.timeTaken,
                message: isError ? 'Analysis Failed' : `${agentFindingCountsRef.current[report.agentName] || 0} issues found`
            });
            
            // Progress logic based on # of agents completed
            setAgentReports(currentReports => {
                const completedCount = currentReports.length;
                const totalAgents = AGENT_ORDER.length;
                // Scale from 20% (recon done) to 90% (analysis done)
                const analysisProgress = 20 + Math.round((completedCount / totalAgents) * 70);
                setProgress(Math.min(90, analysisProgress));
                return currentReports;
            });

            if (isError) {
                addLog(`[${report.toolName}] Agent failed: ${report.toolOutput}`, 'error');
            } else {
                addLog(`[${report.toolName}] Scan complete in ${report.timeTaken.toFixed(1)}s`, 'success');
            }
        });

        es.addEventListener('status', (e) => {
            const data = JSON.parse(e.data);
            setStatus(data.status);
        });

        es.addEventListener('complete', (e) => {
            const data = JSON.parse(e.data);
            setRiskScore(data.riskScore);
            setProgress(100);
            setOverall('All tools complete — generating report...');
            setStatus('complete');

            // Mark last agent done
            if (currentAgentRef.current >= 0) {
                const lastAgent = AGENT_ORDER[currentAgentRef.current];
                const lastCount = agentFindingCountsRef.current[lastAgent] || 0;
                updateAgent(lastAgent, {
                    status: 'done',
                    message: `${lastCount} issue${lastCount !== 1 ? 's' : ''} found`,
                    findings: lastCount,
                    time: parseFloat(((Date.now() - Date.now()) / 1000).toFixed(1)),
                });
            }

            addLog('━━━ All security tools complete ━━━', 'success');
            addLog(`Risk Score: ${data.riskScore}/10 | Total Findings: ${data.totalFindings}`, 'success');

            es.close();
            fetchResults(id);
            loadHistory();

            setTimeout(() => setPhase('results'), 1500);
        });

        es.addEventListener('error', (e) => {
            if ((e as MessageEvent).data) {
                const data = JSON.parse((e as MessageEvent).data);
                addLog(`Error: ${data.message}`, 'error');
                setError(data.message);
            }
            es.close();
        });

        es.onerror = () => {
            if (status === 'running') addLog('Connection interrupted...', 'warn');
        };
    }, [addLog, updateAgent, loadHistory, target]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Fetch final results ───────────────────────────────

    const fetchResults = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/scan/${id}/results`);
            if (res.ok) {
                const data = await res.json();
                if (data.summary) setSummary(data.summary);
                if (data.riskScore) setRiskScore(data.riskScore);
                if (data.findings?.length) setFindings(data.findings);
                if (data.agentReports) setAgentReports(data.agentReports);
                if (data.allPorts) setAllPorts(data.allPorts);
                if (data.allDirectories) setAllDirectories(data.allDirectories);
                // Update agent tool commands
                if (data.agentReports) {
                    data.agentReports.forEach((r: AgentToolReport) => {
                        updateAgent(r.agentName, { toolCommand: r.toolCommand, time: r.timeTaken });
                    });
                }
            }
        } catch { /* non-critical */ }
    }, [updateAgent]);

    // ─── Reset ────────────────────────────────────────────

    const resetScan = useCallback(() => {
        eventSourceRef.current?.close();
        setPhase('input');
        setTarget('');
        setScanId(null);
        setStatus('pending');
        setFindings([]);
        setLogs([]);
        setProgress(0);
        setRiskScore(null);
        setSummary(null);
        setError(null);
        setAgentReports([]);
        setAllPorts([]);
        setAllDirectories([]);
        setOverall('Initializing scan engine...');
        setAgents(AGENT_ORDER.map(a => ({
            agent: a,
            toolName: AGENT_CONFIG[a].toolName,
            toolCommand: '',
            status: 'pending',
            message: 'Waiting...',
            findings: 0,
            time: 0,
        })));
        currentAgentRef.current = -1;
        agentFindingCountsRef.current = {};
        loadHistory();
    }, [loadHistory]);

    useEffect(() => { return () => { eventSourceRef.current?.close(); }; }, []);

    return {
        phase, target, scanId, status, findings, agents, logs, progress,
        riskScore, history, overall, summary, isLoading, error,
        agentReports, allPorts, allDirectories,
        verificationToken, verificationFilename, isVerified,
        startScan, confirmScan, checkVerification, resetScan, loadHistory,
    };
}
