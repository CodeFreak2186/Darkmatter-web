"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
    ChevronRight, ChevronDown, File, Folder, FolderOpen, X, Terminal as TerminalIcon,
    Settings, Search, GitBranch, Bug, Boxes, PanelLeft,
    Plus, MoreHorizontal, ArrowLeft, Bell, Wifi, CheckCircle,
    Upload, Shield, Loader2, FolderUp
} from 'lucide-react';

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

        setTerminalLines(prev => [
            ...prev,
            `\x1b[32m[+]\x1b[0m Uploaded ${uploadedFiles.length} files`,
            ...uploadedFiles.slice(0, 10).map(f => `    ${f.path}`),
            uploadedFiles.length > 10 ? `    ... and ${uploadedFiles.length - 10} more` : '',
            '',
        ].filter(Boolean));
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
            setTerminalLines(prev => [...prev, '\x1b[31m[!]\x1b[0m No files to scan. Upload files first.', '']);
            return;
        }

        setScanning(true);
        setTerminalOpen(true);
        setTerminalLines(prev => [
            ...prev,
            '═'.repeat(60),
            '\x1b[32m[*]\x1b[0m Starting AI-powered security scan...',
            `\x1b[32m[*]\x1b[0m Analyzing ${allFiles.length} files with Gemini AI`,
            '',
        ]);

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
                            }
                        } catch { /* skip unparseable */ }
                    }
                }
            }
        } catch (err) {
            setTerminalLines(prev => [
                ...prev,
                `\x1b[31m[!]\x1b[0m Scan error: ${err instanceof Error ? err.message : 'Unknown error'}`,
                '',
            ]);
        } finally {
            setScanning(false);
        }
    };

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

                    {/* Terminal */}
                    {terminalOpen && (
                        <div className="h-[250px] border-t border-[#1e2030] shrink-0">
                            <TerminalPanel lines={terminalLines} input={terminalInput} setInput={setTerminalInput} onSubmit={handleTerminalSubmit} />
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-[#0a0c14] border-t border-[#1e2030] flex items-center px-3 text-[11px] shrink-0 select-none">
                <div className="flex items-center gap-4 text-[#888]">
                    <span className="flex items-center gap-1"><GitBranch size={12} /> main</span>
                    <span className="flex items-center gap-1"><CheckCircle size={12} className="text-[#28c840]" /> {flattenFiles(fileSystem).length} files</span>
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
