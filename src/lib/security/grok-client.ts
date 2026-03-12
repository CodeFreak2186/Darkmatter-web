// ─── Darkmatter — Gemini AI Client ───────────────────────────
// Connects to Google's Gemini API for cybersecurity analysis

import { GrokAnalysis, Severity } from './types';

const GEMINI_MODEL = 'gemini-2.5-flash';

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
                maxOutputTokens: 4096,
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
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = raw;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    try {
        const parsed = JSON.parse(jsonStr);
        return {
            findings: (parsed.findings || []).map((f: Record<string, unknown>, i: number) => ({
                severity: (f.severity as Severity) || 'info',
                title: (f.title as string) || 'Unknown Issue',
                endpoint: (f.endpoint as string) || '/',
                description: (f.description as string) || '',
                agent: (f.agent as string) || 'AI Agent',
                remediation: (f.remediation as string) || '',
                evidence: (f.evidence as string) || '',
                cwe: (f.cwe as string) || '',
            })),
            summary: parsed.summary || '',
            riskScore: parsed.riskScore || 0,
        };
    } catch {
        console.error('Failed to parse Gemini JSON response:', jsonStr.substring(0, 500));
        return { findings: [], summary: 'Analysis completed but output could not be parsed.', riskScore: 0 };
    }
}

// ─── Cybersecurity System Prompt ─────────────────────────────

const CYBER_SYSTEM_PROMPT = `You are Darkmatter AI, an elite cybersecurity engineer and penetration tester. You analyze targets with extreme thoroughness, identifying vulnerabilities that others miss.

Your role:
- Analyze security data like a professional red team operator
- Identify OWASP Top 10 vulnerabilities, misconfigurations, and attack surfaces
- Provide actionable remediation with code examples when possible
- Rate severity accurately: critical (RCE, auth bypass), high (SQLi, XSS), medium (misconfig), low (info disclosure), info (reconnaissance)
- Reference CWE IDs when applicable

ALWAYS respond with valid JSON in this exact format:
{
  "findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "Short vulnerability title",
      "endpoint": "Affected endpoint or file path",
      "description": "Detailed description of the vulnerability",
      "agent": "Discovery Agent|Fuzzing Agent|Auth Agent|Config Agent|Code Agent|AI Agent",
      "remediation": "How to fix this issue",
      "evidence": "Proof or indicator of the vulnerability",
      "cwe": "CWE-XXX"
    }
  ],
  "summary": "Brief overall security assessment",
  "riskScore": 75
}`;

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

    const userPrompt = `Perform a comprehensive security code review of the following source files. Act as a senior security engineer conducting a SAST (Static Application Security Testing) audit.

${filesSummary}

Analyze for:
1. Hardcoded secrets (API keys, passwords, tokens, private keys)
2. SQL Injection vulnerabilities
3. Cross-Site Scripting (XSS)
4. Command Injection / OS Command Execution
5. Path Traversal
6. Insecure Deserialization
7. Weak Cryptography (MD5, SHA1 for passwords, weak random)
8. Insecure file operations
9. Missing input validation
10. Authentication/Authorization flaws
11. Insecure dependencies or imports
12. Debug code left in production
13. SSRF vulnerabilities
14. Race conditions
15. Any other security issues

Be precise and reference exact line numbers or code patterns as evidence. Only report real vulnerabilities found in the code.`;

    const raw = await callGemini(CYBER_SYSTEM_PROMPT, userPrompt);
    return parseGeminiJson(raw);
}

// ─── ZIP/Project Analysis ────────────────────────────────────

export async function analyzeProjectWithGrok(
    files: { path: string; content: string }[],
    projectContext: string = ''
): Promise<GrokAnalysis> {
    // For large projects, batch files and summarize
    const totalSize = files.reduce((sum, f) => sum + f.content.length, 0);

    if (totalSize > 15000) {
        // Split into batches and analyze
        const batches: typeof files[] = [];
        let currentBatch: typeof files = [];
        let currentSize = 0;

        for (const file of files) {
            if (currentSize + file.content.length > 12000 && currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch = [];
                currentSize = 0;
            }
            currentBatch.push(file);
            currentSize += file.content.length;
        }
        if (currentBatch.length > 0) batches.push(currentBatch);

        // Analyze each batch
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

    return analyzeCodeWithGrok(files);
}
