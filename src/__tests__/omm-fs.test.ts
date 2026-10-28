import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertNoSymlink, OmmSymlinkError, readOmmFile, removeOmmPath, writeOmmFile } from '../lib/omm-fs.js';
import { listGuideIds, readGuideSource, writeGuide } from '../lib/guides.js';

let project: string;
let omm: string;
let outside: string;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-fs-'));
  omm = path.join(project, '.omm');
  outside = path.join(project, 'outside');
  fs.mkdirSync(path.join(omm, 'arch', 'a'), { recursive: true });
  fs.writeFileSync(path.join(omm, 'arch', 'a', 'description.md'), 'a');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'secret.yaml'), 'title: secret\n');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(project, { recursive: true, force: true });
});

describe('omm-fs', () => {
  it('accepts plain paths, existing or not, and refuses paths that leave .omm/', () => {
    expect(() => assertNoSymlink(omm, path.join(omm, 'arch', 'description.md'))).not.toThrow();
    expect(() => assertNoSymlink(omm, path.join(omm, 'new', 'child', 'diagram.mmd'))).not.toThrow();
    expect(() => assertNoSymlink(omm, path.join(outside, 'secret.yaml'))).toThrow(/leaves the .omm directory/);
  });

  it('never reads, writes or removes through a symlink', () => {
    fs.symlinkSync(outside, path.join(omm, 'linked'));
    expect(() => assertNoSymlink(omm, path.join(omm, 'linked', 'x'))).toThrow(OmmSymlinkError);
    expect(readOmmFile(omm, path.join(omm, 'linked', 'secret.yaml'))).toBeNull();
    expect(() => writeOmmFile(omm, path.join(omm, 'linked', 'new.yaml'), 'x')).toThrow(OmmSymlinkError);
    expect(() => removeOmmPath(omm, path.join(omm, 'linked', 'secret.yaml'))).toThrow(OmmSymlinkError);
    expect(fs.readdirSync(outside)).toEqual(['secret.yaml']);
  });

  it('writes and reads a plain file', () => {
    writeOmmFile(omm, path.join(omm, 'x', 'y.md'), 'hello');
    expect(readOmmFile(omm, path.join(omm, 'x', 'y.md'))).toBe('hello');
  });
});

describe('guides and symlinks', () => {
  const GUIDE = 'title: T\nkind: path\nsteps:\n  - element: arch/a\n    say: x\n';

  it('ignores a symlinked .guides folder or guide file', () => {
    fs.symlinkSync(outside, path.join(omm, '.guides'));
    expect(listGuideIds(project)).toEqual([]);
    expect(() => writeGuide('g', GUIDE, project)).toThrow(OmmSymlinkError);
    fs.unlinkSync(path.join(omm, '.guides'));

    fs.mkdirSync(path.join(omm, '.guides'));
    fs.symlinkSync(path.join(outside, 'secret.yaml'), path.join(omm, '.guides', 'leak.yaml'));
    expect(readGuideSource('leak', project)).toBeNull();
  });
});
