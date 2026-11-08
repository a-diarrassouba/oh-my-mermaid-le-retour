import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readProjectFile, parseLineRange } from '../lib/project-files.js';
import { writeGuide, loadGuide } from '../lib/guides.js';
import { buildClaudeArgs, withQuestion } from '../server/ask.js';
import { handleApiV1 } from '../server/api-v1.js';

let dir: string;
const write = (rel: string, content: string) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-ask-')));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  write('src/store.ts', Array.from({ length: 30 }, (_, i) => `// line ${i + 1}`).join('\n') + '\n');
  write('.env', 'SECRET=1\n');
  write('.prisme/arch/diagram.mmd', 'graph LR\n    store["Store\\nsrc/store.ts"]\n');
  write('.prisme/arch/description.md', 'arch');
  write('.prisme/arch/store/description.md', 'store');
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('project files', () => {
  it('reads a text file of the project, never secrets, parents or symlinks', () => {
    expect(readProjectFile('src/store.ts', dir)).toMatchObject({ path: 'src/store.ts', lines: 30 });
    expect(readProjectFile('./src/store.ts', dir)).toMatchObject({ path: 'src/store.ts' });
    expect(readProjectFile('.env', dir)).toHaveProperty('error');
    expect(readProjectFile('../x', dir)).toHaveProperty('error');
    expect(readProjectFile('/etc/hosts', dir)).toHaveProperty('error');
    expect(readProjectFile('.git/config', dir)).toHaveProperty('error');
    fs.symlinkSync(path.join(dir, '.env'), path.join(dir, 'src/link.ts'));
    expect(readProjectFile('src/link.ts', dir)).toHaveProperty('error');
    expect(readProjectFile('src/nope.ts', dir)).toHaveProperty('error');
  });

  it('reads line ranges', () => {
    expect(parseLineRange('12-40')).toEqual({ start: 12, end: 40 });
    expect(parseLineRange(7)).toEqual({ start: 7, end: 7 });
    expect(parseLineRange('40-12')).toBeNull();
    expect(parseLineRange('a')).toBeNull();
  });
});

describe('guide steps that show a file', () => {
  it('accepts a file and lines that exist, and keeps the question', () => {
    const yaml = 'title: Où ?\nkind: path\nquestion: "Où est le store ?"\nsteps:\n  - element: arch/store\n    say: Ici.\n    file: { path: src/store.ts, lines: "3-8" }\n  - element: arch\n    say: Vue.\n    file: src/store.ts\n';
    expect(writeGuide('ask-a', yaml, dir).written).toBe(true);
    const g = loadGuide('ask-a', dir)!.guide!;
    expect(g.question).toBe('Où est le store ?');
    expect(g.steps.map(s => s.file)).toEqual([{ path: 'src/store.ts', lines: '3-8' }, { path: 'src/store.ts' }]);
  });

  it('refuses secrets, missing files and lines past the end', () => {
    const step = (file: string) => `title: x\nkind: path\nsteps:\n  - element: arch/store\n    say: x\n    file: ${file}\n`;
    expect(writeGuide('ask-b', step('{ path: .env }'), dir).issues[0].message).toMatch(/secrets/);
    expect(writeGuide('ask-b', step('{ path: src/store.ts, lines: "25-40" }'), dir).issues[0].message).toMatch(/30 lines/);
    expect(writeGuide('ask-b', step('{ path: src/store.ts, lines: "x" }'), dir).issues[0].rule).toBe('file');
    expect(writeGuide('ask-b', step('src/missing.ts'), dir).written).toBe(false);
  });
});

describe('Claude for questions', () => {
  it('may only read, and never secrets', () => {
    const args = buildClaudeArgs('skill');
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Grep,Glob');
    expect(args).toContain('--restricted');
    const deny = JSON.parse(args[args.indexOf('--settings') + 1]).permissions.deny as string[];
    expect(deny).toEqual(expect.arrayContaining(['Read(**/.env)', 'Grep(**/.env.production)', 'Read(**/*.pem)']));
    expect(deny.some(d => d.includes('example'))).toBe(false);
  });

  it('records the question in the guide', () => {
    expect(withQuestion('title: T\nsteps: []\n', 'Pourquoi ?')).toContain('question: Pourquoi ?');
  });
});

describe('routes for the page', () => {
  const TOKEN = 'y'.repeat(48);
  let server: http.Server;
  let port: number;
  const call = (route: string, method = 'GET', headers: Record<string, string> = {}) =>
    new Promise<{ status: number; data: any }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, res => {
        let text = '';
        res.on('data', c => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode!, data: JSON.parse(text) }));
      });
      req.on('error', reject);
      req.end();
    });

  beforeEach(async () => {
    server = http.createServer((req, res) => { handleApiV1(req, res, { port, token: TOKEN, ai: false, cwd: dir }); });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise<void>(r => server.close(() => r())));

  it('serves a file, not a secret', async () => {
    expect((await call('/api/v1/file?path=src/store.ts')).data.lines).toBe(30);
    expect((await call('/api/v1/file?path=.env')).status).toBe(404);
  });

  it('deletes an answer and runs the security check only for the page', async () => {
    writeGuide('ask-c', 'title: x\nkind: path\nquestion: q\nsteps:\n  - element: arch\n    say: x\n', dir);
    expect((await call('/api/v1/guides/ask-c', 'DELETE')).status).toBe(403);
    expect((await call('/api/v1/guides/ask-c', 'DELETE', { 'X-Prisme-Token': TOKEN })).data).toEqual({ deleted: 'ask-c' });
    expect((await call('/api/v1/security/run', 'POST')).status).toBe(403);
    expect((await call('/api/v1/security/run', 'POST', { 'X-Prisme-Token': TOKEN, Origin: 'https://evil.example' })).status).toBe(403);
  });
});
