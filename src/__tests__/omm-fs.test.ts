import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertNoSymlink, OmmSymlinkError, readOmmFile, removeOmmPath, writeOmmFile } from '../lib/omm-fs.js';
import { listGuideIds, readGuideSource, writeGuide } from '../lib/guides.js';

let project: string;
let prisme: string;
let outside: string;

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'omm-fs-'));
  prisme = path.join(project, '.prisme');
  outside = path.join(project, 'outside');
  fs.mkdirSync(path.join(prisme, 'arch', 'a'), { recursive: true });
  fs.writeFileSync(path.join(prisme, 'arch', 'a', 'description.md'), 'a');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'secret.yaml'), 'title: secret\n');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(project, { recursive: true, force: true });
});

describe('omm-fs', () => {
  it('accepts plain paths, existing or not, and refuses paths that leave .prisme/', () => {
    expect(() => assertNoSymlink(prisme, path.join(prisme, 'arch', 'description.md'))).not.toThrow();
    expect(() => assertNoSymlink(prisme, path.join(prisme, 'new', 'child', 'diagram.mmd'))).not.toThrow();
    expect(() => assertNoSymlink(prisme, path.join(outside, 'secret.yaml'))).toThrow(/leaves the .prisme directory/);
  });

  it('never reads, writes or removes through a symlink', () => {
    fs.symlinkSync(outside, path.join(prisme, 'linked'));
    expect(() => assertNoSymlink(prisme, path.join(prisme, 'linked', 'x'))).toThrow(OmmSymlinkError);
    expect(readOmmFile(prisme, path.join(prisme, 'linked', 'secret.yaml'))).toBeNull();
    expect(() => writeOmmFile(prisme, path.join(prisme, 'linked', 'new.yaml'), 'x')).toThrow(OmmSymlinkError);
    expect(() => removeOmmPath(prisme, path.join(prisme, 'linked', 'secret.yaml'))).toThrow(OmmSymlinkError);
    expect(fs.readdirSync(outside)).toEqual(['secret.yaml']);
  });

  it('writes and reads a plain file', () => {
    writeOmmFile(prisme, path.join(prisme, 'x', 'y.md'), 'hello');
    expect(readOmmFile(prisme, path.join(prisme, 'x', 'y.md'))).toBe('hello');
  });
});

describe('guides and symlinks', () => {
  const GUIDE = 'title: T\nkind: path\nsteps:\n  - element: arch/a\n    say: x\n';

  it('ignores a symlinked .guides folder or guide file', () => {
    fs.symlinkSync(outside, path.join(prisme, '.guides'));
    expect(listGuideIds(project)).toEqual([]);
    expect(() => writeGuide('g', GUIDE, project)).toThrow(OmmSymlinkError);
    fs.unlinkSync(path.join(prisme, '.guides'));

    fs.mkdirSync(path.join(prisme, '.guides'));
    fs.symlinkSync(path.join(outside, 'secret.yaml'), path.join(prisme, '.guides', 'leak.yaml'));
    expect(readGuideSource('leak', project)).toBeNull();
  });
});
