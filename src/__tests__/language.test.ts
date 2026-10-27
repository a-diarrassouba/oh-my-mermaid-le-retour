import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeLanguage, getLanguage } from '../lib/language.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-lang-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(content: string): void {
  fs.mkdirSync(path.join(tmpDir, '.omm'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.omm', 'config.yaml'), content, 'utf-8');
}

describe('normalizeLanguage', () => {
  it('keeps codes, lowercased', () => {
    expect(normalizeLanguage('fr')).toBe('fr');
    expect(normalizeLanguage('EN')).toBe('en');
    expect(normalizeLanguage(' ko ')).toBe('ko');
  });

  it('formats regional codes', () => {
    expect(normalizeLanguage('pt-br')).toBe('pt-BR');
    expect(normalizeLanguage('zh_TW')).toBe('zh-TW');
  });

  it('maps language names left by older configs', () => {
    expect(normalizeLanguage('English')).toBe('en');
    expect(normalizeLanguage('Français')).toBe('fr');
    expect(normalizeLanguage('한국어')).toBe('ko');
  });

  it('rejects anything else', () => {
    expect(normalizeLanguage('french please')).toBeNull();
    expect(normalizeLanguage('')).toBeNull();
    expect(normalizeLanguage(42)).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe('getLanguage', () => {
  it('defaults to en without .omm/ or without a language', () => {
    expect(getLanguage(tmpDir)).toBe('en');
    writeConfig('version: 0.1.0\n');
    expect(getLanguage(tmpDir)).toBe('en');
  });

  it('reads the configured code', () => {
    writeConfig('version: 0.1.0\nlanguage: fr\n');
    expect(getLanguage(tmpDir)).toBe('fr');
  });

  it('understands an old language name', () => {
    writeConfig('version: 0.1.0\nlanguage: English\n');
    expect(getLanguage(tmpDir)).toBe('en');
  });

  it('falls back to en for an unknown value', () => {
    writeConfig('version: 0.1.0\nlanguage: "not a language"\n');
    expect(getLanguage(tmpDir)).toBe('en');
  });
});
