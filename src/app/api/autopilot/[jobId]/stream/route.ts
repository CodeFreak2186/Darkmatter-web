/**
 * GET /api/autopilot/[jobId]/stream
 * SSE endpoint for streaming autopilot events in real-time.
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Import the store getter from the start route
function getStore(): Map<string, import('../../start/route').AutopilotJob> {
  if (!global.__autopilotStore) {
    global.__autopilotStore = new Map();
  }
  return global.__autopilotStore;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may have been closed
        }
      };

      let lastEventIndex = 0;
      let lastFindingCount = 0;
      let pollCount = 0;
      const maxPolls = 600; // 10 min max

      const poll = async () => {
        pollCount++;
        const store = getStore();
        const job = store.get(jobId);

        if (!job) {
          send('error', { message: 'Autopilot job not found' });
          controller.close();
          return;
        }

        // Send status
        send('status', {
          status: job.status,
          findingCount: job.findings.length,
          eventCount: job.events.length,
        });

        // Stream new events
        if (job.events.length > lastEventIndex) {
          const newEvents = job.events.slice(lastEventIndex);
          for (const event of newEvents) {
            send('autopilot_event', event);
          }
          lastEventIndex = job.events.length;
        }

        // Stream new findings (deduplicated from events)
        if (job.findings.length > lastFindingCount) {
          lastFindingCount = job.findings.length;
        }

        // Job complete
        if (job.status === 'complete') {
          send('complete', {
            totalFindings: job.findings.length,
            critical: job.findings.filter(f => f.severity === 'critical').length,
            high: job.findings.filter(f => f.severity === 'high').length,
            medium: job.findings.filter(f => f.severity === 'medium').length,
            low: job.findings.filter(f => f.severity === 'low').length,
            info: job.findings.filter(f => f.severity === 'info').length,
            rounds: job.rounds,
            totalTime: job.totalTime,
            report: job.report,
            completedAt: job.completedAt,
          });
          controller.close();
          return;
        }

        // Job error
        if (job.status === 'error') {
          send('error', { message: job.error || 'Autopilot failed' });
          controller.close();
          return;
        }

        // Timeout
        if (pollCount >= maxPolls) {
          send('error', { message: 'Autopilot timed out after 10 minutes' });
          controller.close();
          return;
        }

        // Periodic ping
        if (pollCount % 15 === 0) {
          send('ping', { ts: Date.now(), poll: pollCount });
        }

        await new Promise(res => setTimeout(res, 500));
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
