import { beforeEach, describe, expect, it, vi } from 'vitest';

const execSync = vi.fn();
const execFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync,
  execSync,
}));

describe('commandUpdate', () => {
  beforeEach(() => {
    vi.resetModules();
    execSync.mockReset();
    execFileSync.mockReset();
  });

  it('re-runs setup through a fresh prisme subprocess after the CLI update succeeds', async () => {
    execSync.mockReturnValue('updated');
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { commandUpdate } = await import('../commands/update.js');

    await commandUpdate();

    expect(execSync).toHaveBeenCalledWith('npm install -g github:a-diarrassouba/oh-my-mermaid-le-retour 2>&1', {
      encoding: 'utf-8',
    });
    expect(execFileSync).toHaveBeenCalledWith('prisme', ['setup'], { stdio: 'inherit' });
    stderrWrite.mockRestore();
  });

  it('fails when the fresh setup subprocess fails', async () => {
    execSync.mockReturnValue('updated');
    execFileSync.mockImplementation(() => {
      throw new Error('setup failed');
    });
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { commandUpdate } = await import('../commands/update.js');

    await expect(commandUpdate()).rejects.toThrow('setup failed');

    stderrWrite.mockRestore();
  });
});
