import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync,
  execSync: vi.fn(),
}));

// The tests run from a clone of the repository: its root holds skills/ and .git.
const ROOT = path.resolve(__dirname, '..', '..');

describe('commandUpdate', () => {
  beforeEach(() => {
    vi.resetModules();
    execFileSync.mockReset();
  });

  it('pulls and rebuilds the clone, then re-runs setup through a fresh prisme subprocess', async () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { commandUpdate } = await import('../commands/update.js');

    await commandUpdate();

    expect(execFileSync.mock.calls).toEqual([
      ['git', ['-C', ROOT, 'pull', '--ff-only'], { stdio: 'inherit' }],
      ['npm', ['install'], { cwd: ROOT, stdio: 'inherit' }],
      ['prisme', ['setup'], { stdio: 'inherit' }],
    ]);
    stderrWrite.mockRestore();
  });

  it('stops before setup when the pull fails', async () => {
    execFileSync.mockImplementationOnce(() => { throw new Error('not a fast-forward'); });
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { commandUpdate } = await import('../commands/update.js');

    await commandUpdate();

    expect(execFileSync).toHaveBeenCalledTimes(1);
    stderrWrite.mockRestore();
  });

  it('fails when the fresh setup subprocess fails', async () => {
    execFileSync.mockImplementation((cmd: string) => {
      if (cmd === 'prisme') throw new Error('setup failed');
    });
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { commandUpdate } = await import('../commands/update.js');

    await expect(commandUpdate()).rejects.toThrow('setup failed');

    stderrWrite.mockRestore();
  });
});
