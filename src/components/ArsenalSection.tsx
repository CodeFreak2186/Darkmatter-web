"use client"

import { useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Crosshair, Shield, Zap, Brain } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   Terminal Mockup — Kali-themed
   ────────────────────────────────────────────────────────────── */
function TerminalMockup() {
    return (
        <div className="w-full rounded-xl overflow-hidden border border-[#4af626]/20 shadow-[0_0_60px_rgba(74,246,38,0.08)]">
            {/* Chrome */}
            <div className="h-8 bg-[#0a0c14] flex items-center px-3 gap-2 border-b border-[#1e2030]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-[#666] font-mono">darkmatter@kali: ~/scans</span>
            </div>
            {/* Body */}
            <div className="bg-[#0c0c0c] p-4 font-mono text-[12px] leading-[1.5] min-h-[240px]">
                <div><span className="text-[#ff3333]">┌──(</span><span className="text-[#4af626] font-bold">darkmatter㉿kali</span><span className="text-[#ff3333]">)─[</span><span className="text-white">~/scans</span><span className="text-[#ff3333]">]</span></div>
                <div><span className="text-[#ff3333]">└─</span><span className="text-[#4af626]">$ </span><span className="text-white">nmap -sV -sC 10.10.10.40</span></div>
                <div className="text-[#5cb3ff] mt-1">Starting Nmap 7.94SVN</div>
                <div className="text-[#d4d4d4]">PORT     STATE SERVICE       VERSION</div>
                <div className="text-[#4af626]">22/tcp   open  ssh           OpenSSH 8.9p1</div>
                <div className="text-[#4af626]">80/tcp   open  http          Apache 2.4.54</div>
                <div className="text-[#4af626]">443/tcp  open  https         nginx 1.24.0</div>
                <div className="text-[#ff6b6b]">3306/tcp open  mysql         MySQL 8.0.32</div>
                <div className="text-[#ff6b6b]">8080/tcp open  http-proxy    Squid 5.7</div>
                <div className="mt-2"><span className="text-[#ff3333]">┌──(</span><span className="text-[#4af626] font-bold">darkmatter㉿kali</span><span className="text-[#ff3333]">)─[</span><span className="text-white">~/scans</span><span className="text-[#ff3333]">]</span></div>
                <div><span className="text-[#ff3333]">└─</span><span className="text-[#4af626]">$ </span><span className="text-white animate-pulse">█</span></div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   IDE Mockup — Monaco-themed
   ────────────────────────────────────────────────────────────── */
function IDEMockup() {
    return (
        <div className="w-full rounded-xl overflow-hidden border border-[#B6FF2E]/20 shadow-[0_0_60px_rgba(182,255,46,0.08)]">
            {/* Chrome */}
            <div className="h-8 bg-[#0e1019] flex items-center px-3 gap-2 border-b border-[#1e2030]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-[#666] font-mono">engine.py — Darkmatter IDE</span>
            </div>
            <div className="flex">
                {/* Sidebar */}
                <div className="w-10 bg-[#0a0c14] border-r border-[#1e2030] flex flex-col items-center py-2 gap-3">
                    <div className="w-5 h-5 rounded bg-[#1e2030]" />
                    <div className="w-5 h-5 rounded bg-[#1e2030]" />
                    <div className="w-5 h-5 rounded bg-[#1e2030]" />
                </div>
                {/* File tree */}
                <div className="w-36 bg-[#12141f] border-r border-[#1e2030] py-2 hidden sm:block">
                    <div className="px-2 text-[9px] text-[#888] font-semibold tracking-wider mb-1">EXPLORER</div>
                    <div className="px-3 py-0.5 text-[11px] text-[#B6FF2E] flex items-center gap-1">📁 src</div>
                    <div className="px-5 py-0.5 text-[11px] text-white bg-[#37394e]">🐍 engine.py</div>
                    <div className="px-5 py-0.5 text-[11px] text-[#ccc]">🐍 reporter.py</div>
                    <div className="px-5 py-0.5 text-[11px] text-[#ccc]">📁 agents</div>
                    <div className="px-3 py-0.5 text-[11px] text-[#ccc]">⚙ config.yml</div>
                    <div className="px-3 py-0.5 text-[11px] text-[#ccc]">📝 README.md</div>
                </div>
                {/* Editor */}
                <div className="flex-1 bg-[#12141f] min-h-[240px]">
                    <div className="h-8 bg-[#0e1019] flex items-center border-b border-[#1e2030]">
                        <div className="px-3 text-[11px] text-white bg-[#12141f] h-full flex items-center border-t-2 border-t-[#B6FF2E]">engine.py</div>
                    </div>
                    <div className="p-3 font-mono text-[11px] leading-[1.6]">
                        <div><span className="text-[#666] select-none mr-3"> 1</span><span className="text-[#c586c0]">class</span> <span className="text-[#4EC9B0]">ScanEngine</span><span className="text-[#d4d4d4]">:</span></div>
                        <div><span className="text-[#666] select-none mr-3"> 2</span><span className="text-[#608b4e]">  """Orchestrates scanning agents."""</span></div>
                        <div><span className="text-[#666] select-none mr-3"> 3</span></div>
                        <div><span className="text-[#666] select-none mr-3"> 4</span>  <span className="text-[#c586c0]">async def</span> <span className="text-[#DCDCAA]">run</span><span className="text-[#d4d4d4]">(</span><span className="text-[#9CDCFE]">self</span><span className="text-[#d4d4d4]">):</span></div>
                        <div><span className="text-[#666] select-none mr-3"> 5</span>    <span className="text-[#9CDCFE]">tasks</span> <span className="text-[#d4d4d4]">=</span> <span className="text-[#d4d4d4]">[</span><span className="text-[#9CDCFE]">a</span><span className="text-[#d4d4d4]">.</span><span className="text-[#DCDCAA]">scan</span><span className="text-[#d4d4d4]">()</span> <span className="text-[#c586c0]">for</span> <span className="text-[#9CDCFE]">a</span> <span className="text-[#c586c0]">in</span> <span className="text-[#9CDCFE]">self</span><span className="text-[#d4d4d4]">.</span><span className="text-[#9CDCFE]">agents</span><span className="text-[#d4d4d4]">]</span></div>
                        <div><span className="text-[#666] select-none mr-3"> 6</span>    <span className="text-[#c586c0]">return await</span> <span className="text-[#DCDCAA]">asyncio</span><span className="text-[#d4d4d4]">.</span><span className="text-[#DCDCAA]">gather</span><span className="text-[#d4d4d4]">(*</span><span className="text-[#9CDCFE]">tasks</span><span className="text-[#d4d4d4]">)</span></div>
                    </div>
                </div>
                {/* Minimap */}
                <div className="w-12 bg-[#12141f] border-l border-[#1e2030] hidden sm:block">
                    <div className="mt-8 mx-1 space-y-0.5">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-0.5 bg-[#333] rounded" style={{ width: `${30 + Math.random() * 60}%` }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   Dashboard Mockup — Security analytics
   ────────────────────────────────────────────────────────────── */
function DashboardMock() {
    return (
        <div className="w-full rounded-xl overflow-hidden border border-[#5cb3ff]/20 shadow-[0_0_60px_rgba(92,179,255,0.08)]">
            {/* Chrome */}
            <div className="h-8 bg-[#0e1019] flex items-center px-3 gap-2 border-b border-[#1e2030]">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-[#666] font-mono">Darkmatter — Security Dashboard</span>
            </div>
            <div className="bg-[#0e111a] p-4 min-h-[240px]">
                {/* Top stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[{ l: 'Threats', v: '847', c: '#ff6b6b' }, { l: 'Blocked', v: '99.2%', c: '#4af626' }, { l: 'Endpoints', v: '2.4k', c: '#B6FF2E' }, { l: 'Latency', v: '12ms', c: '#5cb3ff' }].map((s, i) => (
                        <div key={i} className="bg-[#07080B] rounded-lg p-2 border border-white/5">
                            <div className="text-[9px] text-[#666]">{s.l}</div>
                            <div className="text-sm font-mono font-bold" style={{ color: s.c }}>{s.v}</div>
                        </div>
                    ))}
                </div>
                {/* Chart area */}
                <div className="bg-[#07080B] rounded-lg p-3 border border-white/5 mb-3">
                    <div className="text-[10px] text-[#888] mb-2">THREAT ACTIVITY — 24H</div>
                    <div className="flex items-end gap-1 h-16">
                        {[35, 42, 28, 65, 80, 45, 92, 60, 38, 70, 55, 48, 85, 72, 40, 58, 90, 65, 42, 75].map((h, i) => (
                            <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: h > 75 ? '#ff6b6b' : h > 50 ? '#ffd93d' : '#4af626', opacity: 0.7 }} />
                        ))}
                    </div>
                </div>
                {/* Findings list */}
                <div className="space-y-1.5">
                    {[{ sev: 'CRIT', title: 'IDOR /api/users', c: '#ff5f57' }, { sev: 'HIGH', title: 'SQL injection /search', c: '#ffd93d' }, { sev: 'MED', title: 'Missing HSTS header', c: '#5cb3ff' }].map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-[#07080B] rounded px-2 py-1.5 border border-white/5">
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: f.c + '20', color: f.c }}>{f.sev}</span>
                            <span className="text-[11px] text-[#ccc] font-mono">{f.title}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   MAIN ARSENAL SECTION — 3 Feature Showcases
   ────────────────────────────────────────────────────────────── */
export function ArsenalSection({ onOpenTerminal, onOpenIDE }: { onOpenTerminal: string | (() => void); onOpenIDE: string | (() => void) }) {
    const router = useRouter();
    const sectionRef = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        if (!sectionRef.current || !window.gsap) return;
        const gsap = window.gsap;
        const ctx = gsap.context(() => {
            gsap.utils.toArray('.arsenal-item').forEach((item: unknown) => {
                gsap.fromTo(item as Element, { y: 80, opacity: 0 }, {
                    y: 0, opacity: 1, duration: 1, ease: 'power3.out',
                    scrollTrigger: { trigger: item as Element, start: 'top 85%', end: 'top 45%', scrub: 0.5 }
                });
            });
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    const features = [
        {
            num: '01',
            label: 'ATTACK SURFACE',
            title: 'The Terminal',
            desc: 'A full Kali Linux-style terminal right in your browser. Run nmap, sqlmap, hydra — simulate real-world penetration testing workflows without leaving the platform. Tab completion, command history, and a simulated filesystem included.',
            tags: ['Kali Linux', 'Pen Testing', 'Full Shell'],
            accent: '#4af626',
            mockup: <TerminalMockup />,
            action: () => typeof onOpenTerminal === 'string' ? router.push(onOpenTerminal) : onOpenTerminal(),
            actionLabel: 'Launch Terminal',
        },
        {
            num: '02',
            label: 'CODE ANALYSIS',
            title: 'The Web IDE',
            desc: 'A Monaco-powered code editor with syntax highlighting, file explorer, integrated terminal, and git status. Review scanner source code, write exploits, and analyze findings — all in a VS Code-grade editing experience.',
            tags: ['Monaco Editor', 'Multi-file', 'Integrated Terminal'],
            accent: '#B6FF2E',
            mockup: <IDEMockup />,
            action: () => typeof onOpenIDE === 'string' ? router.push(onOpenIDE) : onOpenIDE(),
            actionLabel: 'Open IDE',
        },
        {
            num: '03',
            label: 'THREAT INTELLIGENCE',
            title: 'The Dashboard',
            desc: 'Real-time security analytics with threat correlation, risk scoring, and exportable reports. Visualize attack surfaces, track vulnerability trends, and get actionable intelligence from coordinated AI agents.',
            tags: ['Live Analytics', 'AI Agents', 'Export Reports'],
            accent: '#5cb3ff',
            mockup: <DashboardMock />,
            action: () => document.getElementById('threat-map')?.scrollIntoView({ behavior: 'smooth' }),
            actionLabel: 'View Dashboard',
        },
    ];

    return (
        <section id="arsenal" ref={sectionRef} className="relative bg-[#07080B] py-32 lg:py-40 overflow-hidden">
            {/* Section header */}
            <div className="max-w-6xl mx-auto px-6 lg:px-12 mb-24">
                <p className="text-[#B6FF2E] font-mono text-xs tracking-[0.3em] uppercase mb-4">THE ARSENAL</p>
                <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-[#F4F6FF] leading-tight">
                    Professional Grade Tools.<br />
                    <span className="text-[#B6FF2E]">Zero Configuration.</span>
                </h2>
                <p className="mt-6 text-lg text-[#A7ACBF] max-w-2xl leading-relaxed">
                    Three integrated environments designed for security professionals. Each one built from scratch, running entirely in your browser.
                </p>
            </div>

            {/* Feature items */}
            {features.map((feat, idx) => (
                <div key={feat.num} className={`arsenal-item max-w-7xl mx-auto px-6 lg:px-12 ${idx < features.length - 1 ? 'mb-32 lg:mb-40' : ''}`}>
                    <div className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}>
                        {/* Text side */}
                        <div className="lg:w-2/5">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono font-bold" style={{ borderColor: feat.accent + '60', color: feat.accent }}>{feat.num}</span>
                                <span className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: feat.accent }}>{feat.label}</span>
                            </div>
                            <h3 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-[#F4F6FF] mb-5">{feat.title}</h3>
                            <p className="text-[#A7ACBF] text-base leading-relaxed mb-8">{feat.desc}</p>
                            <div className="flex flex-wrap gap-2 mb-8">
                                {feat.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 text-[11px] font-mono border rounded-full" style={{ borderColor: feat.accent + '30', color: feat.accent + 'cc' }}>{tag}</span>
                                ))}
                            </div>
                            <button onClick={feat.action} className="group flex items-center gap-2 font-medium text-sm transition-all duration-300 hover:-translate-y-0.5" style={{ color: feat.accent }}>
                                {feat.actionLabel}
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </button>
                        </div>
                        {/* Mockup side */}
                        <div className="lg:w-3/5 w-full relative">
                            {/* Glow behind */}
                            <div className="absolute -inset-4 rounded-2xl blur-3xl opacity-10" style={{ backgroundColor: feat.accent }} />
                            <div className="relative">
                                {feat.mockup}
                            </div>
                            {/* Corner dots */}
                            <div className="absolute -top-2 -left-2 w-3 h-3 rounded-full border" style={{ borderColor: feat.accent, backgroundColor: feat.accent + '40' }} />
                            <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full border" style={{ borderColor: feat.accent, backgroundColor: feat.accent + '40' }} />
                            <div className="absolute -bottom-2 -left-2 w-3 h-3 rounded-full border" style={{ borderColor: feat.accent, backgroundColor: feat.accent + '40' }} />
                            <div className="absolute -bottom-2 -right-2 w-3 h-3 rounded-full border" style={{ borderColor: feat.accent, backgroundColor: feat.accent + '40' }} />
                        </div>
                    </div>
                </div>
            ))}
        </section>
    );
}

/* ──────────────────────────────────────────────────────────────
   THE PROTOCOL — Step-by-step timeline
   ────────────────────────────────────────────────────────────── */
export function ProtocolSection() {
    const sectionRef = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        if (!sectionRef.current || !window.gsap) return;
        const gsap = window.gsap;
        const ctx = gsap.context(() => {
            gsap.utils.toArray('.protocol-step').forEach((step: unknown) => {
                gsap.fromTo(step as Element, { x: -40, opacity: 0 }, {
                    x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
                    scrollTrigger: { trigger: step as Element, start: 'top 80%', end: 'top 55%', scrub: 0.5 }
                });
            });
            gsap.utils.toArray('.protocol-code').forEach((code: unknown) => {
                gsap.fromTo(code as Element, { x: 40, opacity: 0 }, {
                    x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
                    scrollTrigger: { trigger: code as Element, start: 'top 80%', end: 'top 55%', scrub: 0.5 }
                });
            });
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    const steps = [
        {
            num: 'STEP 01',
            icon: <Crosshair size={16} />,
            title: 'Initialize',
            desc: 'Define your target scope. Configure scan profiles, agent selection, and authentication parameters.',
            code: `// DARKMATTER.init()\nconst engine = new ScanEngine({\n  target: "https://api.target.com",\n  profile: "full",\n  agents: ["discovery", "fuzzing", "auth"]\n});`,
        },
        {
            num: 'STEP 02',
            icon: <Shield size={16} />,
            title: 'Recon',
            desc: 'Automated asset discovery. Map endpoints, identify technologies, and enumerate attack surfaces.',
            code: `// DARKMATTER.recon()\nconst surface = await engine.discover();\n// → 47 endpoints found\n// → 3 API versions detected\n// → 12 input vectors mapped`,
        },
        {
            num: 'STEP 03',
            icon: <Zap size={16} />,
            title: 'Strike',
            desc: 'Coordinated agents run fuzzing, auth testing, and configuration audits in parallel.',
            code: `// DARKMATTER.strike()\nconst results = await engine.run();\n// [!] CRITICAL: IDOR on /api/users\n// [!] HIGH: SQL injection in /search\n// [✓] 23 total findings in 4.82s`,
        },
        {
            num: 'STEP 04',
            icon: <Brain size={16} />,
            title: 'Analyze',
            desc: 'AI correlates findings, removes duplicates, and generates executive-ready reports with remediation steps.',
            code: `// DARKMATTER.analyze()\nconst report = engine.generateReport();\nreport.exportPDF("findings.pdf");\n// → Risk score: 8.4 / 10\n// → 3 critical, instant remediation`,
        },
    ];

    return (
        <section id="protocol" ref={sectionRef} className="relative bg-[#0E111A] py-32 lg:py-40 overflow-hidden">
            <div className="max-w-6xl mx-auto px-6 lg:px-12">
                {/* Header */}
                <div className="mb-20">
                    <p className="text-[#B6FF2E] font-mono text-xs tracking-[0.3em] uppercase mb-4">THE PROTOCOL</p>
                    <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-[#F4F6FF] leading-tight">
                        The Execution Pipeline
                    </h2>
                    <p className="mt-4 text-[#A7ACBF] max-w-lg leading-relaxed">
                        From target definition to executive report. A proven sequence designed for precision.
                    </p>
                </div>

                {/* Steps */}
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] lg:left-[calc(45%-1px)] top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#B6FF2E]/50 via-[#B6FF2E]/20 to-transparent" />

                    <div className="space-y-16 lg:space-y-20">
                        {steps.map((step, idx) => (
                            <div key={idx} className="relative flex flex-col lg:flex-row items-start gap-6 lg:gap-12">
                                {/* Left — Text */}
                                <div className="protocol-step lg:w-[45%] lg:text-right pl-10 lg:pl-0">
                                    <span className="text-[#B6FF2E] font-mono text-[11px] tracking-[0.2em]">{step.num}</span>
                                    <h3 className="font-display font-bold text-2xl lg:text-3xl text-[#F4F6FF] mt-2 flex items-center lg:justify-end gap-2">
                                        {step.title}
                                    </h3>
                                    <p className="mt-3 text-[#A7ACBF] text-sm leading-relaxed lg:ml-auto lg:max-w-sm">{step.desc}</p>
                                </div>

                                {/* Dot on line */}
                                <div className="absolute left-[7px] lg:left-[calc(45%-8px)] top-0 w-4 h-4 rounded-full border-2 border-[#B6FF2E] bg-[#0E111A] flex items-center justify-center z-10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#B6FF2E]" />
                                </div>

                                {/* Right — Code */}
                                <div className="protocol-code lg:w-[55%] pl-10 lg:pl-0">
                                    <div className="bg-[#07080B] border border-white/5 rounded-lg p-4 font-mono text-[12px] leading-[1.6]">
                                        {step.code.split('\n').map((line, i) => (
                                            <div key={i} className={line.startsWith('//') ? 'text-[#608b4e]' : line.includes('[!]') ? 'text-[#ff6b6b]' : line.includes('[✓]') || line.includes('→') ? 'text-[#4af626]' : 'text-[#d4d4d4]'}>
                                                {line || '\u00A0'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
