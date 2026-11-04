import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getOmmDir, nodeDir, readNodeMeta, writeNodeMeta } from './store.js';
import type { ClassMeta } from '../types.js';
import { readOmmFile, writeOmmFile } from './omm-fs.js';

// An element explained at three reader levels. The senior level is the
// element's description; explain.yaml holds the two others:
//
//   novice: an everyday image first, then the real words one at a time
//   deeper: "Learn more" for the novice: how the image maps to the code
//   junior: what it does, how, with which files and patterns
//
// The element's icon (one word from ICONS) sits in meta.yaml, next to its title.

export const EXPLAIN_FILE = 'explain.yaml';
export const EXPLAIN_KEYS = ['novice', 'deeper', 'junior'] as const;
export type ExplainKey = (typeof EXPLAIN_KEYS)[number];
export type Explain = Partial<Record<ExplainKey, string>>;

export const EXPLAIN_LIMITS: Record<ExplainKey, number> = { novice: 1200, deeper: 1500, junior: 1500 };

/** Icons a scan may give an element. Fronts map each name to a drawing. */
export const ICONS = [
  'app', 'api', 'server', 'database', 'storage', 'file', 'folder', 'terminal', 'browser', 'screen',
  'mobile', 'user', 'users', 'lock', 'key', 'shield', 'settings', 'plug', 'cloud', 'network',
  'queue', 'message', 'mail', 'bell', 'clock', 'search', 'chart', 'book', 'test', 'build',
  'package', 'git', 'bot', 'code', 'globe', 'link', 'layers', 'map', 'compass', 'flag',
  'wrench', 'zap', 'eye', 'palette', 'calendar', 'cart', 'payment', 'puzzle', 'filter', 'refresh',
] as const;
export type Icon = (typeof ICONS)[number];

export function isIcon(value: unknown): value is Icon {
  return typeof value === 'string' && (ICONS as readonly string[]).includes(value);
}

/** Checks explain.yaml; returns the explanation (null when unusable) and what is wrong. */
export function parseExplain(source: string): { explain: Explain | null; issues: string[] } {
  let data: unknown;
  try {
    data = YAML.parse(source);
  } catch (e) {
    return { explain: null, issues: [`not valid YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { explain: null, issues: ['must be a map of novice, deeper, junior'] };
  const issues: string[] = [];
  const explain: Explain = {};
  for (const [key, value] of Object.entries(data)) {
    if (!(EXPLAIN_KEYS as readonly string[]).includes(key)) {
      issues.push(`unknown key "${key}" (allowed: ${EXPLAIN_KEYS.join(', ')})`);
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      issues.push(`"${key}" must be non-empty text`);
      continue;
    }
    const limit = EXPLAIN_LIMITS[key as ExplainKey];
    if (value.trim().length > limit) issues.push(`"${key}" is longer than ${limit} characters`);
    explain[key as ExplainKey] = value.trim();
  }
  if (!explain.novice && !issues.some(i => i.startsWith('"novice"'))) issues.push('"novice" is required');
  if (explain.deeper && !explain.novice) issues.push('"deeper" goes with "novice"');
  return { explain: issues.length ? null : explain, issues };
}

function explainFile(perspective: string, nodePath: string[], cwd?: string): string {
  return path.join(nodeDir(perspective, nodePath, cwd), EXPLAIN_FILE);
}

/** The element's explanation, or null when it has none or it is not valid. */
export function readExplain(perspective: string, nodePath: string[], cwd?: string): Explain | null {
  const source = readOmmFile(getOmmDir(cwd), explainFile(perspective, nodePath, cwd));
  return source === null ? null : parseExplain(source).explain;
}

export function readExplainSource(perspective: string, nodePath: string[], cwd?: string): string | null {
  return readOmmFile(getOmmDir(cwd), explainFile(perspective, nodePath, cwd));
}

/** Writes explain.yaml after checking it; nothing is written when it has issues. */
export function writeExplain(perspective: string, nodePath: string[], source: string, cwd?: string): { written: boolean; issues: string[] } {
  if (!fs.existsSync(nodeDir(perspective, nodePath, cwd))) return { written: false, issues: ['element not found'] };
  const { issues } = parseExplain(source);
  if (issues.length) return { written: false, issues };
  writeOmmFile(getOmmDir(cwd), explainFile(perspective, nodePath, cwd), source.endsWith('\n') ? source : source + '\n');
  return { written: true, issues: [] };
}

/** The element's icon, or null when it has none or an unknown one. */
export function readIcon(perspective: string, nodePath: string[], cwd?: string): Icon | null {
  const icon = readNodeMeta(perspective, nodePath, cwd)?.icon;
  return isIcon(icon) ? icon : null;
}

/** Sets the element's icon; an empty value removes it. Returns an error message, or null. */
export function writeIcon(perspective: string, nodePath: string[], icon: string, cwd?: string): string | null {
  if (!fs.existsSync(nodeDir(perspective, nodePath, cwd))) return 'element not found';
  const clean = icon.trim();
  if (clean && !isIcon(clean)) return `unknown icon "${clean}" (allowed: ${ICONS.join(', ')})`;
  const now = new Date().toISOString();
  const meta: ClassMeta = readNodeMeta(perspective, nodePath, cwd)
    ?? { created: now, updated: now, update_count: 0, last_field: 'description' };
  if (clean) meta.icon = clean;
  else delete meta.icon;
  writeNodeMeta(perspective, nodePath, meta, cwd);
  return null;
}
