import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEvolve, readEvolve, writeEvolve } from '../lib/evolve.js';
import { apiProject } from '../server/api-v1.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-evolve-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  fs.mkdirSync(path.join(dir, '.prisme/arch/store'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.prisme/arch/description.md'), 'arch');
  fs.writeFileSync(path.join(dir, '.prisme/arch/store/description.md'), 'store');
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const GOOD = `summary: "Two ideas first."
code:
  - kind: simplify
    title: "Merge the readers"
    why: "One place to change."
    how: |
      1. Move it.
    effort: small
    impact: medium
    elements: [arch/store]
    files: [src/store.ts]
market:
  products:
    - name: "Alpha"
      url: "https://alpha.example.com"
      what: "A docs tool."
      similar: "Same users."
  ideas:
    - kind: design
      title: "Empty states"
      why: "New users know what to do."
      how: "Show a hint."
      effort: small
      impact: high
      seenIn: ["Alpha"]
`;

describe('evolve report', () => {
  it('accepts code and market ideas, and stores them', () => {
    expect(parseEvolve(GOOD, dir).issues).toEqual([]);
    const { written, report } = writeEvolve(GOOD, dir);
    expect(written).toBe(true);
    expect(report).toMatchObject({ version: 1, code: [{ kind: 'simplify', elements: ['arch/store'] }], market: { products: [{ name: 'Alpha' }] } });
    expect(readEvolve(dir)?.market?.ideas[0].seenIn).toEqual(['Alpha']);
    expect(apiProject({ ai: false, cwd: dir }).categories.evolve).toMatchObject({ available: true, code: 1, products: 1, ideas: 1 });
  });

  it('accepts one level alone', () => {
    expect(parseEvolve('summary: "s"\nmarket:\n  products:\n    - {name: A, url: "https://a.io", what: w, similar: s}\n  ideas: []\n', dir).issues).toEqual([]);
  });

  it('says what is wrong and writes nothing', () => {
    const bad = GOOD
      .replace('kind: simplify', 'kind: rewrite')
      .replace('[arch/store]', '[arch/nope]')
      .replace('https://alpha.example.com', 'javascript:alert(1)')
      .replace('seenIn: ["Alpha"]', 'seenIn: ["Beta"]')
      .replace('effort: small\n    impact: medium', 'effort: small\n    impact: medium\n    owner: me');
    const { written, issues } = writeEvolve(bad, dir);
    expect(written).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      'code 1: unknown key "owner"',
      'code 1: "kind" must be one of simplify, speed, further',
      'code 1: element "arch/nope" does not exist (see prisme tree)',
      'product 1: "url" must be an http(s) address',
      'market idea 1: "Beta" is not in market.products',
    ]));
    expect(readEvolve(dir)).toBeNull();
    expect(parseEvolve('summary: "s"\n', dir).issues).toContain('write at least "code" or "market"');
  });
});
