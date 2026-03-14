// ─── Darkmatter — Static Code Security Scanner ──────────────
// Regex-based quick scan + Gemini AI deep analysis

import { Finding, Severity } from './types';
import { analyzeProjectWithGrok } from './grok-client';

interface CodeFile {
    path: string;
    content: string;
    language?: string;
}

// ─── Regex-based Pattern Scanner ─────────────────────────────

interface Pattern {
    name: string;
    regex: RegExp;
    severity: Severity;
    description: string;
    agent: string;
    remediation: string;
    cwe?: string;
}

const SECURITY_PATTERNS: Pattern[] = [
    // Hardcoded Secrets
    {
        name: 'AWS Access Key',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical',
        description: 'AWS Access Key ID found in source code. This can give attackers access to your AWS account.',
        agent: 'Code Agent',
        remediation: 'Remove the key and use environment variables or AWS IAM roles instead.',
        cwe: 'CWE-798',
    },
    {
        name: 'AWS Secret Key',
        regex: /(?:aws_secret_access_key|secret_key)\s*[:=]\s*['"][A-Za-z0-9\/+=]{40}['"]/gi,
        severity: 'critical',
        description: 'AWS Secret Access Key found in source code.',
        agent: 'Code Agent',
        remediation: 'Remove the key and use environment variables or AWS Secrets Manager.',
        cwe: 'CWE-798',
    },
    {
        name: 'Private Key',
        regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
        severity: 'critical',
        description: 'Private key embedded in source code.',
        agent: 'Code Agent',
        remediation: 'Move private keys to a secure key vault. Never commit them to source control.',
        cwe: 'CWE-321',
    },
    {
        name: 'Generic API Key',
        regex: /(?:api[_-]?key|apikey|api[_-]?secret|api[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi,
        severity: 'high',
        description: 'Potential API key or secret found hardcoded in source code.',
        agent: 'Code Agent',
        remediation: 'Use environment variables to store API keys.',
        cwe: 'CWE-798',
    },
    {
        name: 'Hardcoded Password',
        regex: /(?:password|passwd|pwd|pass)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
        severity: 'high',
        description: 'Hardcoded password found in source code.',
        agent: 'Code Agent',
        remediation: 'Use environment variables or a secrets manager for passwords.',
        cwe: 'CWE-798',
    },
    {
        name: 'JWT Secret/Token',
        regex: /(?:jwt[_-]?secret|jwt[_-]?key|bearer)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
        severity: 'high',
        description: 'JWT secret or token found hardcoded.',
        agent: 'Auth Agent',
        remediation: 'Store JWT secrets in environment variables with proper rotation.',
        cwe: 'CWE-798',
    },

    // Injection Vulnerabilities
    {
        name: 'SQL Injection (String Concat)',
        regex: /(?:query|execute|sql)\s*\(\s*(?:['"`].*?['"`]\s*\+|f['"`]|`\$\{)/gi,
        severity: 'high',
        description: 'SQL query built with string concatenation/interpolation. Vulnerable to SQL injection.',
        agent: 'Fuzzing Agent',
        remediation: 'Use parameterized queries or prepared statements.',
        cwe: 'CWE-89',
    },
    {
        name: 'Command Injection',
        regex: /(?:exec|system|popen|subprocess\.call|subprocess\.run|child_process\.exec|execSync)\s*\(/g,
        severity: 'high',
        description: 'OS command execution detected. If user input flows into this, it enables command injection.',
        agent: 'Fuzzing Agent',
        remediation: 'Avoid exec/system calls. If necessary, use allowlists and never pass raw user input.',
        cwe: 'CWE-78',
    },
    {
        name: 'eval() Usage',
        regex: /\beval\s*\(/g,
        severity: 'high',
        description: 'eval() executes arbitrary code. If user input reaches eval, it enables code injection.',
        agent: 'Code Agent',
        remediation: 'Remove eval() calls. Use safe alternatives like JSON.parse() for data parsing.',
        cwe: 'CWE-95',
    },

    // XSS
    {
        name: 'innerHTML Assignment',
        regex: /\.innerHTML\s*=/g,
        severity: 'medium',
        description: 'Direct innerHTML assignment can lead to XSS if content includes user input.',
        agent: 'Fuzzing Agent',
        remediation: 'Use textContent or a sanitization library like DOMPurify.',
        cwe: 'CWE-79',
    },
    {
        name: 'document.write',
        regex: /document\.write\s*\(/g,
        severity: 'medium',
        description: 'document.write() can introduce XSS vulnerabilities.',
        agent: 'Fuzzing Agent',
        remediation: 'Use DOM manipulation methods instead of document.write().',
        cwe: 'CWE-79',
    },
    {
        name: 'dangerouslySetInnerHTML',
        regex: /dangerouslySetInnerHTML/g,
        severity: 'medium',
        description: 'React dangerouslySetInnerHTML bypasses XSS protection. Ensure content is sanitized.',
        agent: 'Fuzzing Agent',
        remediation: 'Sanitize HTML content with DOMPurify before using dangerouslySetInnerHTML.',
        cwe: 'CWE-79',
    },

    // Insecure Crypto
    {
        name: 'Weak Hash (MD5)',
        regex: /(?:md5|MD5)\s*\(|hashlib\.md5|crypto\.createHash\s*\(\s*['"]md5['"]\)/g,
        severity: 'medium',
        description: 'MD5 is cryptographically broken and should not be used for security purposes.',
        agent: 'Code Agent',
        remediation: 'Use SHA-256 or bcrypt/argon2 for password hashing.',
        cwe: 'CWE-328',
    },
    {
        name: 'Weak Hash (SHA1)',
        regex: /(?:sha1|SHA1)\s*\(|hashlib\.sha1|crypto\.createHash\s*\(\s*['"]sha1?['"]\)/g,
        severity: 'medium',
        description: 'SHA-1 is deprecated for security use. Collision attacks are practical.',
        agent: 'Code Agent',
        remediation: 'Use SHA-256 or stronger hash functions.',
        cwe: 'CWE-328',
    },

    // Insecure Deserialization
    {
        name: 'Unsafe Pickle',
        regex: /pickle\.loads?\s*\(/g,
        severity: 'high',
        description: 'pickle.load/loads can execute arbitrary code during deserialization.',
        agent: 'Code Agent',
        remediation: 'Avoid pickle for untrusted data. Use JSON or protocol buffers instead.',
        cwe: 'CWE-502',
    },
    {
        name: 'Unsafe YAML Load',
        regex: /yaml\.load\s*\(/g,
        severity: 'medium',
        description: 'yaml.load() without SafeLoader can execute arbitrary Python code.',
        agent: 'Code Agent',
        remediation: 'Use yaml.safe_load() instead of yaml.load().',
        cwe: 'CWE-502',
    },

    // Path Traversal
    {
        name: 'Path Traversal Risk',
        regex: /(?:open|readFile|readFileSync|createReadStream)\s*\([^)]*(?:\+|`\$\{|\.format)/g,
        severity: 'medium',
        description: 'File operation with dynamic path construction. May be vulnerable to path traversal.',
        agent: 'Fuzzing Agent',
        remediation: 'Validate and sanitize file paths. Use path.resolve() and verify the resolved path.',
        cwe: 'CWE-22',
    },

    // Debug / Info Leaks
    {
        name: 'Debug Mode Enabled',
        regex: /(?:DEBUG|debug)\s*[:=]\s*(?:True|true|1|['"]true['"])/g,
        severity: 'low',
        description: 'Debug mode appears to be enabled. This may expose sensitive information in production.',
        agent: 'Config Agent',
        remediation: 'Ensure debug mode is disabled in production environments.',
        cwe: 'CWE-489',
    },
    {
        name: 'TODO/FIXME Security',
        regex: /(?:TODO|FIXME|HACK|XXX).*(?:security|auth|password|secret|vulnerab|exploit|inject)/gi,
        severity: 'low',
        description: 'Security-related TODO/FIXME comment found. This may indicate known but unfixed issues.',
        agent: 'Code Agent',
        remediation: 'Address security-related TODOs before deploying to production.',
    },

    // Env file
    {
        name: 'Exposed .env Variables',
        regex: /(?:DATABASE_URL|DB_PASSWORD|SECRET_KEY|PRIVATE_KEY|AUTH_TOKEN|STRIPE_SECRET)\s*=/g,
        severity: 'high',
        description: 'Sensitive environment variable found in source file.',
        agent: 'Config Agent',
        remediation: 'Move secrets to .env files that are excluded from version control via .gitignore.',
        cwe: 'CWE-798',
    },

    // CORS in code
    {
        name: 'Wildcard CORS in Code',
        regex: /(?:Access-Control-Allow-Origin|cors)\s*[:=({]\s*['"]\*['"]/gi,
        severity: 'medium',
        description: 'Wildcard CORS origin (*) configured in application code.',
        agent: 'Config Agent',
        remediation: 'Restrict CORS to specific trusted origins.',
        cwe: 'CWE-942',
    },
];

// ─── Run regex scan on a single file ─────────────────────────

function regexScanFile(file: CodeFile): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (const pattern of SECURITY_PATTERNS) {
        // Reset regex state
        pattern.regex.lastIndex = 0;
        let match;

        while ((match = pattern.regex.exec(file.content)) !== null) {
            // Find line number
            const beforeMatch = file.content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const lineContent = lines[lineNumber - 1]?.trim() || '';

            findings.push({
                id: 0, // assigned later
                severity: pattern.severity,
                title: pattern.name,
                endpoint: `${file.path}:${lineNumber}`,
                description: pattern.description,
                agent: pattern.agent,
                remediation: pattern.remediation,
                evidence: lineContent.substring(0, 200),
                cwe: pattern.cwe,
                line: lineNumber,
            });

            // Prevent infinite loops with zero-length matches
            if (match.index === pattern.regex.lastIndex) {
                pattern.regex.lastIndex++;
            }
        }
    }

    return findings;
}

// ─── Main Code Scan Function ─────────────────────────────────

export async function scanCode(
    files: CodeFile[],
    useAI: boolean = true,
    onProgress?: (msg: string) => void
): Promise<Finding[]> {
    const allFindings: Finding[] = [];

    // Phase 1: Regex-based quick scan
    if (!useAI) {
        onProgress?.('Running pattern-based security scan...');

        for (const file of files) {
            const fileFindings = regexScanFile(file);
            allFindings.push(...fileFindings);
        }

        onProgress?.(`Pattern scan complete. Found ${allFindings.length} issues.`);
    }

    // Phase 2: Gemini AI deep analysis
    if (useAI) {
        onProgress?.('Running AI-powered deep code analysis with Gemini...');

        try {
            // Filter to scannable files (skip very large or binary-like files)
            const scannableFiles = files.filter(f => {
                if (f.content.length > 50000) return false;
                const ext = f.path.split('.').pop()?.toLowerCase() || '';
                const codeExts = ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'go', 'rb', 'php', 'cs', 'c', 'cpp', 'rs', 'yaml', 'yml', 'json', 'xml', 'html', 'css', 'env', 'sh', 'bash', 'sql', 'tf', 'hcl'];
                return codeExts.includes(ext) || !ext;
            });

            if (scannableFiles.length > 0) {
                const grokAnalysis = await analyzeProjectWithGrok(scannableFiles);

                // Add all AI findings
                for (const grokFinding of grokAnalysis.findings) {
                    allFindings.push({ ...grokFinding, id: 0 });
                }

                onProgress?.(`AI analysis complete. Total: ${allFindings.length} findings.`);
            }
        } catch (err) {
            onProgress?.(`AI analysis skipped: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    // Sort and assign IDs
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allFindings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
    allFindings.forEach((f, i) => { f.id = i + 1; });

    return allFindings;
}
