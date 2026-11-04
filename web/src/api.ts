// The /api/v1 contract (docs/api.md), as the front uses it.

declare global {
  interface Window {
    __prismeToken?: string;
    __prismeAI?: boolean;
    __projectName?: string;
  }
}

export type Level = 'novice' | 'junior' | 'senior';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Project {
  api: number;
  name: string;
  language: string;
  version: string;
  lastScan: { commit: string; date: string } | null;
  counts: { perspectives: number; elements: number; guides: number };
  categories: {
    understand: { available: boolean };
    security: { available: boolean; grade?: Grade; score?: number; date?: string; counts?: Record<Severity, number>; threats?: number; questions?: number };
    evolve: { available: boolean; date?: string; code?: number; products?: number; ideas?: number };
  };
  ai: { available: boolean; reason?: string };
}

export interface Finding {
  rule: string;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  file?: string;
  line?: number;
  match?: string;
  owasp?: string;
  source: string;
  elements?: string[];
  reason?: string;
}

export interface SecurityReport {
  date: string;
  grade: Grade;
  score: number;
  counts: Record<Severity, number>;
  files: number;
  findings: Finding[];
  ignored: Finding[];
  tools: { name: string; status: 'ran' | 'missing' | 'failed' | 'skipped'; findings: number }[];
}

export type Stride = 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
export interface ThreatModel {
  date: string;
  summary: string;
  assets: string[];
  boundaries: { from: string; to: string; why: string }[];
  threats: { element: string; stride: Stride[]; title: string; scenario: string; likelihood: 'low' | 'medium' | 'high'; impact: 'low' | 'medium' | 'high'; status: 'open' | 'mitigated' | 'accepted'; control: string; files?: string[] }[];
  questions: { theme: string; question: string; status: 'answered' | 'open'; answer?: string; elements?: string[] }[];
}

export interface Idea { kind: string; title: string; why: string; how: string; effort: 'small' | 'medium' | 'large'; impact: 'low' | 'medium' | 'high'; elements?: string[]; files?: string[]; seenIn?: string[] }
export interface EvolveReport {
  date: string;
  summary: string;
  code: Idea[];
  market: { products: { name: string; url: string; what: string; similar: string }[]; ideas: Idea[] } | null;
}

export interface ApiElement { path: string; title: string; kind: string }
export interface GuideResult { id: string; valid: boolean; guide: { title: string; start?: boolean; steps: unknown[]; duration?: string } | null }

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export const api = {
  project: () => get<Project>('/api/v1/project'),
  security: () => get<SecurityReport>('/api/v1/security'),
  threats: () => get<ThreatModel>('/api/v1/threats'),
  evolve: () => get<EvolveReport>('/api/v1/evolve'),
  elements: () => get<ApiElement[]>('/api/v1/elements'),
  guides: () => get<GuideResult[]>('/api/v1/guides'),
  /** Runs `prisme security` on the machine; needs the page token. */
  async runSecurity(): Promise<{ report: SecurityReport | null; error?: string }> {
    try {
      const res = await fetch('/api/v1/security/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Prisme-Token': window.__prismeToken ?? '' },
      });
      const body = await res.json().catch(() => ({}));
      return res.ok ? { report: body as SecurityReport } : { report: null, error: (body as { error?: string }).error };
    } catch (e) {
      return { report: null, error: String(e) };
    }
  },
};

/** The classic map viewer, opened on an element or a guide. */
export function mapLink(target?: { element?: string; guide?: string }): string {
  if (target?.guide) return `/map#guide=${encodeURIComponent(target.guide)}`;
  if (target?.element) return `/map#element=${encodeURIComponent(target.element)}`;
  return '/map';
}
