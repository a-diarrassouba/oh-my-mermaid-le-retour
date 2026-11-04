import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ensureOmmForWrite, ensureOmmForRead, writeField, initOmm } from '../lib/store.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ensureOmmForWrite', () => {
  it('creates .prisme/ and config.yaml when missing', () => {
    ensureOmmForWrite(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.prisme'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.prisme', 'config.yaml'))).toBe(true);
  });

  it('is a no-op when .prisme/ already exists', () => {
    initOmm(tmpDir);
    const configBefore = fs.readFileSync(path.join(tmpDir, '.prisme', 'config.yaml'), 'utf-8');
    ensureOmmForWrite(tmpDir);
    const configAfter = fs.readFileSync(path.join(tmpDir, '.prisme', 'config.yaml'), 'utf-8');
    expect(configAfter).toBe(configBefore);
  });
});

describe('ensureOmmForRead', () => {
  it('returns false when .prisme/ is missing (no auto-create)', () => {
    const result = ensureOmmForRead(tmpDir);
    expect(result).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.prisme'))).toBe(false);
  });

  it('returns true when .prisme/ exists', () => {
    initOmm(tmpDir);
    const result = ensureOmmForRead(tmpDir);
    expect(result).toBe(true);
  });
});

describe('writeField with lazy-init', () => {
  it('creates .prisme/ + config.yaml + field file when .prisme/ missing', () => {
    writeField('test-class', 'description', 'hello world', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.prisme'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.prisme', 'config.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.prisme', 'test-class', 'description.md'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, '.prisme', 'test-class', 'description.md'), 'utf-8');
    expect(content).toBe('hello world');
  });

  it('creates meta.yaml after writing a field', () => {
    writeField('test-class', 'diagram', 'graph LR; A-->B', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.prisme', 'test-class', 'meta.yaml'))).toBe(true);
  });

  it('works normally when .prisme/ already exists', () => {
    initOmm(tmpDir);
    writeField('existing-class', 'constraint', 'no direct DB access', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.prisme', 'existing-class', 'constraint.md'), 'utf-8');
    expect(content).toBe('no direct DB access');
  });
});
