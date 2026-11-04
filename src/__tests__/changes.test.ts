import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { computeChanges, markScanned, resolveLocations } from '../lib/changes.js';
import { diagramNodes, labelLocations, listElements } from '../lib/elements.js';
import { writeGuide } from '../lib/guides.js';

let dir: string;

const write = (rel: string, content: string) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, stdio: 'pipe' }).toString();

const ARCH = `graph LR
    a["Alpha\\nsrc/a.ts"]
    b["Beta\\nsrc/b/"]
    c["Gamma\\nsrc/c.ts, d.ts"]
    ext["Service\\napi.example.com"]
    a -->|"calls"| b
    b --> ext
    classDef entry fill:#89b4fa
    class a entry
    class ext external
`;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-changes-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  write('src/a.ts', 'a');
  write('src/b/one.ts', 'one');
  write('src/c.ts', 'c');
  write('src/d.ts', 'd');
  write('README.md', '# demo');
  write('package.json', '{}');
  write('.prisme/arch/diagram.mmd', ARCH);
  write('.prisme/arch/description.md', 'arch');
  for (const id of ['a', 'b', 'c', 'ext']) write(`.prisme/arch/${id}/description.md`, id);
  write('.prisme/operations/description.md', 'ops');
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'init');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('elements', () => {
  it('reads labels, locations and roles from the parent diagram', () => {
    const nodes = diagramNodes(ARCH);
    expect(nodes.get('a')).toEqual({ label: 'Alpha\\nsrc/a.ts', role: 'entry' });
    expect(nodes.get('ext')?.role).toBe('external');
    expect(labelLocations('Gamma\\nsrc/c.ts, d.ts')).toEqual(['src/c.ts', 'd.ts']);
    const els = listElements(dir);
    expect(els.map(e => e.path)).toEqual(['arch', 'arch/a', 'arch/b', 'arch/c', 'arch/ext', 'operations']);
    expect(els.find(e => e.path === 'arch/b')?.locations).toEqual(['src/b/']);
  });

  it('reads a bare name in the folder of the path before it, and drops what is not a path', () => {
    const known = (p: string) => ['src/c.ts', 'src/d.ts', 'src/b/'].includes(p);
    expect(resolveLocations(['src/c.ts', 'd.ts', 'api.example.com', '?'], known)).toEqual(['src/c.ts', 'src/d.ts']);
  });
});

describe('computeChanges', () => {
  it('recommends a full scan when no scan was recorded', () => {
    expect(computeChanges(dir)).toMatchObject({ recommend: 'full', reason: 'no-previous-scan' });
  });

  it('finds nothing to rescan right after a scan', () => {
    markScanned(dir);
    expect(computeChanges(dir)).toMatchObject({ recommend: 'none', reason: 'no-changes', changed: [] });
  });

  it('lists changed elements, new files, removed paths, onboarding perspectives and guides', () => {
    markScanned(dir);
    writeGuide('tour', 'title: T\nkind: path\nsteps:\n  - element: arch/a\n    say: x\n', dir);
    write('src/a.ts', 'a changed');
    write('src/new.ts', 'new');
    fs.rmSync(path.join(dir, 'src/d.ts'));
    write('package.json', '{"name":"x"}');
    const r = computeChanges(dir);
    expect(r.changed).toEqual([
      { path: 'arch/a', files: ['src/a.ts'] },
      { path: 'arch/c', files: ['src/d.ts'] },
    ]);
    expect(r.orphans).toEqual(['src/new.ts']);
    expect(r.removed).toEqual([{ path: 'arch/c', location: 'src/d.ts' }]);
    // package.json feeds operations and security; only operations exists here.
    expect(r.onboarding).toEqual(['operations']);
    expect(r.guides).toEqual(['tour']);
    expect(r.recommend).toBe('partial');
  });

  it('sees committed changes too, not only the working tree', () => {
    markScanned(dir);
    write('src/b/two.ts', 'two');
    git('add', '-A');
    git('commit', '-qm', 'more');
    const r = computeChanges(dir);
    expect(r.changed).toEqual([{ path: 'arch/b', files: ['src/b/two.ts'] }]);
    expect(r.orphans).toEqual([]);
  });

  it('recommends a full scan when more than a third of the elements changed', () => {
    markScanned(dir);
    write('src/a.ts', 'x');
    write('src/b/one.ts', 'x');
    write('src/c.ts', 'x');
    expect(computeChanges(dir)).toMatchObject({ recommend: 'full', reason: 'too-many-changes' });
  });

  it('recommends a full scan when the recorded commit is gone', () => {
    write('.prisme/config.yaml', 'version: 0.1.0\nlast_scan:\n  commit: 0123456789abcdef0123456789abcdef01234567\n  date: 2026-01-01\n');
    expect(computeChanges(dir)).toMatchObject({ recommend: 'full', reason: 'base-missing' });
  });

  it('recommends a full scan outside a git repository', () => {
    fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
    expect(computeChanges(dir)).toMatchObject({ recommend: 'full', reason: 'not-git' });
    expect(markScanned(dir)).toBeNull();
  });
});
