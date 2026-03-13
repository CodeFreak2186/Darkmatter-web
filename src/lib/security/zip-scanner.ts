// ─── Darkmatter — ZIP File Security Scanner ─────────────────
// Extracts files from uploaded ZIP and scans them

import { Finding } from './types';
import { scanCode } from './code-scanner';

// We use the built-in DecompressionStream and manual ZIP parsing
// to avoid requiring external dependencies

interface ExtractedFile {
    path: string;
    content: string;
    language?: string;
}

// ─── Language Detection ──────────────────────────────────────

function detectLanguage(filename: string): string | undefined {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
        py: 'python',
        js: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        jsx: 'javascript',
        java: 'java',
        go: 'go',
        rb: 'ruby',
        php: 'php',
        cs: 'csharp',
        c: 'c',
        cpp: 'cpp',
        rs: 'rust',
        yaml: 'yaml',
        yml: 'yaml',
        json: 'json',
        xml: 'xml',
        html: 'html',
        css: 'css',
        sql: 'sql',
        sh: 'bash',
        bash: 'bash',
        env: 'dotenv',
        tf: 'terraform',
        hcl: 'hcl',
        md: 'markdown',
        txt: 'plaintext',
        toml: 'toml',
        ini: 'ini',
        cfg: 'ini',
        conf: 'ini',
        dockerfile: 'dockerfile',
        gradle: 'groovy',
        kt: 'kotlin',
        swift: 'swift',
        r: 'r',
        scala: 'scala',
    };
    return ext ? langMap[ext] : undefined;
}

// ─── Supported File Extensions ───────────────────────────────

const SCANNABLE_EXTENSIONS = new Set([
    'py', 'js', 'ts', 'tsx', 'jsx', 'java', 'go', 'rb', 'php', 'cs',
    'c', 'cpp', 'h', 'rs', 'yaml', 'yml', 'json', 'xml', 'html',
    'css', 'sql', 'sh', 'bash', 'env', 'tf', 'hcl', 'toml', 'ini',
    'cfg', 'conf', 'txt', 'md', 'dockerfile', 'gradle', 'kt', 'swift',
    'r', 'scala', 'properties', 'pem', 'key', 'crt',
]);

function isScannableFile(filename: string): boolean {
    // Always scan dotfiles like .env, .htaccess, etc.
    const basename = filename.split('/').pop() || '';
    if (basename.startsWith('.')) return true;

    const ext = basename.split('.').pop()?.toLowerCase() || '';
    return SCANNABLE_EXTENSIONS.has(ext);
}

// ─── Parse files from text content ──────────────────────────

export function parseFilesFromContent(
    files: { name: string; content: string }[]
): ExtractedFile[] {
    const extracted: ExtractedFile[] = [];

    for (const file of files) {
        // Skip directories, binary files, and non-scannable files
        if (file.name.endsWith('/')) continue;
        if (!isScannableFile(file.name)) continue;

        // Skip node_modules, __pycache__, .git, etc.
        const skipDirs = ['node_modules/', '__pycache__/', '.git/', 'venv/', '.venv/',
            'dist/', 'build/', '.next/', 'vendor/', '.idea/', '.vscode/'];
        if (skipDirs.some(d => file.name.includes(d))) continue;

        // Skip very large files (> 100KB)
        if (file.content.length > 100000) continue;

        extracted.push({
            path: file.name,
            content: file.content,
            language: detectLanguage(file.name),
        });
    }

    return extracted;
}

// ─── Check for .env and config files ─────────────────────────

function checkSensitiveFiles(files: ExtractedFile[]): Finding[] {
    const findings: Finding[] = [];
    let id = 0;

    for (const file of files) {
        const basename = file.path.split('/').pop() || '';

        // .env file check
        if (basename === '.env' || basename.startsWith('.env.')) {
            findings.push({
                id: id++,
                severity: 'high',
                title: 'Environment File Exposed',
                endpoint: file.path,
                description: `Environment file "${basename}" found in uploaded code. These often contain secrets, database credentials, and API keys.`,
                agent: 'Config Agent',
                remediation: 'Never include .env files in deployments or repositories. Add .env to .gitignore.',
                cwe: 'CWE-798',
            });
        }

        // Private key files
        if (basename.endsWith('.pem') || basename.endsWith('.key')) {
            findings.push({
                id: id++,
                severity: 'critical',
                title: 'Private Key File Found',
                endpoint: file.path,
                description: `Private key file "${basename}" found in uploaded code.`,
                agent: 'Code Agent',
                remediation: 'Remove private keys from the codebase. Use a secrets manager.',
                cwe: 'CWE-321',
            });
        }

        // .htaccess with credentials
        if (basename === '.htaccess' || basename === '.htpasswd') {
            findings.push({
                id: id++,
                severity: 'medium',
                title: 'Apache Config File Exposed',
                endpoint: file.path,
                description: `Apache configuration file "${basename}" found. May contain access rules or credentials.`,
                agent: 'Config Agent',
                remediation: 'Ensure Apache config files are not publicly accessible.',
            });
        }

        // Docker secrets
        if (basename === 'docker-compose.yml' || basename === 'docker-compose.yaml') {
            if (file.content.includes('password') || file.content.includes('secret') || file.content.includes('MYSQL_ROOT')) {
                findings.push({
                    id: id++,
                    severity: 'medium',
                    title: 'Secrets in Docker Compose',
                    endpoint: file.path,
                    description: 'Docker Compose file contains hardcoded secrets or passwords.',
                    agent: 'Config Agent',
                    remediation: 'Use Docker secrets or environment variable references instead of hardcoded values.',
                    cwe: 'CWE-798',
                });
            }
        }
    }

    return findings;
}

// ─── Main ZIP/Project Scan Function ──────────────────────────

export async function scanUploadedFiles(
    rawFiles: { name: string; content: string }[],
    useAI: boolean = true,
    onProgress?: (msg: string) => void
): Promise<Finding[]> {
    onProgress?.('Extracting and analyzing uploaded files...');

    // Parse and filter files
    const files = parseFilesFromContent(rawFiles);
    onProgress?.(`Found ${files.length} scannable files.`);

    if (files.length === 0) {
        return [{
            id: 1,
            severity: 'info',
            title: 'No Scannable Files',
            endpoint: '/',
            description: 'No source code files were found in the upload. Supported: .py, .js, .ts, .java, .go, .php, .rb, .yaml, .json, .env, etc.',
            agent: 'Discovery Agent',
        }];
    }

    // Phase 1: Check for sensitive file types
    onProgress?.('Checking for exposed sensitive files...');
    const sensitiveFindings = checkSensitiveFiles(files);

    // Phase 2: Run code scanner on all files
    const codeFindings = await scanCode(files, useAI, onProgress);

    // Merge and deduplicate
    const allFindings = [...sensitiveFindings, ...codeFindings];

    // Re-sort and re-ID
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allFindings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
    allFindings.forEach((f, i) => { f.id = i + 1; });

    onProgress?.(`Scan complete. Found ${allFindings.length} issues across ${files.length} files.`);
    return allFindings;
}
