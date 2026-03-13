// ─── Darkmatter — Code Scan API ──────────────────────────────
// POST /api/scan/code
// Accepts { files: [{ path, content, language }] }
// Returns code analysis findings

import { NextRequest, NextResponse } from 'next/server';
import { scanCode } from '@/lib/security/code-scanner';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { files } = body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return NextResponse.json(
                { error: 'files array is required. Format: [{ path, content, language? }]' },
                { status: 400 }
            );
        }

        // Validate files
        const validFiles = files.filter(
            (f: { path?: string; content?: string }) =>
                typeof f.path === 'string' && typeof f.content === 'string'
        );

        if (validFiles.length === 0) {
            return NextResponse.json(
                { error: 'No valid files provided. Each file needs path and content.' },
                { status: 400 }
            );
        }

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const findings = await scanCode(validFiles, true, (msg) => {
                        const data = JSON.stringify({ type: 'progress', message: msg });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    });

                    const result = JSON.stringify({
                        type: 'result',
                        findings,
                        filesScanned: validFiles.length,
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
                        message: err instanceof Error ? err.message : 'Code scan failed',
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
