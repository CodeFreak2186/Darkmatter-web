/**
 * POST /api/scan/start
 * Starts a new security scan job.
 * Returns the scan ID immediately so the frontend can start streaming.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanStore, AgentToolReport, PortResult, DirResult } from '@/lib/scanStore';
import { runAgentPipeline, generateSummary, AgentReport, AGENT_NAMES } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { target, profile = 'full' } = body;

        if (!target || typeof target !== 'string') {
            return NextResponse.json({ error: 'Missing required field: target' }, { status: 400 });
        }

        let normalizedTarget = target.trim();
        if (!normalizedTarget.startsWith('http://') && !normalizedTarget.startsWith('https://')) {
            normalizedTarget = `https://${normalizedTarget}`;
        }

        const scanId = uuidv4();

        scanStore.create({
            id: scanId,
            target: normalizedTarget,
            profile: profile as 'full' | 'quick' | 'stealth',
            status: 'pending',
            startedAt: Date.now(),
            findings: [],
            agentReports: [],
            allPorts: [],
            allDirectories: [],
        });

        runScanBackground(scanId, normalizedTarget, profile).catch(err => {
            console.error(`[Scan ${scanId}] Background error:`, err);
            scanStore.update(scanId, { status: 'error', error: err.message });
        });

        return NextResponse.json({ scanId, target: normalizedTarget, status: 'pending' });
    } catch (err) {
        console.error('[/api/scan/start] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ─── Background scan runner ───────────────────────────────────

async function runScanBackground(scanId: string, target: string, profile: string) {
    scanStore.update(scanId, { status: 'running' });

    const allFindings: import('@/lib/scanStore').ScanFinding[] = [];
    const allAgentReports: AgentToolReport[] = [];
    const allPorts: PortResult[] = [];
    const allDirectories: DirResult[] = [];
    let findingIdCounter = 1;

    await runAgentPipeline(target, profile, (report: AgentReport) => {
        const statusIcon = report.findings.length > 0 ? '✓' : '○';
        const critCount = report.findings.filter(f => f.severity === 'critical').length;
        const highCount = report.findings.filter(f => f.severity === 'high').length;
        console.log(
            `[${report.agentName}] ${statusIcon} Done in ${report.timeTaken.toFixed(1)}s` +
            ` — ${report.findings.length} findings` +
            (critCount > 0 ? ` (${critCount} CRITICAL)` : '') +
            (highCount > 0 ? ` (${highCount} HIGH)` : '')
        );
        // Collect port results
        if (report.ports) {
            allPorts.push(...report.ports);
        }

        // Collect directory results
        if (report.directories) {
            allDirectories.push(...report.directories);
        }

        // Store agent tool report
        const toolReport: AgentToolReport = {
            agentName: report.agentName,
            toolName: report.toolName,
            toolCommand: report.toolCommand,
            toolOutput: report.toolOutput,
            timeTaken: report.timeTaken,
            ports: report.ports,
            directories: report.directories,
        };
        allAgentReports.push(toolReport);

        // Tag findings
        const tagged: import('@/lib/scanStore').ScanFinding[] = report.findings.map(f => ({
            id: findingIdCounter++,
            severity: f.severity,
            title: f.title,
            endpoint: f.endpoint,
            description: f.description,
            recommendation: f.recommendation,
            cvss: f.cvss,
            agent: report.agentName,
            tool: f.tool || report.toolName,
            cve: f.cve,
        }));

        allFindings.push(...tagged);

        // Update store progressively
        scanStore.update(scanId, {
            findings: [...allFindings],
            agentReports: [...allAgentReports],
            allPorts: [...allPorts],
            allDirectories: [...allDirectories],
        });
    });

    const crit = allFindings.filter(f => f.severity === 'critical').length;
    const high = allFindings.filter(f => f.severity === 'high').length;
    const med = allFindings.filter(f => f.severity === 'medium').length;
    const low = allFindings.filter(f => f.severity === 'low').length;
    const riskScore = Math.min(10, parseFloat((crit * 2.5 + high * 1.5 + med * 0.7 + low * 0.2).toFixed(1)));

    const summary = await generateSummary(target, allFindings as import('@/lib/gemini').GeminiFinding[]);

    scanStore.update(scanId, {
        status: 'complete',
        completedAt: Date.now(),
        findings: allFindings,
        riskScore,
        summary,
        agentReports: allAgentReports,
        allPorts,
        allDirectories,
    });

    console.log(`[Scan ${scanId}] Complete: ${allFindings.length} findings, ${allPorts.length} ports, ${allDirectories.length} directories`);
}

// Export for reference
export { AGENT_NAMES };
