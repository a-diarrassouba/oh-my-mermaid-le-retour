import { describe, it, expect } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildAuditArgs, buildAuditPrompt, eventsFromLine } from '../server/skill-jobs.js';
import { handleApiV1 } from '../server/api-v1.js';

describe('audit from the viewer', () => {
  it('lets Claude read and run only the audit commands, never secrets', () => {
    const args = buildAuditArgs('skill');
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Grep,Glob,Bash,Write,Agent');
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

describe('make it evolve from the viewer', () => {
  it('keeps the web phase away from the project, and the code phase away from the web', async () => {
    const { readingArgs, webArgs, EVOLVE_COMMANDS } = await import('../server/skill-jobs.js');
    const web = webArgs('skill');
    expect(web[web.indexOf('--tools') + 1]).toBe('WebSearch,WebFetch,Write');
    expect(web.some(a => /^(Read|Grep|Glob|Bash)\b/.test(a))).toBe(false);
    expect(web.filter(a => /^(Write|Edit)\(/.test(a))).toEqual(['Write(./.prisme/.drafts/**)', 'Edit(./.prisme/.drafts/**)']);
    const code = readingArgs('skill', EVOLVE_COMMANDS, false);
    expect(code[code.indexOf('--tools') + 1]).toBe('Read,Grep,Glob,Bash,Write');
    expect(code.some(a => /^Web/.test(a))).toBe(false);
  });

  it('merges both drafts and saves them through the same checks', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { finishEvolve } = await import('../server/skill-jobs.js');
    const { readEvolve } = await import('../lib/evolve.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-evo-job-'));
    const w = (rel: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
    w('.prisme/arch/description.md', 'arch');
    w('.prisme/.drafts/evolve-code.yaml', 'summary: "Deux idées."\ncode:\n  - kind: speed\n    title: "Cache"\n    why: "Plus vite."\n    how: "Garder en mémoire."\n    effort: small\n    impact: high\n');
    w('.prisme/.drafts/evolve-market.yaml', 'market:\n  products:\n    - {name: A, url: "https://a.example.com", what: "w", similar: "s"}\n  ideas: []\n');
    w('.prisme/.drafts/evolve-brief.md', 'Un outil.');
    expect(finishEvolve(dir)).toBeNull();
    expect(readEvolve(dir)).toMatchObject({ code: [{ title: 'Cache' }], market: { products: [{ name: 'A' }] } });
    expect(fs.readdirSync(path.join(dir, '.prisme/.drafts'))).toEqual([]);
    expect(finishEvolve(dir)).toMatch(/without writing the ideas/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('skill instructions', () => {
  it('never ask for combined shell commands, refused from the viewer', async () => {
    const fs = await import('node:fs');
    for (const skill of ['prisme-security', 'prisme-evolve']) {
      const text = fs.readFileSync(`skills/${skill}/SKILL.md`, 'utf-8');
      const blocks = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);
      for (const block of blocks) for (const line of block.split('\n').filter(Boolean))
        expect(line, `${skill}: ${line}`).not.toMatch(/&&|;\s|\s\|\s|2>/);
    }
    expect(buildAuditPrompt('French')).toMatch(/Run each shell command on its own/);
  });
});
