import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gradeAudit, parseAudit, readAudit, writeAudit, AREAS } from '../lib/audit.js';
import { apiAudit, apiProject } from '../server/api-v1.js';

let dir: string;
const write = (rel: string, content: string) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-audit-')));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  write('src/routes/tickets.ts', Array.from({ length: 60 }, (_, i) => `// ${i + 1}`).join('\n') + '\n');
  write('src/routes/comments.ts', '// comments\n');
  write('.gitignore', '.claude/\n');
  write('.claude/worktrees/copy/src/routes/tickets.ts', '// copy\n');
  write('.prisme/arch/diagram.mmd', 'graph LR\n    api["API\\nsrc/routes/"]\n');
  write('.prisme/arch/description.md', 'arch');
  write('.prisme/arch/api/description.md', 'api');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const checked = (overrides: Record<string, string> = {}) =>
  'checked:\n' + AREAS.map(a => `  - area: ${a}\n    status: ${overrides[a] ?? 'ok'}\n    note: "Vu."\n`).join('');

const finding = (extra = '') => `findings:
  - title: "Un utilisateur lit les tickets des autres"
    severity: high
    area: access-control
    owasp: A01
    file: src/routes/tickets.ts
    lines: "40-58"
    what: "La route charge le ticket sans vérifier son propriétaire."
    impact: "Un client voit les tickets des autres entreprises."
    evidence: "tickets.ts:44 findUnique({ where: { id } }) sans ownerId."
    fix: "Filtrer par ownerId."
    effort: small
    also: [src/routes/comments.ts]
${extra}`;

const GOOD = `summary: "Une faille d'accès à corriger en premier."
${finding()}dismissed:
  - title: "Mot de passe dans .env.example"
    file: .env.example
    reason: "Fichier d'exemple."
${checked({ 'access-control': 'issues' })}`;

describe('security audit', () => {
  it('grades from the confirmed flaws, always the same way', () => {
    expect(gradeAudit([])).toEqual({ score: 100, grade: 'A' });
    expect(gradeAudit(Array(20).fill({ severity: 'low' }))).toEqual({ score: 90, grade: 'A' });
    expect(gradeAudit(Array(10).fill({ severity: 'medium' }))).toEqual({ score: 70, grade: 'C' });
    expect(gradeAudit([{ severity: 'high' }])).toEqual({ score: 85, grade: 'C' });
    expect(gradeAudit([{ severity: 'critical' }])).toEqual({ score: 70, grade: 'D' });
    expect(gradeAudit([{ severity: 'critical' }, { severity: 'critical' }, { severity: 'high' }])).toEqual({ score: 25, grade: 'E' });
  });

  it('stores an audit of this repository and serves it', () => {
    expect(parseAudit(GOOD, dir).issues).toEqual([]);
    const { written, report } = writeAudit(GOOD, dir);
    expect(written).toBe(true);
    expect(report).toMatchObject({ kind: 'audit', grade: 'C', score: 85, counts: { high: 1 }, files: 3 });
    expect(readAudit(dir)?.dismissed[0].reason).toBe("Fichier d'exemple.");
    expect(apiAudit(dir)?.findings[0].elements).toEqual(['arch/api']);
    expect(apiProject({ ai: false, cwd: dir }).categories.security).toMatchObject({ available: true, grade: 'C', dismissed: 1 });
  });

  it('refuses files outside the repository, wrong lines and missing areas', () => {
    const bad = GOOD
      .replace('file: src/routes/tickets.ts', 'file: .claude/worktrees/copy/src/routes/tickets.ts')
      .replace('also: [src/routes/comments.ts]', 'also: [node_modules/x/index.js]')
      .replace(/  - area: dos\n    status: ok\n    note: "Vu."\n/, '');
    const { written, issues } = writeAudit(bad, dir);
    expect(written).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('".claude/worktrees/copy/src/routes/tickets.ts" is not a file of this repository'),
      expect.stringContaining('"node_modules/x/index.js" is not a file of this repository'),
      expect.stringContaining('missing: dos'),
    ]));
    expect(writeAudit(GOOD.replace('"40-58"', '"40-99"'), dir).issues[0]).toMatch(/has 60 lines, not 99/);
    expect(writeAudit(GOOD.replace('status: issues', 'status: ok'), dir).issues[0]).toMatch(/area "access-control" is "ok"/);
    expect(readAudit(dir)).toBeNull();
  });
});
