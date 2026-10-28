import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { listClasses } from '../lib/store.js';
import {
  deleteGuide,
  guideParts,
  diagramGraph,
  listGuideIds,
  loadGuides,
  parseStepEdge,
  parseGuide,
  validateGuide,
  writeGuide,
  type Guide,
} from '../lib/guides.js';

let tmpDir: string;

const FLOW = `graph LR
    a["Alpha\\nsrc/a.ts"]
    a -->|"calls"| b
    b -- "writes" --> c
    c --> d --> a
    classDef entry fill:#89b4fa,stroke:#89b4fa,color:#1e1e2e
    class a entry
`;

function write(rel: string, content: string) {
  const file = path.join(tmpDir, '.omm', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function guide(fields: Partial<Guide>): Guide {
  return { id: 't', title: 'T', kind: 'path', audience: 'developer', steps: [], ...fields };
}

const errorsOf = (issues: { level: string; rule: string }[]) =>
  issues.filter(i => i.level === 'error').map(i => i.rule);
const warningsOf = (issues: { level: string; rule: string }[]) =>
  issues.filter(i => i.level === 'warning').map(i => i.rule);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-guides-'));
  write('flow/diagram.mmd', FLOW);
  for (const id of ['a', 'b', 'c', 'd']) write(`flow/${id}/description.md`, id);
  write('other/description.md', 'no diagram');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diagramGraph', () => {
  it('reads labeled edges and quoted labels', () => {
    const { nodes, edges } = diagramGraph(FLOW);
    expect([...edges].sort()).toEqual(['a->b', 'b->c', 'c->d']);
    expect([...nodes].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  // Guides may only point at edges the viewer draws (parseFlowchart in viewer.html).
  it('reads edges exactly as the viewer draws them', () => {
    const edgesOf = (line: string) => [...diagramGraph(`graph LR\n${line}`).edges];
    expect(edgesOf('c --> d --> a')).toEqual(['c->d']);
    expect(edgesOf('a -.-> b')).toEqual(['a->b']);
    expect(edgesOf('a ==> b')).toEqual(['a->b']);
    expect(edgesOf('@auth --> b["B"]')).toEqual(['auth->b']);
    expect(edgesOf('a & b --> c')).toEqual([]);
    expect(edgesOf('a["x --> y"]')).toEqual([]);
    expect(edgesOf('a -- calls --> b')).toEqual([]);
  });

  it('reads a step edge only when both ends are plain ids', () => {
    expect(parseStepEdge('a --> b')).toEqual({ from: 'a', to: 'b' });
    expect(parseStepEdge('a -->|calls| b')).toEqual({ from: 'a', to: 'b' });
    expect(parseStepEdge('a["A"] --> b')).toBeNull();
    expect(parseStepEdge('a')).toBeNull();
  });
});

describe('parseGuide', () => {
  it('accepts a minimal guide and fills defaults', () => {
    const { guide: t, issues } = parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: Hi\n');
    expect(issues).toEqual([]);
    expect(t?.audience).toBe('developer');
    expect(t?.steps[0]).toEqual({ element: 'flow', edge: undefined, focus: undefined, say: 'Hi' });
  });

  it('refuses a guide that cannot be used', () => {
    expect(errorsOf(parseGuide('t', 'kind: walk\nsteps: []\n').issues)).toEqual(['title', 'kind', 'steps']);
    expect(errorsOf(parseGuide('t', 'title: [').issues)).toEqual(['yaml']);
    expect(errorsOf(parseGuide('Bad_Id', 'title: T').issues)).toEqual(['guide-id']);
    expect(parseGuide('t', 'title: T\nkind: path\nsteps:\n  - say: x\n').guide).toBeNull();
    expect(errorsOf(parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: 3\n    say: [x]\n').issues)).toEqual(['element', 'say']);
    expect(errorsOf(parseGuide('t', 'title: T\nkind: path\nsteps:\n  - null\n').issues)).toEqual(['step']);
  });

  it('reads optional details, and refuses details that are not text', () => {
    const ok = parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: Hi\n    details: |\n      First paragraph.\n\n      Second one.\n');
    expect(ok.issues).toEqual([]);
    expect(ok.guide?.steps[0].details).toBe('First paragraph.\n\nSecond one.');
    const blank = parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: Hi\n    details: "  "\n');
    expect(blank.guide?.steps[0]).not.toHaveProperty('details');
    const empty = parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: Hi\n    details:\n');
    expect(empty.issues).toEqual([]);
    expect(empty.guide?.steps[0]).not.toHaveProperty('details');
    expect(errorsOf(parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: Hi\n    details: [a]\n').issues)).toEqual(['details']);
  });

  it('warns about unknown fields, which are usually typos', () => {
    const { guide: t, issues } = parseGuide('t', 'title: T\nkind: path\nstep: 1\nsteps:\n  - element: flow\n    sya: x\n    say: y\n');
    expect(t).not.toBeNull();
    expect(warningsOf(issues)).toEqual(['unknown-field', 'unknown-field']);
  });
});

describe('parts', () => {
  const step = (part?: string) => `  - element: flow\n    say: x\n${part ? `    part: ${part}\n` : ''}`;
  const parse = (...parts: (string | undefined)[]) => parseGuide('t', `title: T\nkind: path\nsteps:\n${parts.map(step).join('')}`);

  it('reads parts and lists them in order', () => {
    const { guide: g, issues } = parse('Fonctionnel', 'Fonctionnel', 'Technique', 'Opérationnel');
    expect(issues).toEqual([]);
    expect(g?.steps[0].part).toBe('Fonctionnel');
    expect(guideParts(g!)).toEqual(['Fonctionnel', 'Technique', 'Opérationnel']);
  });

  it('allows a guide without parts', () => {
    const { guide: g, issues } = parse(undefined, undefined);
    expect(issues).toEqual([]);
    expect(guideParts(g!)).toEqual([]);
    expect(g?.steps[0]).not.toHaveProperty('part');
  });

  it('needs a part on every step once one step has one', () => {
    const { guide: g, issues } = parse('Fonctionnel', undefined);
    expect(g).toBeNull();
    expect(issues.filter(i => i.level === 'error').map(i => [i.rule, i.step])).toEqual([['part', 2]]);
  });

  it('keeps the steps of a part together', () => {
    const { guide: g, issues } = parse('A', 'B', 'A');
    expect(g).toBeNull();
    expect(issues.find(i => i.rule === 'part')?.message).toMatch(/comes back/);
  });

  it('refuses a part that is not text', () => {
    expect(errorsOf(parseGuide('t', 'title: T\nkind: path\nsteps:\n  - element: flow\n    say: x\n    part: [a]\n').issues)).toEqual(['part']);
  });
});

describe('validateGuide', () => {
  it('accepts a trace that follows real edges from visited steps', () => {
    const t = guide({
      kind: 'trace',
      steps: [
        { element: 'flow/a', say: 'start' },
        { element: 'flow/b', edge: 'a -->|calls| b', say: 'next' },
        { element: 'flow/c', edge: 'b --> c', say: 'then' },
        { element: 'flow/d', edge: 'c --> d', focus: ['a'], say: 'end' },
      ],
    });
    expect(validateGuide(t, ['t'], tmpDir)).toEqual([]);
  });

  it('allows a trace to branch from any visited step', () => {
    const t = guide({
      kind: 'trace',
      steps: [
        { element: 'flow/c', say: '' },
        { element: 'flow/d', edge: 'c --> d', say: 'x' },
        { element: 'flow/b', edge: 'b --> c', say: 'x' },
      ],
    });
    expect(errorsOf(validateGuide(t, ['t'], tmpDir))).toEqual([]);
  });

  it('reports missing elements and edges', () => {
    write('other/child/description.md', 'x');
    const t = guide({
      steps: [
        { element: 'flow/zzz', say: 'x' },                   // unknown element
        { element: 'flow/b', edge: 'a --> c', say: 'x' },    // edge not in the diagram
        { element: 'flow/b', edge: 'c --> d', say: 'x' },    // edge does not touch b
        { element: 'flow/b', edge: 'b --> a', say: 'x' },    // against the arrow
        { element: 'flow', edge: 'a --> b', say: 'x' },      // perspective: no parent diagram
        { element: 'other/child', edge: 'x --> child', say: 'x' }, // parent without diagram
        { element: 'other', say: 'x' },
        { element: '../flow', say: 'x' },
        { element: 'flow\\..\\..\\x', say: 'x' },
      ],
    });
    const issues = validateGuide(t, ['t'], tmpDir);
    expect(errorsOf(issues)).toEqual(['element', 'edge', 'edge', 'edge', 'edge', 'edge', 'element', 'element']);
    expect(issues.find(i => i.step === 3)?.message).toMatch(/does not touch/);
    expect(issues.find(i => i.step === 6)?.message).toMatch(/has no diagram/);
  });

  it('refuses a trace that jumps or has no edge', () => {
    const t = guide({
      kind: 'trace',
      steps: [
        { element: 'flow/a', say: 'x' },
        { element: 'flow/d', edge: 'c --> d', say: 'x' },
        { element: 'flow/b', say: 'x' },
      ],
    });
    expect(errorsOf(validateGuide(t, ['t'], tmpDir))).toEqual(['trace', 'trace']);
  });

  it('warns about empty or long sentences and unknown focus nodes', () => {
    const t = guide({
      steps: [
        { element: 'flow/a', say: ' ' },
        { element: 'flow/b', say: 'x'.repeat(300), focus: ['nope'] },
      ],
    });
    expect(warningsOf(validateGuide(t, ['t'], tmpDir))).toEqual(['say', 'say', 'focus']);
  });

  it('warns about details too long to read during a guide', () => {
    const t = guide({ steps: [{ element: 'flow/a', say: 'x', details: 'y'.repeat(1600) }] });
    expect(warningsOf(validateGuide(t, ['t'], tmpDir))).toEqual(['details']);
  });

  it('checks "after"', () => {
    const t = guide({ after: ['t', 'missing', 'other'], steps: [{ element: 'flow', say: 'x' }] });
    expect(errorsOf(validateGuide(t, ['t', 'other'], tmpDir))).toEqual(['after', 'after']);
  });
});

describe('guide files', () => {
  const VALID = 'title: T\nkind: path\nsteps:\n  - element: flow/a\n    say: x\n';

  it('writes valid guides, refuses invalid ones, and never lists them as perspectives', () => {
    expect(writeGuide('good', VALID, tmpDir).written).toBe(true);
    const bad = writeGuide('bad', 'title: T\nkind: path\nsteps:\n  - element: flow/zzz\n    say: x\n', tmpDir);
    expect(bad.written).toBe(false);
    expect(listGuideIds(tmpDir)).toEqual(['good']);
    expect(listClasses(tmpDir)).toEqual(['flow', 'other']);
    expect(deleteGuide('good', tmpDir)).toEqual({ deleted: true });
    expect(deleteGuide('good', tmpDir)).toEqual({ deleted: false, reason: 'not-found' });
  });

  it('refuses a write that creates a loop and a delete that breaks "after"', () => {
    expect(writeGuide('a', VALID, tmpDir).written).toBe(true);
    expect(writeGuide('b', VALID + 'after: [a]\n', tmpDir).written).toBe(true);
    const loop = writeGuide('a', VALID + 'after: [b]\n', tmpDir);
    expect(loop.written).toBe(false);
    expect(errorsOf(loop.issues)).toEqual(['after']);
    expect(loadGuides(tmpDir).every(r => r.valid)).toBe(true);
    expect(deleteGuide('a', tmpDir)).toEqual({ deleted: false, reason: 'needed', dependents: ['b'] });
  });

  it('copes with a .guides file or a diagram folder instead of crashing', () => {
    write('.guides', 'not a folder');
    expect(listGuideIds(tmpDir)).toEqual([]);
    expect(loadGuides(tmpDir)).toEqual([]);
    fs.rmSync(path.join(tmpDir, '.omm', 'flow', 'diagram.mmd'));
    fs.mkdirSync(path.join(tmpDir, '.omm', 'flow', 'diagram.mmd'));
    const t = guide({ steps: [{ element: 'flow/b', edge: 'a --> b', say: 'x' }] });
    expect(errorsOf(validateGuide(t, ['t'], tmpDir))).toEqual(['edge']);
  });

  it('ignores files that are not guides', () => {
    write('.guides/Not_A_Guide.yaml', VALID);
    write('.guides/notes.md', 'x');
    expect(listGuideIds(tmpDir)).toEqual([]);
  });

  it('flags several start guides and loops between guides', () => {
    write('.guides/one.yaml', VALID + 'start: true\nafter: [two]\n');
    write('.guides/two.yaml', VALID + 'start: true\nafter: [one]\n');
    write('.guides/three.yaml', 'title: [');
    const results = loadGuides(tmpDir);
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    expect(warningsOf(byId.one.issues)).toContain('start');
    expect(errorsOf(byId.one.issues)).toEqual(['after']);
    expect(byId.one.valid).toBe(false);
    expect(byId.three.valid).toBe(false);
    expect(byId.three.guide).toBeNull();
  });
});
