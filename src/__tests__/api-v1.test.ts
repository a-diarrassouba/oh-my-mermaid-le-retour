import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiElements, apiProject, handleApiV1 } from '../server/api-v1.js';
import { agentEnv, buildMap, extractYaml, languageName, stripGuideFlags, validateQuestion } from '../server/ask.js';
import { isLocalHost, isLocalOrigin, sameToken } from '../server/local.js';
import { searchElements } from '../lib/search.js';
import { writeGuide } from '../lib/guides.js';

let dir: string;

const write = (rel: string, content: string) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-api-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  write('.prisme/config.yaml', 'version: 0.1.0\nlanguage: fr\n');
  write('.prisme/arch/diagram.mmd', 'graph LR\n    store["Stockage\\nsrc/store.ts"]\n    cli["CLI\\nsrc/cli.ts"]\n    cli --> store\n    class store store\n');
  write('.prisme/arch/description.md', "Vue d'ensemble.");
  write('.prisme/arch/store/description.md', 'Lit et écrit les fichiers du dossier .prisme.');
  write('.prisme/arch/store/concern.md', 'Pas de verrou entre deux écritures.');
  write('.prisme/arch/cli/description.md', 'Point d’entrée des commandes.');
  write('.prisme/arch/cli/meta.yaml', 'created: 2026-01-01\nupdated: 2026-01-02\nupdate_count: 1\nlast_field: description\ntitle: Ligne de commande\n');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('local-only checks', () => {
  it('accepts this machine through this port only', () => {
    expect(isLocalHost('localhost:3000', 3000)).toBe(true);
    expect(isLocalHost('127.0.0.1:3000', 3000)).toBe(true);
    expect(isLocalHost('evil.example:3000', 3000)).toBe(false);
    expect(isLocalHost('localhost:3001', 3000)).toBe(false);
    expect(isLocalOrigin(undefined, 3000)).toBe(true);
    expect(isLocalOrigin('http://localhost:3000', 3000)).toBe(true);
    expect(isLocalOrigin('https://evil.example', 3000)).toBe(false);
  });

  it('compares tokens exactly', () => {
    expect(sameToken('abc', 'abc')).toBe(true);
    expect(sameToken('abd', 'abc')).toBe(false);
    expect(sameToken(undefined, 'abc')).toBe(false);
    expect(sameToken('abc', null)).toBe(false);
  });
});

describe('/api/v1 data', () => {
  it('lists elements with kind, role, files, title and fields', () => {
    const els = apiElements(dir);
    expect(els.map(e => [e.path, e.kind])).toEqual([['arch', 'perspective'], ['arch/cli', 'leaf'], ['arch/store', 'leaf']]);
    const store = els.find(e => e.path === 'arch/store')!;
    expect(store).toMatchObject({ title: 'Stockage', role: 'store', files: ['src/store.ts'], icon: null, explain: null });
    expect(store.fields.concern).toContain('verrou');
    expect(els.find(e => e.path === 'arch/cli')).toMatchObject({ title: 'Ligne de commande', updated: '2026-01-02' });
  });

  it('describes the project', () => {
    const p = apiProject({ ai: false, cwd: dir });
    expect(p).toMatchObject({
      api: 1, language: 'fr', lastScan: null,
      counts: { perspectives: 1, elements: 3, guides: 0 },
      categories: { understand: { available: true }, security: { available: false }, evolve: { available: false } },
      ai: { available: false },
    });
  });
});

describe('/api/v1 routes', () => {
  const TOKEN = 'x'.repeat(48);
  let server: http.Server;
  let port: number;
  const get = (route: string, headers: Record<string, string> = {}, method = 'GET', body?: string) =>
    new Promise<{ status: number; data: any }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, res => {
        let text = '';
        res.on('data', c => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode!, data: JSON.parse(text) }));
      });
      req.on('error', reject);
      req.end(body);
    });

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      if (!handleApiV1(req, res, { port, token: TOKEN, ai: true, cwd: dir })) { res.writeHead(418); res.end('{}'); }
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise<void>(r => server.close(() => r())));

  it('serves one element by path, and 404 for an unknown one', async () => {
    expect((await get('/api/v1/elements/arch/store')).data.path).toBe('arch/store');
    expect((await get('/api/v1/elements/arch/nope')).status).toBe(404);
    expect((await get('/api/v1/elements/..%2F..%2Fetc')).status).toBe(404);
  });

  it('serves guides and search', async () => {
    writeGuide('demo', 'title: Démo\nkind: path\nsteps:\n  - element: arch/store\n    say: Le stockage.\n', dir);
    expect((await get('/api/v1/guides')).data.map((g: { id: string }) => g.id)).toEqual(['demo']);
    expect((await get('/api/v1/guides/demo')).data.valid).toBe(true);
    expect((await get('/api/v1/ask?q=verrou')).data.results[0].cls).toBe('arch/store');
  });

  it('refuses questions to Claude without the token or from another site', async () => {
    const question = JSON.stringify({ question: 'Comment ça marche ?' });
    expect((await get('/api/v1/ask/ai', {}, 'POST', question)).status).toBe(403);
    expect((await get('/api/v1/ask/ai', { 'X-Prisme-Token': TOKEN, Origin: 'https://evil.example' }, 'POST', question)).status).toBe(403);
    expect((await get('/api/v1/ask/ai', { 'X-Prisme-Token': TOKEN }, 'POST', '{"question":"?"}')).status).toBe(400);
    expect((await get('/api/v1/ask/ai/current', { 'X-Prisme-Token': TOKEN })).data).toBeNull();
  });

  it('only reads', async () => {
    expect((await get('/api/v1/elements', {}, 'POST')).status).toBe(405);
  });
});

describe('questions to Claude', () => {
  it('checks the question', () => {
    expect(validateQuestion('  Comment   marche le scan ? ')).toEqual({ question: 'Comment marche le scan ?' });
    expect(validateQuestion('?')).toHaveProperty('error');
    expect(validateQuestion('x'.repeat(301))).toHaveProperty('error');
    expect(validateQuestion(42)).toHaveProperty('error');
  });

  it('builds the map from .prisme/ within budget', () => {
    const map = buildMap(dir);
    expect(map).toContain('## arch/store');
    expect(map).toContain('```mermaid');
    expect(buildMap(dir, 40)).toMatch(/map truncated: \d+ more elements/);
  });

  it('reads the guide from the answer and drops start and after', () => {
    const yaml = 'title: T\nkind: path\nstart: true\nafter: [x]\nsteps:\n  - element: arch\n    say: s\n';
    expect(extractYaml('```yaml\n' + yaml + '```')).toBe(yaml);
    expect(stripGuideFlags(yaml)).not.toMatch(/start|after/);
  });

  it('names the language and cleans the session variables', () => {
    expect(languageName('fr')).toBe('French');
    expect(agentEnv({ CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'x', PATH: '/bin' })).toEqual({ PATH: '/bin' });
  });
});

describe('search', () => {
  it('ignores accents and stopwords, and matches titles', () => {
    const results = searchElements('ecrit les fichiers', dir);
    expect(results[0].cls).toBe('arch/store');
    expect(searchElements('le la les', dir)).toEqual([]);
    expect(searchElements('ligne commande', dir)[0]).toMatchObject({ cls: 'arch/cli', title: 'Ligne de commande' });
  });
});
