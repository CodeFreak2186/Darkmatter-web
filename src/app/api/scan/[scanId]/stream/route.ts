/**
 * GET /api/scan/[scanId]/stream
 * Server-Sent Events (SSE) endpoint for real-time scan progress.
 */

import { NextRequest } from 'next/server';
import { scanStore } from '@/lib/scanStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ scanId: string }> }
) {
    const { scanId } = await params;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            let lastFindingCount = 0;
            let lastPortCount = 0;
            let lastDirCount = 0;
            let lastReportCount = 0;
            let pollCount = 0;
            const maxPolls = 360; // 6 min max

            const poll = async () => {
                pollCount++;
                const job = scanStore.get(scanId);

                if (!job) {
                    send('error', { message: 'Scan not found' });
                    controller.close();
                    return;
                }

                // Send status update
                send('status', { status: job.status, findingCount: job.findings.length });

                // Stream new findings
                if (job.findings.length > lastFindingCount) {
                    const newFindings = job.findings.slice(lastFindingCount);
                    for (const f of newFindings) send('finding', f);
                    lastFindingCount = job.findings.length;
                }

                // Stream new port results
                const ports = job.allPorts ?? [];
                if (ports.length > lastPortCount) {
                    const newPorts = ports.slice(lastPortCount);
                    for (const p of newPorts) send('port', p);
                    lastPortCount = ports.length;
                }

                // Stream new directory results
                const dirs = job.allDirectories ?? [];
                if (dirs.length > lastDirCount) {
                    const newDirs = dirs.slice(lastDirCount);
                    for (const d of newDirs) send('directory', d);
                    lastDirCount = dirs.length;
                }

                // Stream completed agent reports (tool output)
                const reports = job.agentReports ?? [];
                if (reports.length > lastReportCount) {
                    const newReports = reports.slice(lastReportCount);
                    for (const r of newReports) send('agent_report', r);
                    lastReportCount = reports.length;
                }

                if (job.status === 'complete') {
                    send('complete', {
                        riskScore: job.riskScore,
                        totalFindings: job.findings.length,
                        openPorts: ports.filter(p => p.state === 'open').length,
                        directories: dirs.length,
                        completedAt: job.completedAt,
                    });
                    controller.close();
                    return;
                }

                if (job.status === 'error') {
                    send('error', { message: job.error || 'Scan failed' });
                    controller.close();
                    return;
                }

                if (pollCount >= maxPolls) {
                    send('error', { message: 'Scan timed out after 6 minutes' });
                    controller.close();
                    return;
                }

                if (pollCount % 10 === 0) send('ping', { ts: Date.now(), poll: pollCount });

                await new Promise(res => setTimeout(res, 1000));
                await poll();
            };

            try {
                await poll();
            } catch (err) {
                send('error', { message: err instanceof Error ? err.message : 'Stream error' });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
