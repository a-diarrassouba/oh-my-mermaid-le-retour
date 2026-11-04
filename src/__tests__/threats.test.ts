import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseThreats, readThreats, writeThreats } from '../lib/threats.js';
import { apiProject } from '../server/api-v1.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-threats-'));
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  for (const p of ['arch', 'arch/browser', 'arch/server']) {
    fs.mkdirSync(path.join(dir, '.prisme', p), { recursive: true });
    fs.writeFileSync(path.join(dir, '.prisme', p, 'description.md'), p);
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const GOOD = `summary: "Le serveur local est la seule porte."
assets: ["Clé d'API de Claude"]
boundaries:
  - from: arch/browser
    to: arch/server
    why: "Toute page ouverte peut appeler le serveur."
threats:
  - element: arch/server
    stride: [S]
    title: "Un autre site appelle le serveur"
    scenario: "Une page piégée envoie une requête à localhost."
    likelihood: low
    impact: high
    status: mitigated
    control: "Host et Origin sont vérifiés."
  - element: arch/server
    stride: [D, T]
    title: "Requêtes en boucle"
    scenario: "Un script lance des questions sans fin."
    likelihood: medium
    impact: medium
    status: open
    control: "Limiter à une question à la fois."
questions:
  - theme: "Échanges"
    question: "Le serveur vérifie-t-il l'origine des requêtes ?"
    status: answered
    answer: "Oui, src/server/local.ts."
    elements: [arch/server]
  - theme: "Secrets"
    question: "Qui peut lire la clé d'API ?"
    status: open
`;

describe('threat model', () => {
  it('accepts a model of the map and puts open, likely threats first', () => {
    expect(parseThreats(GOOD, dir).issues).toEqual([]);
    const { written, model } = writeThreats(GOOD, dir);
    expect(written).toBe(true);
    expect(model!.threats.map(t => t.title)).toEqual(['Requêtes en boucle', 'Un autre site appelle le serveur']);
    expect(readThreats(dir)?.questions[1]).toEqual({ theme: 'Secrets', question: "Qui peut lire la clé d'API ?", status: 'open' });
    expect(apiProject({ ai: false, cwd: dir }).categories.security).toMatchObject({ threats: 2, questions: 2 });
  });

  it('says what is wrong and writes nothing', () => {
    const bad = GOOD
      .replace('stride: [S]', 'stride: [S, X]')
      .replace('element: arch/server\n    stride: [D, T]', 'element: arch/nope\n    stride: [D, T]')
      .replace('status: answered\n    answer: "Oui, src/server/local.ts."', 'status: answered')
      .replace('likelihood: low', 'likelihood: rare');
    const { written, issues } = writeThreats(bad, dir);
    expect(written).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      'threat 1: "X" is not a STRIDE letter (S, T, R, I, D, E)',
      'threat 1: "likelihood" must be one of low, medium, high',
      'threat 2: "element" must be an element of the map (see prisme tree), not "arch/nope"',
      'question 1: "answer" must be non-empty text',
    ]));
    expect(readThreats(dir)).toBeNull();
    expect(parseThreats('summary: "s"\n', dir).issues).toContain('write at least "threats" or "questions"');
  });
});
