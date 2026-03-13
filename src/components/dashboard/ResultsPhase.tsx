gi"use client"

import { useState } from 'react';
import {
    CheckCircle, ExternalLink, RotateCcw, Download, Bug,
    Globe, Terminal, Folder, Network, Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { Finding, Severity, AgentToolReport, PortResult, DirResult } from '@/hooks/useScan';
import { GlassCard, SEV } from '@/components/SecurityDashboard';

// ─── Animated number ──────────────────────────────────────────
function AnimNum({ value, color }: { value: string; color: string }) {
    return <span className="font-mono text-3xl font-bold" style={{ color }}>{value}</span>;
}

// ─── Donut chart ──────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    let cumulative = 0;
    const size = 140; const sw = 18; const r = (size - sw) / 2;
    const circ = 2 * Math.PI * r;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1d2e" strokeWidth={sw} />
                {segments.filter(s => s.value > 0).map((seg, i) => {
                    const off = (cumulative / total) * circ;
                    const len = (seg.value / total) * circ;
                    cumulative += seg.value;
                    return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color}
                        strokeWidth={sw} strokeDasharray={`${len - 2} ${circ - len + 2}`} strokeDashoffset={-off}
                        strokeLinecap="round" className="transition-all duration-1000"
                        style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }} />;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-bold text-[#F4F6FF]">{total}</span>
                <span className="text-[9px] text-[#555] tracking-wider">FINDINGS</span>
            </div>
        </div>
    );
}

// ─── Port risk color ──────────────────────────────────────────
const PORT_RISK: Record<string, { color: string; bg: string }> = {
    high: { color: '#ff5f57', bg: '#ff5f5715' },
    medium: { color: '#ffd93d', bg: '#ffd93d15' },
    low: { color: '#4af626', bg: '#4af62615' },
    info: { color: '#888', bg: '#88888815' },
};

// ─── Port Table ───────────────────────────────────────────────
function PortTable({ ports }: { ports: PortResult[] }) {
    const open = ports.filter(p => p.state === 'open');
    if (!open.length) return (
        <div className="py-10 text-center text-[#444] font-mono text-sm">No open ports detected</div>
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-mono">
                <thead>
                    <tr className="border-b border-white/[0.05]">
                        {['PORT', 'PROTO', 'STATE', 'SERVICE', 'VERSION', 'RISK'].map(h => (
                            <th key={h} className="text-left py-2.5 px-3 text-[10px] text-[#444] tracking-[0.15em] font-normal">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {open.map((p, i) => {
                        const rc = PORT_RISK[p.risk] || PORT_RISK.info;
                        return (
                            <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                <td className="py-2 px-3 text-[#B6FF2E] font-bold">{p.port}</td>
                                <td className="py-2 px-3 text-[#555]">{p.protocol}</td>
                                <td className="py-2 px-3">
                                    <span className="text-[#4af626] bg-[#4af62612] px-1.5 py-0.5 rounded text-[10px]">open</span>
                                </td>
                                <td className="py-2 px-3 text-[#A7ACBF]">{p.service}</td>
                                <td className="py-2 px-3 text-[#666] truncate max-w-[200px]">{p.version}</td>
                                <td className="py-2 px-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                        style={{ color: rc.color, backgroundColor: rc.bg }}>{p.risk}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Directory Table ──────────────────────────────────────────
function DirTable({ dirs }: { dirs: DirResult[] }) {
    const [showAll, setShowAll] = useState(false);
    const interesting = dirs.filter(d => d.interesting);
    const displayed = showAll ? dirs : dirs.slice(0, 20);
    const statusColor = (s: number) => s === 200 ? '#4af626' : s === 301 || s === 302 ? '#5cb3ff' : s === 403 ? '#ffd93d' : s === 401 ? '#ff9f43' : '#888';

    if (!dirs.length) return (
        <div className="py-10 text-center text-[#444] font-mono text-sm">No directories discovered</div>
    );

    return (
        <div>
            {interesting.length > 0 && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff9f43]/[0.06] border border-[#ff9f43]/15">
                    <div className="text-[10px] font-mono text-[#ff9f43] tracking-wider mb-2">⚠ INTERESTING PATHS ({interesting.length})</div>
                    <div className="flex flex-wrap gap-2">
                        {interesting.map((d, i) => (
                            <span key={i} className="text-[11px] font-mono text-[#ff9f43] bg-[#ff9f43]/10 px-2 py-0.5 rounded">{d.path}</span>
                        ))}
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-[12px] font-mono">
                    <thead>
                        <tr className="border-b border-white/[0.05]">
                            {['PATH', 'STATUS', 'SIZE', 'TYPE'].map(h => (
                                <th key={h} className="text-left py-2.5 px-3 text-[10px] text-[#444] tracking-[0.15em] font-normal">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((d, i) => (
                            <tr key={i} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${d.interesting ? 'bg-[#ff9f43]/[0.03]' : ''}`}>
                                <td className="py-1.5 px-3">
                                    <span className={d.interesting ? 'text-[#ff9f43]' : 'text-[#A7ACBF]'}>{d.path}</span>
                                    {d.interesting && <span className="ml-2 text-[9px] text-[#ff9f43]/60 bg-[#ff9f43]/10 px-1 py-0.5 rounded">INTERESTING</span>}
                                </td>
                                <td className="py-1.5 px-3">
                                    <span className="font-bold" style={{ color: statusColor(d.status) }}>{d.status}</span>
                                </td>
                                <td className="py-1.5 px-3 text-[#555]">{d.size > 0 ? `${(d.size / 1024).toFixed(1)}KB` : '-'}</td>
                                <td className="py-1.5 px-3 text-[#555]">{d.type}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {dirs.length > 20 && (
                <button onClick={() => setShowAll(!showAll)} className="mt-3 w-full py-2 text-[11px] font-mono text-[#555] hover:text-[#B6FF2E] transition-colors flex items-center justify-center gap-1">
                    {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {dirs.length} paths</>}
                </button>
            )}
        </div>
    );
}

// ─── Tool Output Terminal ─────────────────────────────────────
function ToolOutputTerminal({ report }: { report: AgentToolReport }) {
    return (
        <div>
            {/* Command bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#080a10] border-b border-white/[0.04]">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffd93d]" />
                    <div className="w-3 h-3 rounded-full bg-[#4af626]" />
                </div>
                <span className="text-[11px] font-mono text-[#444] ml-2">darkmatter@kali:~$</span>
                <span className="text-[11px] font-mono text-[#B6FF2E] truncate">{report.toolCommand}</span>
            </div>
            {/* Output */}
            <pre className="p-4 text-[11px] font-mono text-[#8a9bb5] overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap leading-relaxed bg-[#060809]">
                {report.toolOutput || 'No output available.'}
            </pre>
            <div className="px-4 py-2 border-t border-white/[0.04] text-[10px] font-mono text-[#333] flex justify-between">
                <span>Tool: {report.toolName}</span>
                <span>Time: {report.timeTaken.toFixed(1)}s</span>
            </div>
        </div>
    );
}

// ─── Finding row ─────────────────────────────────────────────
function FindingRow({ f, expanded, onToggle }: { f: Finding; expanded: boolean; onToggle: () => void }) {
    const sev = SEV[f.severity];
    return (
        <div onClick={onToggle} className="px-5 py-3.5 hover:bg-white/[0.01] transition-colors cursor-pointer group border-b border-white/[0.025]">
            <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 items-start">
                    <span className="shrink-0 px-2 py-0.5 text-[9px] font-mono font-bold rounded-md"
                        style={{ backgroundColor: sev.bg, color: sev.color, boxShadow: sev.glow }}>{sev.label}</span>
                    {f.confidence && (
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                            f.confidence === 'confirmed' ? 'border-[#4af626]/20 text-[#4af626]/60' : 
                            f.confidence === 'likely' ? 'border-[#ffd93d]/20 text-[#ffd93d]/60' : 
                            'border-[#555]/20 text-[#555]/60'
                        }`}>
                            {f.confidence.toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] text-[#F4F6FF] font-medium group-hover:text-white transition-colors">{f.title}</span>
                        {f.cve && <span className="text-[9px] font-mono text-[#5cb3ff] bg-[#5cb3ff]/10 px-1.5 py-0.5 rounded">{f.cve}</span>}
                        {f.tool && <span className="text-[9px] font-mono text-[#444] bg-white/[0.03] px-1.5 py-0.5 rounded">{f.tool}</span>}
                    </div>
                    {expanded && (
                        <div className="mt-2.5 space-y-2.5 animate-[fadeIn_0.2s_ease-out]">
                            <p className="text-[12px] text-[#666] leading-relaxed">{f.description}</p>
                            
                            {f.evidence && (
                                <div className="p-3 rounded-xl bg-[#0a0c12] border border-white/[0.04]">
                                    <div className="text-[9px] font-mono text-[#555] tracking-wider mb-1">TECHNICAL EVIDENCE</div>
                                    <pre className="text-[11px] font-mono text-[#A7ACBF] whitespace-pre-wrap leading-tight bg-black/20 p-2 rounded border border-white/[0.02]">
                                        {f.evidence}
                                    </pre>
                                </div>
                            )}

                            {f.recommendation && (
                                <div className="p-3 rounded-xl bg-[#B6FF2E]/[0.04] border border-[#B6FF2E]/10">
                                    <div className="text-[9px] font-mono text-[#B6FF2E]/50 tracking-wider mb-1">RECOMMENDATION</div>
                                    <p className="text-[12px] text-[#A7ACBF]">{f.recommendation}</p>
                                </div>
                            )}
                            {f.cvss !== undefined && f.cvss > 0 && (
                                <div className="flex items-center gap-3 text-[10px] font-mono">
                                    <span className="text-[#555]">CVSS:</span>
                                    <span className="font-bold" style={{ color: f.cvss >= 9 ? '#ff5f57' : f.cvss >= 7 ? '#ff9f43' : f.cvss >= 4 ? '#ffd93d' : '#4af626' }}>{f.cvss.toFixed(1)}</span>
                                    <div className="flex-1 h-1 bg-[#12152a] rounded-full overflow-hidden max-w-[120px]">
                                        <div className="h-full rounded-full" style={{ width: `${(f.cvss / 10) * 100}%`, backgroundColor: f.cvss >= 9 ? '#ff5f57' : f.cvss >= 7 ? '#ff9f43' : f.cvss >= 4 ? '#ffd93d' : '#4af626' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[11px] text-[#B6FF2E]/60 font-mono truncate max-w-[140px]">{f.endpoint}</div>
                    <div className="text-[10px] text-[#333] mt-0.5">{f.agent}</div>
                </div>
            </div>
        </div>
    );
}

// ─── ResultsPhase ─────────────────────────────────────────────
interface ResultsPhaseProps {
    target: string;
    findings: Finding[];
    riskScore: number | null;
    onNewScan: () => void;
    summary: string | null;
    history: { id: string; target: string; status: string; findingCount: number; riskScore: number | null }[];
    agentReports: AgentToolReport[];
    allPorts: PortResult[];
    allDirectories: DirResult[];
}

export function ResultsPhase({
    target, findings, riskScore: propRisk, onNewScan, summary,
    agentReports, allPorts, allDirectories
}: ResultsPhaseProps) {
    const crit = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const med = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;
    const info = findings.filter(f => f.severity === 'info').length;
    const riskScore = propRisk ?? Math.min(10, parseFloat((crit * 2.5 + high * 1.5 + med * 0.7 + low * 0.2).toFixed(1)));
    const openPorts = allPorts.filter(p => p.state === 'open');

    const [mainTab, setMainTab] = useState<'findings' | 'ports' | 'dirs' | 'tools'>('findings');
    const [findingFilter, setFindingFilter] = useState<Severity | 'all'>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [activeToolIdx, setActiveToolIdx] = useState(0);

    const filtered = findingFilter === 'all' ? findings : findings.filter(f => f.severity === findingFilter);

    const handleExport = () => {
        const report = { target, riskScore, findings, openPorts, directories: allDirectories, agentReports: agentReports.map(r => ({ ...r, toolOutput: r.toolOutput })), generatedAt: new Date().toISOString(), summary };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `darkmatter-report-${Date.now()}.json`; a.click();
    };

    const riskColor = riskScore >= 7 ? '#ff5f57' : riskScore >= 4 ? '#ffd93d' : '#4af626';

    const mainTabs = [
        { id: 'findings', label: 'Findings', icon: <Bug size={13} />, count: findings.length },
        { id: 'ports', label: 'Ports', icon: <Network size={13} />, count: openPorts.length },
        { id: 'dirs', label: 'Directories', icon: <Folder size={13} />, count: allDirectories.length },
        { id: 'tools', label: 'Tool Output', icon: <Terminal size={13} />, count: agentReports.length },
    ] as const;

    return (
        <div className="min-h-screen px-4 sm:px-6 pt-20 pb-16 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-[#ff5f57] rounded-full blur-[250px] opacity-[0.015]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#B6FF2E] rounded-full blur-[250px] opacity-[0.015]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={14} className="text-[#4af626]" />
                            <span className="text-[10px] font-mono text-[#4af626] tracking-wider">SCAN COMPLETE · GEMINI AI</span>
                        </div>
                        <h2 className="font-display font-bold text-3xl lg:text-4xl text-[#F4F6FF] tracking-tight">Security Report</h2>
                        <p className="text-[#555] font-mono text-sm mt-1 flex items-center gap-2">{target} <ExternalLink size={11} /></p>
                        {summary && (
                            <p className="text-[#7a7f99] text-sm mt-3 max-w-2xl leading-relaxed border-l-2 border-[#B6FF2E]/20 pl-3">{summary}</p>
                        )}
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <button onClick={onNewScan} className="px-4 py-2 rounded-xl border border-white/[0.06] text-[#A7ACBF] text-sm hover:border-[#B6FF2E]/20 hover:text-white transition-all flex items-center gap-2 bg-white/[0.02]">
                            <RotateCcw size={13} /> New Scan
                        </button>
                        <button onClick={handleExport} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B] text-sm font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(182,255,46,0.15)]">
                            <Download size={13} /> Export JSON
                        </button>
                    </div>
                </div>

                {/* Hero stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    {/* Risk score */}
                    <GlassCard className="col-span-2 sm:col-span-4 lg:col-span-2 p-5" glow={`0 0 40px ${riskColor}18`}>
                        <div className="flex items-center gap-5">
                            <div className="relative w-20 h-20 shrink-0">
                                <svg width="80" height="80" className="-rotate-90">
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="#1a1d2e" strokeWidth="6" />
                                    <circle cx="40" cy="40" r="34" fill="none" stroke={riskColor}
                                        strokeWidth="6" strokeDasharray={`${(riskScore / 10) * 213} 213`}
                                        strokeLinecap="round" className="transition-all duration-1000"
                                        style={{ filter: `drop-shadow(0 0 6px ${riskColor}50)` }} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-mono text-2xl font-bold" style={{ color: riskColor }}>{riskScore}</span>
                                    <span className="text-[8px] text-[#444]">/10</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[#555] font-mono tracking-wider mb-1">RISK SCORE</div>
                                <div className="font-bold text-lg" style={{ color: riskColor }}>
                                    {riskScore >= 7 ? 'CRITICAL' : riskScore >= 4 ? 'MODERATE' : 'LOW RISK'}
                                </div>
                                <div className="text-[11px] text-[#666] mt-1">{findings.length} total issues</div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Stat cards */}
                    {[
                        { label: 'Critical', value: crit, color: '#ff5f57' },
                        { label: 'High', value: high, color: '#ff9f43' },
                        { label: 'Medium', value: med, color: '#ffd93d' },
                        { label: 'Open Ports', value: openPorts.length, color: '#5cb3ff' },
                        { label: 'Directories', value: allDirectories.length, color: '#B6FF2E' },
                    ].map((s, i) => (
                        <GlassCard key={i} className="p-4">
                            <div className="text-[9px] text-[#555] font-mono tracking-[0.15em] mb-2">{s.label.toUpperCase()}</div>
                            <AnimNum value={s.value.toString()} color={s.color} />
                        </GlassCard>
                    ))}
                </div>

                {/* Donut + tools used */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                    <GlassCard className="p-5">
                        <div className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-4">SEVERITY DIST.</div>
                        <div className="flex items-center gap-6">
                            <DonutChart segments={[{ value: crit, color: '#ff5f57', label: 'Crit' }, { value: high, color: '#ff9f43', label: 'High' }, { value: med, color: '#ffd93d', label: 'Med' }, { value: low, color: '#5cb3ff', label: 'Low' }, { value: info, color: '#555', label: 'Info' }]} />
                            <div className="space-y-2">
                                {[['Critical', '#ff5f57', crit], ['High', '#ff9f43', high], ['Medium', '#ffd93d', med], ['Low', '#5cb3ff', low], ['Info', '#555', info]].map(([l, c, v], i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px]">
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: c as string }} />
                                        <span className="text-[#666] w-14">{l}</span>
                                        <span className="font-mono font-bold text-[#F4F6FF]">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="lg:col-span-2 p-5">
                        <div className="text-[10px] font-mono text-[#555] tracking-[0.2em] mb-4">TOOLS USED</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {agentReports.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                    <Shield size={13} className="text-[#B6FF2E] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] text-[#F4F6FF] font-medium">{r.toolName}</div>
                                        <div className="text-[10px] text-[#444] font-mono truncate">{r.toolCommand.slice(0, 40)}...</div>
                                    </div>
                                    <span className="text-[10px] font-mono text-[#555] shrink-0">{r.timeTaken.toFixed(1)}s</span>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>

                {/* Main tabs */}
                <GlassCard>
                    <div className="px-5 py-3 border-b border-white/[0.04] flex flex-wrap gap-1">
                        {mainTabs.map(tab => (
                            <button key={tab.id} onClick={() => setMainTab(tab.id as typeof mainTab)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-mono transition-all ${mainTab === tab.id ? 'bg-[#B6FF2E]/10 text-[#B6FF2E] border border-[#B6FF2E]/20' : 'text-[#555] hover:text-[#888]'}`}>
                                {tab.icon}{tab.label}
                                <span className={`text-[10px] ${mainTab === tab.id ? 'text-[#B6FF2E]/60' : 'text-[#333]'}`}>{tab.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* FINDINGS TAB */}
                    {mainTab === 'findings' && (
                        <div>
                            <div className="px-5 py-3 border-b border-white/[0.03] flex flex-wrap gap-1">
                                {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(f => {
                                    const cnt = f === 'all' ? findings.length : findings.filter(x => x.severity === f).length;
                                    return (
                                        <button key={f} onClick={() => setFindingFilter(f)}
                                            className={`px-3 py-1 text-[10px] font-mono rounded-lg transition-all ${findingFilter === f ? 'bg-white/[0.06] text-[#F4F6FF]' : 'text-[#555] hover:text-[#888]'}`}>
                                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                            <span className="ml-1 opacity-40">{cnt}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="max-h-[600px] overflow-y-auto">
                                {filtered.length === 0 ? (
                                    <div className="py-12 text-center text-[#444] font-mono text-sm">No {findingFilter !== 'all' ? findingFilter : ''} findings</div>
                                ) : filtered.map(f => (
                                    <FindingRow key={f.id} f={f} expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PORTS TAB */}
                    {mainTab === 'ports' && (
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                {[{ label: 'Open', v: openPorts.length, c: '#4af626' }, { label: 'Filtered', v: allPorts.filter(p => p.state === 'filtered').length, c: '#ffd93d' }, { label: 'High Risk', v: openPorts.filter(p => p.risk === 'high').length, c: '#ff5f57' }].map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[11px] font-mono">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.c }} />
                                        <span className="text-[#666]">{s.label}:</span>
                                        <span className="font-bold" style={{ color: s.c }}>{s.v}</span>
                                    </div>
                                ))}
                            </div>
                            <PortTable ports={allPorts} />
                        </div>
                    )}

                    {/* DIRS TAB */}
                    {mainTab === 'dirs' && (
                        <div className="p-5">
                            <DirTable dirs={allDirectories} />
                        </div>
                    )}

                    {/* TOOLS TAB */}
                    {mainTab === 'tools' && (
                        <div className="flex flex-col sm:flex-row">
                            {/* Sidebar */}
                            <div className="sm:w-48 border-b sm:border-b-0 sm:border-r border-white/[0.04] p-3 flex sm:flex-col gap-1">
                                {agentReports.map((r, i) => (
                                    <button key={i} onClick={() => setActiveToolIdx(i)}
                                        className={`flex-1 sm:flex-none text-left px-3 py-2 rounded-lg text-[11px] font-mono transition-all truncate ${activeToolIdx === i ? 'bg-[#B6FF2E]/10 text-[#B6FF2E]' : 'text-[#555] hover:text-[#888]'}`}>
                                        {r.toolName}
                                    </button>
                                ))}
                            </div>
                            {/* Output */}
                            <div className="flex-1 overflow-hidden">
                                {agentReports[activeToolIdx] ? (
                                    <ToolOutputTerminal report={agentReports[activeToolIdx]} />
                                ) : (
                                    <div className="py-12 text-center text-[#444] font-mono text-sm">No output available yet</div>
                                )}
                            </div>
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
}
