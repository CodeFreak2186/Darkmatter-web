"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  Target,
  Brain,
  Shield,
  AlertTriangle,
  ChevronRight,
  Activity,
  Terminal,
  Code,
  Crosshair,
  Radio,
  Cpu,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Clock,
  BarChart3,
  FileText,
  Globe,
  Lock,
  Wifi,
  Search,
  Bug,
  Key,
  Server,
  Cloud,
  Container,
  Skull,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface AutopilotEvent {
  phase: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface Finding {
  id: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  endpoint: string;
  description: string;
  recommendation: string;
  cvss: number;
  tool: string;
  cve?: string;
  verified: boolean;
  discovered_in_round: number;
  attack_chain?: string;
}

type Phase = "idle" | "init" | "decision" | "attack" | "analysis" | "report" | "complete" | "error";

// ─── Severity Styles ──────────────────────────────────────────

const SEV_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", glow: "shadow-red-500/20" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", glow: "shadow-orange-500/20" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", glow: "shadow-yellow-500/20" },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", glow: "shadow-blue-500/20" },
  info: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", glow: "shadow-gray-500/20" },
};

const SEV_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

const AGENT_ICONS: Record<string, React.ReactNode> = {
  nmap: <Wifi size={16} />,
  dirb: <Search size={16} />,
  nikto: <Globe size={16} />,
  sqlmap: <Bug size={16} />,
  metasploit: <Skull size={16} />,
  ssl: <Lock size={16} />,
  osint: <Eye size={16} />,
  burp: <Shield size={16} />,
  cloud: <Cloud size={16} />,
  container: <Container size={16} />,
  api: <Server size={16} />,
  secrets: <Key size={16} />,
  waf: <Shield size={16} />,
  ad: <Cpu size={16} />,
  takeover: <Target size={16} />,
};

// ─── Navigation ───────────────────────────────────────────────

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#07080B]/90 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-6 lg:px-12 py-4">
        <Link href="/" className="font-display font-bold text-xl tracking-tight text-[#F4F6FF] hover:text-[#B6FF2E] transition-colors">
          Darkmatter
        </Link>
        <div className="hidden lg:flex items-center gap-8">
          <Link href="/dashboard" className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors flex items-center gap-1.5">
            <Activity size={15} /> Dashboard
          </Link>
          <Link href="/terminal" className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors flex items-center gap-1.5">
            <Terminal size={15} /> Terminal
          </Link>
          <Link href="/ide" className="text-sm text-[#A7ACBF] hover:text-[#F4F6FF] transition-colors flex items-center gap-1.5">
            <Code size={15} /> Web IDE
          </Link>
          <Link href="/autopilot" className="text-sm text-[#ff4040] font-semibold flex items-center gap-1.5">
            <Crosshair size={15} className="animate-pulse" /> Autopilot
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Animated Background ──────────────────────────────────────

function AttackGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes: { x: number; y: number; vx: number; vy: number; size: number; pulse: number }[] = [];
    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const t = Date.now() * 0.001;

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.offsetWidth) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.offsetHeight) node.vy *= -1;
        node.pulse += 0.02;

        const alpha = 0.3 + Math.sin(node.pulse) * 0.2;
        ctx.fillStyle = `rgba(255, 64, 64, ${alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.08;
            ctx.strokeStyle = `rgba(255, 64, 64, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Pulse rings
      const ringAlpha = 0.05 + Math.sin(t) * 0.03;
      ctx.strokeStyle = `rgba(255, 64, 64, ${ringAlpha})`;
      ctx.lineWidth = 1;
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      for (let r = 50; r < 400; r += 80) {
        const radius = r + Math.sin(t + r * 0.01) * 10;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />;
}

// ─── Phase Indicator ──────────────────────────────────────────

function PhaseIndicator({ currentPhase }: { currentPhase: Phase }) {
  const phases: { key: Phase; label: string; icon: React.ReactNode }[] = [
    { key: "init", label: "Initialize", icon: <Radio size={14} /> },
    { key: "decision", label: "AI Strategy", icon: <Brain size={14} /> },
    { key: "attack", label: "Attack", icon: <Crosshair size={14} /> },
    { key: "analysis", label: "Analyze", icon: <Activity size={14} /> },
    { key: "report", label: "Report", icon: <FileText size={14} /> },
    { key: "complete", label: "Complete", icon: <CheckCircle2 size={14} /> },
  ];

  const currentIdx = phases.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
      {phases.map((phase, i) => {
        const isActive = phase.key === currentPhase;
        const isDone = i < currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={phase.key} className="flex items-center shrink-0">
            <div
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-500
                ${isActive ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_15px_rgba(255,64,64,0.15)]" : ""}
                ${isDone ? "bg-[#B6FF2E]/10 text-[#B6FF2E] border border-[#B6FF2E]/20" : ""}
                ${isFuture ? "bg-white/5 text-[#A7ACBF]/50 border border-white/5" : ""}
              `}
            >
              {isDone ? <CheckCircle2 size={12} className="text-[#B6FF2E]" /> : isActive ? <Loader2 size={12} className="animate-spin" /> : phase.icon}
              <span>{phase.label}</span>
            </div>
            {i < phases.length - 1 && (
              <ChevronRight size={14} className={`mx-0.5 ${isDone ? "text-[#B6FF2E]/30" : "text-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Terminal Feed ────────────────────────────────────────────

function TerminalFeed({ events }: { events: AutopilotEvent[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const getEventStyle = (event: AutopilotEvent) => {
    switch (event.type) {
      case "thinking":
        return "text-purple-400";
      case "decision":
        return "text-cyan-400";
      case "finding":
        return "text-red-400";
      case "error":
        return "text-red-500";
      case "status":
        return "text-[#B6FF2E]";
      case "agent_report":
        return "text-yellow-400";
      case "summary":
        return "text-[#B6FF2E] font-bold";
      default:
        return "text-[#A7ACBF]";
    }
  };

  const formatMessage = (event: AutopilotEvent): string => {
    const d = event.data;
    if (d.message) return d.message as string;
    if (event.type === "finding") {
      const f = d as unknown as Finding;
      return `${SEV_ICONS[f.severity] || "⚪"} [${(f.severity || "info").toUpperCase()}] ${f.title} → ${f.endpoint}`;
    }
    if (event.type === "agent_report") {
      return `✓ ${d.agentName} — ${d.findingCount} findings`;
    }
    if (event.type === "decision") {
      return `Strategy: ${d.overall_strategy || d.reasoning || "Planning..."}`;
    }
    return JSON.stringify(d).slice(0, 120);
  };

  return (
    <div ref={feedRef} className="h-64 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2">
      {events.length === 0 && <div className="text-[#A7ACBF]/50 italic">Awaiting autopilot initialization...</div>}
      {events.map((event, i) => (
        <div key={i} className={`${getEventStyle(event)} flex gap-2 py-0.5`}>
          <span className="text-[#A7ACBF]/30 shrink-0 tabular-nums">{new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false })}</span>
          <span className="text-[#A7ACBF]/20 shrink-0">[{event.phase}]</span>
          <span className="break-all">{formatMessage(event)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Finding Card ─────────────────────────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
  const style = SEV_STYLES[finding.severity] || SEV_STYLES.info;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`
        ${style.bg} ${style.border} border rounded-lg p-3 cursor-pointer
        hover:shadow-lg ${style.glow} transition-all duration-300 hover:-translate-y-0.5
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{SEV_ICONS[finding.severity]}</span>
          <div className="min-w-0">
            <div className={`font-semibold text-sm ${style.text} truncate`}>{finding.title}</div>
            <div className="text-xs text-[#A7ACBF]/70 truncate mt-0.5">{finding.endpoint}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {finding.cve && <span className="text-[10px] font-mono text-cyan-400/70 bg-cyan-400/5 px-1.5 py-0.5 rounded">{finding.cve}</span>}
          <span className="text-[10px] font-mono text-[#A7ACBF]/50 bg-white/5 px-1.5 py-0.5 rounded">CVSS {finding.cvss}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2 animate-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-[#A7ACBF] leading-relaxed">{finding.description}</p>
          {finding.recommendation && (
            <div className="text-xs text-[#B6FF2E]/70 bg-[#B6FF2E]/5 px-2 py-1.5 rounded">
              💡 {finding.recommendation}
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-[#A7ACBF]/50">
            <span>Tool: {finding.tool}</span>
            <span>Round: {finding.discovered_in_round}</span>
            {finding.attack_chain && <span>Chain: {finding.attack_chain}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attack Decision Card ─────────────────────────────────────

function DecisionCard({ data }: { data: Record<string, unknown> }) {
  const attacks = (data.attacks as Array<{ agent: string; rationale: string; priority: string }>) || [];

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-purple-400">
        <Brain size={16} />
        <span className="font-semibold text-sm">AI Attack Strategy</span>
      </div>
      {data.target_analysis && <p className="text-xs text-[#A7ACBF] leading-relaxed">{data.target_analysis as string}</p>}
      {data.overall_strategy && <p className="text-xs text-purple-300/80 font-mono">{data.overall_strategy as string}</p>}
      {data.reasoning && <p className="text-xs text-purple-300/80 font-mono">{data.reasoning as string}</p>}
      {attacks.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-purple-500/10">
          {attacks.map((atk, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-purple-400">{AGENT_ICONS[atk.agent] || <Crosshair size={12} />}</span>
              <span className="text-[#F4F6FF] font-medium">{atk.agent}</span>
              <ArrowRight size={10} className="text-[#A7ACBF]/30" />
              <span className="text-[#A7ACBF] truncate">{atk.rationale}</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${atk.priority === "critical" ? "bg-red-500/10 text-red-400" : atk.priority === "high" ? "bg-orange-500/10 text-orange-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                {atk.priority}
              </span>
            </div>
          ))}
        </div>
      )}
      {(data.chains_exploited as string[] || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(data.chains_exploited as string[]).map((chain, i) => (
            <span key={i} className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-1">
              <GitBranch size={10} /> {chain}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Score Ring ────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  const color =
    score >= 8 ? "#ff4040" : score >= 6 ? "#ff9f43" : score >= 4 ? "#ffc107" : "#B6FF2E";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-bold" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-[10px] text-[#A7ACBF]/50 font-mono">/10</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function AutopilotPage() {
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<AutopilotEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [decisions, setDecisions] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState({ rounds: 0, totalTime: 0, riskScore: 0 });
  const [report, setReport] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startAutopilot = useCallback(async () => {
    if (!target.trim()) return;

    // Reset state
    setPhase("init");
    setEvents([]);
    setFindings([]);
    setDecisions([]);
    setStats({ rounds: 0, totalTime: 0, riskScore: 0 });
    setReport("");
    startTimer();

    try {
      // Start the autopilot job
      const res = await fetch("/api/autopilot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim() }),
      });

      if (!res.ok) {
        setPhase("error");
        stopTimer();
        return;
      }

      const { jobId } = await res.json();

      // Connect to SSE stream
      const es = new EventSource(`/api/autopilot/${jobId}/stream`);
      eventSourceRef.current = es;

      es.addEventListener("autopilot_event", (e) => {
        const event: AutopilotEvent = JSON.parse(e.data);

        setEvents((prev) => [...prev, event]);

        // Update phase
        if (event.phase && event.phase !== "init") {
          setPhase(event.phase as Phase);
        }

        // Track findings
        if (event.type === "finding") {
          const f = event.data as unknown as Finding;
          setFindings((prev) => {
            const exists = prev.some((p) => p.id === f.id);
            return exists ? prev : [...prev, f];
          });
        }

        // Track decisions
        if (event.type === "decision") {
          setDecisions((prev) => [...prev, event.data]);
        }
      });

      es.addEventListener("complete", (e) => {
        const data = JSON.parse(e.data);
        setPhase("complete");
        setReport(data.report || "");
        setStats({
          rounds: data.rounds || 0,
          totalTime: data.totalTime || 0,
          riskScore:
            Math.min(10, parseFloat(((data.critical || 0) * 2.5 + (data.high || 0) * 1.5 + (data.medium || 0) * 0.7 + (data.low || 0) * 0.2).toFixed(1))),
        });
        stopTimer();
        es.close();
      });

      es.addEventListener("error", (e) => {
        setPhase("error");
        stopTimer();
        es.close();
      });
    } catch (err) {
      setPhase("error");
      stopTimer();
    }
  }, [target, startTimer, stopTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      stopTimer();
    };
  }, [stopTimer]);

  const isRunning = !["idle", "complete", "error"].includes(phase);

  const critCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const medCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  return (
    <div className="relative min-h-screen bg-[#07080B] text-[#F4F6FF] font-sans">
      <Navigation />

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <AttackGrid />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080B] via-transparent to-[#07080B]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 pt-24 pb-16 px-4 lg:px-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Crosshair size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">
                AUTOPILOT <span className="text-red-400">ATTACK</span>
              </h1>
              <p className="text-xs text-[#A7ACBF] font-mono">Autonomous AI Red Team Orchestrator</p>
            </div>
          </div>
        </div>

        {/* Target Input */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-500/10 via-purple-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isRunning && startAutopilot()}
                placeholder="Enter target URL (e.g. https://example.com)"
                disabled={isRunning}
                className="relative w-full bg-[#0E111A] border border-white/10 rounded-lg px-5 py-3.5 text-[#F4F6FF] font-mono text-sm placeholder:text-[#A7ACBF]/30 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20 transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={startAutopilot}
              disabled={isRunning || !target.trim()}
              className={`
                relative px-8 py-3.5 rounded-lg font-semibold text-sm transition-all duration-300
                flex items-center gap-2 shrink-0
                ${isRunning
                  ? "bg-red-500/10 text-red-400/50 border border-red-500/20 cursor-not-allowed"
                  : "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 hover:shadow-[0_0_30px_rgba(255,64,64,0.3)] hover:-translate-y-0.5 active:translate-y-0"
                }
              `}
            >
              {isRunning ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Running...
                </>
              ) : (
                <>
                  <Zap size={16} /> LAUNCH AUTOPILOT
                </>
              )}
            </button>
          </div>
        </div>

        {/* Phase Indicator */}
        {phase !== "idle" && (
          <div className="mb-6">
            <PhaseIndicator currentPhase={phase} />
          </div>
        )}

        {/* Main Grid */}
        {phase !== "idle" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column — Terminal + Decisions */}
            <div className="lg:col-span-5 space-y-4">
              {/* Live Terminal */}
              <div className="bg-[#0A0D14] border border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                  </div>
                  <span className="text-[10px] text-[#A7ACBF]/50 font-mono ml-2">AUTOPILOT FEED</span>
                  <div className="ml-auto flex items-center gap-2">
                    {isRunning && <Radio size={12} className="text-red-400 animate-pulse" />}
                    <span className="text-[10px] text-[#A7ACBF]/30 font-mono tabular-nums">{events.length} events</span>
                  </div>
                </div>
                <div className="p-3">
                  <TerminalFeed events={events} />
                </div>
              </div>

              {/* AI Decisions */}
              {decisions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono text-[#A7ACBF]/50 uppercase tracking-wider">AI Decisions</h3>
                  {decisions.map((d, i) => (
                    <DecisionCard key={i} data={d} />
                  ))}
                </div>
              )}

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0A0D14] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-[#A7ACBF]/50 font-mono mb-1">
                    <Clock size={12} className="inline mr-1" />Elapsed
                  </div>
                  <div className="text-lg font-mono text-[#F4F6FF] tabular-nums">{elapsed.toFixed(1)}s</div>
                </div>
                <div className="bg-[#0A0D14] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-[#A7ACBF]/50 font-mono mb-1">
                    <BarChart3 size={12} className="inline mr-1" />Findings
                  </div>
                  <div className="text-lg font-mono text-[#F4F6FF] tabular-nums">{findings.length}</div>
                </div>
                <div className="bg-[#0A0D14] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-[#A7ACBF]/50 font-mono mb-1">
                    <Target size={12} className="inline mr-1" />Events
                  </div>
                  <div className="text-lg font-mono text-[#F4F6FF] tabular-nums">{events.length}</div>
                </div>
              </div>
            </div>

            {/* Right Column — Findings + Summary */}
            <div className="lg:col-span-7 space-y-4">
              {/* Severity Overview */}
              {findings.length > 0 && (
                <div className="bg-[#0A0D14] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#F4F6FF] flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-400" /> Severity Breakdown
                    </h3>
                    {phase === "complete" && <ScoreRing score={stats.riskScore} size={60} />}
                  </div>
                  <div className="flex gap-3">
                    {[
                      { label: "Critical", count: critCount, color: "bg-red-500", text: "text-red-400" },
                      { label: "High", count: highCount, color: "bg-orange-500", text: "text-orange-400" },
                      { label: "Medium", count: medCount, color: "bg-yellow-500", text: "text-yellow-400" },
                      { label: "Low", count: lowCount, color: "bg-blue-500", text: "text-blue-400" },
                      { label: "Info", count: infoCount, color: "bg-gray-500", text: "text-gray-400" },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 text-center">
                        <div className={`text-xl font-mono font-bold ${s.text} tabular-nums`}>{s.count}</div>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                          <span className="text-[10px] text-[#A7ACBF]/50">{s.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Findings List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-[#A7ACBF]/50 uppercase tracking-wider">
                    Vulnerabilities ({findings.length})
                  </h3>
                  {isRunning && <Loader2 size={12} className="animate-spin text-red-400" />}
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {findings.length === 0 && phase !== "idle" && (
                    <div className="text-center py-8 text-[#A7ACBF]/30">
                      <Crosshair size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Scanning for vulnerabilities...</p>
                    </div>
                  )}
                  {findings
                    .sort((a, b) => {
                      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                      return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
                    })
                    .map((f) => (
                      <FindingCard key={f.id} finding={f} />
                    ))}
                </div>
              </div>

              {/* Final Report */}
              {phase === "complete" && report && (
                <div className="bg-[#0A0D14] border border-[#B6FF2E]/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3 text-[#B6FF2E]">
                    <CheckCircle2 size={16} />
                    <span className="font-semibold text-sm">Autopilot Complete</span>
                  </div>
                  <pre className="text-xs text-[#A7ACBF] font-mono whitespace-pre-wrap leading-relaxed">{report}</pre>
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-[#A7ACBF]/50 font-mono">
                    <span>Rounds: {stats.rounds}</span>
                    <span>Time: {stats.totalTime.toFixed(1)}s</span>
                    <span>Risk: {stats.riskScore}/10</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Idle State */}
        {phase === "idle" && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center mb-6">
              <Crosshair size={36} className="text-red-400/60" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-3">
              Autonomous <span className="text-red-400">Attack</span> Engine
            </h2>
            <p className="text-[#A7ACBF] max-w-lg leading-relaxed mb-8">
              Enter a target URL above and Darkmatter&apos;s AI will autonomously analyze the target,
              decide which attacks to run, select optimal parameters, and chain findings for maximum
              vulnerability discovery — all without manual intervention.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
              {[
                { icon: <Brain size={20} />, title: "AI Strategy", desc: "Gemini analyzes the target and plans multi-round attacks" },
                { icon: <GitBranch size={20} />, title: "Attack Chaining", desc: "Findings from each round inform the next attack decisions" },
                { icon: <Crosshair size={20} />, title: "15 Agents", desc: "From Nmap to Metasploit — deployed autonomously" },
              ].map((feat) => (
                <div key={feat.title} className="bg-[#0A0D14] border border-white/5 rounded-lg p-4 hover:border-red-500/20 transition-colors">
                  <div className="text-red-400/60 mb-2">{feat.icon}</div>
                  <div className="text-sm font-semibold text-[#F4F6FF] mb-1">{feat.title}</div>
                  <div className="text-xs text-[#A7ACBF]/70">{feat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
