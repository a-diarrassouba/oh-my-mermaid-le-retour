import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mask, readSecurityReport, runSecurity, scanText, scoreFindings, writeSecurityReport, type Finding } from '../lib/security.js';

// Fake secrets are built in pieces, so this file does not trip the checks itself.
const AWS = 'AKIA' + 'Q3EXAMPLEKEY7ZZZ'.replace('EXAMPLE', 'ABCDEFG');
const GH = 'ghp' + '_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';

let dir: string;
const write = (rel: string, content: string) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, stdio: 'pipe' });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-security-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const rules = (fs: Finding[]) => fs.map(f => f.rule);

describe('scanText', () => {
  it('finds secrets and masks them', () => {
    const found = scanText('src/config.ts', `const key = "${AWS}";\nconst gh = '${GH}';\n`);
    expect(rules(found)).toEqual(['secret-in-code', 'secret-in-code']);
    expect(found[0]).toMatchObject({ line: 1, severity: 'critical' });
    expect(found.map(f => f.match).join(' ')).not.toContain(AWS);
    expect(mask(AWS)).toBe('AKIA…ZZ');
  });

  it('flags a hard-coded password, not a placeholder', () => {
    expect(rules(scanText('app.py', 'DB_PASSWORD = "Xk9#mP2$vL7qR4tW"\n'))).toEqual(['password-in-code']);
    expect(scanText('app.py', 'DB_PASSWORD = "changeme-please"\n')).toEqual([]);
    expect(scanText('app.py', 'password = os.environ["DB_PASSWORD_VALUE"]\n')).toEqual([]);
  });

  it('flags risky code', () => {
    const text = [
      'https.request({ rejectUnauthorized: false })',
      'exec(`ls ${dir}`)',
      'db.query(`SELECT * FROM users WHERE id = ${id}`)',
      'process.stderr.write(`update failed: ${err}`)',
      'const fn = new Function(body)',
      'const token = Math.random().toString(36)',
      'el.innerHTML = html',
      "el.innerHTML = ''",
    ].join('\n');
    expect(rules(scanText('src/a.ts', text))).toEqual(['tls-disabled', 'command-injection', 'sql-injection', 'code-eval', 'weak-random', 'html-injection']);
    expect(rules(scanText('app.py', 'data = yaml.load(f)\nsafe = yaml.load(f, Loader=yaml.SafeLoader)\n'))).toEqual(['unsafe-deserialize']);
  });

  it('weighs less in tests', () => {
    expect(scanText('src/__tests__/a.test.ts', `const k = "${AWS}";`)[0].severity).toBe('medium');
    expect(scanText('src/__tests__/a.test.ts', 'const fn = new Function(body);\nel.innerHTML = html;')).toEqual([]);
  });
});

describe('score', () => {
  const f = (rule: string, severity: Finding['severity']): Finding => ({ rule, severity, title: '', why: '', fix: '', source: 'prisme' });
  it('grades from A to E and caps one rule', () => {
    expect(scoreFindings([])).toEqual({ score: 100, grade: 'A' });
    expect(scoreFindings(Array(30).fill(f('html-injection', 'low')))).toEqual({ score: 96, grade: 'A' });
    expect(scoreFindings([f('code-eval', 'medium'), f('sql-injection', 'medium')]).grade).toBe('B');
    expect(scoreFindings([f('tls-disabled', 'high')]).grade).toBe('C');
    expect(scoreFindings([f('secret-in-code', 'critical')]).grade).toBe('D');
    expect(scoreFindings([f('secret-in-code', 'critical'), f('secret-in-code', 'critical'), f('env-committed', 'critical')]).grade).toBe('E');
  });
});

describe('runSecurity', () => {
  it('checks the repository and writes a report without secrets', () => {
    write('src/server.ts', `const key = "${AWS}";\nrequire('dotenv').config();\n`);
    write('.env', 'API_KEY=abc\n');
    write('.gitignore', 'node_modules\n');
    write('Dockerfile', 'FROM node:22\nCMD ["node", "x"]\n');
    write('package.json', JSON.stringify({ dependencies: { express: '^4' } }));
    write('.github/workflows/ci.yml', 'on: pull_request_target\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n');
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
    const report = runSecurity(dir, { tools: false });
    expect(new Set(rules(report.findings))).toEqual(new Set(['secret-in-code', 'env-committed', 'env-not-ignored', 'docker-root', 'workflow-pr-target', 'no-lockfile', 'workflow-permissions', 'no-dependency-updates', 'no-security-policy']));
    expect(report.grade).toBe('E');
    expect(report.counts.critical).toBe(2);
    expect(report.tools.every(t => t.status === 'skipped')).toBe(true);
    writeSecurityReport(report, dir);
    expect(fs.readFileSync(path.join(dir, '.prisme/.reports/security.json'), 'utf-8')).not.toContain(AWS);
    expect(readSecurityReport(dir)?.grade).toBe('E');
  });

  it('gives A to a clean project, in the project language', () => {
    write('.prisme/config.yaml', 'version: 0.1.0\nlanguage: fr\n');
    write('src/a.ts', 'export const a = 1;\n');
    write('src/b.ts', 'el.innerHTML = html;\n');
    const report = runSecurity(dir, { tools: false });
    expect(report.grade).toBe('A');
    expect(report.findings[0].title).toBe('Du HTML est inséré sans nettoyage');
  });
});

describe('ignored findings', () => {
  it('leaves out what .prisme/security.yaml lists, with the reason', () => {
    write('src/a.ts', 'el.innerHTML = html;\nexec(`ls ${dir}`);\n');
    write('.prisme/security.yaml', 'ignore:\n  - rule: html-injection\n    file: src/\n    reason: escaped before\n  - rule: command-injection\n    reason: ""\n');
    const report = runSecurity(dir, { tools: false });
    expect(report.findings.map(f => f.rule)).toEqual(['command-injection']);
    expect(report.ignored).toMatchObject([{ rule: 'html-injection', reason: 'escaped before' }]);
  });
});

describe('sharper checks', () => {
  it('knows many kinds of keys, once each, and passwords in database addresses', () => {
    const gitlab = 'glpat' + '-' + 'a1B2c3D4e5F6g7H8i9J0';
    const hf = 'hf' + '_' + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ';
    const slackHook = 'https://hooks.slack.com/services/' + 'T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
    const found = scanText('src/config.ts', [
      `const a = "${gitlab}";`,
      `const b = "${hf}";`,
      `const c = "${slackHook}";`,
      'const db = "postgres://app:S3cr3tPw@db.internal:5432/app";',
      'const local = "postgres://app:password@localhost/app";',
      'const env = `postgres://app:${process.env.PW}@db/app`;',
    ].join('\n'));
    expect(found.map(f => f.match?.split(':')[0])).toEqual(['GitLab token', 'Hugging Face token', 'Slack webhook', 'postgres']);
    expect(found.map(f => f.rule)).toEqual(['secret-in-code', 'secret-in-code', 'secret-in-code', 'connection-string']);
    expect(found.map(f => f.match).join(' ')).not.toContain('S3cr3tPw');
    expect(found[0].owasp).toBe('A07:2021 Identification and Authentication Failures');
  });

  it('flags risky request handling and crypto', () => {
    const text = [
      'res.sendFile(path.join(__dirname, req.params.name));',
      'res.redirect(req.query.next);',
      "const c = crypto.createCipher('aes192', key);",
      'jwt.decode(token, options={"verify_signature": False})',
    ].join('\n');
    expect(scanText('src/app.ts', text).map(f => [f.rule, f.owasp?.slice(0, 3)])).toEqual([
      ['path-traversal', 'A01'], ['open-redirect', 'A01'], ['weak-crypto', 'A02'], ['jwt-unverified', 'A07'],
    ]);
  });

  it('checks CI workflows, Docker images and downloads like OpenSSF Scorecard', () => {
    write('package.json', JSON.stringify({ dependencies: { a: '1' } }));
    write('package-lock.json', '{}');
    write('SECURITY.md', 'Report privately.');
    write('.github/dependabot.yml', 'version: 2');
    write('.github/workflows/ok.yml', 'on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: owner/tool@0123456789abcdef0123456789abcdef01234567\n      - run: npm ci\n      - env:\n          TITLE: ${{ github.event.issue.title }}\n        run: echo "$TITLE"\n');
    write('.github/workflows/bad.yml', 'on: issues\njobs:\n  a:\n    steps:\n      - uses: someone/action@v2\n      - run: npm install\n      - run: echo "${{ github.event.issue.title }}"\n');
    write('Dockerfile', 'FROM node AS build\nRUN curl -fsSL https://get.example.com | sh\nRUN wget http://example.com/tool.tgz\nFROM build\nUSER app\n');
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
    const report = runSecurity(dir, { tools: false });
    const got = report.findings.map(f => `${f.rule} ${f.file}${f.line ? ':' + f.line : ''}`).sort();
    expect(got).toEqual([
      'ci-install-unlocked .github/workflows/bad.yml:6',
      'docker-latest Dockerfile:1',
      'insecure-download Dockerfile:3',
      'remote-script Dockerfile:2',
      'unpinned-action .github/workflows/bad.yml',
      'workflow-permissions .github/workflows/bad.yml',
      'workflow-script-injection .github/workflows/bad.yml:7',
    ]);
  });
});

describe('docs', () => {
  it('only look for secrets in documentation', () => {
    expect(scanText('docs/api.md', '"match": "rejectUnauthorized: false"\nel.innerHTML = x')).toEqual([]);
    expect(scanText('docs/setup.md', `export KEY=${AWS}`).map(f => f.rule)).toEqual(['secret-in-code']);
  });
});

describe('paths with accents', () => {
  it('come back from git as they are', async () => {
    const { projectFiles } = await import('../lib/security.js');
    write('1 - Spécifications/cahier.md', '# cahier');
    git('init', '-q');
    git('add', '-A');
    expect(projectFiles(dir)).toContain('1 - Spécifications/cahier.md');
  });
});
