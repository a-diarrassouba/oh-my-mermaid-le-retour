import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAsset } from '../server/index.js';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-web-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'no');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('new front assets', () => {
  it('serves built files by plain name only', () => {
    expect(readAsset(dir, 'index-abc.js')).toMatchObject({ type: 'text/javascript; charset=utf-8' });
    expect(readAsset(dir, '../secret.txt')).toBeNull();
    expect(readAsset(dir, '..%2Fsecret.txt')).toBeNull();
    expect(readAsset(dir, '.hidden.js')).toBeNull();
    expect(readAsset(dir, 'missing.js')).toBeNull();
    expect(readAsset(dir, 'index-abc.exe')).toBeNull();
  });
});
