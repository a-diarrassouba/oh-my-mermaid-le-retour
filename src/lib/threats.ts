import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { getOmmDir } from './store.js';
import { listElements } from './elements.js';
import { readOmmFile, writeOmmFile } from './omm-fs.js';
import { REPORTS_DIR } from './security.js';

// The threat model `/prisme-security` writes from the map: what to protect,
// where trusted parts meet untrusted ones, the realistic threats on each
// element (STRIDE), and the secure-by-design questions the team should be
// able to answer. Unlike the score, it comes from an AI review; the score
// stays the automatic check.
//
// The skill sends YAML to `prisme security threats write -`; this file checks
// it and stores .prisme/.reports/threats.json for the viewer and the API.

export const THREATS_REPORT = 'threats.json';
/** Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege */
export const STRIDE = ['S', 'T', 'R', 'I', 'D', 'E'] as const;
export const LEVELS = ['low', 'medium', 'high'] as const;
export const THREAT_STATUSES = ['open', 'mitigated', 'accepted'] as const;
export const QUESTION_STATUSES = ['answered', 'open'] as const;
const LIMITS = { summary: 1500, title: 140, scenario: 800, control: 800, why: 400, theme: 60, question: 300, answer: 800, asset: 120 };
const MAX = { threats: 40, questions: 50, boundaries: 30, assets: 20 };

export interface Boundary { from: string; to: string; why: string }
export interface Threat {
  element: string;
  stride: (typeof STRIDE)[number][];
  title: string;
  /** Who could do what, in plain words */
  scenario: string;
  likelihood: (typeof LEVELS)[number];
  impact: (typeof LEVELS)[number];
  status: (typeof THREAT_STATUSES)[number];
  /** What protects against it today, or what to do */
  control: string;
  files?: string[];
}
export interface Question {
  theme: string;
  question: string;
  status: (typeof QUESTION_STATUSES)[number];
  /** The answer found in the code, when answered */
  answer?: string;
  elements?: string[];
}
export interface ThreatModel {
  version: 1;
  date: string;
  commit: string | null;
  summary: string;
  assets: string[];
  boundaries: Boundary[];
  threats: Threat[];
  questions: Question[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Checks the YAML the skill wrote; returns the model (null when it has errors) and the errors. */
export function parseThreats(source: string, cwd?: string): { model: Omit<ThreatModel, 'version' | 'date' | 'commit'> | null; issues: string[] } {
  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (e) {
    return { model: null, issues: [`not valid YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  if (!isObj(data)) return { model: null, issues: ['must be a map with summary, assets, boundaries, threats and questions'] };
  const issues: string[] = [];
  const known = new Set(listElements(cwd).map(e => e.path));

  const text = (where: string, v: unknown, key: keyof typeof LIMITS, required = true): string => {
    if (v === undefined && !required) return '';
    if (typeof v !== 'string' || !v.trim()) { issues.push(`${where}: "${key}" must be non-empty text`); return ''; }
    if (v.trim().length > LIMITS[key]) issues.push(`${where}: "${key}" is longer than ${LIMITS[key]} characters`);
    return v.trim();
  };
  const oneOf = <T extends string>(where: string, key: string, v: unknown, allowed: readonly T[]): T => {
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) issues.push(`${where}: "${key}" must be one of ${allowed.join(', ')}`);
    return v as T;
  };
  const element = (where: string, key: string, v: unknown): string => {
    if (typeof v !== 'string' || !known.has(v)) issues.push(`${where}: "${key}" must be an element of the map (see prisme tree)${typeof v === 'string' ? `, not "${v}"` : ''}`);
    return typeof v === 'string' ? v : '';
  };
  const list = (where: string, key: string, v: unknown): string[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) { issues.push(`${where}: "${key}" must be a list of text`); return undefined; }
    return v as string[];
  };
  const keys = (where: string, o: Obj, allowed: string[]) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) issues.push(`${where}: unknown key "${k}"`);
  };
  const items = (key: keyof typeof MAX): unknown[] => {
    const v = (data as Obj)[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) { issues.push(`"${key}" must be a list`); return []; }
    if (v.length > MAX[key]) issues.push(`"${key}" has more than ${MAX[key]} items: keep the most important ones`);
    return v;
  };

  keys('model', data, ['summary', 'assets', 'boundaries', 'threats', 'questions']);
  const summary = text('model', data.summary, 'summary');

  const assets: string[] = [];
  for (const [i, a] of items('assets').entries()) {
    if (typeof a !== 'string' || !a.trim()) issues.push(`asset ${i + 1}: must be text`);
    else if (a.length > LIMITS.asset) issues.push(`asset ${i + 1}: longer than ${LIMITS.asset} characters`);
    else assets.push(a.trim());
  }

  const boundaries: Boundary[] = [];
  for (const [i, raw] of items('boundaries').entries()) {
    const where = `boundary ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['from', 'to', 'why']);
    boundaries.push({ from: element(where, 'from', raw.from), to: element(where, 'to', raw.to), why: text(where, raw.why, 'why') });
  }

  const threats: Threat[] = [];
  for (const [i, raw] of items('threats').entries()) {
    const where = `threat ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['element', 'stride', 'title', 'scenario', 'likelihood', 'impact', 'status', 'control', 'files']);
    const stride = list(where, 'stride', raw.stride) ?? [];
    if (!stride.length) issues.push(`${where}: "stride" must list at least one of ${STRIDE.join(', ')}`);
    for (const s of stride) if (!(STRIDE as readonly string[]).includes(s)) issues.push(`${where}: "${s}" is not a STRIDE letter (${STRIDE.join(', ')})`);
    threats.push({
      element: element(where, 'element', raw.element),
      stride: [...new Set(stride)] as Threat['stride'],
      title: text(where, raw.title, 'title'),
      scenario: text(where, raw.scenario, 'scenario'),
      likelihood: oneOf(where, 'likelihood', raw.likelihood, LEVELS),
      impact: oneOf(where, 'impact', raw.impact, LEVELS),
      status: oneOf(where, 'status', raw.status, THREAT_STATUSES),
      control: text(where, raw.control, 'control'),
      ...(raw.files !== undefined ? { files: list(where, 'files', raw.files) } : {}),
    });
  }

  const questions: Question[] = [];
  for (const [i, raw] of items('questions').entries()) {
    const where = `question ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    keys(where, raw, ['theme', 'question', 'status', 'answer', 'elements']);
    const status = oneOf(where, 'status', raw.status, QUESTION_STATUSES);
    const answer = status === 'answered' ? text(where, raw.answer, 'answer') : text(where, raw.answer, 'answer', false);
    const elements = list(where, 'elements', raw.elements);
    for (const p of elements ?? []) element(where, 'elements', p);
    questions.push({
      theme: text(where, raw.theme, 'theme'),
      question: text(where, raw.question, 'question'),
      status,
      ...(answer ? { answer } : {}),
      ...(elements ? { elements } : {}),
    });
  }

  if (!threats.length && !questions.length) issues.push('write at least "threats" or "questions"');
  return { model: issues.length ? null : { summary, assets, boundaries, threats, questions }, issues };
}

function headCommit(cwd?: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const reportFile = (cwd?: string) => path.join(getOmmDir(cwd), REPORTS_DIR, THREATS_REPORT);

/** Checks and stores the threat model; nothing is written when it has errors. */
export function writeThreats(source: string, cwd?: string): { written: boolean; issues: string[]; model?: ThreatModel } {
  const { model, issues } = parseThreats(source, cwd);
  if (!model) return { written: false, issues };
  // Most worrying first: likelihood × impact, open before mitigated.
  const rank = (t: Threat) => (LEVELS.indexOf(t.likelihood) + 1) * (LEVELS.indexOf(t.impact) + 1) + (t.status === 'open' ? 10 : 0);
  model.threats.sort((a, b) => rank(b) - rank(a));
  const full: ThreatModel = { version: 1, date: new Date().toISOString(), commit: headCommit(cwd), ...model };
  writeOmmFile(getOmmDir(cwd), reportFile(cwd), JSON.stringify(full, null, 2) + '\n');
  return { written: true, issues: [], model: full };
}

export function readThreats(cwd?: string): ThreatModel | null {
  try {
    const data = JSON.parse(readOmmFile(getOmmDir(cwd), reportFile(cwd)) ?? 'null');
    return data && data.version === 1 ? data as ThreatModel : null;
  } catch {
    return null;
  }
}
