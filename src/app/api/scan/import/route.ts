/**
 * POST /api/scan/import
 * Imports a scan report from the CLI into the web dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanStore, ScanJob } from '@/lib/scanStore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Ensure the report has an ID
        const id = body.id || uuidv4();
        
        const job: ScanJob = {
            id,
            target: body.target,
            profile: body.profile || 'full',
            status: 'complete',
            startedAt: body.startedAt || Date.now(),
            completedAt: body.completedAt || Date.now(),
            findings: body.findings || [],
            riskScore: body.riskScore || 0,
            summary: body.summary || "Imported from CLI",
            agentReports: body.agents?.map((a: any) => ({
                agentName: a.agent,
                toolName: a.tool,
                toolCommand: a.command,
                toolOutput: a.error ? `Error: ${a.error}` : "Command executed in CLI",
                timeTaken: a.time
            })) || [],
            allPorts: body.findings?.filter((f: any) => f.port).map((f: any) => ({
                port: f.port,
                protocol: 'tcp',
                state: 'open',
                service: f.service || 'unknown',
                version: f.version || '',
                risk: f.severity
            })) || []
        };

        scanStore.create(job);

        return NextResponse.json({ success: true, scanId: id });
    } catch (err) {
        console.error('[/api/scan/import] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
