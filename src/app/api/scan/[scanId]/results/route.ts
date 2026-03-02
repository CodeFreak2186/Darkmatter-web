/**
 * GET /api/scan/[scanId]/results
 * Returns the complete results of a scan job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanStore } from '@/lib/scanStore';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ scanId: string }> }
) {
    const { scanId } = await params;
    const job = scanStore.get(scanId);

    if (!job) {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    return NextResponse.json({
        id: job.id,
        target: job.target,
        profile: job.profile,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        findings: job.findings,
        riskScore: job.riskScore,
        summary: job.summary ?? null,
        error: job.error ?? null,
        agentReports: job.agentReports ?? [],
        allPorts: job.allPorts ?? [],
        allDirectories: job.allDirectories ?? [],
        stats: {
            total: job.findings.length,
            critical: job.findings.filter(f => f.severity === 'critical').length,
            high: job.findings.filter(f => f.severity === 'high').length,
            medium: job.findings.filter(f => f.severity === 'medium').length,
            low: job.findings.filter(f => f.severity === 'low').length,
            info: job.findings.filter(f => f.severity === 'info').length,
            openPorts: (job.allPorts ?? []).filter(p => p.state === 'open').length,
            directories: (job.allDirectories ?? []).length,
        },
    });
}
