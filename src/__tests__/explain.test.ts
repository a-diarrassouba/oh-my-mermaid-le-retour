import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseExplain, readExplain, readIcon, writeExplain, writeIcon } from '../lib/explain.js';
import { apiElements } from '../server/api-v1.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-explain-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  fs.mkdirSync(path.join(dir, '.prisme/arch/store'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.prisme/arch/description.md'), 'arch');
  fs.writeFileSync(path.join(dir, '.prisme/arch/store/description.md'), 'Stores the docs.');
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const GOOD = 'novice: |\n  Comme un classeur.\ndeeper: |\n  Le classeur est un dossier.\njunior: |\n  Lit et écrit `.prisme/`.\n';

describe('explain.yaml', () => {
  it('accepts novice, deeper and junior', () => {
    expect(parseExplain(GOOD)).toEqual({
      explain: { novice: 'Comme un classeur.', deeper: 'Le classeur est un dossier.', junior: 'Lit et écrit `.prisme/`.' },
      issues: [],
    });
  });

  it('says what is wrong', () => {
    expect(parseExplain('junior: x\n').issues).toEqual(['"novice" is required']);
    expect(parseExplain('novice: x\nsenior: y\n').issues[0]).toMatch(/unknown key "senior"/);
    expect(parseExplain(`novice: ${'a'.repeat(1201)}\n`).issues[0]).toMatch(/longer than 1200/);
    expect(parseExplain('novice: [a]\n').issues[0]).toMatch(/non-empty text/);
    expect(parseExplain('- a\n').issues[0]).toMatch(/must be a map/);
    expect(parseExplain('novice: "\n').issues[0]).toMatch(/not valid YAML/);
  });

  it('writes only a valid explanation of an existing element', () => {
    expect(writeExplain('arch', ['store'], 'novice: 1\n', dir).written).toBe(false);
    expect(writeExplain('arch', ['nope'], GOOD, dir)).toEqual({ written: false, issues: ['element not found'] });
    expect(writeExplain('arch', ['store'], GOOD, dir)).toEqual({ written: true, issues: [] });
    expect(readExplain('arch', ['store'], dir)?.novice).toBe('Comme un classeur.');
  });
});

describe('icons', () => {
  it('sets, refuses and removes an icon', () => {
    expect(writeIcon('arch', ['store'], 'database', dir)).toBeNull();
    expect(readIcon('arch', ['store'], dir)).toBe('database');
    expect(writeIcon('arch', ['store'], 'unicorn', dir)).toMatch(/unknown icon "unicorn"/);
    expect(readIcon('arch', ['store'], dir)).toBe('database');
    expect(writeIcon('arch', ['store'], '', dir)).toBeNull();
    expect(readIcon('arch', ['store'], dir)).toBeNull();
  });

  it('reaches the API', () => {
    writeIcon('arch', ['store'], 'database', dir);
    writeExplain('arch', ['store'], GOOD, dir);
    const store = apiElements(dir).find(e => e.path === 'arch/store')!;
    expect(store.icon).toBe('database');
    expect(store.explain?.junior).toContain('.prisme/');
    expect(apiElements(dir).find(e => e.path === 'arch')).toMatchObject({ icon: null, explain: null });
  });
});
