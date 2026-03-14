"use client"

import { useRef, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Radio, Sparkles, Terminal } from 'lucide-react';
import { AgentStep, ScanLog } from '@/hooks/useScan';
import { GlassCard } from '@/components/SecurityDashboard';

interface ScanningPhaseProps {
    target: string;
    agents: AgentStep[];
    logs: ScanLog[];
    progress: number;
    overall: string;
    agentConfig: Record<string, { toolName: string; icon: string; description: string }>;
}

export function ScanningPhase({ target, agents, logs, progress, overall, agentConfig }: ScanningPhaseProps) {
    const logRef = useRef<HTMLDivElement>(null);
    useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [logs]);

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

    const doneCount = agents.filter(a => a.status === 'done').length;

    return (
        <div className="min-h-screen flex flex-col px-6 pt-20 pb-12 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#B6FF2E] rounded-full blur-[300px] opacity-[0.015] animate-pulse pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col relative z-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Radio size={14} className="text-[#B6FF2E] animate-pulse" />
                        <span className="font-mono text-sm text-[#B6FF2E] tracking-wide">{overall}</span>
                    </div>
                    <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#F4F6FF] mb-1">
                        Scanning: <span className="text-[#B6FF2E] font-mono text-xl sm:text-2xl break-all">{target}</span>
                    </h2>
                    <div className="text-[11px] font-mono text-[#444] mt-1 flex items-center gap-2">
                        <Sparkles size={10} className="text-[#B6FF2E]/50" />
                        Nmap · Gobuster · Nikto · SQLMap · Metasploit — powered by Gemini AI
                    </div>

                    {/* Progress */}
                    <div className="mt-5">
                        <div className="h-1.5 bg-[#12152a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 ease-out relative"
                                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #B6FF2E, #4af626)' }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] font-mono">
                            <span className="text-[#555]">{doneCount}/{agents.length} tools complete</span>
                            <span className="text-[#B6FF2E] font-bold">{progress}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5">
                    {/* Agents column */}
                    <div className="lg:col-span-2 flex flex-col gap-3">
                        {agents.map((a, i) => {
                            const cfg = agentConfig[a.agent];
                            return (
                                <GlassCard key={i} className={`p-4 transition-all duration-500 ${a.status === 'running' ? 'border-[#B6FF2E]/25 shadow-[0_0_20px_rgba(182,255,46,0.06)]' : a.status === 'done' ? 'border-[#4af626]/15' : 'border-white/[0.04]'}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all ${a.status === 'running' ? 'bg-[#B6FF2E]/10' : a.status === 'done' ? 'bg-[#4af626]/10' : 'bg-white/[0.03]'}`}>
                                            {cfg?.icon || '🔧'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <div className="text-[13px] text-[#F4F6FF] font-semibold">{cfg?.toolName || a.agent}</div>
                                                <div className="flex items-center gap-2">
                                                    {a.status === 'done' && a.findings > 0 && (
                                                        <span className="text-[10px] font-mono font-bold text-[#4af626] bg-[#4af626]/10 px-1.5 py-0.5 rounded">{a.findings}</span>
                                                    )}
                                                    {statusIcon(a.status)}
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-[#555] mt-0.5">{cfg?.description || a.message}</div>
                                            {a.status !== 'pending' && (
                                                <div className="text-[10px] font-mono text-[#444] mt-1 truncate">{a.message}</div>
                                            )}
                                            {a.status === 'done' && a.time > 0 && (
                                                <div className="text-[9px] text-[#333] font-mono mt-1">{a.time.toFixed(1)}s</div>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>

                    {/* Live log */}
                    <div className="lg:col-span-3">
                        <GlassCard className="h-full flex flex-col">
                            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
                                <Terminal size={13} className="text-[#B6FF2E]" />
                                <span className="text-[10px] font-mono text-[#555] tracking-[0.2em]">LIVE ACTIVITY LOG</span>
                                <div className="ml-auto flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4af626] animate-pulse" />
                                    <span className="text-[10px] text-[#444] font-mono">live · gemini</span>
                                </div>
                            </div>
                            <div ref={logRef} className="flex-1 overflow-y-auto p-5 font-mono text-[11.5px] space-y-1.5 max-h-[500px] scroll-smooth">
                                {logs.map((l, i) => (
                                    <div key={i} className="flex gap-3 hover:bg-white/[0.01] rounded px-1 -mx-1 py-0.5 transition-colors">
                                        <span className="text-[#2a2a3a] shrink-0 tabular-nums">{l.time}</span>
                                        <span className={`${logColor(l.type)} shrink-0 w-3`}>{logPrefix(l.type)}</span>
                                        <span className={logColor(l.type)}>{l.msg}</span>
                                    </div>
                                ))}
                                {progress < 100 && (
                                    <div className="flex gap-3 px-1 -mx-1 py-0.5">
                                        <span className="text-[#2a2a3a] shrink-0">···</span>
                                        <span className="text-[#333] animate-pulse">AI tool analysis in progress...</span>
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
