/**
 * POST /api/autopilot/start
 * Starts a new autonomous attack job.
 * Returns a scan ID immediately so the frontend can stream events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runAutopilot, AutopilotEvent, AutopilotFinding } from '@/lib/autopilot';

// ─── In-memory store for autopilot jobs ──────────────────────

export interface AutopilotJob {
  id: string;
  target: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  startedAt: number;
  completedAt?: number;
  events: AutopilotEvent[];
  findings: AutopilotFinding[];
  report?: string;
  rounds?: number;
  totalTime?: number;
  error?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __autopilotStore: Map<string, AutopilotJob> | undefined;
}

function getStore(): Map<string, AutopilotJob> {
  if (!global.__autopilotStore) {
    global.__autopilotStore = new Map();
  }
  return global.__autopilotStore;
}

export { getStore as getAutopilotStore };

// ─── POST Handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target } = body;

    if (!target || typeof target !== 'string') {
      return NextResponse.json({ error: 'Missing required field: target' }, { status: 400 });
    }

    let normalizedTarget = target.trim();
    if (!normalizedTarget.startsWith('http://') && !normalizedTarget.startsWith('https://')) {
      normalizedTarget = `https://${normalizedTarget}`;
    }

    const jobId = uuidv4();
    const store = getStore();

    const job: AutopilotJob = {
      id: jobId,
      target: normalizedTarget,
      status: 'pending',
      startedAt: Date.now(),
      events: [],
      findings: [],
    };

    store.set(jobId, job);

    // Start the autopilot in the background
    runAutopilotBackground(jobId, normalizedTarget).catch(err => {
      console.error(`[Autopilot ${jobId}] Background error:`, err);
      const j = store.get(jobId);
      if (j) {
        j.status = 'error';
        j.error = err.message;
      }
    });

    return NextResponse.json({
      jobId,
      target: normalizedTarget,
      status: 'pending',
    });
  } catch (err) {
    console.error('[/api/autopilot/start] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Background Runner ────────────────────────────────────────

async function runAutopilotBackground(jobId: string, target: string) {
  const store = getStore();
  const job = store.get(jobId);
  if (!job) return;

  job.status = 'running';

  const result = await runAutopilot(target, (event: AutopilotEvent) => {
    const j = store.get(jobId);
    if (j) {
      j.events.push(event);

      // Track findings as they come in
      if (event.type === 'finding' && event.data) {
        j.findings.push(event.data as unknown as AutopilotFinding);
      }
    }
  });

  const j = store.get(jobId);
  if (j) {
    j.status = 'complete';
    j.completedAt = Date.now();
    j.findings = result.findings;
    j.report = result.report;
    j.rounds = result.rounds;
    j.totalTime = result.totalTime;
  }

  console.log(`[Autopilot ${jobId}] Complete: ${result.findings.length} findings in ${result.rounds} rounds (${result.totalTime.toFixed(1)}s)`);
}
