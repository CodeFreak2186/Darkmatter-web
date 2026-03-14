// ─── Darkmatter Security Scanner — Core Types ───────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AgentType =
  | 'Discovery Agent'
  | 'Fuzzing Agent'
  | 'Auth Agent'
  | 'Config Agent'
  | 'Code Agent'
  | 'AI Agent';

export interface Finding {
  id: number;
  severity: Severity;
  title: string;
  endpoint: string;
  description: string;
  agent: string;
  remediation?: string;
  evidence?: string;
  cwe?: string;
  line?: number;
  endLine?: number;
  fixSnippet?: string;
  risk?: string;
}

export interface ScanRequest {
  url?: string;
  profile?: 'quick' | 'full' | 'stealth';
  files?: CodeFile[];
}

export interface CodeFile {
  path: string;
  content: string;
  language?: string;
}

export interface ScanProgress {
  phase: string;
  agent: string;
  message: string;
  progress: number; // 0-100
}

export interface ScanResult {
  id: string;
  target: string;
  findings: Finding[];
  scanTime: number;
  timestamp: string;
  profile: string;
}

export interface GrokAnalysis {
  findings: {
    severity: Severity;
    title: string;
    endpoint: string;
    description: string;
    agent: string;
    remediation: string;
    evidence: string;
    cwe: string;
    line?: number;
    endLine?: number;
    fixSnippet?: string;
    risk?: string;
  }[];
  summary: string;
  riskScore: number;
}
