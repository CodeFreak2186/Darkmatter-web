"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
    ChevronRight, ChevronDown, File, Folder, FolderOpen, X, Terminal as TerminalIcon,
    Settings, Search, GitBranch, Bug, Boxes, PanelLeft,
    Plus, MoreHorizontal, ArrowLeft, Bell, Wifi, CheckCircle,
<<<<<<< HEAD
    Upload, Shield, Loader2, FolderUp
} from 'lucide-react';

=======
    Upload, Shield, Loader2, FolderUp, Copy, Check
} from 'lucide-react';

declare global {
    interface Window {
        __darkmatterCodeLensRegistered?: boolean;
        __darkmatterApplyFixCallback?: (finding: any) => void;
    }
}

>>>>>>> main
// ─── File System ─────────────────────────────────────────────
interface FSNode {
    name: string;
    type: 'file' | 'folder';
    children?: FSNode[];
    content?: string;
    language?: string;
}

function detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        py: 'python', js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
        java: 'java', go: 'go', rb: 'ruby', php: 'php', cs: 'csharp', c: 'c', cpp: 'cpp',
        rs: 'rust', html: 'html', css: 'css', scss: 'scss', json: 'json', xml: 'xml',
        yaml: 'yaml', yml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell',
        env: 'plaintext', txt: 'plaintext', tf: 'hcl', dockerfile: 'dockerfile',
    };
    return map[ext] || 'plaintext';
}

function buildFSTree(files: { path: string; content: string }[]): FSNode[] {
    const root: FSNode[] = [];

    for (const file of files) {
        const parts = file.path.split('/');
        let currentLevel = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (isFile) {
                currentLevel.push({
                    name: part,
                    type: 'file',
                    content: file.content,
                    language: detectLanguage(part),
                });
            } else {
                let folder = currentLevel.find(n => n.name === part && n.type === 'folder');
                if (!folder) {
                    folder = { name: part, type: 'folder', children: [] };
                    currentLevel.push(folder);
                }
                currentLevel = folder.children!;
            }
        }
    }
    return root;
}

const DEFAULT_FS: FSNode[] = [
    {
        name: 'example', type: 'folder', children: [
            {
                name: 'app.py', type: 'file', language: 'python', content: `# Example vulnerable app — upload your own files to scan!
import sqlite3
from flask import Flask, request

app = Flask(__name__)

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    # WARNING: SQL Injection vulnerability!
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    db = sqlite3.connect('app.db')
    result = db.execute(query)
    
    return "Login success" if result.fetchone() else "Login failed"

# Hardcoded secret — should be in env vars
API_KEY = "sk-proj-abc123def456ghi789"
SECRET_KEY = "super_secret_password_123"

if __name__ == '__main__':
    app.run(debug=True)  # Debug mode in production!
` },
            {
                name: 'README.md', type: 'file', language: 'markdown', content: `# Darkmatter IDE

Upload your code files to scan them for security vulnerabilities.

## How to use:
1. Click **Upload Files** or drag & drop files into the sidebar
2. Browse and edit files in the editor
3. Click **🛡️ Scan Code** to run AI-powered security analysis
4. View results in the terminal below

Powered by Gemini AI for deep vulnerability detection.
` },
        ]
    },
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
    if (name.endsWith('.js') || name.endsWith('.jsx')) return <span className="text-[#f7df1e]">JS</span>;
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return <span className="text-[#3178c6]">TS</span>;
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return <span className="text-[#cb171e]">⚙</span>;
    if (name.endsWith('.md')) return <span className="text-[#519aba]">📝</span>;
    if (name.endsWith('.json')) return <span className="text-[#f7df1e]">{'{}'}</span>;
    if (name.endsWith('.html')) return <span className="text-[#e34c26]">{'<>'}</span>;
    if (name.endsWith('.css') || name.endsWith('.scss')) return <span className="text-[#563d7c]">#</span>;
    if (name.endsWith('.env')) return <span className="text-[#ff5f57]">🔑</span>;
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

<<<<<<< HEAD
// ─── Terminal with Scan Results ──────────────────────────────
function TerminalPanel({ lines, input, setInput, onSubmit }: {
    lines: string[];
    input: string;
    setInput: (val: string) => void;
    onSubmit: () => void;
}) {
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [lines]);

    const renderLine = (line: string) => {
        return line
            .replace(/\x1b\[32m/g, '<span style="color:#B6FF2E">')
            .replace(/\x1b\[31m/g, '<span style="color:#ff6b6b">')
            .replace(/\x1b\[33m/g, '<span style="color:#ffd93d">')
            .replace(/\x1b\[36m/g, '<span style="color:#5cb3ff">')
            .replace(/\x1b\[90m/g, '<span style="color:#666">')
            .replace(/\x1b\[0m/g, '</span>');
    };

    return (
        <div className="h-full flex flex-col bg-[#0e1019] font-mono text-[13px]">
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#1e2030] text-[12px]">
                <span className="flex items-center gap-1.5 text-white border-b-2 border-[#B6FF2E] pb-1 px-1"><TerminalIcon size={12} /> SCAN OUTPUT</span>
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
                    onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                    className="flex-1 bg-transparent text-[#ccc] outline-none text-[13px]"
                    placeholder="Type a command..."
                />
=======
// ─── Security Copilot Components ───────────────────────────
function SnippetBlock({ snippet, endpoint }: { snippet: string, endpoint: string }) {
    const [copied, setCopied] = useState(false);
    
    // basic language from endpoint
    const ext = endpoint.split('.').pop() || '';
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(snippet.replace(/\\n/g, '\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="mt-3 mb-3">
            <div className="text-[#ccc] text-xs mb-2 leading-relaxed">
                <strong className="text-white">Secure Fix Snippet:</strong>
            </div>
            <div className="relative group rounded-md overflow-hidden border border-[#1e2030] bg-[#0a0c14]">
                <div className="flex justify-between items-center px-2 py-1 bg-[#12141f] border-b border-[#1e2030]">
                    <span className="text-[10px] text-[#888] uppercase">{ext || 'code'}</span>
                    <button 
                        onClick={copyToClipboard}
                        className="text-[#888] hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                    >
                        {copied ? <Check size={12} className="text-[#B6FF2E]" /> : <Copy size={12} />}
                        {copied ? <span className="text-[#B6FF2E]">Copied</span> : 'Copy'}
                    </button>
                </div>
                <pre className="p-3 overflow-x-auto text-[11px] font-mono text-[#B6FF2E] leading-relaxed whitespace-pre-wrap">
                    <code>{snippet.replace(/\\n/g, '\n')}</code>
                </pre>
            </div>
        </div>
    );
}

// ─── Security Copilot Panel ──────────────────────────────
function SecurityPanel({ findings, scanning, onNavigate, onFix }: {
    findings: any[];
    scanning: boolean;
    onNavigate: (endpoint: string, line?: number) => void;
    onFix: (finding: any) => void;
}) {
    const crit = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const med = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;

    // A simple score calculation
    const riskPenalty = crit * 25 + high * 15 + med * 5 + low;
    const score = Math.max(0, 100 - riskPenalty);

    return (
        <div className="h-full flex flex-col bg-[#0e1019] text-[13px] border-l border-[#1e2030] overflow-hidden w-80 shrink-0">
            <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#1e2030]">
                <div className="flex items-center gap-2">
                    <Shield size={16} className="text-[#B6FF2E]" />
                    <span className="font-semibold text-white tracking-wide">Security Copilot</span>
                </div>
                {scanning && (
                    <div className="flex items-center gap-2 text-[#888] text-xs">
                        <Loader2 size={12} className="animate-spin" /> Analyzing codebase purely for security...
                    </div>
                )}
                {!scanning && findings.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-[#888]">Security Score</span>
                            <span className={`font-bold ${score < 50 ? 'text-[#ff6b6b]' : score < 80 ? 'text-[#ffd93d]' : 'text-[#B6FF2E]'}`}>
                                {score}/100
                            </span>
                        </div>
                        <div className="flex gap-1 text-[10px] font-mono tracking-wider">
                            {crit > 0 && <span className="bg-[#ff6b6b]/20 text-[#ff6b6b] px-1.5 py-0.5 rounded">{crit} CRIT</span>}
                            {high > 0 && <span className="bg-[#ff6b6b]/20 text-[#ff6b6b] px-1.5 py-0.5 rounded">{high} HIGH</span>}
                            {med > 0 && <span className="bg-[#ffd93d]/20 text-[#ffd93d] px-1.5 py-0.5 rounded">{med} MED</span>}
                            {low > 0 && <span className="bg-[#5cb3ff]/20 text-[#5cb3ff] px-1.5 py-0.5 rounded">{low} LOW</span>}
                        </div>
                    </div>
                )}
                {!scanning && findings.length === 0 && (
                    <div className="text-xs text-[#888]">No vulnerabilities detected.</div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
                {findings.map((f, i) => (
                    <div key={i} className="bg-[#12141f] border border-[#1e2030] rounded-lg p-3 hover:border-[#B6FF2E]/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    f.severity === 'critical' || f.severity === 'high' ? 'bg-[#ff6b6b]' : 
                                    f.severity === 'medium' ? 'bg-[#ffd93d]' : 
                                    f.severity === 'low' ? 'bg-[#5cb3ff]' : 'bg-[#888]'
                                }`} />
                                <span className="font-semibold text-white text-xs">{f.title}</span>
                            </div>
                        </div>
                        
                        <div className="text-[#888] text-[11px] font-mono mb-2 cursor-pointer hover:text-[#B6FF2E] transition-colors"
                             onClick={() => onNavigate(f.endpoint, f.line)}>
                            {f.endpoint} {f.line ? `(Line ${f.line}${f.endLine && f.endLine > f.line ? `-${f.endLine}` : ''})` : ''}
                        </div>

                        {f.description && (
                            <div className="text-[#ccc] text-xs mb-2 leading-relaxed">
                                <strong className="text-[#fff]">Problem:</strong> {f.description}
                            </div>
                        )}
                        {f.risk && (
                            <div className="text-[#ccc] text-xs mb-2 leading-relaxed">
                                <strong className="text-[#ff6b6b]">Risk:</strong> {f.risk}
                            </div>
                        )}
                        {f.remediation && (
                            <div className="text-[#ccc] text-xs mb-2 leading-relaxed">
                                <strong className="text-[#B6FF2E]">Secure Alternative:</strong> {f.remediation}
                            </div>
                        )}
                        
                        {f.fixSnippet && (
                            <>
                                <SnippetBlock snippet={f.fixSnippet} endpoint={f.endpoint || ''} />
                                <button 
                                    onClick={() => onFix(f)}
                                    className="w-full text-center py-1.5 bg-[#B6FF2E]/10 border border-[#B6FF2E]/20 text-[#B6FF2E] hover:bg-[#B6FF2E]/30 rounded text-xs font-semibold transition-colors mt-2 text-shadow-glow">
                                    ✨ Apply Secure Fix
                                </button>
                            </>
                        )}
                    </div>
                ))}
>>>>>>> main
            </div>
        </div>
    );
}

// ─── Main IDE ────────────────────────────────────────────────
export default function WebIDE({ onBack }: { onBack?: () => void } = {}) {
    const router = useRouter();
    const handleBack = onBack || (() => router.push('/'));
    const [fileSystem, setFileSystem] = useState<FSNode[]>(DEFAULT_FS);
    const [openTabs, setOpenTabs] = useState<{ path: string; node: FSNode }[]>([]);
    const [activeTab, setActiveTab] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
<<<<<<< HEAD
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [sidebarTab, setSidebarTab] = useState<'files' | 'search'>('files');
    const [scanning, setScanning] = useState(false);
    const [terminalLines, setTerminalLines] = useState<string[]>([
        '\x1b[32m❯\x1b[0m Darkmatter IDE — Security Code Analyzer',
        '\x1b[90mUpload files and click "Scan Code" to analyze for vulnerabilities\x1b[0m',
        '',
    ]);
    const [terminalInput, setTerminalInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
=======
    const [sidebarTab, setSidebarTab] = useState<'files' | 'search'>('files');
    const [scanning, setScanning] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [scanFindings, setScanFindings] = useState<any[]>([]);
    const [terminalLogs, setTerminalLogs] = useState<{ msg: string; type: 'info' | 'error' | 'success' }[]>([
        { msg: 'Welcome to Darkmatter Security IDE v2.5', type: 'info' },
        { msg: 'System ready. Upload files to begin analysis.', type: 'info' }
    ]);
    const [terminalOpen, setTerminalOpen] = useState(true);
    const [monacoLoaded, setMonacoLoaded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [terminalLogs]);

    const scanFindingsRef = useRef<any[]>([]);
    useEffect(() => { scanFindingsRef.current = scanFindings; }, [scanFindings]);
    const activeTabRef = useRef<string>('');
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    // Apply exact fix when CodeLens is clicked
    useEffect(() => {
        window.__darkmatterApplyFixCallback = (finding: any) => {
            if (editorRef.current && monacoRef.current) {
                const model = editorRef.current.getModel();
                const endL = finding.endLine || finding.line;
                const origContent = model.getLineContent(finding.line) || '';
                const match = origContent.match(/^\s*/);
                const indent = match ? match[0] : '';
                
                let replacement = finding.fixSnippet;
                // Basic auto-formatting: if the AI forgot to indent the first line, we add it back.
                if (indent && !replacement.startsWith(indent)) {
                    replacement = replacement.split('\n').map((l: string, i: number) => i === 0 || l.trim() === '' ? l : indent + l.trimStart()).join('\n');
                    if (!replacement.startsWith(indent)) replacement = indent + replacement;
                }

                editorRef.current.executeEdits('darkmatter', [{
                    range: new monacoRef.current.Range(finding.line, 1, endL, model.getLineMaxColumn(endL) || 1000),
                    text: replacement,
                    forceMoveMarkers: true
                }]);
                setScanFindings(prev => prev.filter(f => f.title !== finding.title || f.line !== finding.line));
            }
        };
    }, []);

    // Register Code Providers for inline IDE magic (Antigravity/Cursor style)
    useEffect(() => {
        if (!monacoLoaded || !monacoRef.current) return;
        const monaco = monacoRef.current;

        const actionProvider = monaco.languages.registerCodeActionProvider('*', {
            provideCodeActions: (model: any, range: any, context: any, token: any) => {
                const getPathName = (p: string) => p.split(':')[0].replace(/\\/g, '/').split('/').pop() || '';
                const activeName = activeTabRef.current.replace(/\\/g, '/').split('/').pop() || '';
                const findings = scanFindingsRef.current.filter(f => f.endpoint && activeName === getPathName(f.endpoint) && f.line && f.fixSnippet);
                const actions = [];
                for (const f of findings) {
                    const endL = f.endLine || f.line;
                    if (range.startLineNumber <= endL && range.endLineNumber >= f.line) {
                        
                        const origContent = model.getLineContent(f.line) || '';
                        const match = origContent.match(/^\s*/);
                        const indent = match ? match[0] : '';
                        let replacement = f.fixSnippet;
                        if (indent && !replacement.startsWith(indent)) {
                            replacement = replacement.split('\n').map((l: string, i: number) => i === 0 || l.trim() === '' ? l : indent + l.trimStart()).join('\n');
                            if (!replacement.startsWith(indent)) replacement = indent + replacement;
                        }

                        actions.push({
                            title: '⚡ AI Fix (Replace Vulnerability)',
                            diagnostics: context.markers.filter((m: any) => m.startLineNumber >= f.line && m.endLineNumber <= endL),
                            kind: 'quickfix',
                            edit: {
                                edits: [{
                                    resource: model.uri,
                                    textEdit: {
                                        range: new monaco.Range(f.line, 1, endL, model.getLineMaxColumn(endL) || 1000),
                                        text: replacement
                                    },
                                    versionId: undefined
                                }]
                            },
                            isPreferred: true
                        });
                        
                        // Also add an explicit command version
                        actions.push({
                            title: '✨ Apply Recommendation inline',
                            command: {
                                id: 'darkmatter.applyCodeLensFix',
                                title: 'Apply Fix',
                                arguments: [f]
                            },
                            kind: 'refactor'
                        });
                    }
                }
                return { actions, dispose: () => {} };
            }
        });

        const lensProvider = monaco.languages.registerCodeLensProvider('*', {
            provideCodeLenses: function (model: any, token: any) {
                const getPathName = (p: string) => p.split(':')[0].replace(/\\/g, '/').split('/').pop() || '';
                const activeName = activeTabRef.current.replace(/\\/g, '/').split('/').pop() || '';
                const findings = scanFindingsRef.current.filter(f => f.endpoint && activeName === getPathName(f.endpoint) && f.line && f.fixSnippet);
                const lenses = findings.map(f => ({
                    range: new monaco.Range(f.line, 1, f.line, 1),
                    id: 'lens-' + f.line + '-' + f.title,
                    command: {
                        id: 'darkmatter.applyCodeLensFix',
                        title: '✨ Fix Vulnerability: ' + f.title,
                        arguments: [f]
                    }
                }));
                return { lenses, dispose: () => {} };
            },
            resolveCodeLens: function (model: any, codeLens: any, token: any) {
                return codeLens;
            }
        });

        if (!window.__darkmatterCodeLensRegistered) {
            window.__darkmatterCodeLensRegistered = true;
            monaco.editor.registerCommand('darkmatter.applyCodeLensFix', (accessor: any, ...args: any[]) => {
                if (window.__darkmatterApplyFixCallback) {
                    window.__darkmatterApplyFixCallback(args[0]);
                }
            });
        }

        return () => {
            actionProvider.dispose();
            lensProvider.dispose();
        };
    }, [monacoLoaded, scanFindings, activeTab]);

    // Decorate code editor with vulnerabilities
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current || !activeTab) return;
        const currentModel = editorRef.current.getModel();
        if (!currentModel) return;

        const getPathName = (p: string) => p.split(':')[0].replace(/\\/g, '/').split('/').pop() || '';
        const activeName = activeTab.replace(/\\/g, '/').split('/').pop() || '';
        const activeFindings = scanFindings.filter(f => f.endpoint && activeName === getPathName(f.endpoint) && f.line);
        const markers = activeFindings.map(f => {
            const sev = f.severity === 'critical' || f.severity === 'high'  
                ? monacoRef.current.MarkerSeverity.Error 
                : f.severity === 'medium' 
                    ? monacoRef.current.MarkerSeverity.Warning 
                    : monacoRef.current.MarkerSeverity.Info;
            return {
                message: `🛡️ Security Vulnerability: ${f.title}\nSeverity: ${f.severity.toUpperCase()}\n\n${f.description || ''}\n\nRecommendation: ${f.remediation || ''}`,
                severity: sev,
                startLineNumber: f.line,
                startColumn: 1,
                endLineNumber: f.endLine || f.line,
                endColumn: 1000,
            };
        });

        monacoRef.current.editor.setModelMarkers(currentModel, 'darkmatter', markers);
    }, [scanFindings, activeTab]);
>>>>>>> main

    // Open default file
    useEffect(() => {
        const allFiles = flattenFiles(DEFAULT_FS);
        const mainFile = allFiles.find(f => f.path.endsWith('README.md')) || allFiles[0];
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

<<<<<<< HEAD
=======
    // ─── Navigation via Panel ────────────────────────────────
    const navigateToVulnerability = (endpoint: string, line?: number) => {
        const path = endpoint.split(':')[0].replace(/\\/g, '/').split('/').pop() || '';
        const allFiles = flattenFiles(fileSystem);
        const file = allFiles.find(f => {
            const fName = f.path.replace(/\\/g, '/').split('/').pop() || '';
            return fName === path;
        });
        
        if (file) {
            openFile(file.path, file.node);
            setTimeout(() => {
                if (editorRef.current && line) {
                    editorRef.current.revealLineInCenter(line);
                    editorRef.current.setPosition({ lineNumber: line, column: 1 });
                    editorRef.current.focus();
                }
            }, 50);
        }
    };

>>>>>>> main
    // ─── File Upload Handler ─────────────────────────────────
    const handleFileUpload = useCallback(async (fileList: FileList) => {
        const uploadedFiles: { path: string; content: string }[] = [];

        for (const file of Array.from(fileList)) {
            // Skip binary files, hidden files, node_modules
            if (file.name.startsWith('.') || file.name === 'node_modules') continue;
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const textExts = ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'go', 'rb', 'php', 'cs', 'c', 'cpp', 'rs',
                'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'md', 'sql', 'sh', 'bash', 'env', 'txt',
                'tf', 'hcl', 'toml', 'cfg', 'ini', 'conf', 'dockerfile', 'gitignore', 'lock'];
            if (!textExts.includes(ext) && ext.length > 0) continue;

            try {
                const content = await file.text();
                if (content.length > 100000) continue; // skip very large files
                // Use webkitRelativePath if available, otherwise just filename
                const path = (file as any).webkitRelativePath || file.name;
                uploadedFiles.push({ path, content });
            } catch { /* skip unreadable files */ }
        }

        if (uploadedFiles.length === 0) return;

        // Build tree from uploaded files
        const newTree = buildFSTree(uploadedFiles);
        setFileSystem(prev => [...prev, ...newTree]);

        // Open first uploaded file
        const allNewFiles = flattenFiles(newTree);
        if (allNewFiles.length > 0) {
            const first = allNewFiles[0];
            setOpenTabs(prev => [...prev, first]);
            setActiveTab(first.path);
        }
<<<<<<< HEAD

        setTerminalLines(prev => [
            ...prev,
            `\x1b[32m[+]\x1b[0m Uploaded ${uploadedFiles.length} files`,
            ...uploadedFiles.slice(0, 10).map(f => `    ${f.path}`),
            uploadedFiles.length > 10 ? `    ... and ${uploadedFiles.length - 10} more` : '',
            '',
        ].filter(Boolean));
=======
>>>>>>> main
    }, []);

    // ─── Drag and Drop ───────────────────────────────────────
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => setIsDragging(false), []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    }, [handleFileUpload]);

    // ─── Scan Code ───────────────────────────────────────────
    const scanCode = async () => {
        const allFiles = flattenFiles(fileSystem);
        if (allFiles.length === 0) {
<<<<<<< HEAD
            setTerminalLines(prev => [...prev, '\x1b[31m[!]\x1b[0m No files to scan. Upload files first.', '']);
=======
>>>>>>> main
            return;
        }

        setScanning(true);
<<<<<<< HEAD
        setTerminalOpen(true);
        setTerminalLines(prev => [
            ...prev,
            '═'.repeat(60),
            '\x1b[32m[*]\x1b[0m Starting AI-powered security scan...',
            `\x1b[32m[*]\x1b[0m Analyzing ${allFiles.length} files with Gemini AI`,
            '',
        ]);
=======
        setScanFindings([]);
>>>>>>> main

        try {
            const response = await fetch('/api/scan/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: allFiles.map(f => ({
                        path: f.path,
                        content: f.node.content || '',
                        language: f.node.language || 'plaintext',
                    })),
                }),
            });

            if (!response.ok) throw new Error(`Scan failed: ${response.status}`);
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'progress') {
<<<<<<< HEAD
                                setTerminalLines(prev => [...prev, `\x1b[33m[▸]\x1b[0m ${data.message}`]);
                            } else if (data.type === 'complete') {
                                const findings = data.findings || [];
                                setTerminalLines(prev => {
                                    const newLines = [
                                        ...prev,
                                        '',
                                        '═'.repeat(60),
                                        '\x1b[32m[✓]\x1b[0m SCAN COMPLETE',
                                        '═'.repeat(60),
                                        '',
                                    ];

                                    if (findings.length === 0) {
                                        newLines.push('\x1b[32m[✓]\x1b[0m No vulnerabilities found!');
                                    } else {
                                        for (const f of findings) {
                                            const sevColor = f.severity === 'critical' ? '\x1b[31m' :
                                                f.severity === 'high' ? '\x1b[31m' :
                                                    f.severity === 'medium' ? '\x1b[33m' :
                                                        f.severity === 'low' ? '\x1b[36m' : '\x1b[90m';
                                            newLines.push(`${sevColor}[${f.severity?.toUpperCase()}]\x1b[0m ${f.title}`);
                                            newLines.push(`  ${f.endpoint} — ${f.description?.substring(0, 120)}`);
                                            if (f.remediation) {
                                                newLines.push(`  \x1b[32mFix: ${f.remediation?.substring(0, 120)}\x1b[0m`);
                                            }
                                            newLines.push('');
                                        }

                                        const crit = findings.filter((f: any) => f.severity === 'critical').length;
                                        const high = findings.filter((f: any) => f.severity === 'high').length;
                                        const med = findings.filter((f: any) => f.severity === 'medium').length;
                                        const low = findings.filter((f: any) => f.severity === 'low').length;

                                        newLines.push('─'.repeat(40));
                                        newLines.push(`Critical: ${crit} | High: ${high} | Medium: ${med} | Low: ${low}`);
                                        newLines.push(`Total findings: ${findings.length}`);
                                    }

                                    newLines.push('═'.repeat(60));
                                    newLines.push('');
                                    return newLines;
                                });
                            } else if (data.type === 'error') {
                                setTerminalLines(prev => [...prev, `\x1b[31m[!]\x1b[0m ${data.message}`, '']);
=======
                                setTerminalLogs(prev => [...prev, { msg: `> ${data.message}`, type: 'info' }]);
                            } else if (data.type === 'result') {
                                setScanFindings(data.findings || []);
                                setTerminalLogs(prev => [...prev, { msg: `✓ Scan Successful: Found ${data.totalFindings} vulnerabilities.`, type: 'success' }]);
                            } else if (data.type === 'error') {
                                setTerminalLogs(prev => [...prev, { msg: `⨯ ${data.message}`, type: 'error' }]);
>>>>>>> main
                            }
                        } catch { /* skip unparseable */ }
                    }
                }
            }
        } catch (err) {
<<<<<<< HEAD
            setTerminalLines(prev => [
                ...prev,
                `\x1b[31m[!]\x1b[0m Scan error: ${err instanceof Error ? err.message : 'Unknown error'}`,
                '',
            ]);
=======
            const msg = err instanceof Error ? err.message : 'Unknown scan error';
            setTerminalLogs(prev => [...prev, { msg: `⨯ ${msg}`, type: 'error' }]);
>>>>>>> main
        } finally {
            setScanning(false);
        }
    };

<<<<<<< HEAD
    // ─── Terminal command handler ─────────────────────────────
    const handleTerminalSubmit = () => {
        if (!terminalInput.trim()) return;
        const cmd = terminalInput.trim();
        setTerminalLines(prev => [...prev, `\x1b[32m❯\x1b[0m ${cmd}`]);

        if (cmd === 'clear') { setTerminalLines([]); }
        else if (cmd === 'help') {
            setTerminalLines(prev => [...prev,
                'Commands:',
                '  scan     — Run security scan on loaded files',
                '  clear    — Clear terminal',
                '  files    — List loaded files',
                '  help     — Show this help',
                ''
            ]);
        } else if (cmd === 'scan') { scanCode(); }
        else if (cmd === 'files') {
            const allFiles = flattenFiles(fileSystem);
            setTerminalLines(prev => [...prev,
            `${allFiles.length} files loaded:`,
            ...allFiles.map(f => `  ${f.path}`),
                ''
            ]);
        } else {
            setTerminalLines(prev => [...prev, `\x1b[31mUnknown command:\x1b[0m ${cmd}. Type "help" for commands.`, '']);
        }
        setTerminalInput('');
    };

=======
>>>>>>> main
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
                <div className="flex items-center gap-3">
                    {/* Scan Code Button */}
                    <button
                        onClick={scanCode}
                        disabled={scanning}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${scanning
                            ? 'bg-[#B6FF2E]/20 text-[#B6FF2E]/50 cursor-wait'
                            : 'bg-gradient-to-r from-[#B6FF2E] to-[#8ed615] text-[#07080B] hover:brightness-110 shadow-[0_0_15px_rgba(182,255,46,0.2)]'
                            }`}
                    >
                        {scanning ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
                        {scanning ? 'Scanning...' : '🛡️ Scan Code'}
                    </button>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
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
                    <div
                        className={`w-60 bg-[#12141f] border-r border-[#1e2030] flex flex-col shrink-0 overflow-hidden ${isDragging ? 'ring-2 ring-[#B6FF2E] ring-inset' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="px-4 py-2.5 text-[11px] font-semibold tracking-wider text-[#888] uppercase flex items-center justify-between">
                            Explorer
                            <div className="flex gap-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[#888] hover:text-[#B6FF2E] transition-colors"
                                    title="Upload Files"
                                >
                                    <Upload size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        // Trigger folder upload
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.webkitdirectory = true;
                                        input.multiple = true;
                                        input.onchange = (e) => {
                                            const files = (e.target as HTMLInputElement).files;
                                            if (files) handleFileUpload(files);
                                        };
                                        input.click();
                                    }}
                                    className="text-[#888] hover:text-[#B6FF2E] transition-colors"
                                    title="Upload Folder"
                                >
                                    <FolderUp size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files) handleFileUpload(e.target.files);
                                e.target.value = '';
                            }}
                        />

                        {isDragging && (
                            <div className="mx-2 mb-2 p-4 border-2 border-dashed border-[#B6FF2E]/50 rounded-lg text-center">
                                <Upload size={24} className="text-[#B6FF2E] mx-auto mb-2" />
                                <div className="text-[11px] text-[#B6FF2E]">Drop files here</div>
                            </div>
                        )}

                        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#888] uppercase flex items-center gap-1">
                            <ChevronDown size={12} /> PROJECT FILES
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {fileSystem.map((node) => (
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
<<<<<<< HEAD
=======
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                    monacoRef.current = monaco;
                                    setMonacoLoaded(true);
                                    
                                    // Disable native TS/JS syntax validation so it doesn't clash with our security markers (no "rain of red")
                                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                                        noSemanticValidation: true,
                                        noSyntaxValidation: true
                                    });
                                    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                                        noSemanticValidation: true,
                                        noSyntaxValidation: true
                                    });
                                }}
>>>>>>> main
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
                                <div className="text-6xl mb-6 opacity-20">🛡️</div>
                                <div className="text-xl font-display">Darkmatter Security IDE</div>
                                <div className="text-sm mt-2 text-center max-w-md">
                                    Upload your code files and click <span className="text-[#B6FF2E] font-bold">Scan Code</span> to find vulnerabilities
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B6FF2E]/10 border border-[#B6FF2E]/20 text-[#B6FF2E] hover:bg-[#B6FF2E]/20 transition-colors text-sm"
                                >
                                    <Upload size={16} /> Upload Files
                                </button>
                            </div>
                        )}
                    </div>
<<<<<<< HEAD

                    {/* Terminal */}
                    {terminalOpen && (
                        <div className="h-[250px] border-t border-[#1e2030] shrink-0">
                            <TerminalPanel lines={terminalLines} input={terminalInput} setInput={setTerminalInput} onSubmit={handleTerminalSubmit} />
                        </div>
                    )}
                </div>
            </div>

=======
                </div>

                {/* Security Copilot Right Panel */}
                <SecurityPanel 
                    findings={scanFindings} 
                    scanning={scanning} 
                    onNavigate={navigateToVulnerability} 
                    onFix={(f) => window.__darkmatterApplyFixCallback && window.__darkmatterApplyFixCallback(f)} 
                />
            </div>

            {/* Bottom Terminal */}
            {terminalOpen && (
                <div className="h-40 bg-[#0a0c14] border-t border-[#1e2030] flex flex-col shrink-0 font-mono">
                    <div className="flex items-center justify-between px-3 py-1 bg-[#12141f] border-b border-[#1e2030] text-[10px] text-[#888] tracking-widest uppercase">
                        <span>Terminal — Security Agent Output</span>
                        <button onClick={() => setTerminalOpen(false)} className="hover:text-white transition-colors">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 text-[12px] space-y-1">
                        {terminalLogs.map((log, i) => (
                            <div key={i} className={`${
                                log.type === 'error' ? 'text-[#ff6b6b]' : 
                                log.type === 'success' ? 'text-[#B6FF2E]' : 'text-[#888]'
                            }`}>
                                {log.msg}
                            </div>
                        ))}
                        <div ref={terminalEndRef} />
                    </div>
                </div>
            )}

>>>>>>> main
            {/* Status Bar */}
            <div className="h-6 bg-[#0a0c14] border-t border-[#1e2030] flex items-center px-3 text-[11px] shrink-0 select-none">
                <div className="flex items-center gap-4 text-[#888]">
                    <span className="flex items-center gap-1"><GitBranch size={12} /> main</span>
                    <span className="flex items-center gap-1"><CheckCircle size={12} className="text-[#28c840]" /> {flattenFiles(fileSystem).length} files</span>
<<<<<<< HEAD
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setTerminalOpen(!terminalOpen)}>
                        <TerminalIcon size={12} /> Terminal
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <PanelLeft size={12} /> Sidebar
                    </span>
=======
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <PanelLeft size={12} /> Sidebar
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-white" onClick={() => setTerminalOpen(!terminalOpen)}>
                        <TerminalIcon size={12} /> Terminal
                    </span>
>>>>>>> main
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
