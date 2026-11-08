import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildAuditArgs, buildAuditPrompt, eventsFromLine } from '../server/audit-job.js';
import { handleApiV1 } from '../server/api-v1.js';

describe('audit from the viewer', () => {
  it('lets Claude read and run only the audit commands, never secrets', () => {
    const args = buildAuditArgs('skill');
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Grep,Glob,Bash,Agent,Write');
    // Writing is allowed in the drafts folder only.
    expect(args.filter(a => /^(Write|Edit)\(/.test(a))).toEqual(['Write(./.prisme/.drafts/**)', 'Edit(./.prisme/.drafts/**)']);
    expect(args).toEqual(expect.arrayContaining(['Bash(prisme security:*)', 'Bash(git ls-files:*)', 'Bash(npm audit:*)', '--restricted', 'stream-json']));
    expect(args.some(a => /Bash\((rm|curl|npm install|git push)/.test(a))).toBe(false);
    const deny = JSON.parse(args[args.indexOf('--settings') + 1]).permissions.deny as string[];
    expect(deny).toContain('Read(**/.env)');
    expect(buildAuditPrompt('French')).toMatch(/Skip Step 10: change no code/);
  });

  it('turns Claude\'s stream into steps and actions', () => {
    const line = JSON.stringify({ type: 'assistant', message: { content: [
      { type: 'text', text: 'STEP 3\nReviewing access control.' },
      { type: 'tool_use', name: 'Read', input: { file_path: '/repo/src/a.ts' } },
      { type: 'tool_use', name: 'Grep', input: { pattern: 'findUnique' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'prisme security --json --no-tools\nmore' } },
    ] } });
    expect(eventsFromLine(line, 1).map(e => [e.kind, e.text])).toEqual([
      ['step', '3'], ['note', 'Reviewing access control.'], ['read', '/repo/src/a.ts'], ['search', 'findUnique'], ['run', 'prisme security --json --no-tools'],
    ]);
    expect(eventsFromLine('not json')).toEqual([]);
    expect(eventsFromLine(JSON.stringify({ type: 'result', result: 'DONE' }))).toEqual([]);
  });

  it('only answers the page, and not when questions to Claude are off', async () => {
    const TOKEN = 'z'.repeat(48);
    let ai = false;
    const server = http.createServer((req, res) => { handleApiV1(req, res, { port, token: TOKEN, ai, cwd: process.cwd() }); });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    const call = (method: string, headers: Record<string, string> = {}) => new Promise<number>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/v1/security/audit', method, headers }, res => { res.resume(); resolve(res.statusCode!); });
      req.on('error', reject);
      req.end();
    });
    expect(await call('POST', { 'X-Prisme-Token': TOKEN })).toBe(404);
    ai = true;
    expect(await call('POST')).toBe(403);
    expect(await call('GET', { 'X-Prisme-Token': TOKEN, Origin: 'https://evil.example' })).toBe(403);
    expect(await call('GET', { 'X-Prisme-Token': TOKEN })).toBe(200);
    await new Promise<void>(r => server.close(() => r()));
  });
});
