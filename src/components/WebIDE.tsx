"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
    ChevronRight, ChevronDown, File, Folder, FolderOpen, X, Terminal as TerminalIcon,
    Settings, Search, GitBranch, Bug, Boxes, PanelLeft,
    Plus, MoreHorizontal, ArrowLeft, Bell, Wifi, CheckCircle
} from 'lucide-react';

// ─── File System ─────────────────────────────────────────────
interface FSNode {
    name: string;
    type: 'file' | 'folder';
    children?: FSNode[];
    content?: string;
    language?: string;
}

const DEFAULT_FS: FSNode[] = [
    {
        name: 'src', type: 'folder', children: [
            {
                name: 'main.py', type: 'file', language: 'python', content: `#!/usr/bin/env python3
"""Darkmatter Security Scanner — Entry Point"""

import asyncio
from scanner.engine import ScanEngine
from scanner.reporter import Reporter
from config import load_config

async def main():
    config = load_config("config.yaml")
    engine = ScanEngine(config)
    
    print("[*] Darkmatter Scanner v2.4 initialized")
    print(f"[*] Target: {config.target}")
    print(f"[*] Scan profile: {config.profile}")
    print()
    
    results = await engine.run()
    
    reporter = Reporter(results)
    reporter.print_summary()
    reporter.export_pdf("report.pdf")
    
    print(f"\\n[+] Scan complete. {len(results.findings)} findings.")

if __name__ == "__main__":
    asyncio.run(main())
` },
            {
                name: 'scanner', type: 'folder', children: [
                    { name: '__init__.py', type: 'file', language: 'python', content: `"""Darkmatter Scanner Module"""\n__version__ = "2.4.0"\n` },
                    {
                        name: 'engine.py', type: 'file', language: 'python', content: `"""Core scanning engine with coordinated agents."""
import asyncio
from typing import List
from dataclasses import dataclass, field

@dataclass
class Finding:
    severity: str  # critical, high, medium, low, info
    title: str
    description: str
    evidence: str = ""
    remediation: str = ""

@dataclass
class ScanResults:
    findings: List[Finding] = field(default_factory=list)
    scan_time: float = 0.0
    targets_scanned: int = 0

class ScanEngine:
    """Orchestrates multiple scanning agents."""
    
    def __init__(self, config):
        self.config = config
        self.agents = []
        self._setup_agents()
    
    def _setup_agents(self):
        """Initialize scanning agents based on config."""
        from .agents import (
            DiscoveryAgent,
            FuzzingAgent, 
            AuthAgent,
            ConfigAgent,
            CodeAgent
        )
        
        agent_map = {
            'discovery': DiscoveryAgent,
            'fuzzing': FuzzingAgent,
            'auth': AuthAgent,
            'config': ConfigAgent,
            'code': CodeAgent,
        }
        
        for name in self.config.agents:
            if name in agent_map:
                self.agents.append(agent_map[name](self.config))
    
    async def run(self) -> ScanResults:
        """Execute all agents concurrently."""
        import time
        start = time.time()
        
        tasks = [agent.scan() for agent in self.agents]
        agent_results = await asyncio.gather(*tasks)
        
        results = ScanResults()
        for agent_findings in agent_results:
            results.findings.extend(agent_findings)
        
        results.scan_time = time.time() - start
        results.targets_scanned = self.config.target_count
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        results.findings.sort(key=lambda f: severity_order.get(f.severity, 5))
        
        return results
` },
                    {
                        name: 'reporter.py', type: 'file', language: 'python', content: `"""Report generation for scan results."""

class Reporter:
    def __init__(self, results):
        self.results = results
    
    def print_summary(self):
        """Print a colored summary to terminal."""
        findings = self.results.findings
        
        critical = sum(1 for f in findings if f.severity == 'critical')
        high = sum(1 for f in findings if f.severity == 'high')
        medium = sum(1 for f in findings if f.severity == 'medium')
        low = sum(1 for f in findings if f.severity == 'low')
        
        print("=" * 60)
        print("  SCAN RESULTS SUMMARY")
        print("=" * 60)
        print(f"  Critical: {critical}")
        print(f"  High:     {high}")
        print(f"  Medium:   {medium}")
        print(f"  Low:      {low}")
        print(f"  Total:    {len(findings)}")
        print(f"  Time:     {self.results.scan_time:.2f}s")
        print("=" * 60)
    
    def export_pdf(self, path: str):
        """Export findings to PDF report."""
        print(f"  [+] Report exported to {path}")
` },
                ]
            },
            {
                name: 'config.py', type: 'file', language: 'python', content: `"""Configuration loader."""
import yaml
from dataclasses import dataclass, field
from typing import List

@dataclass
class Config:
    target: str = "https://example.com"
    profile: str = "full"
    agents: List[str] = field(default_factory=lambda: [
        'discovery', 'fuzzing', 'auth', 'config', 'code'
    ])
    target_count: int = 1
    timeout: int = 300
    threads: int = 10

def load_config(path: str) -> Config:
    """Load config from YAML file."""
    try:
        with open(path) as f:
            data = yaml.safe_load(f)
        return Config(**data)
    except FileNotFoundError:
        print(f"[!] Config {path} not found, using defaults")
        return Config()
` },
        ]
    },
    {
        name: 'config.yaml', type: 'file', language: 'yaml', content: `# Darkmatter Scanner Configuration
target: "https://api.targetapp.com"
profile: full

agents:
  - discovery
  - fuzzing
  - auth
  - config
  - code

timeout: 300
threads: 10

# Advanced options
rate_limit: 100  # requests per second
proxy: null
auth_token: null
` },
    {
        name: 'requirements.txt', type: 'file', language: 'plaintext', content: `aiohttp>=3.9.0
pyyaml>=6.0
rich>=13.0
reportlab>=4.0
cryptography>=41.0
` },
    {
        name: 'README.md', type: 'file', language: 'markdown', content: `# Darkmatter Scanner v2.4

AI-powered security scanning engine with coordinated agents.

## Quick Start

\`\`\`bash
pip install -r requirements.txt
python src/main.py
\`\`\`

## Agents

| Agent | Description |
|-------|-------------|
| Discovery | Asset enumeration and mapping |
| Fuzzing | Input validation testing |
| Auth | Authentication & authorization |
| Config | Security misconfiguration |
| Code | Static analysis correlation |

## License

Proprietary — Darkmatter Labs © 2026
` },
];

// ─── Helpers ─────────────────────────────────────────────────
function flattenFiles(nodes: FSNode[], path = ''): { path: string; node: FSNode }[] {
    const result: { path: string; node: FSNode }[] = [];
    for (const n of nodes) {
        const p = path ? `${path}/${n.name}` : n.name;
        if (n.type === 'file') result.push({ path: p, node: n });
        if (n.children) result.push(...flattenFiles(n.children, p));
    }
    return result;
}

function getFileIcon(name: string) {
    if (name.endsWith('.py')) return <span className="text-[#3572A5]">🐍</span>;
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return <span className="text-[#cb171e]">⚙</span>;
    if (name.endsWith('.md')) return <span className="text-[#519aba]">📝</span>;
    if (name.endsWith('.txt')) return <span className="text-[#888]">📄</span>;
    return <File size={14} className="text-[#888]" />;
}

// ─── File Tree ───────────────────────────────────────────────
function FileTreeNode({ node, depth, path, onOpen, activeFile }: {
    node: FSNode; depth: number; path: string;
    onOpen: (path: string, node: FSNode) => void;
    activeFile: string;
}) {
    const [expanded, setExpanded] = useState(depth < 2);
    const fullPath = path ? `${path}/${node.name}` : node.name;
    const isActive = fullPath === activeFile;

    if (node.type === 'folder') {
        return (
            <div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-1.5 px-2 py-[3px] text-[13px] hover:bg-[#2a2d3e] transition-colors text-left"
                    style={{ paddingLeft: depth * 12 + 8 }}
                >
                    {expanded ? <ChevronDown size={14} className="text-[#888] shrink-0" /> : <ChevronRight size={14} className="text-[#888] shrink-0" />}
                    {expanded ? <FolderOpen size={14} className="text-[#B6FF2E] shrink-0" /> : <Folder size={14} className="text-[#B6FF2E] shrink-0" />}
                    <span className="truncate text-[#ccc]">{node.name}</span>
                </button>
                {expanded && node.children?.map((child) => (
                    <FileTreeNode key={child.name} node={child} depth={depth + 1} path={fullPath} onOpen={onOpen} activeFile={activeFile} />
                ))}
            </div>
        );
    }

    return (
        <button
            onClick={() => onOpen(fullPath, node)}
            className={`w-full flex items-center gap-1.5 px-2 py-[3px] text-[13px] transition-colors text-left ${isActive ? 'bg-[#37394e] text-white' : 'hover:bg-[#2a2d3e] text-[#ccc]'}`}
            style={{ paddingLeft: depth * 12 + 22 }}
        >
            {getFileIcon(node.name)}
            <span className="truncate">{node.name}</span>
        </button>
    );
}

// ─── Terminal ────────────────────────────────────────────────
function TerminalPanel() {
    const [lines, setLines] = useState<string[]>([
        '\x1b[32m❯\x1b[0m darkmatter-scanner v2.4',
        '\x1b[90m$ python src/main.py\x1b[0m',
        '[*] Darkmatter Scanner v2.4 initialized',
        '[*] Target: https://api.targetapp.com',
        '[*] Scan profile: full',
        '',
        '\x1b[33m[▸]\x1b[0m Running discovery agent...',
        '\x1b[33m[▸]\x1b[0m Running fuzzing agent...',
        '\x1b[33m[▸]\x1b[0m Running auth agent...',
        '\x1b[32m[✓]\x1b[0m Discovery complete — 47 endpoints found',
        '\x1b[32m[✓]\x1b[0m Auth testing complete — 3 findings',
        '\x1b[31m[!]\x1b[0m Critical: IDOR on /api/users/{id}',
        '\x1b[32m[✓]\x1b[0m All agents complete',
        '',
        '════════════════════════════════════════',
        '  SCAN RESULTS SUMMARY',
        '════════════════════════════════════════',
        '  Critical: 1',
        '  High:     3',
        '  Medium:   7',
        '  Low:      12',
        '  Total:    23',
        '  Time:     4.82s',
        '════════════════════════════════════════',
        '  [+] Report exported to report.pdf',
        '',
    ]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [lines]);

    const handleSubmit = () => {
        if (!input.trim()) return;
        const newLines = [...lines, `\x1b[32m❯\x1b[0m ${input}`];
        if (input === 'clear') { setLines([]); setInput(''); return; }
        if (input === 'help') { newLines.push('Commands: help, clear, scan, status, exit'); }
        else if (input === 'status') { newLines.push('[*] All systems operational', '[*] 23 findings | 47 endpoints | 4.82s'); }
        else if (input.startsWith('scan')) { newLines.push('[*] Initiating new scan...', '\x1b[33m[▸]\x1b[0m Scanning...'); }
        else { newLines.push(`\x1b[31mCommand not found:\x1b[0m ${input}`); }
        setLines(newLines);
        setInput('');
    };

    const renderLine = (line: string) => {
        return line
            .replace(/\x1b\[32m/g, '<span style="color:#B6FF2E">')
            .replace(/\x1b\[31m/g, '<span style="color:#ff6b6b">')
            .replace(/\x1b\[33m/g, '<span style="color:#ffd93d">')
            .replace(/\x1b\[90m/g, '<span style="color:#666">')
            .replace(/\x1b\[0m/g, '</span>');
    };

    return (
        <div className="h-full flex flex-col bg-[#0e1019] font-mono text-[13px]">
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1e2030] text-[12px]">
                <span className="flex items-center gap-1.5 text-white border-b-2 border-[#B6FF2E] pb-1 px-1"><TerminalIcon size={12} /> TERMINAL</span>
                <span className="flex items-center gap-1.5 text-[#666] px-1 cursor-pointer hover:text-white"><Bug size={12} /> PROBLEMS</span>
                <div className="ml-auto flex gap-2">
                    <button className="text-[#666] hover:text-white"><Plus size={14} /></button>
                    <button className="text-[#666] hover:text-white"><MoreHorizontal size={14} /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
                {lines.map((line, i) => (
                    <div key={i} dangerouslySetInnerHTML={{ __html: renderLine(line) || '&nbsp;' }} className="text-[#ccc] leading-5" />
                ))}
                <div ref={bottomRef} />
            </div>
            <div className="flex items-center px-3 py-1 border-t border-[#1e2030]">
                <span className="text-[#B6FF2E] mr-2">❯</span>
                <input
                    value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="flex-1 bg-transparent text-[#ccc] outline-none text-[13px]"
                    placeholder="Type a command..."
                    autoFocus
                />
            </div>
        </div>
    );
}

// ─── Main IDE ────────────────────────────────────────────────
export default function WebIDE({ onBack }: { onBack?: () => void } = {}) {
    const router = useRouter();
    const handleBack = onBack || (() => router.push('/'));
    const [openTabs, setOpenTabs] = useState<{ path: string; node: FSNode }[]>([]);
    const [activeTab, setActiveTab] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [sidebarTab, setSidebarTab] = useState<'files' | 'search'>('files');

    // Open default file
    useEffect(() => {
        const allFiles = flattenFiles(DEFAULT_FS);
        const mainFile = allFiles.find(f => f.path === 'src/main.py');
        if (mainFile) {
            setOpenTabs([mainFile]);
            setActiveTab(mainFile.path);
        }
    }, []);

    const openFile = (path: string, node: FSNode) => {
        if (!openTabs.find(t => t.path === path)) {
            setOpenTabs([...openTabs, { path, node }]);
        }
        setActiveTab(path);
    };

    const closeTab = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTabs = openTabs.filter(t => t.path !== path);
        setOpenTabs(newTabs);
        if (activeTab === path) {
            setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1].path : '');
        }
    };

    const activeNode = openTabs.find(t => t.path === activeTab)?.node;

    return (
        <div className="fixed inset-0 z-[200] bg-[#12141f] flex flex-col text-[#ccc]" style={{ fontFamily: "'IBM Plex Mono', 'Consolas', monospace" }}>
            {/* Title Bar */}
            <div className="h-9 bg-[#0e1019] flex items-center px-3 border-b border-[#1e2030] select-none shrink-0">
                <button onClick={handleBack} className="flex items-center gap-2 text-[13px] text-[#888] hover:text-[#B6FF2E] transition-colors mr-4">
                    <ArrowLeft size={14} /> Back to Darkmatter
                </button>
                <div className="flex-1 text-center text-[13px] text-[#888]">
                    {activeTab || 'Darkmatter IDE'} — <span className="text-[#B6FF2E]">Darkmatter IDE</span>
                </div>
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Activity Bar */}
                <div className="w-12 bg-[#0a0c14] flex flex-col items-center py-2 gap-1 border-r border-[#1e2030] shrink-0">
                    {[
                        { icon: <File size={20} />, id: 'files' as const },
                        { icon: <Search size={20} />, id: 'search' as const },
                        { icon: <GitBranch size={20} />, id: 'files' as const },
                        { icon: <Bug size={20} />, id: 'files' as const },
                        { icon: <Boxes size={20} />, id: 'files' as const },
                    ].map((item, i) => (
                        <button
                            key={i}
                            onClick={() => { if (sidebarTab === item.id && sidebarOpen) setSidebarOpen(false); else { setSidebarTab(item.id); setSidebarOpen(true); } }}
                            className={`w-full flex items-center justify-center py-2.5 transition-colors ${i === 0 && sidebarOpen ? 'text-white border-l-2 border-[#B6FF2E] bg-[#12141f]' : 'text-[#555] hover:text-[#999]'}`}
                        >
                            {item.icon}
                        </button>
                    ))}
                    <div className="flex-1" />
                    <button className="text-[#555] hover:text-[#999] py-2"><Settings size={20} /></button>
                </div>

                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="w-60 bg-[#12141f] border-r border-[#1e2030] flex flex-col shrink-0 overflow-hidden">
                        <div className="px-4 py-2.5 text-[11px] font-semibold tracking-wider text-[#888] uppercase">Explorer</div>
                        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#888] uppercase flex items-center gap-1">
                            <ChevronDown size={12} /> DARKMATTER-SCANNER
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {DEFAULT_FS.map((node) => (
                                <FileTreeNode key={node.name} node={node} depth={0} path="" onOpen={openFile} activeFile={activeTab} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Editor Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="h-[35px] bg-[#0e1019] flex items-end border-b border-[#1e2030] overflow-x-auto shrink-0">
                        {openTabs.map((tab) => (
                            <button
                                key={tab.path}
                                onClick={() => setActiveTab(tab.path)}
                                className={`flex items-center gap-2 px-3 h-[34px] text-[13px] border-r border-[#1e2030] shrink-0 transition-colors ${activeTab === tab.path ? 'bg-[#12141f] text-white border-t-2 border-t-[#B6FF2E]' : 'bg-[#0a0c14] text-[#888] hover:bg-[#12141f]'}`}
                            >
                                {getFileIcon(tab.node.name)}
                                <span>{tab.node.name}</span>
                                <span onClick={(e) => closeTab(tab.path, e)} className="ml-1 hover:bg-[#333] rounded p-0.5"><X size={12} /></span>
                            </button>
                        ))}
                    </div>

                    {/* Editor Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeNode ? (
                            <Editor
                                theme="vs-dark"
                                language={activeNode.language || 'plaintext'}
                                value={activeNode.content || ''}
                                options={{
                                    fontSize: 14,
                                    fontFamily: "'IBM Plex Mono', Consolas, monospace",
                                    minimap: { enabled: true },
                                    scrollBeyondLastLine: false,
                                    renderLineHighlight: 'all',
                                    padding: { top: 12 },
                                    cursorBlinking: 'smooth',
                                    smoothScrolling: true,
                                    bracketPairColorization: { enabled: true },
                                }}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[#555]">
                                <div className="text-6xl mb-6 opacity-20">⌨</div>
                                <div className="text-xl font-display">Darkmatter IDE</div>
                                <div className="text-sm mt-2">Open a file from the explorer to start editing</div>
                            </div>
                        )}
                    </div>

                    {/* Terminal */}
                    {terminalOpen && (
                        <div className="h-[250px] border-t border-[#1e2030] shrink-0">
                            <TerminalPanel />
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-[#0a0c14] border-t border-[#1e2030] flex items-center px-3 text-[11px] shrink-0 select-none">
                <div className="flex items-center gap-4 text-[#888]">
                    <span className="flex items-center gap-1"><GitBranch size={12} /> main</span>
                    <span className="flex items-center gap-1"><CheckCircle size={12} className="text-[#28c840]" /> 0 errors</span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setTerminalOpen(!terminalOpen)}>
                        <TerminalIcon size={12} /> Terminal
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <PanelLeft size={12} /> Sidebar
                    </span>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-4 text-[#888]">
                    <span>{activeNode?.language || 'Plain Text'}</span>
                    <span>UTF-8</span>
                    <span className="flex items-center gap-1"><Wifi size={12} className="text-[#28c840]" /> Connected</span>
                    <span className="flex items-center gap-1"><Bell size={12} /></span>
                    <span className="text-[#B6FF2E] font-semibold">Darkmatter</span>
                </div>
            </div>
        </div>
    );
}
