"use client"

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Globe, Play, Shield, AlertTriangle,
    RotateCcw, Download, ChevronRight, Sparkles, Radio,
    CheckCircle, Activity
} from 'lucide-react';
import { useScan, AGENT_CONFIG, Finding, Severity, AgentToolReport, PortResult, DirResult } from '@/hooks/useScan';
import { ScanningPhase } from './dashboard/ScanningPhase';
import { ResultsPhase } from './dashboard/ResultsPhase';

// ─── Severity Config ──────────────────────────────────────────
export const SEV: Record<Severity, { color: string; bg: string; label: string; glow: string }> = {
    critical: { color: '#ff5f57', bg: '#ff5f5712', label: 'CRIT', glow: '0 0 12px #ff5f5730' },
    high: { color: '#ff9f43', bg: '#ff9f4312', label: 'HIGH', glow: '0 0 12px #ff9f4330' },
    medium: { color: '#ffd93d', bg: '#ffd93d12', label: 'MED', glow: '0 0 12px #ffd93d30' },
    low: { color: '#5cb3ff', bg: '#5cb3ff12', label: 'LOW', glow: '0 0 12px #5cb3ff30' },
    info: { color: '#888', bg: '#88888812', label: 'INFO', glow: 'none' },
};

// ─── GlassCard ────────────────────────────────────────────────
export function GlassCard({ children, className = '', glow }: {
    children: React.ReactNode; className?: string; glow?: string;
}) {
    return (
        <div className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0f1220]/80 to-[#0a0d16]/80 backdrop-blur-xl overflow-hidden ${className}`}
            style={{ boxShadow: glow ? `${glow}, inset 0 1px 0 rgba(255,255,255,0.03)` : 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {children}
        </div>
    );
}

// ─── INPUT PHASE ─────────────────────────────────────────────
function InputPhase({ onScan, history, isLoading, error }: {
    onScan: (url: string, profile: string) => void;
    history: ReturnType<typeof useScan>['history'];
    isLoading: boolean;
    error: string | null;
}) {
    const [url, setUrl] = useState('');
    const [profile, setProfile] = useState('full');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim() && !isLoading) onScan(url.trim(), profile);
    };

    const tools = [
        { name: 'Nmap', desc: 'Port Scan', color: '#B6FF2E' },
        { name: 'Gobuster', desc: 'Dir Brute', color: '#5cb3ff' },
        { name: 'Nikto', desc: 'Web Scan', color: '#ffd93d' },
        { name: 'SQLMap', desc: 'Injection', color: '#ff9f43' },
        { name: 'Metasploit', desc: 'Exploits', color: '#ff5f57' },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#B6FF2E] rounded-full blur-[300px] opacity-[0.02]" />
                <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#5cb3ff] rounded-full blur-[200px] opacity-[0.015]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            </div>

            <div className="relative max-w-2xl w-full text-center z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B6FF2E]/15 bg-[#B6FF2E]/[0.04] text-[#B6FF2E] text-xs font-mono mb-10 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B6FF2E] animate-pulse" />
                    DARKMATTER AI SECURITY SCANNER · v2.4
                </div>

                <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-[#F4F6FF] leading-[1.1] mb-5 tracking-tight">
                    Scan <span className="bg-gradient-to-r from-[#B6FF2E] to-[#4af626] bg-clip-text text-transparent">Any Target</span>
                </h1>
                <p className="text-[#A7ACBF] text-lg mb-8 max-w-md mx-auto leading-relaxed">
                    AI-orchestrated Nmap, Gobuster, Nikto, SQLMap &amp; Metasploit — real findings, real data.
                </p>

                {/* Tools strip */}
                <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
                    {tools.map(t => (
                        <div key={t.name} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[11px] font-mono">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                            <span className="text-[#F4F6FF]">{t.name}</span>
                            <span className="text-[#444]">{t.desc}</span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ff5f57]/10 border border-[#ff5f57]/20 text-[#ff5f57] text-sm font-mono">
                        <AlertTriangle size={14} />{error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className={`relative flex items-center rounded-2xl overflow-hidden transition-all duration-500 ${focused ? 'shadow-[0_0_60px_rgba(182,255,46,0.08)]' : 'shadow-[0_0_30px_rgba(0,0,0,0.3)]'}`}>
                        <div className={`absolute inset-0 rounded-2xl border transition-colors duration-500 pointer-events-none ${focused ? 'border-[#B6FF2E]/30' : 'border-white/[0.06]'}`} />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1220] to-[#0a0d16] rounded-2xl" />
                        <div className="relative flex items-center w-full">
                            <div className={`px-5 transition-colors duration-300 ${focused ? 'text-[#B6FF2E]' : 'text-[#444]'}`}><Globe size={22} /></div>
                            <input ref={inputRef} type="text" value={url}
                                onChange={e => setUrl(e.target.value)}
                                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                                placeholder="https://target.example.com"
                                disabled={isLoading}
                                className="flex-1 bg-transparent text-[#F4F6FF] text-lg py-5 outline-none placeholder:text-[#333] font-mono disabled:opacity-50"
                            />
                            <button type="submit" disabled={!url.trim() || isLoading}
                                className="px-6 py-3 mr-3 bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B] font-bold text-sm rounded-xl hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(182,255,46,0.2)]">
                                {isLoading ? <div className="w-3.5 h-3.5 border-2 border-[#07080B] border-t-transparent rounded-full animate-spin" /> : <Play size={14} fill="currentColor" />}
                                {isLoading ? 'STARTING...' : 'SCAN'}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="mt-6 flex items-center justify-center gap-3">
                    <span className="text-[11px] text-[#555] font-mono tracking-wider">PROFILE</span>
                    <div className="flex bg-[#0a0d16] rounded-xl p-1 border border-white/[0.04]">
                        {[
                            { id: 'quick', label: 'Quick', desc: 'Fast scan' },
                            { id: 'full', label: 'Full', desc: 'Complete' },
                            { id: 'stealth', label: 'Stealth', desc: 'Low noise' },
                        ].map(p => (
                            <button key={p.id} onClick={() => setProfile(p.id)}
                                className={`px-4 py-1.5 text-xs font-mono rounded-lg transition-all duration-300 ${profile === p.id ? 'bg-[#B6FF2E]/10 text-[#B6FF2E]' : 'text-[#555] hover:text-[#888]'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {history.length > 0 && (
                    <div className="mt-16 text-left">
                        <div className="text-[10px] text-[#555] font-mono tracking-[0.25em] mb-4 flex items-center gap-2">
                            <RotateCcw size={10} /> RECENT SCANS
                        </div>
                        <div className="space-y-2">
                            {history.slice(0, 3).map((s, i) => (
                                <button key={i} onClick={() => setUrl(s.target)} className="w-full group">
                                    <GlassCard className="p-3 hover:border-white/10 transition-all">
                                        <div className="flex items-center gap-3">
                                            <Globe size={13} className="text-[#444] group-hover:text-[#B6FF2E] transition-colors shrink-0" />
                                            <span className="text-sm text-[#A7ACBF] group-hover:text-white transition-colors font-mono truncate flex-1 text-left">{s.target}</span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-[10px] font-mono text-[#555]">{s.findingCount} findings</span>
                                                {s.riskScore !== null && (
                                                    <span className="text-[10px] font-mono font-bold" style={{ color: s.riskScore >= 7 ? '#ff5f57' : s.riskScore >= 4 ? '#ffd93d' : '#4af626' }}>{s.riskScore}</span>
                                                )}
                                                <ChevronRight size={12} className="text-[#333] group-hover:text-[#B6FF2E] transition-colors" />
                                            </div>
                                        </div>
                                    </GlassCard>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────
export default function SecurityDashboard({ onBack }: { onBack?: () => void } = {}) {
    const router = useRouter();
    const handleBack = onBack || (() => router.push('/'));

    const scan = useScan();
    const { phase, target, agents, logs, progress, overall, findings, riskScore,
        summary, history, isLoading, error, agentReports, allPorts, allDirectories,
        startScan, resetScan } = scan;

    return (
        <div className="fixed inset-0 z-[200] bg-[#07080B] text-[#F4F6FF] overflow-y-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Top bar */}
            <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#07080B]/80 backdrop-blur-2xl border-b border-white/[0.04] flex items-center px-6">
                <button onClick={handleBack} className="flex items-center gap-2 text-sm text-[#555] hover:text-[#B6FF2E] transition-colors group">
                    <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                    <span className="hidden sm:inline">Back</span>
                </button>
                <div className="flex-1 flex items-center justify-center gap-3">
                    <Shield size={14} className="text-[#B6FF2E]" />
                    <span className="font-mono text-[11px] text-[#555] tracking-[0.15em]">DARKMATTER</span>
                    <span className="font-mono text-[11px] text-[#B6FF2E] tracking-[0.15em]">SECURITY DASHBOARD</span>
                    <span className="font-mono text-[9px] text-[#333] tracking-wider px-2 py-0.5 rounded border border-white/[0.04]">GEMINI AI</span>
                </div>
                {phase !== 'input' && (
                    <div className="flex items-center gap-2">
                        {phase === 'scanning' ? (
                            <><Radio size={11} className="text-[#ffd93d] animate-pulse" /><span className="text-[11px] font-mono text-[#555]">Scanning</span></>
                        ) : (
                            <><CheckCircle size={11} className="text-[#4af626]" /><span className="text-[11px] font-mono text-[#555]">Complete</span></>
                        )}
                    </div>
                )}
            </div>

            {phase === 'input' && <InputPhase onScan={startScan} history={history} isLoading={isLoading} error={error} />}
            {phase === 'scanning' && <ScanningPhase target={target} agents={agents} logs={logs} progress={progress} overall={overall} agentConfig={AGENT_CONFIG} />}
            {phase === 'results' && (
                <ResultsPhase
                    target={target} findings={findings} riskScore={riskScore}
                    onNewScan={resetScan} summary={summary} history={history}
                    agentReports={agentReports} allPorts={allPorts} allDirectories={allDirectories}
                />
            )}
        </div>
    );
}
