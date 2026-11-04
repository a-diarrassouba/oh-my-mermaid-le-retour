import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { getOmmDir } from './store.js';
import { listElements } from './elements.js';
import { readOmmFile, writeOmmFile } from './omm-fs.js';
import { REPORTS_DIR } from './security.js';

// `/prisme-evolve` writes ideas to make the project evolve, at two levels:
//
//   code:   the project itself — simplify, speed up, go further
//   market: 3 to 5 similar products the AI found, and the features and
//           design ideas they suggest
//
// The skill sends YAML to `prisme evolve write`; this file checks it and
// stores it as .prisme/.reports/evolve.json for the viewer and the API.

export const EVOLVE_REPORT = 'evolve.json';
export const CODE_KINDS = ['simplify', 'speed', 'further'] as const;
export const MARKET_KINDS = ['feature', 'design'] as const;
export const LEVELS = ['low', 'medium', 'high'] as const;
export const EFFORTS = ['small', 'medium', 'large'] as const;
const LIMITS = { summary: 1200, title: 120, why: 800, how: 2000, what: 400, similar: 400 };
const MAX_IDEAS = 15;

export interface CodeIdea {
  kind: (typeof CODE_KINDS)[number];
  title: string;
  why: string;
  how: string;
  effort: (typeof EFFORTS)[number];
  impact: (typeof LEVELS)[number];
  elements?: string[];
  files?: string[];
}

export interface Product { name: string; url: string; what: string; similar: string }

export interface MarketIdea {
  kind: (typeof MARKET_KINDS)[number];
  title: string;
  why: string;
  how: string;
  effort: (typeof EFFORTS)[number];
  impact: (typeof LEVELS)[number];
  /** Names of the products where the idea was seen */
  seenIn: string[];
  elements?: string[];
}

export interface EvolveReport {
  version: 1;
  date: string;
  commit: string | null;
  summary: string;
  code: CodeIdea[];
  market: { products: Product[]; ideas: MarketIdea[] } | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Checks the YAML the skill wrote; returns the report (null when it has errors) and the errors. */
export function parseEvolve(source: string, cwd?: string): { report: Omit<EvolveReport, 'version' | 'date' | 'commit'> | null; issues: string[] } {
  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (e) {
    return { report: null, issues: [`not valid YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  if (!isObj(data)) return { report: null, issues: ['must be a map with summary, code and market'] };
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
  const strings = (where: string, key: string, v: unknown): string[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) { issues.push(`${where}: "${key}" must be a list of text`); return undefined; }
    return v as string[];
  };
  const elements = (where: string, v: unknown): string[] | undefined => {
    const list = strings(where, 'elements', v);
    for (const p of list ?? []) if (!known.has(p)) issues.push(`${where}: element "${p}" does not exist (see prisme tree)`);
    return list;
  };
  const allowedKeys = (where: string, o: Obj, keys: string[]) => {
    for (const k of Object.keys(o)) if (!keys.includes(k)) issues.push(`${where}: unknown key "${k}"`);
  };

  allowedKeys('report', data, ['summary', 'code', 'market']);
  const summary = text('report', data.summary, 'summary');

  const code: CodeIdea[] = [];
  if (data.code !== undefined && !Array.isArray(data.code)) issues.push('"code" must be a list');
  for (const [i, raw] of (Array.isArray(data.code) ? data.code : []).entries()) {
    const where = `code ${i + 1}`;
    if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
    allowedKeys(where, raw, ['kind', 'title', 'why', 'how', 'effort', 'impact', 'elements', 'files']);
    code.push({
      kind: oneOf(where, 'kind', raw.kind, CODE_KINDS),
      title: text(where, raw.title, 'title'),
      why: text(where, raw.why, 'why'),
      how: text(where, raw.how, 'how'),
      effort: oneOf(where, 'effort', raw.effort, EFFORTS),
      impact: oneOf(where, 'impact', raw.impact, LEVELS),
      ...(raw.elements !== undefined ? { elements: elements(where, raw.elements) } : {}),
      ...(raw.files !== undefined ? { files: strings(where, 'files', raw.files) } : {}),
    });
  }
  if (code.length > MAX_IDEAS) issues.push(`"code" has more than ${MAX_IDEAS} ideas: keep the best ones`);

  let market: EvolveReport['market'] = null;
  if (data.market !== undefined && data.market !== null) {
    if (!isObj(data.market)) issues.push('"market" must be a map with products and ideas');
    else {
      allowedKeys('market', data.market, ['products', 'ideas']);
      const products: Product[] = [];
      const rawProducts = Array.isArray(data.market.products) ? data.market.products : [];
      if (rawProducts.length < 1 || rawProducts.length > 5) issues.push('"market.products" must list 1 to 5 products (3 to 5 when they exist)');
      for (const [i, raw] of rawProducts.entries()) {
        const where = `product ${i + 1}`;
        if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
        allowedKeys(where, raw, ['name', 'url', 'what', 'similar']);
        const url = typeof raw.url === 'string' ? raw.url.trim() : '';
        if (!/^https?:\/\/[^\s/]+\.[^\s]+$/.test(url)) issues.push(`${where}: "url" must be an http(s) address`);
        products.push({ name: text(where, raw.name, 'title'), url, what: text(where, raw.what, 'what'), similar: text(where, raw.similar, 'similar') });
      }
      const names = new Set(products.map(p => p.name));
      const ideas: MarketIdea[] = [];
      if (data.market.ideas !== undefined && !Array.isArray(data.market.ideas)) issues.push('"market.ideas" must be a list');
      for (const [i, raw] of (Array.isArray(data.market.ideas) ? data.market.ideas : []).entries()) {
        const where = `market idea ${i + 1}`;
        if (!isObj(raw)) { issues.push(`${where}: must be a map`); continue; }
        allowedKeys(where, raw, ['kind', 'title', 'why', 'how', 'effort', 'impact', 'seenIn', 'elements']);
        const seenIn = strings(where, 'seenIn', raw.seenIn) ?? [];
        if (!seenIn.length) issues.push(`${where}: "seenIn" must name at least one product`);
        for (const n of seenIn) if (!names.has(n)) issues.push(`${where}: "${n}" is not in market.products`);
        ideas.push({
          kind: oneOf(where, 'kind', raw.kind, MARKET_KINDS),
          title: text(where, raw.title, 'title'),
          why: text(where, raw.why, 'why'),
          how: text(where, raw.how, 'how'),
          effort: oneOf(where, 'effort', raw.effort, EFFORTS),
          impact: oneOf(where, 'impact', raw.impact, LEVELS),
          seenIn,
          ...(raw.elements !== undefined ? { elements: elements(where, raw.elements) } : {}),
        });
      }
      if (ideas.length > MAX_IDEAS) issues.push(`"market.ideas" has more than ${MAX_IDEAS} ideas: keep the best ones`);
      market = { products, ideas };
    }
  }
  if (!code.length && !market) issues.push('write at least "code" or "market"');
  return { report: issues.length ? null : { summary, code, market }, issues };
}

function headCommit(cwd?: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const reportFile = (cwd?: string) => path.join(getOmmDir(cwd), REPORTS_DIR, EVOLVE_REPORT);

/** Checks and stores the report; nothing is written when it has errors. */
export function writeEvolve(source: string, cwd?: string): { written: boolean; issues: string[]; report?: EvolveReport } {
  const { report, issues } = parseEvolve(source, cwd);
  if (!report) return { written: false, issues };
  const full: EvolveReport = { version: 1, date: new Date().toISOString(), commit: headCommit(cwd), ...report };
  writeOmmFile(getOmmDir(cwd), reportFile(cwd), JSON.stringify(full, null, 2) + '\n');
  return { written: true, issues: [], report: full };
}

export function readEvolve(cwd?: string): EvolveReport | null {
  try {
    const data = JSON.parse(readOmmFile(getOmmDir(cwd), reportFile(cwd)) ?? 'null');
    return data && data.version === 1 ? data as EvolveReport : null;
  } catch {
    return null;
  }
}
