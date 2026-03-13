// ─── Darkmatter — URL Scan API ───────────────────────────────
// POST /api/scan/url
// Accepts { url: string, profile: string }
// Returns scan findings via streaming SSE

import { NextRequest, NextResponse } from 'next/server';
import { scanUrl } from '@/lib/security/url-scanner';

export const maxDuration = 60; // Allow up to 60s for scan

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, profile = 'full' } = body;

        if (!url) {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format. Include protocol (https://)' },
                { status: 400 }
            );
        }

        // Create a readable stream for SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const progressMessages: string[] = [];

                try {
                    const findings = await scanUrl(url, profile, (msg) => {
                        progressMessages.push(msg);
                        // Send progress event
                        const data = JSON.stringify({ type: 'progress', message: msg });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    });

                    // Send final result
                    const result = JSON.stringify({
                        type: 'result',
                        findings,
                        scanTime: Date.now(),
                        target: url,
                        profile,
                        totalFindings: findings.length,
                        critical: findings.filter(f => f.severity === 'critical').length,
                        high: findings.filter(f => f.severity === 'high').length,
                        medium: findings.filter(f => f.severity === 'medium').length,
                        low: findings.filter(f => f.severity === 'low').length,
                        info: findings.filter(f => f.severity === 'info').length,
                    });
                    controller.enqueue(encoder.encode(`data: ${result}\n\n`));
                } catch (err) {
                    const errorMsg = JSON.stringify({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Scan failed',
                    });
                    controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
