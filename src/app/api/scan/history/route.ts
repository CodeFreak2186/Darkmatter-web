/**
 * GET /api/scan/history
 * Returns recent scan history (last 20 scans).
 */

import { NextResponse } from 'next/server';
import { scanStore } from '@/lib/scanStore';

export async function GET() {
    const jobs = scanStore.list();

    return NextResponse.json({
        scans: jobs.map(job => ({
            id: job.id,
            target: job.target,
            profile: job.profile,
            status: job.status,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            findingCount: job.findings.length,
            riskScore: job.riskScore ?? null,
        })),
    });
}
