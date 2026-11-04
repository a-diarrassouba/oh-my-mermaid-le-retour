import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { VALID_FIELDS, type Field } from '../types.js';
import { getOmmDir, readNodeField, readNodeMeta } from '../lib/store.js';
import { listElements, type ElementInfo, type Role } from '../lib/elements.js';
import { loadGuides } from '../lib/guides.js';
import { searchElements } from '../lib/search.js';
import { getLanguage } from '../lib/language.js';
import { readConfig } from '../lib/config.js';
import { readExplain, readIcon, type Explain, type Icon } from '../lib/explain.js';
import { askSupported, getJob, runningJob, startAsk, validateQuestion } from './ask.js';
import { isLocalOrigin, sameToken } from './local.js';
import { msg } from '../lib/messages.js';

// The data contract of the viewer, versioned so another front (the next
// viewer, a script) can rely on it. Described in docs/api.md.

export const API_VERSION = 1;

export interface ApiContext {
  port: number;
  /** Secret the page must send to run Claude; null when questions to Claude are off */
  token: string | null;
  cwd?: string;
}

export interface ApiElement {
  path: string;
  parent: string | null;
  id: string;
  /** Display title, falling back to the first line of the label, then the id */
  title: string;
  kind: 'perspective' | 'group' | 'leaf';
  role: Role | null;
  /** One word from ICONS (src/lib/explain.ts), null when the scan gave none */
  icon: Icon | null;
  /** Files, folders or external names the element covers */
  files: string[];
  depth: number;
  children: string[];
  fields: Partial<Record<Field, string>>;
  /** novice, deeper (novice's "learn more") and junior; the senior level is fields.description */
  explain: Explain | null;
  updated: string | null;
}

function prismeVersion(): string {
  const require = createRequire(import.meta.url);
  for (const file of ['../package.json', '../../package.json']) {
    try {
      const pkg = require(file) as { name?: string; version?: string };
      if (pkg.name === 'prisme' && pkg.version) return pkg.version;
    } catch { /* try the next one */ }
  }
  return 'unknown';
}

function displayTitle(el: ElementInfo): string {
  if (el.title) return el.title;
  const first = el.label?.split(/\\n|<br\s*\/?>|\n/i)[0]?.trim();
  return first || el.id;
}

function toApiElement(el: ElementInfo, cwd?: string): ApiElement {
  const [perspective, ...nodePath] = el.path.split('/');
  const fields: Partial<Record<Field, string>> = {};
  for (const field of VALID_FIELDS) {
    const value = readNodeField(perspective, nodePath, field, cwd);
    if (value !== null) fields[field] = value;
  }
  return {
    path: el.path,
    parent: el.parent,
    id: el.id,
    title: displayTitle(el),
    kind: el.depth === 0 ? 'perspective' : el.children.length ? 'group' : 'leaf',
    role: el.role,
    icon: readIcon(perspective, nodePath, cwd),
    files: el.locations,
    depth: el.depth,
    children: el.children,
    fields,
    explain: readExplain(perspective, nodePath, cwd),
    updated: readNodeMeta(perspective, nodePath, cwd)?.updated ?? null,
  };
}

export function apiElements(cwd?: string): ApiElement[] {
  return listElements(cwd).map(el => toApiElement(el, cwd));
}

const reportExists = (name: string, cwd?: string) => fs.existsSync(path.join(getOmmDir(cwd), name, 'report.json'));

export function apiProject(ctx: Pick<ApiContext, 'token' | 'cwd'>) {
  const elements = listElements(ctx.cwd);
  const guides = loadGuides(ctx.cwd);
  const supported = askSupported();
  return {
    api: API_VERSION,
    name: path.basename(ctx.cwd ?? process.cwd()),
    language: getLanguage(ctx.cwd),
    version: prismeVersion(),
    lastScan: readConfig(ctx.cwd).last_scan ?? null,
    counts: {
      perspectives: elements.filter(e => e.depth === 0).length,
      elements: elements.length,
      guides: guides.filter(g => g.valid).length,
    },
    categories: {
      understand: { available: elements.length > 0 },
      security: { available: reportExists('security', ctx.cwd) },
      evolve: { available: reportExists('evolve', ctx.cwd) },
    },
    ai: ctx.token === null
      ? { available: false, reason: msg('aiOff') }
      : supported.ok ? { available: true } : { available: false, reason: supported.reason },
  };
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

/** POST /api/v1/ask/ai and its job routes: same origin and the page's token only. */
function handleAskAi(req: IncomingMessage, res: ServerResponse, url: URL, ctx: ApiContext): void {
  if (!ctx.token) return json(res, { error: 'questions to Claude are turned off' }, 404);
  if (!isLocalOrigin(req.headers.origin, ctx.port) || !sameToken(req.headers['x-prisme-token'], ctx.token))
    return json(res, { error: 'forbidden' }, 403);

  // The question being answered, so a reloaded page can pick it up again.
  if (req.method === 'GET' && url.pathname === '/api/v1/ask/ai/current') return json(res, runningJob());

  const jobMatch = url.pathname.match(/^\/api\/v1\/ask\/ai\/([0-9a-f]{16})$/);
  if (req.method === 'GET' && jobMatch) {
    const job = getJob(jobMatch[1]);
    return job ? json(res, job) : json(res, { error: 'unknown question' }, 404);
  }
  if (req.method !== 'POST' || url.pathname !== '/api/v1/ask/ai') return json(res, { error: 'not found' }, 404);

  let body = '';
  req.setEncoding('utf-8');
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    let data: unknown;
    try { data = JSON.parse(body); } catch { return json(res, { error: 'invalid JSON' }, 400); }
    const checked = validateQuestion((data as { question?: unknown })?.question);
    if ('error' in checked) return json(res, { error: checked.error }, 400);
    const job = startAsk(checked.question, ctx.cwd);
    if ('status' in job) return json(res, { error: job.error, job: job.job }, job.status);
    json(res, job, 202);
  });
}

export function handleApiV1(req: IncomingMessage, res: ServerResponse, ctx: ApiContext): boolean {
  const url = new URL(req.url || '/', 'http://localhost');
  const route = url.pathname;
  if (!route.startsWith('/api/v1/')) return false;

  if (route === '/api/v1/ask/ai' || route.startsWith('/api/v1/ask/ai/')) {
    handleAskAi(req, res, url, ctx);
    return true;
  }
  if (req.method !== 'GET') {
    json(res, { error: 'method not allowed' }, 405);
    return true;
  }

  if (route === '/api/v1/project') {
    json(res, apiProject(ctx));
    return true;
  }

  if (route === '/api/v1/elements') {
    json(res, apiElements(ctx.cwd));
    return true;
  }

  const elementMatch = route.match(/^\/api\/v1\/elements\/(.+)$/);
  if (elementMatch) {
    let wanted = '';
    try { wanted = decodeURIComponent(elementMatch[1]); } catch { /* not found below */ }
    const el = listElements(ctx.cwd).find(e => e.path === wanted);
    if (el) json(res, toApiElement(el, ctx.cwd));
    else json(res, { error: 'element not found' }, 404);
    return true;
  }

  if (route === '/api/v1/guides') {
    json(res, loadGuides(ctx.cwd));
    return true;
  }

  const guideMatch = route.match(/^\/api\/v1\/guides\/([a-z0-9][a-z0-9-]*)$/);
  if (guideMatch) {
    const guide = loadGuides(ctx.cwd).find(g => g.id === guideMatch[1]);
    if (guide) json(res, guide);
    else json(res, { error: 'guide not found' }, 404);
    return true;
  }

  if (route === '/api/v1/ask') {
    const q = url.searchParams.get('q') || '';
    json(res, { query: q, results: searchElements(q, ctx.cwd) });
    return true;
  }

  json(res, { error: 'not found' }, 404);
  return true;
}
