"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Play, Shield, Zap, Eye, CheckCircle, XCircle, Activity, Search, Lock, Code, Bug, ExternalLink, RotateCcw, Download, ChevronRight, Sparkles, Radio } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
type Phase = 'input' | 'scanning' | 'results';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Finding {
    id: number;
    severity: Severity;
    title: string;
    endpoint: string;
    description: string;
    agent: string;
    remediation?: string;
    cwe?: string;
}

interface AgentStep {
    agent: string;
    icon: React.ReactNode;
    status: 'pending' | 'running' | 'done' | 'error';
    message: string;
    findings: number;
    time: number;
}

// ─── Severity Config ─────────────────────────────────────────
const SEV: Record<Severity, { color: string; bg: string; label: string; glow: string }> = {
    critical: { color: '#ff5f57', bg: '#ff5f5712', label: 'CRIT', glow: '0 0 12px #ff5f5730' },
    high: { color: '#ff9f43', bg: '#ff9f4312', label: 'HIGH', glow: '0 0 12px #ff9f4330' },
    medium: { color: '#ffd93d', bg: '#ffd93d12', label: 'MED', glow: '0 0 12px #ffd93d30' },
    low: { color: '#5cb3ff', bg: '#5cb3ff12', label: 'LOW', glow: '0 0 12px #5cb3ff30' },
    info: { color: '#888', bg: '#88888812', label: 'INFO', glow: 'none' },
};

// ─── Glass card wrapper ──────────────────────────────────────
function GlassCard({ children, className = '', glow }: { children: React.ReactNode; className?: string; glow?: string }) {
    return (
        <div className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0f1220]/80 to-[#0a0d16]/80 backdrop-blur-xl overflow-hidden ${className}`}
            style={{ boxShadow: glow ? `${glow}, inset 0 1px 0 rgba(255,255,255,0.03)` : 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            {/* Top shine */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {children}
        </div>
    );
}



// ─── Animated bar chart ──────────────────────────────────────
function BarChart({ data, height = 140 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-4 justify-center px-2" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{d.value}</span>
                    <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${Math.max(4, (d.value / max) * (height - 40))}px` }}>
                        <div className="absolute inset-0 transition-all duration-1000" style={{ backgroundColor: d.color, opacity: 0.25 }} />
                        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(to top, ${d.color}60, transparent)` }} />
                        <div className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: d.color }} />
                    </div>
                    <span className="text-[10px] text-[#555] font-mono tracking-wider">{d.label}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Donut chart ─────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    let cumulative = 0;
    const size = 160;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1d2e" strokeWidth={strokeWidth} />
                {segments.filter(s => s.value > 0).map((seg, i) => {
                    const offset = (cumulative / total) * circumference;
                    const length = (seg.value / total) * circumference;
                    cumulative += seg.value;
                    return (
                        <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
                            strokeDasharray={`${length - 2} ${circumference - length + 2}`} strokeDashoffset={-offset}
                            strokeLinecap="round" className="transition-all duration-1000"
                            style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }} />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-bold text-[#F4F6FF]">{total}</span>
                <span className="text-[10px] text-[#666] tracking-wider">FINDINGS</span>
            </div>
        </div>
    );
}

// ─── Sparkline ───────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#sg-${color.replace('#', '')})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ─── Animated counter ────────────────────────────────────────
function AnimNum({ value, color }: { value: string; color: string }) {
    const [show, setShow] = useState(false);
    useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
    return (
        <span className={`font-mono text-3xl font-bold transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} style={{ color }}>{value}</span>
    );
}

// ─── INPUT PHASE ─────────────────────────────────────────────
function InputPhase({ onScan }: { onScan: (url: string) => void }) {
    const [url, setUrl] = useState('');
    const [profile, setProfile] = useState('full');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) onScan(url.trim());
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#B6FF2E] rounded-full blur-[300px] opacity-[0.02]" />
                <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#5cb3ff] rounded-full blur-[200px] opacity-[0.015]" />
                <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-[#ff5f57] rounded-full blur-[200px] opacity-[0.01]" />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            </div>

            <div className="relative max-w-2xl w-full text-center z-10">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B6FF2E]/15 bg-[#B6FF2E]/[0.04] text-[#B6FF2E] text-xs font-mono mb-10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B6FF2E] animate-pulse" />
                    DARKMATTER SCANNER v2.4
                </div>

                <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-[#F4F6FF] leading-[1.1] mb-5 tracking-tight">
                    Scan <span className="bg-gradient-to-r from-[#B6FF2E] to-[#4af626] bg-clip-text text-transparent">Any Target</span>
                </h1>
                <p className="text-[#A7ACBF] text-lg mb-14 max-w-md mx-auto leading-relaxed">
                    Paste a URL and watch our AI agents analyze your target in real-time.
                </p>

                {/* URL Input */}
                <form onSubmit={handleSubmit} className="relative">
                    <div className={`relative flex items-center rounded-2xl overflow-hidden transition-all duration-500 ${focused ? 'shadow-[0_0_60px_rgba(182,255,46,0.08)]' : 'shadow-[0_0_30px_rgba(0,0,0,0.3)]'}`}>
                        {/* Border glow */}
                        <div className={`absolute inset-0 rounded-2xl border transition-colors duration-500 pointer-events-none ${focused ? 'border-[#B6FF2E]/30' : 'border-white/[0.06]'}`} />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1220] to-[#0a0d16] rounded-2xl" />
                        <div className="relative flex items-center w-full">
                            <div className={`px-5 transition-colors duration-300 ${focused ? 'text-[#B6FF2E]' : 'text-[#444]'}`}><Globe size={22} /></div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                placeholder="https://target.example.com"
                                className="flex-1 bg-transparent text-[#F4F6FF] text-lg py-5 outline-none placeholder:text-[#333] font-mono"
                            />
                            <button type="submit" disabled={!url.trim()} className="px-6 py-3 mr-3 bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B] font-bold text-sm rounded-xl hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-[0_0_20px_rgba(182,255,46,0.2)]">
                                <Play size={14} fill="currentColor" /> SCAN
                            </button>
                        </div>
                    </div>
                </form>

                {/* Profile selector */}
                <div className="mt-8 flex items-center justify-center gap-3">
                    <span className="text-[11px] text-[#555] font-mono tracking-wider">PROFILE</span>
                    <div className="flex bg-[#0a0d16] rounded-xl p-1 border border-white/[0.04]">
                        {['full', 'quick', 'stealth'].map(p => (
                            <button key={p} onClick={() => setProfile(p)} className={`px-4 py-1.5 text-xs font-mono rounded-lg transition-all duration-300 ${profile === p ? 'bg-[#B6FF2E]/10 text-[#B6FF2E] shadow-[inset_0_1px_0_rgba(182,255,46,0.1)]' : 'text-[#555] hover:text-[#888]'}`}>{p}</button>
                        ))}
                    </div>
                </div>

                {/* Recent scans */}
                <div className="mt-20 text-left">
                    <div className="text-[10px] text-[#555] font-mono tracking-[0.25em] mb-4 flex items-center gap-2">
                        <RotateCcw size={10} /> RECENT SCANS
                    </div>
                    <div className="space-y-2">
                        {[
                            { url: 'https://example.com', findings: 18, risk: 6.2, ago: '2m ago' },
                            { url: 'https://example.com', findings: 31, risk: 8.7, ago: '1h ago' },
                            { url: 'https://example.com', findings: 9, risk: 3.1, ago: '3h ago' },
                        ].map((s, i) => (
                            <button key={i} onClick={() => setUrl(s.url)} className="w-full group">
                                <GlassCard className="p-3 hover:border-white/10 transition-all duration-300">
                                    <div className="flex items-center gap-3">
                                        <Globe size={13} className="text-[#444] group-hover:text-[#B6FF2E] transition-colors shrink-0" />
                                        <span className="text-sm text-[#A7ACBF] group-hover:text-white transition-colors font-mono truncate flex-1 text-left">{s.url}</span>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[10px] font-mono text-[#555]">{s.findings} findings</span>
                                            <span className="text-[10px] font-mono font-bold" style={{ color: s.risk >= 7 ? '#ff5f57' : s.risk >= 4 ? '#ffd93d' : '#4af626' }}>{s.risk}</span>
                                            <span className="text-[10px] text-[#333]">{s.ago}</span>
                                            <ChevronRight size={12} className="text-[#333] group-hover:text-[#B6FF2E] transition-colors" />
                                        </div>
                                    </div>
                                </GlassCard>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── SCANNING PHASE ──────────────────────────────────────────
function ScanningPhase({ target, onComplete }: { target: string; onComplete: (findings: Finding[]) => void }) {
    const [agents, setAgents] = useState<AgentStep[]>([
        { agent: 'Discovery Agent', icon: <Search size={16} />, status: 'pending', message: 'Waiting...', findings: 0, time: 0 },
        { agent: 'Fuzzing Agent', icon: <Zap size={16} />, status: 'pending', message: 'Waiting...', findings: 0, time: 0 },
        { agent: 'Auth Agent', icon: <Lock size={16} />, status: 'pending', message: 'Waiting...', findings: 0, time: 0 },
        { agent: 'Config Agent', icon: <Eye size={16} />, status: 'pending', message: 'Waiting...', findings: 0, time: 0 },
        { agent: 'Code Agent', icon: <Code size={16} />, status: 'pending', message: 'Waiting...', findings: 0, time: 0 },
    ]);
    const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
    const [progress, setProgress] = useState(0);
    const [overall, setOverall] = useState('Initializing scan engine...');
    const logRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [...prev, { time, msg, type }]);
    }, []);

    useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

    useEffect(() => {
        let cancelled = false;
        const updateAgent = (idx: number, updates: Partial<AgentStep>) => {
            setAgents(prev => prev.map((a, i) => i === idx ? { ...a, ...updates } : a));
        };

        addLog('Darkmatter Scanner v2.4 initialized', 'info');
        addLog(`Target: ${target}`, 'info');
        addLog('Connecting to scan engine API...', 'info');

        // Start all agents as running
        updateAgent(0, { status: 'running', message: 'Starting reconnaissance...' });
        setOverall('Connecting to scan API...');
        setProgress(5);

        async function runScan() {
            try {
                const response = await fetch('/api/scan/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: target, profile: 'full' }),
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({ error: 'Scan failed' }));
                    addLog(`Error: ${errData.error || 'Scan request failed'}`, 'error');
                    setOverall('Scan failed');
                    agents.forEach((_, i) => updateAgent(i, { status: 'error', message: 'Failed' }));
                    return;
                }

                const reader = response.body?.getReader();
                if (!reader) return;

                const decoder = new TextDecoder();
                let buffer = '';
                let progressStep = 10;
                let agentIdx = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done || cancelled) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'progress') {
                                addLog(data.message, data.message.toLowerCase().includes('error') || data.message.toLowerCase().includes('fail') ? 'error'
                                    : data.message.toLowerCase().includes('found') || data.message.toLowerCase().includes('complete') ? 'success'
                                        : data.message.toLowerCase().includes('missing') || data.message.toLowerCase().includes('warning') ? 'warn'
                                            : 'info');

                                // Advance progress and agents
                                progressStep = Math.min(95, progressStep + 15);
                                setProgress(progressStep);
                                setOverall(data.message);

                                if (agentIdx < 5) {
                                    updateAgent(agentIdx, { status: 'running', message: data.message });
                                    if (agentIdx > 0) {
                                        updateAgent(agentIdx - 1, { status: 'done', message: 'Complete', findings: 0, time: parseFloat((Math.random() * 3 + 1).toFixed(1)) });
                                    }
                                    agentIdx++;
                                }
                            }

                            if (data.type === 'result') {
                                if (cancelled) return;
                                const findings: Finding[] = data.findings || [];

                                // Mark all agents as done with their finding counts
                                const agentNames = ['Discovery', 'Fuzzing', 'Auth', 'Config', 'Code'];
                                agentNames.forEach((name, i) => {
                                    const agentFindings = findings.filter((f: Finding) => f.agent?.includes(name)).length;
                                    updateAgent(i, { status: 'done', message: `${agentFindings} findings`, findings: agentFindings, time: parseFloat((Math.random() * 3 + 1).toFixed(1)) });
                                });

                                setProgress(100);
                                setOverall('Scan complete — generating report...');
                                addLog(`Scan complete. Total: ${findings.length} findings`, 'success');

                                const crit = findings.filter((f: Finding) => f.severity === 'critical').length;
                                const high = findings.filter((f: Finding) => f.severity === 'high').length;
                                const med = findings.filter((f: Finding) => f.severity === 'medium').length;
                                const low = findings.filter((f: Finding) => f.severity === 'low').length;
                                const info = findings.filter((f: Finding) => f.severity === 'info').length;
                                addLog(`${crit} critical, ${high} high, ${med} medium, ${low} low, ${info} info`, 'success');

                                setTimeout(() => { if (!cancelled) onComplete(findings); }, 1500);
                            }

                            if (data.type === 'error') {
                                addLog(`Scan error: ${data.message}`, 'error');
                                setOverall('Scan encountered an error');
                            }
                        } catch {
                            // Skip malformed SSE lines
                        }
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    addLog(`Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
                    setOverall('Connection failed');
                }
            }
        }

        runScan();
        return () => { cancelled = true; };
    }, [target, addLog, onComplete]);

    const statusIcon = (s: string) => {
        if (s === 'done') return <CheckCircle size={15} className="text-[#4af626]" />;
        if (s === 'running') return <div className="w-4 h-4 border-2 border-[#B6FF2E] border-t-transparent rounded-full animate-spin" />;
        if (s === 'error') return <XCircle size={15} className="text-[#ff5f57]" />;
        return <div className="w-4 h-4 rounded-full border border-[#222]" />;
    };

    const logColor = (t: string) => {
        if (t === 'error') return 'text-[#ff6b6b]';
        if (t === 'warn') return 'text-[#ffd93d]';
        if (t === 'success') return 'text-[#4af626]';
        return 'text-[#7a7f99]';
    };

    const logPrefix = (t: string) => {
        if (t === 'error') return '✗';
        if (t === 'warn') return '⚠';
        if (t === 'success') return '✓';
        return '›';
    };

    return (
        <div className="min-h-screen flex flex-col px-6 pt-20 pb-12 relative">
            {/* Background pulse */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#B6FF2E] rounded-full blur-[300px] opacity-[0.015] animate-pulse pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col relative z-10">
                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <Radio size={14} className="text-[#B6FF2E] animate-pulse" />
                        <span className="font-mono text-sm text-[#B6FF2E] tracking-wide">{overall}</span>
                    </div>
                    <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#F4F6FF] mb-1">
                        Scanning: <span className="text-[#B6FF2E] font-mono text-xl sm:text-2xl">{target}</span>
                    </h2>

                    {/* Progress bar */}
                    <div className="mt-5 relative">
                        <div className="h-2 bg-[#12152a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 ease-out relative" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #B6FF2E, #4af626)' }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] font-mono">
                            <span className="text-[#555]">{agents.filter(a => a.status === 'done').length}/5 agents complete</span>
                            <span className="text-[#B6FF2E] font-bold">{progress}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Agents panel */}
                    <div className="lg:col-span-1">
                        <GlassCard className="p-5 h-full">
                            <h3 className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-5 flex items-center gap-2">
                                <Sparkles size={11} /> ACTIVE AGENTS
                            </h3>
                            <div className="space-y-2">
                                {agents.map((a, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${a.status === 'running' ? 'border-[#B6FF2E]/20 bg-[#B6FF2E]/[0.04] shadow-[0_0_20px_rgba(182,255,46,0.05)]' : a.status === 'done' ? 'border-[#4af626]/10 bg-[#4af626]/[0.02]' : 'border-white/[0.03] bg-transparent'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${a.status === 'running' ? 'bg-[#B6FF2E]/10 text-[#B6FF2E]' : a.status === 'done' ? 'bg-[#4af626]/10 text-[#4af626]' : 'bg-white/[0.03] text-[#444]'}`}>
                                            {a.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] text-[#F4F6FF] font-medium truncate">{a.agent}</div>
                                            <div className="text-[10px] text-[#555] truncate mt-0.5">{a.message}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {a.status === 'done' && <span className="text-[10px] font-mono font-bold text-[#4af626] bg-[#4af626]/10 px-1.5 py-0.5 rounded">{a.findings}</span>}
                                            {statusIcon(a.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>

                    {/* Live log */}
                    <div className="lg:col-span-2">
                        <GlassCard className="h-full flex flex-col">
                            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
                                <Activity size={13} className="text-[#B6FF2E]" />
                                <span className="text-[10px] font-mono text-[#555] tracking-[0.2em]">LIVE ACTIVITY LOG</span>
                                <div className="ml-auto flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4af626] animate-pulse" />
                                    <span className="text-[10px] text-[#444] font-mono">streaming</span>
                                </div>
                            </div>
                            <div ref={logRef} className="flex-1 overflow-y-auto p-5 font-mono text-[12px] space-y-1.5 max-h-[420px] scroll-smooth">
                                {logs.map((l, i) => (
                                    <div key={i} className="flex gap-3 hover:bg-white/[0.01] rounded px-1 -mx-1 py-0.5 transition-colors">
                                        <span className="text-[#333] shrink-0 tabular-nums">{l.time}</span>
                                        <span className={`${logColor(l.type)} shrink-0 w-3`}>{logPrefix(l.type)}</span>
                                        <span className={logColor(l.type)}>{l.msg}</span>
                                    </div>
                                ))}
                                {progress < 100 && (
                                    <div className="flex gap-3 px-1 -mx-1 py-0.5">
                                        <span className="text-[#333] shrink-0">{'···'}</span>
                                        <span className="text-[#444] animate-pulse">waiting for next event...</span>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── RESULTS PHASE ───────────────────────────────────────────
function ResultsPhase({ target, findings, onNewScan }: { target: string; findings: Finding[]; onNewScan: () => void }) {
    const crit = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const med = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;
    const info = findings.filter(f => f.severity === 'info').length;
    const riskScore = Math.min(10, parseFloat((crit * 3 + high * 2 + med * 1 + low * 0.3).toFixed(1)));

    const [filter, setFilter] = useState<Severity | 'all'>('all');
    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
    const filtered = filter === 'all' ? findings : findings.filter(f => f.severity === filter);

    const toggleCollapse = (id: number) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="min-h-screen px-6 pt-20 pb-16 relative">
            {/* BG elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-[#ff5f57] rounded-full blur-[250px] opacity-[0.015]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#B6FF2E] rounded-full blur-[250px] opacity-[0.015]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={14} className="text-[#4af626]" />
                            <span className="text-[10px] font-mono text-[#4af626] tracking-wider">SCAN COMPLETE</span>
                        </div>
                        <h2 className="font-display font-bold text-3xl lg:text-4xl text-[#F4F6FF] tracking-tight">Scan Results</h2>
                        <p className="text-[#555] font-mono text-sm mt-1 flex items-center gap-2">{target} <ExternalLink size={11} /></p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onNewScan} className="px-5 py-2.5 rounded-xl border border-white/[0.06] text-[#A7ACBF] text-sm hover:border-[#B6FF2E]/20 hover:text-white transition-all flex items-center gap-2 bg-white/[0.02]">
                            <RotateCcw size={13} /> New Scan
                        </button>
                        <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B] text-sm font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(182,255,46,0.15)]">
                            <Download size={13} /> Export Report
                        </button>
                    </div>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                    {[
                        { label: 'RISK SCORE', value: riskScore.toString(), color: riskScore >= 7 ? '#ff5f57' : riskScore >= 4 ? '#ffd93d' : '#4af626' },
                        { label: 'TOTAL', value: findings.length.toString(), color: '#B6FF2E' },
                        { label: 'CRITICAL', value: crit.toString(), color: '#ff5f57' },
                        { label: 'HIGH', value: high.toString(), color: '#ff9f43' },
                        { label: 'MEDIUM', value: med.toString(), color: '#ffd93d' },
                        { label: 'LOW / INFO', value: `${low + info}`, color: '#5cb3ff' },
                    ].map((s, i) => (
                        <GlassCard key={i} className="p-4 text-center">
                            <div className="text-[9px] text-[#555] font-mono tracking-[0.15em] mb-2">{s.label}</div>
                            <AnimNum value={s.value} color={s.color} />
                        </GlassCard>
                    ))}
                </div>

                {/* ═══════ DETAILED FINDINGS (FIRST — the main content) ═══════ */}
                <GlassCard className="mb-8">
                    <div className="px-6 py-5 border-b border-white/[0.04] flex flex-wrap items-center gap-3">
                        <Bug size={13} className="text-[#B6FF2E]" />
                        <span className="text-[10px] font-mono text-[#555] tracking-[0.2em] mr-3">SECURITY ISSUES FOUND</span>
                        <div className="flex bg-[#0a0d16] rounded-xl p-0.5 border border-white/[0.03]">
                            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(f => {
                                const count = f === 'all' ? findings.length : findings.filter(x => x.severity === f).length;
                                return (
                                    <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[10px] font-mono rounded-lg transition-all duration-300 ${filter === f ? 'bg-white/[0.06] text-[#F4F6FF] shadow-sm' : 'text-[#555] hover:text-[#888]'}`}>
                                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} <span className="ml-1 opacity-50">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="divide-y divide-white/[0.03]">
                        {filtered.map(f => {
                            const isCollapsed = collapsedIds.has(f.id);
                            return (
                                <div key={f.id} className="px-6 py-5 hover:bg-white/[0.01] transition-colors group">
                                    <div className="flex items-start gap-4 cursor-pointer" onClick={() => toggleCollapse(f.id)}>
                                        <span className="shrink-0 mt-0.5 px-2 py-0.5 text-[9px] font-mono font-bold rounded-md" style={{ backgroundColor: SEV[f.severity].bg, color: SEV[f.severity].color, boxShadow: SEV[f.severity].glow }}>{SEV[f.severity].label}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[14px] text-[#F4F6FF] font-semibold group-hover:text-white transition-colors">{f.title}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[11px] text-[#B6FF2E]/70 font-mono">{f.endpoint}</div>
                                            <div className="text-[10px] text-[#444] mt-0.5">{f.agent}</div>
                                        </div>
                                        <span className={`text-[#555] text-[10px] mt-1 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                                    </div>

                                    {/* Details — shown by default (expanded), can be collapsed */}
                                    {!isCollapsed && (
                                        <div className="mt-3 ml-12 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                                            <div className="text-[13px] text-[#888] leading-relaxed">{f.description}</div>
                                            {f.remediation && (
                                                <div className="text-[13px] text-[#4af626]/90 leading-relaxed bg-[#4af626]/[0.04] border border-[#4af626]/10 rounded-lg px-4 py-3">
                                                    <span className="text-[10px] font-mono text-[#4af626] tracking-wider font-bold">🛡️ FIX: </span>{f.remediation}
                                                </div>
                                            )}
                                            {f.cwe && (
                                                <div className="text-[11px] text-[#555] font-mono">{f.cwe}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="px-6 py-10 text-center text-[#555] text-sm">No findings in this category</div>
                        )}
                    </div>
                </GlassCard>

                {/* ═══════ CHARTS (secondary — analytics below) ═══════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Donut */}
                    <GlassCard className="p-6">
                        <h3 className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-6">SEVERITY DISTRIBUTION</h3>
                        <div className="flex justify-center mb-4">
                            <DonutChart segments={[
                                { value: crit, color: '#ff5f57', label: 'Critical' },
                                { value: high, color: '#ff9f43', label: 'High' },
                                { value: med, color: '#ffd93d', label: 'Medium' },
                                { value: low, color: '#5cb3ff', label: 'Low' },
                                { value: info, color: '#666', label: 'Info' },
                            ]} />
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                            {[{ l: 'Critical', c: '#ff5f57', v: crit }, { l: 'High', c: '#ff9f43', v: high }, { l: 'Medium', c: '#ffd93d', v: med }, { l: 'Low', c: '#5cb3ff', v: low }, { l: 'Info', c: '#666', v: info }].map((x, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[10px] text-[#666]">
                                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: x.c }} />
                                    {x.l} ({x.v})
                                </div>
                            ))}
                        </div>
                    </GlassCard>

                    {/* Bar chart */}
                    <GlassCard className="p-6">
                        <h3 className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-6">FINDINGS BY SEVERITY</h3>
                        <BarChart data={[
                            { label: 'CRIT', value: crit, color: '#ff5f57' },
                            { label: 'HIGH', value: high, color: '#ff9f43' },
                            { label: 'MED', value: med, color: '#ffd93d' },
                            { label: 'LOW', value: low, color: '#5cb3ff' },
                            { label: 'INFO', value: info, color: '#666' },
                        ]} />
                    </GlassCard>

                    {/* Agent performance */}
                    <GlassCard className="p-6">
                        <h3 className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-6">AGENT PERFORMANCE</h3>
                        <div className="space-y-4">
                            {['Discovery', 'Fuzzing', 'Auth', 'Config', 'Code'].map((agent, i) => {
                                const af = findings.filter(f => f.agent.startsWith(agent)).length;
                                const pct = (af / findings.length) * 100;
                                const colors = ['#4af626', '#ffd93d', '#ff9f43', '#5cb3ff', '#B6FF2E'];
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between text-[11px] mb-1.5">
                                            <span className="text-[#A7ACBF]">{agent}</span>
                                            <span className="font-mono font-bold" style={{ color: colors[i] }}>{af}</span>
                                        </div>
                                        <div className="h-1.5 bg-[#12152a] rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${colors[i]}80, ${colors[i]})` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                </div>

                {/* Scan history */}
                <GlassCard className="p-6">
                    <h3 className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-5">SCAN HISTORY</h3>
                    <div className="space-y-2">
                        {[{ t: target, f: findings.length, s: riskScore, ago: 'Just now' }, { t: 'https://example.com', f: 18, s: 6.2, ago: '2h ago' }, { t: 'https://example.com', f: 31, s: 8.7, ago: '5h ago' }, { t: 'https://example.com', f: 9, s: 3.1, ago: '1d ago' }].map((s, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.015] border border-white/[0.03] hover:border-white/[0.06] transition-colors">
                                <Globe size={11} className="text-[#444] shrink-0" />
                                <span className="text-[11px] text-[#A7ACBF] font-mono truncate flex-1">{s.t}</span>
                                <span className="text-[10px] font-mono font-bold" style={{ color: s.s >= 7 ? '#ff5f57' : s.s >= 4 ? '#ffd93d' : '#4af626' }}>{s.s}</span>
                                <Sparkline data={[3, 5, 2, 8, 4, 6, 3, 7, 5, 4]} color="#B6FF2E" width={50} height={16} />
                                <span className="text-[10px] text-[#333] shrink-0">{s.ago}</span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────
export default function SecurityDashboard({ onBack }: { onBack?: () => void } = {}) {
    const router = useRouter();
    const handleBack = onBack || (() => router.push('/'));
    const [phase, setPhase] = useState<Phase>('input');
    const [target, setTarget] = useState('');
    const [findings, setFindings] = useState<Finding[]>([]);

    const handleScan = (url: string) => { setTarget(url); setPhase('scanning'); };
    const handleComplete = useCallback((results: Finding[]) => { setFindings(results); setPhase('results'); }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-[#07080B] text-[#F4F6FF] overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Top bar */}
            <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#07080B]/80 backdrop-blur-2xl border-b border-white/[0.04] flex items-center px-6">
                <button onClick={handleBack} className="flex items-center gap-2 text-sm text-[#555] hover:text-[#B6FF2E] transition-colors group">
                    <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" /> <span className="hidden sm:inline">Back to Darkmatter</span>
                </button>
                <div className="flex-1 flex items-center justify-center gap-3">
                    <Shield size={14} className="text-[#B6FF2E]" />
                    <span className="font-mono text-[11px] text-[#555] tracking-[0.15em]">DARKMATTER</span>
                    <span className="font-mono text-[11px] text-[#B6FF2E] tracking-[0.15em]">SECURITY DASHBOARD</span>
                </div>
                {phase !== 'input' && (
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${phase === 'scanning' ? 'bg-[#ffd93d] animate-pulse' : 'bg-[#4af626]'}`} />
                        <span className="text-[11px] font-mono text-[#555]">{phase === 'scanning' ? 'In Progress' : 'Complete'}</span>
                    </div>
                )}
            </div>

            {phase === 'input' && <InputPhase onScan={handleScan} />}
            {phase === 'scanning' && <ScanningPhase target={target} onComplete={handleComplete} />}
            {phase === 'results' && <ResultsPhase target={target} findings={findings} onNewScan={() => setPhase('input')} />}
        </div>
    );
}
