/**
 * scanStore.ts
 * In-memory store for scan jobs, results, and scan history.
 * Uses a global singleton to persist across API route calls in dev/prod.
 */

export type ScanStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ScanFinding {
    id: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    endpoint: string;
    description: string;
    agent: string;
    recommendation?: string;
    cvss?: number;
    tool?: string;
    cve?: string;
}

export interface PortResult {
    port: number;
    protocol: 'tcp' | 'udp';
    state: 'open' | 'closed' | 'filtered';
    service: string;
    version: string;
    risk: 'high' | 'medium' | 'low' | 'info';
}

export interface DirResult {
    path: string;
    status: number;
    size: number;
    type: 'directory' | 'file' | 'redirect';
    interesting: boolean;
}

export interface AgentToolReport {
    agentName: string;
    toolName: string;
    toolCommand: string;
    toolOutput: string;
    timeTaken: number;
    ports?: PortResult[];
    directories?: DirResult[];
}

export interface ScanJob {
    id: string;
    target: string;
    profile: 'full' | 'quick' | 'stealth';
    status: ScanStatus;
    startedAt: number;
    completedAt?: number;
    findings: ScanFinding[];
    riskScore?: number;
    error?: string;
    summary?: string;
    agentReports?: AgentToolReport[];
    allPorts?: PortResult[];
    allDirectories?: DirResult[];
}

// Global singleton to persist across hot-reloads in Next.js dev
declare global {
    // eslint-disable-next-line no-var
    var __scanStore: Map<string, ScanJob> | undefined;
}

function getStore(): Map<string, ScanJob> {
    if (!global.__scanStore) {
        global.__scanStore = new Map();
    }
    return global.__scanStore;
}

export const scanStore = {
    create(job: ScanJob): void {
        getStore().set(job.id, job);
    },

    get(id: string): ScanJob | undefined {
        return getStore().get(id);
    },

    update(id: string, updates: Partial<ScanJob>): void {
        const store = getStore();
        const job = store.get(id);
        if (job) {
            store.set(id, { ...job, ...updates });
        }
    },

    list(): ScanJob[] {
        return Array.from(getStore().values())
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, 20);
    },
};
