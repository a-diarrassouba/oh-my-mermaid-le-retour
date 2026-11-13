import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { getOmmDir } from './store.js';
import { readOmmFile, writeOmmFile } from './omm-fs.js';
import { REPORTS_DIR, projectFiles, type Grade, type Severity } from './security.js';
import { parseLineRange } from './project-files.js';
import { parseLevels, type Levels } from './levels.js';

// The security audit `/prisme-security` writes after reading the code: only
// confirmed flaws, each explained (what, what an attacker could do, proof,
// fix), the leads it dismissed with the reason, and the areas it checked.
//
// Claude judges each flaw's severity with the rubric of the skill; the grade
// is computed here, always the same way, from those severities. The audit
// only covers the repository it was run in: every file must be one git
// tracks there (never .claude/ worktrees, dependencies or build output).

export const AUDIT_REPORT = 'security-audit.json';
export const AUDIT_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
export const EFFORTS = ['small', 'medium', 'large'] as const;
/** The areas an audit goes through, in this order (the skill's checklist). */
export const AREAS = [
  'secrets', 'auth', 'access-control', 'injection', 'xss', 'files', 'ssrf', 'crypto',
  'dependencies', 'config', 'ci-cd', 'data-exposure', 'dos',
] as const;
export const AREA_STATUSES = ['ok', 'issues', 'partial', 'not-applicable'] as const;
/** What the contradictory verification said about a flaw the report keeps. */
export const VERIFICATIONS = ['confirmed', 'contested', 'added'] as const;
export const OWASP_CODES = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'] as const;
const LIMITS = { summary: 2000, title: 160, what: 1200, impact: 800, evidence: 1500, fix: 1500, reason: 600, note: 600, verificationNote: 600 };
const MAX = { findings: 60, dismissed: 200 };

export interface AuditFinding {
  title: string;
  severity: Severity;
  area: (typeof AREAS)[number];
  owasp?: (typeof OWASP_CODES)[number];
  file: string;
  lines?: string;
  /** What is wrong, in plain words */
  what: string;
  /** What an attacker could do in this project */
  impact: string;
  /** Why it is real: the path from input to the risky code, checked by reading it */
  evidence: string;
  fix: string;
  effort: (typeof EFFORTS)[number];
  /** Other files with the same flaw */
  also?: string[];
  /** confirmed: the verifier could not refute it; contested: it tried, the judge kept it; added: the verifier found it */
  verification?: (typeof VERIFICATIONS)[number];
  /** Why the judge kept a contested flaw, or what the verifier found */
  verificationNote?: string;
  /** what, impact and fix for a beginner and a junior; the base texts are the senior level */
  levels?: Levels<'what' | 'impact' | 'fix'>;
}
export interface Dismissed { title: string; file?: string; reason: string }
/** How the audit was run: parallel auditors, then a contradictory verification. */
export interface AuditProcess {
  auditors: number;
  verified: boolean;
  /** Flaws the verifier disproved, now in "dismissed" */
  refuted: number;
  /** Flaws the auditors missed or wrongly dismissed, found by the verifier */
  added: number;
}

export interface AreaCheck { area: (typeof AREAS)[number]; status: (typeof AREA_STATUSES)[number]; note: string }

export interface AuditReport {
  version: 1;
  kind: 'audit';
  date: string;
  commit: string | null;
  /** Files git tracks in the audited repository */
  files: number;
  grade: Grade;
  score: number;
  counts: Record<Severity, number>;
  summary: string;
  findings: AuditFinding[];
  dismissed: Dismissed[];
  checked: AreaCheck[];
  process?: AuditProcess;
  /** The summary for a beginner and a junior */
  levels?: Levels<'summary'>;
}

const PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 6, low: 2 };
/** Many small hardening points must not hide the real state: lows weigh 10 at most, mediums 30. */
const CAP: Partial<Record<Severity, number>> = { low: 10, medium: 30 };

/** The grade, from the confirmed findings only. */
export function gradeAudit(findings: { severity: Severity }[]): { score: number; grade: Grade } {
  let penalty = 0;
  for (const s of AUDIT_SEVERITIES) {
    const sum = findings.filter(f => f.severity === s).length * PENALTY[s];
    penalty += CAP[s] !== undefined ? Math.min(sum, CAP[s]!) : sum;
  }
  const score = Math.max(0, 100 - penalty);
  let grade: Grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'E';
  // A critical flaw is never better than D, a high one never better than C.
  const atMost = (cap: Grade) => { if (grade < cap) grade = cap; };
  if (findings.some(f => f.severity === 'critical')) atMost('D');
  else if (findings.some(f => f.severity === 'high')) atMost('C');
  return { score, grade };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** The audited files: what git tracks in this repository, without Claude Code worktrees or tool folders. */
export function auditScope(cwd: string): Set<string> {
  return new Set(projectFiles(cwd).filter(f => !/^\.claude\//.test(f)));
}

/** Checks the YAML the skill wrote; returns the audit (null when it has errors) and the errors. */
export function parseAudit(source: string, cwd: string = process.cwd()): { audit: Omit<AuditReport, 'version' | 'kind' | 'date' | 'commit' | 'files' | 'grade' | 'score' | 'counts'> | null; issues: string[] } {
  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (e) {
    return { audit: null, issues: [`not valid YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  if (!isObj(data)) return { audit: null, issues: ['must be a map with summary, findings, dismissed and checked'] };
  const issues: string[] = [];
  const scope = auditScope(cwd);
  const lineCount = new Map<string, number>();
  const linesOf = (file: string) => {
    if (!lineCount.has(file)) {
      try {
        const text = fs.readFileSync(path.join(cwd, file), 'utf-8');
        lineCount.set(file, text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
      } catch { lineCount.set(file, 0); }
    }
    return lineCount.get(file)!;
  };

  const text = (where: string, v: unknown, key: keyof typeof LIMITS): string => {
    if (typeof v !== 'string' || !v.trim()) { issues.push(`${where}: "${key}" must be non-empty text`); return ''; }
    if (v.trim().length > LIMITS[key]) issues.push(`${where}: "${key}" is longer than ${LIMITS[key]} characters`);
    return v.trim();
  };
  const oneOf = <T extends string>(where: string, key: string, v: unknown, allowed: readonly T[]): T => {
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) issues.push(`${where}: "${key}" must be one of ${allowed.join(', ')}`);
    return v as T;
  };
  const inScope = (where: string, key: string, v: unknown): string => {
    const file = typeof v === 'string' ? v.trim().replace(/^\.\//, '') : '';
    if (!file) issues.push(`${where}: "${key}" must be a file path`);
    else if (!scope.has(file)) issues.push(`${where}: "${file}" is not a file of this repository (only what git tracks here, not .claude/ worktrees, dependencies or build output)`);
    return file;
  };
  const keys = (where: string, o: Obj, allowed: string[]) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) issues.push(`${where}: unknown key "${k}"`);
  };
  const items = (key: 'findings' | 'dismissed' | 'checked'): unknown[] => {
    const v = (data as Obj)[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) { issues.push(`"${key}" must be a list`); return []; }
    if (key !== 'checked' && v.length > MAX[key]) issues.push(`"${key}" has more than ${MAX[key]} items: group the same flaw in one finding (use "also")`);
    return v;
  };

  keys('audit', data, ['summary', 'findings', 'dismissed', 'checked', 'process', 'levels']);
  const summary = text('audit', data.summary, 'summary');
  const levels = parseLevels('audit', data.levels, { summary: LIMITS.summary }, issues);

  const findings: AuditFinding[] = [];
  for (const [i, raw] of items('findings').entries()) {
    const where = `finding ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['title', 'severity', 'area', 'owasp', 'file', 'lines', 'what', 'impact', 'evidence', 'fix', 'effort', 'also', 'verification', 'verificationNote', 'levels']);
    const findingLevels = parseLevels(where, raw.levels, { what: LIMITS.what, impact: LIMITS.impact, fix: LIMITS.fix }, issues);
    const file = inScope(where, 'file', raw.file);
    let lines: string | undefined;
    if (raw.lines !== undefined) {
      const range = parseLineRange(raw.lines);
      if (!range) issues.push(`${where}: "lines" must be a line or a range, e.g. "12-40"`);
      else if (file && scope.has(file) && range.end > linesOf(file)) issues.push(`${where}: "${file}" has ${linesOf(file)} lines, not ${range.end}`);
      else lines = String(raw.lines).replace(/\s+/g, '');
    }
    let also: string[] | undefined;
    if (raw.also !== undefined) {
      if (!Array.isArray(raw.also) || raw.also.some(x => typeof x !== 'string')) issues.push(`${where}: "also" must be a list of files`);
      else also = raw.also.map((f, k) => inScope(`${where} also ${k + 1}`, 'file', f));
    }
    findings.push({
      title: text(where, raw.title, 'title'),
      severity: oneOf(where, 'severity', raw.severity, AUDIT_SEVERITIES),
      area: oneOf(where, 'area', raw.area, AREAS),
      ...(raw.owasp !== undefined ? { owasp: oneOf(where, 'owasp', raw.owasp, OWASP_CODES) } : {}),
      file,
      ...(lines ? { lines } : {}),
      what: text(where, raw.what, 'what'),
      impact: text(where, raw.impact, 'impact'),
      evidence: text(where, raw.evidence, 'evidence'),
      fix: text(where, raw.fix, 'fix'),
      effort: oneOf(where, 'effort', raw.effort, EFFORTS),
      ...(also?.length ? { also } : {}),
      ...(raw.verification !== undefined ? { verification: oneOf(where, 'verification', raw.verification, VERIFICATIONS) } : {}),
      ...(raw.verificationNote !== undefined ? { verificationNote: text(where, raw.verificationNote, 'verificationNote') } : {}),
      ...(findingLevels ? { levels: findingLevels } : {}),
    });
    if ((raw.verification === 'contested' || raw.verification === 'added') && raw.verificationNote === undefined)
      issues.push(`${where}: a "${raw.verification}" flaw needs a "verificationNote" (why it was kept, or what the verifier found)`);
  }

  const dismissed: Dismissed[] = [];
  for (const [i, raw] of items('dismissed').entries()) {
    const where = `dismissed ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['title', 'file', 'reason']);
    dismissed.push({
      title: text(where, raw.title, 'title'),
      ...(raw.file !== undefined ? { file: typeof raw.file === 'string' ? raw.file.trim() : '' } : {}),
      reason: text(where, raw.reason, 'reason'),
    });
  }

  const checked: AreaCheck[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of items('checked').entries()) {
    const where = `checked ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['area', 'status', 'note']);
    const area = oneOf(where, 'area', raw.area, AREAS);
    if (seen.has(area)) issues.push(`${where}: area "${area}" is listed twice`);
    seen.add(area);
    checked.push({ area, status: oneOf(where, 'status', raw.status, AREA_STATUSES), note: text(where, raw.note, 'note') });
  }
  const missing = AREAS.filter(a => !seen.has(a));
  if (missing.length) issues.push(`"checked" must cover every area; missing: ${missing.join(', ')} (use not-applicable with a note when it does not apply)`);
  for (const f of findings) {
    const c = checked.find(x => x.area === f.area);
    if (c && c.status === 'ok') issues.push(`area "${f.area}" is "ok" but finding "${f.title}" is in it: use "issues"`);
  }

  let process: AuditProcess | undefined;
  if (data.process !== undefined) {
    const p = data.process;
    const count = (k: string, v: unknown) => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) { issues.push(`process: "${k}" must be a whole number`); return 0; }
      return v;
    };
    if (!isObj(p)) issues.push('"process" must be a map: auditors, verified, refuted, added');
    else {
      keys('process', p, ['auditors', 'verified', 'refuted', 'added']);
      if (typeof p.verified !== 'boolean') issues.push('process: "verified" must be true or false');
      process = { auditors: count('auditors', p.auditors), verified: p.verified === true, refuted: count('refuted', p.refuted), added: count('added', p.added) };
      if (process.verified && findings.some(f => !f.verification)) issues.push('process: "verified" is true, so every finding needs "verification"');
    }
  }

  return { audit: issues.length ? null : { summary, findings, dismissed, checked, ...(process ? { process } : {}), ...(levels ? { levels } : {}) }, issues };
}

function headCommit(cwd: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const reportFile = (cwd?: string) => path.join(getOmmDir(cwd), REPORTS_DIR, AUDIT_REPORT);

/** Checks the audit, computes the grade, stores it; nothing is written when it has errors. */
export function writeAudit(source: string, cwd: string = process.cwd()): { written: boolean; issues: string[]; report?: AuditReport } {
  const { audit, issues } = parseAudit(source, cwd);
  if (!audit) return { written: false, issues };
  const order = (s: Severity) => AUDIT_SEVERITIES.indexOf(s);
  audit.findings.sort((a, b) => order(a.severity) - order(b.severity));
  const { score, grade } = gradeAudit(audit.findings);
  const counts = Object.fromEntries(AUDIT_SEVERITIES.map(s => [s, audit.findings.filter(f => f.severity === s).length])) as Record<Severity, number>;
  const report: AuditReport = {
    version: 1, kind: 'audit', date: new Date().toISOString(), commit: headCommit(cwd),
    files: auditScope(cwd).size, grade, score, counts, ...audit,
  };
  writeOmmFile(getOmmDir(cwd), reportFile(cwd), JSON.stringify(report, null, 2) + '\n');
  return { written: true, issues: [], report };
}

export function readAudit(cwd?: string): AuditReport | null {
  try {
    const data = JSON.parse(readOmmFile(getOmmDir(cwd), reportFile(cwd)) ?? 'null');
    return data && data.version === 1 && data.kind === 'audit' ? data as AuditReport : null;
  } catch {
    return null;
  }
}
