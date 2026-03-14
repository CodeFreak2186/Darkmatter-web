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

// ─── POLICY PHASE ─────────────────────────────────────────────
function PolicyPhase({ target, onConfirm, onCancel, verificationToken, verificationFilename, isVerified, onCheckVerification, isLoading }: {
    target: string;
    onConfirm: (verified: boolean) => void;
    onCancel: () => void;
    verificationToken: string | null;
    verificationFilename: string | null;
    isVerified: boolean;
    onCheckVerification: () => Promise<boolean>;
    isLoading: boolean;
}) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [verifying, setVerifying] = useState(false);

    const handleVerify = async () => {
        setVerifying(true);
        const ok = await onCheckVerification();
        setVerifying(false);
        if (!ok) alert("Verification file not found or content mismatch. Please follow the instructions.");
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#B6FF2E] rounded-full blur-[300px] opacity-[0.02]" />
            </div>

            <div className="relative max-w-2xl w-full z-10 animate-in fade-in zoom-in-95 duration-500">
                <GlassCard className="p-8 lg:p-10 border-[#B6FF2E]/20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-[#B6FF2E]/10 flex items-center justify-center border border-[#B6FF2E]/20">
                            <Shield className="text-[#B6FF2E]" size={24} />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-3xl text-[#F4F6FF]">Policy Enforcement</h2>
                            <p className="text-[10px] font-mono text-[#555] mt-1 uppercase tracking-widest">Protocol Delta-7 • Authorization Required</p>
                        </div>
                    </div>

                    <div className="space-y-6 text-[#A7ACBF]">
                        <p className="text-lg leading-relaxed font-light">
                            Before scanning <span className="text-[#B6FF2E] font-mono font-medium">{target}</span>, we must establish 
                            your level of authorization. Security testing without explicit consent is strictly prohibited.
                        </p>

                        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] shadow-inner">
                            <h3 className="text-[#F4F6FF] font-semibold mb-4 text-sm flex items-center gap-2">
                                <Radio size={14} className="text-[#B6FF2E]" />
                                DO YOU HAVE EXPLICIT PERMISSION TO ATTACK THIS TARGET?
                            </h3>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setHasPermission(true)}
                                    className={`flex-1 py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${hasPermission === true ? 'bg-[#B6FF2E] text-[#07080B] shadow-[0_0_20px_rgba(182,255,46,0.3)]' : 'bg-white/5 text-[#A7ACBF] hover:bg-white/10 border border-white/5'}`}
                                >
                                    <CheckCircle size={18} /> YES, FULL ACCESS
                                </button>
                                <button 
                                    onClick={() => setHasPermission(false)}
                                    className={`flex-1 py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${hasPermission === false ? 'bg-[#ff5f57] text-white shadow-[0_0_20_rgba(255,95,87,0.3)]' : 'bg-white/5 text-[#A7ACBF] hover:bg-white/10 border border-white/5'}`}
                                >
                                    <AlertTriangle size={18} /> NO PERMISSION
                                </button>
                            </div>
                        </div>

                        {hasPermission === true && (
                            <div className="p-6 rounded-2xl bg-[#B6FF2E]/[0.02] border border-[#B6FF2E]/10 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[#B6FF2E] font-semibold text-sm flex items-center gap-2">
                                        <Activity size={16} /> VERIFICATION PROTOCOL
                                    </h3>
                                    {isVerified && <span className="px-2 py-0.5 rounded bg-[#4af626]/20 text-[#4af626] text-[10px] font-bold border border-[#4af626]/30">AUTHENTICATED</span>}
                                </div>
                                <p className="text-xs mb-5 text-[#888] leading-normal">
                                    To perform a <span className="text-white font-bold">Deep AI Offensive Scan</span>, upload the following signature to your root directory:
                                </p>
                                <div className="space-y-4 font-mono text-[11px] bg-[#07080B] p-5 rounded-xl border border-white/5 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#B6FF2E]/5 rounded-full blur-2xl group-hover:bg-[#B6FF2E]/10 transition-colors" />
                                    <div className="flex flex-col gap-3 relative z-10">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                            <span className="text-[#444] uppercase tracking-tighter">File Path</span>
                                            <span className="text-[#B6FF2E] font-bold">/{verificationFilename}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#444] uppercase tracking-tighter">Required Signature</span>
                                            <span className="text-white bg-white/5 px-2 py-1 rounded select-all border border-white/5">{verificationToken}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button 
                                            onClick={handleVerify}
                                            disabled={verifying || isVerified || isLoading}
                                            className={`flex-1 py-3.5 rounded-xl transition-all font-bold flex items-center justify-center gap-2 border ${isVerified ? 'bg-transparent border-[#4af626]/30 text-[#4af626]' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 disabled:opacity-50'}`}
                                        >
                                            {verifying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Globe size={16} />}
                                            {isVerified ? "IDENTITY VERIFIED" : "VERIFY OWNERSHIP"}
                                        </button>
                                        
                                        {!isVerified && (
                                            <button 
                                                onClick={() => onConfirm(true)}
                                                disabled={isLoading}
                                                className="flex-1 py-3.5 bg-white/5 border border-white/10 text-[#ff9f43] rounded-xl hover:bg-white/10 transition-all font-bold flex items-center justify-center gap-2"
                                            >
                                                <Shield size={16} /> SKIP & START FULL SCAN
                                            </button>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => onConfirm(isVerified)}
                                        disabled={isLoading}
                                        className={`w-full py-4 ${isVerified ? 'bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B]' : 'bg-white/5 border border-white/10 text-[#444]'} rounded-xl hover:brightness-110 transition-all font-bold shadow-[0_10px_30px_rgba(182,255,46,0.15)] flex items-center justify-center gap-2`}
                                    >
                                        {isLoading ? "INITIALIZING..." : (
                                            isVerified ? 
                                            <>LAUNCH DEEP AI ANALYSIS <Sparkles size={14} /></> : 
                                            <>START SIMPLE RECONNAISSANCE <Activity size={14} /></>
                                        )}
                                    </button>
                                </div>

                                {!isVerified && (
                                    <div className="mt-8 p-4 rounded-xl bg-[#ff9f43]/[0.05] border border-[#ff9f43]/20 flex gap-3 items-start animate-in fade-in duration-700">
                                        <AlertTriangle size={16} className="text-[#ff9f43] shrink-0 mt-0.5" />
                                        <div className="text-[11px] leading-relaxed text-left">
                                            <span className="text-[#ff9f43] font-bold uppercase block mb-1">Responsibility Waiver</span>
                                            <span className="text-[#888]">
                                                By skipping verification, you assume <span className="text-[#F4F6FF]">full legal and operational responsibility</span> for any impact, disturbances, or results arising from this scan.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {hasPermission === false && (
                            <div className="p-6 rounded-2xl bg-[#ff5f57]/[0.02] border border-[#ff5f57]/10 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h3 className="text-[#ff5f57] font-semibold text-sm mb-3 flex items-center gap-2">
                                    <AlertTriangle size={16} /> SIMPLE SCAN MODE ACTIVE
                                </h3>
                                <p className="text-xs mb-6 text-[#888] leading-relaxed">
                                    As authorization is not confirmed, Darkmatter will execute a <span className="text-white font-bold">Simple Discovery Scan</span>. This is a non-intrusive metadata gathering process. AI exploitation agents and deep payload analysis will be <span className="text-[#ff5f57]">permanently disabled</span> for this session.
                                </p>
                                <button 
                                    onClick={() => onConfirm(false)}
                                    disabled={isLoading}
                                    className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all font-bold flex items-center justify-center gap-2"
                                >
                                    {isLoading ? "INITIALIZING..." : <><Activity size={16} /> PROCEED WITH SIMPLE RECON</>}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={onCancel}
                        disabled={isLoading}
                        className="mt-10 text-[#444] hover:text-[#B6FF2E] text-[10px] font-mono uppercase tracking-[.3em] flex items-center gap-2 mx-auto transition-colors"
                    >
                        <ArrowLeft size={10} /> ABORT PROTOCOL
                    </button>
                </GlassCard>
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
        verificationToken, verificationFilename, isVerified,
        startScan, confirmScan, checkVerification, resetScan } = scan;

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
                        ) : phase === 'policy' ? (
                            <><Shield size={11} className="text-[#B6FF2E]" /><span className="text-[11px] font-mono text-[#555]">Policy</span></>
                        ) : (
                            <><CheckCircle size={11} className="text-[#4af626]" /><span className="text-[11px] font-mono text-[#555]">Complete</span></>
                        )}
                    </div>
                )}
            </div>

            {phase === 'input' && <InputPhase onScan={startScan} history={history} isLoading={isLoading} error={error} />}
            {phase === 'policy' && (
                <PolicyPhase 
                    target={target} 
                    onConfirm={(verified) => confirmScan('full', verified)}
                    onCancel={resetScan}
                    verificationToken={verificationToken}
                    verificationFilename={verificationFilename}
                    isVerified={isVerified}
                    onCheckVerification={checkVerification}
                    isLoading={isLoading}
                />
            )}
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
