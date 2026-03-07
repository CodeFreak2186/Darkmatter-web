// ─── Darkmatter — URL Security Scanner ───────────────────────
// Makes real HTTP requests and feeds data to Gemini AI for intelligent analysis

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { Finding, Severity } from './types';
import { analyzeUrlWithGrok } from './grok-client';

// ─── Native Header Checks (instant, no AI needed) ───────────

interface HeaderCheckResult {
    findings: Finding[];
    headers: Record<string, string>;
    statusCode: number;
    sslInfo: Record<string, unknown>;
}

async function fetchHeaders(targetUrl: string): Promise<HeaderCheckResult> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: 15000,
            headers: {
                'User-Agent': 'Darkmatter-Scanner/2.4 (Security Audit)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            rejectUnauthorized: false, // Allow self-signed certs for scanning
        };

        const req = lib.request(options, (res) => {
            const headers: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
                headers[key] = Array.isArray(value) ? value.join(', ') : (value || '');
            }

            // Collect body for tech detection (limited to 10KB)
            let body = '';
            res.on('data', (chunk) => {
                if (body.length < 10000) body += chunk.toString();
            });

            res.on('end', () => {
                // SSL info
                let sslInfo: Record<string, unknown> = {};
                if (isHttps && 'socket' in res && res.socket) {
                    try {
                        const sock = res.socket as import('tls').TLSSocket;
                        if (sock.getPeerCertificate) {
                            const cert = sock.getPeerCertificate();
                            sslInfo = {
                                subject: cert.subject,
                                issuer: cert.issuer,
                                valid_from: cert.valid_from,
                                valid_to: cert.valid_to,
                                protocol: sock.getProtocol?.() || 'unknown',
                                cipher: sock.getCipher?.() || {},
                                authorized: sock.authorized,
                            };
                        }
                    } catch {
                        sslInfo = { error: 'Could not read SSL info' };
                    }
                }

                // Native finding checks
                const findings: Finding[] = [];
                let findingId = 1;

                // Check security headers
                const securityHeaders: { header: string; title: string; severity: Severity; desc: string }[] = [
                    { header: 'strict-transport-security', title: 'Missing HSTS Header', severity: 'medium', desc: 'Strict-Transport-Security header is not set. This allows downgrade attacks and cookie hijacking.' },
                    { header: 'x-frame-options', title: 'Missing X-Frame-Options', severity: 'low', desc: 'Page can be embedded in iframes, enabling clickjacking attacks.' },
                    { header: 'x-content-type-options', title: 'Missing X-Content-Type-Options', severity: 'low', desc: 'Browser may MIME-sniff responses, leading to XSS via content type confusion.' },
                    { header: 'content-security-policy', title: 'Missing Content-Security-Policy', severity: 'medium', desc: 'No CSP header configured. XSS attacks are harder to mitigate without CSP.' },
                    { header: 'referrer-policy', title: 'Missing Referrer-Policy', severity: 'low', desc: 'Referrer information may leak sensitive URL parameters to third parties.' },
                    { header: 'permissions-policy', title: 'Missing Permissions-Policy', severity: 'low', desc: 'No restrictions on browser features like camera, microphone, geolocation.' },
                    { header: 'x-xss-protection', title: 'Missing X-XSS-Protection', severity: 'info', desc: 'Legacy XSS protection header not set (modern browsers use CSP instead).' },
                ];

                for (const check of securityHeaders) {
                    if (!headers[check.header]) {
                        findings.push({
                            id: findingId++,
                            severity: check.severity,
                            title: check.title,
                            endpoint: '/',
                            description: check.desc,
                            agent: 'Config Agent',
                            remediation: `Add the ${check.header} header to your server responses.`,
                        });
                    }
                }

                // Server disclosure
                if (headers['server']) {
                    findings.push({
                        id: findingId++,
                        severity: 'medium',
                        title: 'Server Version Disclosure',
                        endpoint: '/',
                        description: `Server header exposes: ${headers['server']}. This reveals server software and version to attackers.`,
                        agent: 'Discovery Agent',
                        remediation: 'Remove or genericize the Server response header.',
                        evidence: `Server: ${headers['server']}`,
                    });
                }

                // X-Powered-By disclosure
                if (headers['x-powered-by']) {
                    findings.push({
                        id: findingId++,
                        severity: 'low',
                        title: 'Technology Disclosure via X-Powered-By',
                        endpoint: '/',
                        description: `X-Powered-By header reveals: ${headers['x-powered-by']}`,
                        agent: 'Discovery Agent',
                        remediation: 'Remove the X-Powered-By header from responses.',
                        evidence: `X-Powered-By: ${headers['x-powered-by']}`,
                    });
                }

                // CORS check
                if (headers['access-control-allow-origin'] === '*') {
                    findings.push({
                        id: findingId++,
                        severity: 'medium',
                        title: 'CORS Wildcard Origin',
                        endpoint: '/',
                        description: 'Access-Control-Allow-Origin is set to *, allowing any domain to make cross-origin requests.',
                        agent: 'Config Agent',
                        remediation: 'Restrict CORS to specific trusted origins instead of using wildcard.',
                        evidence: 'Access-Control-Allow-Origin: *',
                    });
                }

                // Cookie security
                const setCookie = headers['set-cookie'] || '';
                if (setCookie) {
                    if (!setCookie.toLowerCase().includes('httponly')) {
                        findings.push({
                            id: findingId++,
                            severity: 'medium',
                            title: 'Cookie Missing HttpOnly Flag',
                            endpoint: '/',
                            description: 'Cookies are accessible via JavaScript, making them vulnerable to XSS-based theft.',
                            agent: 'Auth Agent',
                            remediation: 'Add the HttpOnly flag to all sensitive cookies.',
                        });
                    }
                    if (!setCookie.toLowerCase().includes('secure')) {
                        findings.push({
                            id: findingId++,
                            severity: 'medium',
                            title: 'Cookie Missing Secure Flag',
                            endpoint: '/',
                            description: 'Cookies can be transmitted over unencrypted HTTP connections.',
                            agent: 'Auth Agent',
                            remediation: 'Add the Secure flag to all cookies.',
                        });
                    }
                    if (!setCookie.toLowerCase().includes('samesite')) {
                        findings.push({
                            id: findingId++,
                            severity: 'low',
                            title: 'Cookie Missing SameSite Attribute',
                            endpoint: '/',
                            description: 'Without SameSite, cookies may be sent in cross-site requests (CSRF risk).',
                            agent: 'Auth Agent',
                            remediation: 'Set SameSite=Strict or SameSite=Lax on cookies.',
                        });
                    }
                }

                // Technology detection from body
                const techFindings: string[] = [];
                if (body.includes('react')) techFindings.push('React');
                if (body.includes('next')) techFindings.push('Next.js');
                if (body.includes('vue')) techFindings.push('Vue.js');
                if (body.includes('angular')) techFindings.push('Angular');
                if (body.includes('jquery') || body.includes('jQuery')) techFindings.push('jQuery');
                if (body.includes('wordpress') || body.includes('wp-content')) techFindings.push('WordPress');
                if (headers['x-powered-by']?.includes('Express')) techFindings.push('Express.js');
                if (headers['x-powered-by']?.includes('PHP')) techFindings.push('PHP');
                if (headers['server']?.includes('nginx')) techFindings.push('Nginx');
                if (headers['server']?.includes('Apache')) techFindings.push('Apache');
                if (headers['server']?.includes('cloudflare')) techFindings.push('Cloudflare');

                if (techFindings.length > 0) {
                    findings.push({
                        id: findingId++,
                        severity: 'info',
                        title: 'Technology Stack Detected',
                        endpoint: '/',
                        description: `Detected technologies: ${techFindings.join(', ')}`,
                        agent: 'Discovery Agent',
                    });
                }

                // SSL certificate check
                if (isHttps && sslInfo.valid_to) {
                    const expiryDate = new Date(sslInfo.valid_to as string);
                    const daysLeft = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                        findings.push({
                            id: findingId++,
                            severity: 'critical',
                            title: 'SSL Certificate Expired',
                            endpoint: '/',
                            description: `SSL certificate expired ${Math.abs(daysLeft)} days ago.`,
                            agent: 'Config Agent',
                            remediation: 'Renew the SSL certificate immediately.',
                        });
                    } else if (daysLeft < 30) {
                        findings.push({
                            id: findingId++,
                            severity: 'medium',
                            title: 'SSL Certificate Expiring Soon',
                            endpoint: '/',
                            description: `SSL certificate expires in ${daysLeft} days.`,
                            agent: 'Config Agent',
                            remediation: 'Renew the SSL certificate before it expires.',
                        });
                    } else {
                        findings.push({
                            id: findingId++,
                            severity: 'info',
                            title: 'SSL Certificate Info',
                            endpoint: '/',
                            description: `Certificate valid, expires in ${daysLeft} days. Protocol: ${sslInfo.protocol || 'unknown'}`,
                            agent: 'Config Agent',
                        });
                    }
                }

                resolve({ findings, headers, statusCode: res.statusCode || 0, sslInfo });
            });
        });

        req.on('error', (err) => {
            reject(new Error(`Failed to connect to ${targetUrl}: ${err.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Connection to ${targetUrl} timed out`));
        });

        req.end();
    });
}

// ─── Check robots.txt ────────────────────────────────────────

async function checkRobotsTxt(targetUrl: string): Promise<Finding | null> {
    try {
        const parsedUrl = new URL(targetUrl);
        const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        return new Promise((resolve) => {
            const req = lib.get(robotsUrl, { timeout: 5000, rejectUnauthorized: false }, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode === 200 && body.includes('Disallow')) {
                        const disallowed = body.split('\n')
                            .filter(l => l.trim().toLowerCase().startsWith('disallow'))
                            .map(l => l.split(':').slice(1).join(':').trim())
                            .filter(Boolean);

                        resolve({
                            id: 0,
                            severity: 'info',
                            title: 'robots.txt Analysis',
                            endpoint: '/robots.txt',
                            description: `Found ${disallowed.length} disallowed paths: ${disallowed.slice(0, 5).join(', ')}${disallowed.length > 5 ? '...' : ''}`,
                            agent: 'Discovery Agent',
                            evidence: body.substring(0, 500),
                        });
                    } else {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    } catch {
        return null;
    }
}

// ─── Main URL Scan Function ─────────────────────────────────

export async function scanUrl(
    targetUrl: string,
    profile: string = 'full',
    onProgress?: (msg: string) => void
): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    let findingId = 1;

    try {
        // Phase 1: Native HTTP scan
        onProgress?.('Performing HTTP reconnaissance...');
        const { findings: nativeFindings, headers, statusCode, sslInfo } = await fetchHeaders(targetUrl);
        allFindings.push(...nativeFindings);

        onProgress?.(`Connected — HTTP ${statusCode}. Found ${nativeFindings.length} header issues.`);

        // Phase 2: robots.txt check
        onProgress?.('Checking robots.txt...');
        const robotsFinding = await checkRobotsTxt(targetUrl);
        if (robotsFinding) {
            robotsFinding.id = findingId++;
            allFindings.push(robotsFinding);
        }

        // Phase 3: Gemini AI deep analysis
        onProgress?.('Running AI-powered deep analysis with Gemini...');

        const additionalContext = `
HTTP Status Code: ${statusCode}
Robots.txt: ${robotsFinding ? 'Found' : 'Not found'}
Profile: ${profile}
    `.trim();

        try {
            const grokAnalysis = await analyzeUrlWithGrok(targetUrl, headers, sslInfo, additionalContext);

            // Merge Grok findings (avoid duplicates with native)
            const nativeTitles = new Set(allFindings.map(f => f.title.toLowerCase()));
            for (const grokFinding of grokAnalysis.findings) {
                if (!nativeTitles.has(grokFinding.title.toLowerCase())) {
                    allFindings.push({
                        ...grokFinding,
                        id: findingId++,
                    });
                }
            }

            onProgress?.(`AI analysis complete. Total: ${allFindings.length} findings.`);
        } catch (err) {
            onProgress?.(`AI analysis skipped: ${err instanceof Error ? err.message : 'Unknown error'}`);
            // Continue with native findings only
        }

        // Re-assign IDs and sort by severity
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        allFindings.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
        allFindings.forEach((f, i) => { f.id = i + 1; });

        return allFindings;
    } catch (err) {
        // If even the connection fails, return an error finding
        return [{
            id: 1,
            severity: 'info',
            title: 'Connection Error',
            endpoint: targetUrl,
            description: `Could not connect to target: ${err instanceof Error ? err.message : 'Unknown error'}`,
            agent: 'Discovery Agent',
        }];
    }
}
