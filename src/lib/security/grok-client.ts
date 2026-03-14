// ─── Darkmatter — Gemini AI Client ───────────────────────────
// Connects to Google's Gemini API for cybersecurity analysis

import { GrokAnalysis, Severity } from './types';

const GEMINI_MODEL = 'gemini-2.0-flash';

function getApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your-gemini-api-key-here') {
        throw new Error('GEMINI_API_KEY not configured. Set it in .env.local');
    }
    return key;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = getApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userPrompt }],
                },
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseGeminiJson(raw: string): GrokAnalysis {
    if (!raw) return { findings: [], summary: 'Empty response from AI.', riskScore: 0 };
    
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = raw.trim();
    
    // Better regex for nested JSON extraction
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                     raw.match(/(\{[\s\S]*\})/); 
                     
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    try {
        // Basic cleanup for common truncation issues
        if (jsonStr.endsWith(',') || jsonStr.endsWith(', ')) {
            jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf(',')) + ']}';
        }
        
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object') throw new Error('Parsed JSON is not an object');
        
        const findingsArray = Array.isArray(parsed.findings) ? parsed.findings : 
                            (Array.isArray(parsed) ? parsed : []);

        return {
            findings: findingsArray.map((f: any) => ({
                severity: (f.severity as Severity) || 'info',
                title: (f.title as string) || 'Unknown Issue',
                endpoint: (f.endpoint as string) || '/',
                description: (f.description as string) || '',
                agent: (f.agent as string) || 'Code Agent',
                remediation: (f.remediation as string) || '',
                evidence: (f.evidence as string) || '',
                cwe: (f.cwe as string) || '',
                line: (f.line as number) || undefined,
                endLine: (f.endLine as number) || undefined,
                fixSnippet: (f.fixSnippet as string) || undefined,
                risk: (f.risk as string) || undefined,
            })),
            summary: parsed.summary || 'Analysis complete.',
            riskScore: parsed.riskScore || 0,
        };
    } catch (err) {
        console.error('Failed to parse Gemini JSON response:', err);
        console.error('Raw problematic string:', jsonStr.substring(0, 1000));
        
        // Salvage attempt: Use regex to find individual finding objects in the broken string
        const salvagedFindings = salvageFindings(jsonStr);
        if (salvagedFindings.length > 0) {
            console.log(`Salvaged ${salvagedFindings.length} findings from broken AI response.`);
            return {
                findings: salvagedFindings,
                summary: 'Analysis completed (partially salvaged from malformed output).',
                riskScore: Math.min(100, salvagedFindings.length * 10)
            };
        }

        return { 
            findings: [], 
            summary: 'Analysis completed but the output format was invalid and could not be salvaged.', 
            riskScore: 0 
        };
    }
}

/**
 * Attempts to extract individual finding objects from a malformed or truncated JSON string
 */
function salvageFindings(brokenStr: string): any[] {
    const findings: any[] = [];
    // Look for objects that look like findings: { "severity": "...", "title": "..." }
    const findingPattern = /\{\s*"severity":\s*"[^"]*",\s*"title":\s*"[^"]*"[\s\S]*?\}/g;
    let match;
    
    while ((match = findingPattern.exec(brokenStr)) !== null) {
        try {
            // Try to fix common trailing issues in the fragment
            let fragment = match[0].trim();
            if (!fragment.endsWith('}')) fragment += '}';
            
            const f = JSON.parse(fragment);
            if (f.severity && f.title) {
                findings.push({
                    severity: f.severity || 'info',
                    title: f.title || 'Unknown Issue',
                    endpoint: f.endpoint || '/',
                    description: f.description || '',
                    agent: f.agent || 'Code Agent',
                    remediation: f.remediation || '',
                    evidence: f.evidence || '',
                    cwe: f.cwe || '',
                    line: f.line || undefined,
                    endLine: f.endLine || undefined,
                    fixSnippet: f.fixSnippet || undefined,
                    risk: f.risk || undefined,
                });
            }
        } catch {
            // If even the fragment is unparseable after fixing, skip it
        }
    }
    return findings;
}

// ─── Cybersecurity System Prompt ─────────────────────────────

const CYBER_SYSTEM_PROMPT = `You are a dedicated "Security Copilot" for the Darkmatter Web IDE. Your sole purpose is to analyze code ONLY from a cybersecurity perspective.

CRITICAL INSTRUCTIONS:
- strictly restrict analysis to security vulnerabilities ONLY.
- Do NOT analyze syntax errors, formatting issues, linting problems, or general programming mistakes.
- Do NOT show style suggestions, performance optimizations unrelated to security, or general code refactoring.
- Identify OWASP Top 10 vulnerabilities, misconfigurations, and attack surfaces (e.g. Hardcoded credentials, Weak auth, Unprotected endpoints, SQLi, Command injection, Insecure sessions, XSS, CSRF, Misconfigured CORS, Unsafe file uploads).
- Improve existing security code: If the code uses weak practices (e.g. MD5/SHA1), suggest stronger alternatives (e.g. bcrypt).

Provide your findings as valid JSON exactly in this format:
{
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "Short vulnerability title (e.g., SQL Injection Risk)",
      "endpoint": "Affected endpoint or file path",
      "description": "What is the vulnerability? (e.g., User input is directly concatenated into the SQL query.)",
      "risk": "Why is it dangerous? (e.g., Attackers could manipulate queries...)",
      "remediation": "How to fix this issue (e.g., Use parameterized queries)",
      "agent": "Code Agent",
      "evidence": "Proof or indicator of the vulnerability",
      "cwe": "CWE-XXX",
      "line": 42,
      "endLine": 44,
      "fixSnippet": "import { rateLimit } from 'express-rate-limit';\\nconst limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });\\napp.use(limiter);" // ONLY small patches, no full files!
    }
  ],
  "summary": "Brief overall security assessment",
  "riskScore": 75
}

DO NOT under any circumstances return a JSON larger than 4kb. If you have many findings, only return the Top 3 most critical ones.
KEEP descriptions and fixSnippets short and focused!`;

// ─── URL Analysis ────────────────────────────────────────────

export async function analyzeUrlWithGrok(
    url: string,
    headerData: Record<string, string>,
    sslInfo: Record<string, unknown>,
    additionalContext: string = ''
): Promise<GrokAnalysis> {
    const userPrompt = `Analyze the security posture of this target URL as a cybersecurity engineer performing a reconnaissance and vulnerability assessment.

TARGET: ${url}

HTTP RESPONSE HEADERS:
${JSON.stringify(headerData, null, 2)}

SSL/TLS INFO:
${JSON.stringify(sslInfo, null, 2)}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ''}

Perform a thorough security analysis covering:
1. Missing security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc.)
2. CORS misconfiguration
3. Cookie security issues
4. Server information disclosure
5. SSL/TLS weaknesses
6. Potential injection points
7. Authentication/Authorization issues visible from headers
8. Any other vulnerabilities you can identify

Be thorough but accurate. Only report real issues based on the provided data. Assign appropriate severity levels.`;

    const raw = await callGemini(CYBER_SYSTEM_PROMPT, userPrompt);
    return parseGeminiJson(raw);
}

// ─── Code Analysis ───────────────────────────────────────────

export async function analyzeCodeWithGrok(
    files: { path: string; content: string; language?: string }[]
): Promise<GrokAnalysis> {
    const filesSummary = files.map(f => {
        const truncated = f.content.length > 3000 ? f.content.substring(0, 3000) + '\n... (truncated)' : f.content;
        return `### File: ${f.path} (${f.language || 'unknown'})\n\`\`\`\n${truncated}\n\`\`\``;
    }).join('\n\n');

    const userPrompt = `Perform a comprehensive security code review of the following source files. Act as a dedicated "Security Copilot" for the Darkmatter Web IDE.

${filesSummary}

Analyze strictly for:
1. Hardcoded credentials or secrets
2. Weak authentication or authorization logic
3. Unprotected API endpoints
4. Missing input validation or sanitization
5. SQL injection vulnerabilities
6. Command injection risks
7. Insecure session handling
8. Static or predictable hashes/tokens
9. Exposure of database credentials
10. Unsafe file uploads
11. Cross-site scripting (XSS)
12. CSRF vulnerabilities
13. Insecure cryptographic implementations
14. Misconfigured CORS
15. Unsafe environment variable handling
16. Any other security and ONLY security issues.

CRITICAL INSTRUCTIONS:
- Do NOT report syntax errors, linting issues, missing generic imports, or normal programming bugs.
- Limit your report to a MAXIMUM of the 5 most severe vulnerabilities across all files combined to prevent JSON truncation.
- Be precise and reference exact line numbers. YOU MUST provide an exact code replacement in the \`fixSnippet\` field.
- IMPORTANT: \`fixSnippet\` MUST ONLY contain the code block that replaces the lines from \`line\` to \`endLine\`. Do NOT include the entire file.
- If the output is getting too long, prioritize Critical and High severity issues.
- Failure to provide valid, compact JSON will break the IDE dashboard.`;

    const raw = await callGemini(CYBER_SYSTEM_PROMPT, userPrompt);
    return parseGeminiJson(raw);
}

// ─── ZIP/Project Analysis ────────────────────────────────────

export async function analyzeProjectWithGrok(
    files: { path: string; content: string }[],
    projectContext: string = ''
): Promise<GrokAnalysis> {
    // For large projects, batch files and summarize
    // Split into smaller batches to prevent output truncation
    const batches: typeof files[] = [];
    let currentBatch: typeof files = [];
    let currentSize = 0;

    for (const file of files) {
        if (currentSize + file.content.length > 20000 && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentSize = 0;
        }
        currentBatch.push(file);
        currentSize += file.content.length;
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    // Analyze each batch sequentially (to respect free tier rate limits)
    const allFindings: GrokAnalysis['findings'] = [];
    for (const batch of batches) {
        const result = await analyzeCodeWithGrok(batch);
        allFindings.push(...result.findings);
    }

    return {
        findings: allFindings,
        summary: `Analyzed ${files.length} files across ${batches.length} batches.`,
        riskScore: Math.min(100, allFindings.filter(f => f.severity === 'critical').length * 25 +
            allFindings.filter(f => f.severity === 'high').length * 15 +
            allFindings.filter(f => f.severity === 'medium').length * 5),
    };
}
