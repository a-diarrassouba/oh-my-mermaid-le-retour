import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { writeField, writeNodeField, readTitle, writeTitle, readNodeMeta, MAX_TITLE_LENGTH } from '../lib/store.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-title-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('element titles', () => {
  it('sets and reads the title of a perspective', () => {
    writeField('overall-architecture', 'description', 'desc', tmpDir);
    writeTitle('overall-architecture', [], 'Architecture générale', tmpDir);
    expect(readTitle('overall-architecture', [], tmpDir)).toBe('Architecture générale');
  });

  it('sets the title of a nested element without touching its other meta', () => {
    writeNodeField('overall-architecture', ['cli'], 'description', 'desc', tmpDir);
    const before = readNodeMeta('overall-architecture', ['cli'], tmpDir)!;
    writeTitle('overall-architecture', ['cli'], '  Ligne de commande  ', tmpDir);
    const after = readNodeMeta('overall-architecture', ['cli'], tmpDir)!;
    expect(after.title).toBe('Ligne de commande');
    expect(after.update_count).toBe(before.update_count);
    expect(after.created).toBe(before.created);
  });

  it('treats the id stored by older metas as no title', () => {
    writeNodeField('overall-architecture', ['cli'], 'description', 'desc', tmpDir);
    expect(readNodeMeta('overall-architecture', ['cli'], tmpDir)!.title).toBe('cli');
    expect(readTitle('overall-architecture', ['cli'], tmpDir)).toBeNull();
  });

  it('removes the title when given an empty one', () => {
    writeField('data-flow', 'description', 'desc', tmpDir);
    writeTitle('data-flow', [], 'Flux de données', tmpDir);
    writeTitle('data-flow', [], '', tmpDir);
    expect(readTitle('data-flow', [], tmpDir)).toBeNull();
    const raw = YAML.parse(fs.readFileSync(path.join(tmpDir, '.omm', 'data-flow', 'meta.yaml'), 'utf-8'));
    expect(raw).not.toHaveProperty('title');
  });

  it('refuses an element that does not exist', () => {
    expect(() => writeTitle('nowhere', ['ghost'], 'Fantôme', tmpDir)).toThrow(/not found/);
    expect(fs.existsSync(path.join(tmpDir, '.omm', 'nowhere'))).toBe(false);
  });

  it('refuses titles on several lines or too long', () => {
    writeField('data-flow', 'description', 'desc', tmpDir);
    expect(() => writeTitle('data-flow', [], 'Flux\nde données', tmpDir)).toThrow(/one line/);
    expect(() => writeTitle('data-flow', [], 'x'.repeat(MAX_TITLE_LENGTH + 1), tmpDir)).toThrow(/at most/);
  });
});
