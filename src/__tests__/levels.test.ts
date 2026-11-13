import { describe, it, expect } from 'vitest';
import { parseLevels } from '../lib/levels.js';
import { parseAudit, gradeAudit, AREAS } from '../lib/audit.js';
import { parseEvolve } from '../lib/evolve.js';
import { parseGuide } from '../lib/guides.js';
import { explainGrade } from '../../web/src/method.js';

describe('reader levels', () => {
  it('keeps novice and junior texts, trimmed', () => {
    const issues: string[] = [];
    const out = parseLevels('x', { novice: { what: '  Like a locker.  ' }, junior: { what: 'An IDOR.' } }, { what: 100 }, issues);
    expect(issues).toEqual([]);
    expect(out).toEqual({ novice: { what: 'Like a locker.' }, junior: { what: 'An IDOR.' } });
  });

  it('is optional', () => {
    const issues: string[] = [];
    expect(parseLevels('x', undefined, { what: 100 }, issues)).toBeUndefined();
    expect(issues).toEqual([]);
  });

  it('says what is wrong: senior level, unknown field, empty or too long text', () => {
    const issues: string[] = [];
    parseLevels('finding 1', { senior: { what: 'a' }, novice: { why: 'b', what: '' }, junior: { what: 'x'.repeat(11) } }, { what: 10 }, issues);
    expect(issues).toEqual([
      'finding 1: "levels.senior" is unknown (novice, junior; the base texts are the senior level)',
      'finding 1: "levels.novice.why" is unknown (what)',
      'finding 1: "levels.novice.what" must be non-empty text',
      'finding 1: "levels.junior.what" is longer than 10 characters',
    ]);
  });

  it('refuses a list instead of a map', () => {
    const issues: string[] = [];
    parseLevels('audit', ['novice'], { summary: 10 }, issues);
    expect(issues).toEqual(['audit: "levels" must be a map with novice and junior']);
  });

  it('reaches the evolve ideas and the summary', () => {
    const { report, issues } = parseEvolve(`summary: "Two ideas."
levels:
  novice: { summary: "Deux idées simples." }
code:
  - kind: simplify
    title: "Merge the readers"
    why: "One place."
    how: "Move it."
    effort: small
    impact: medium
    levels:
      novice: { title: "Un seul carnet", why: "Moins de surprises.", how: "Garder un seul lecteur." }
`);
    expect(issues).toEqual([]);
    expect(report!.levels).toEqual({ novice: { summary: 'Deux idées simples.' } });
    expect(report!.code[0].levels!.novice!.title).toBe('Un seul carnet');
  });

  it('reaches the guide steps', () => {
    const { guide, issues } = parseGuide('start-here', `title: "Start"
kind: path
audience: newcomer
steps:
  - element: arch
    say: "A web front and one API."
    levels:
      novice: { say: "Une vitrine et une arrière-boutique." }
      junior: { say: "Un front React et une API Express.", details: "Ouvrez src/api." }
`);
    expect(issues.filter(i => i.level === 'error')).toEqual([]);
    expect(guide!.steps[0].levels).toEqual({ novice: { say: 'Une vitrine et une arrière-boutique.' }, junior: { say: 'Un front React et une API Express.', details: 'Ouvrez src/api.' } });
  });

  it('marks a bad guide level as an error of its step', () => {
    const { issues } = parseGuide('start-here', `title: "Start"
kind: path
audience: newcomer
steps:
  - element: arch
    say: "Hi."
    levels: { novice: { title: "x" } }
`);
    expect(issues.filter(i => i.level === 'error').map(i => [i.rule, i.step])).toEqual([['levels', 1]]);
  });

  it('refuses levels on an audit finding that are too long', () => {
    const checked = 'checked:\n' + AREAS.map(a => `  - area: ${a}\n    status: not-applicable\n    note: "n"\n`).join('');
    const { issues } = parseAudit(`summary: "s"
levels: { junior: { summary: "${'x'.repeat(2001)}" } }
findings: []
dismissed: []
${checked}`, process.cwd());
    expect(issues).toContain('audit: "levels.junior.summary" is longer than 2000 characters');
  });
});

describe('"how is the score computed" page', () => {
  // The page explains the formula step by step: it must give the grades prisme gives.
  const cases = [
    { critical: 0, high: 0, medium: 0, low: 0 },
    { critical: 0, high: 1, medium: 0, low: 0 },
    { critical: 1, high: 0, medium: 0, low: 0 },
    { critical: 0, high: 0, medium: 7, low: 12 },
    { critical: 0, high: 2, medium: 3, low: 1 },
    { critical: 3, high: 2, medium: 0, low: 0 },
  ];
  it.each(cases)('matches gradeAudit for %o', counts => {
    const findings = (Object.entries(counts) as [keyof typeof counts, number][]).flatMap(([severity, n]) => Array.from({ length: n }, () => ({ severity })));
    const { score, grade } = explainGrade(counts);
    expect({ score, grade }).toEqual(gradeAudit(findings));
  });
});
