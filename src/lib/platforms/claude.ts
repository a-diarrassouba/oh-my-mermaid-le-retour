import { execSync } from 'node:child_process';
import type { Platform } from './types.js';
import { getPackageVersion, hasCommand } from './utils.js';

function run(cmd: string): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    return { ok: true, out };
  } catch {
    return { ok: false, out: '' };
  }
}

/** Extract installed plugin version from `claude plugin list` output */
function getInstalledVersion(): string | null {
  const { ok, out } = run('claude plugin list 2>&1');
  if (!ok) return null;
  // Match "Version: X.Y.Z" line after prisme
  const lines = out.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('prisme') && !lines[i].includes('oh-my-claudecode')) {
      // Look for Version line in next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const m = lines[j].match(/Version:\s*([\d.]+)/);
        if (m) return m[1];
      }
    }
  }
  return null;
}

export const claude: Platform = {
  name: 'Claude Code',
  id: 'claude',

  detect(): boolean {
    return hasCommand('claude');
  },

  isSetup(): boolean {
    const installed = getInstalledVersion();
    if (!installed) return false;
    const current = getPackageVersion();
    if (!current) return true; // can't compare, assume OK
    return installed === current;
  },

  async setup(): Promise<void> {
    const installed = getInstalledVersion();

    // Uninstall old version first if present
    if (installed) {
      const current = getPackageVersion();
      process.stderr.write(`  Updating ${installed} → ${current}...\n`);
      run('claude plugin uninstall prisme 2>&1');
    }

    // Add marketplace (may already exist — ignore error)
    run('claude plugin marketplace add a-diarrassouba/oh-my-mermaid-le-retour');

    const { ok, out } = run('claude plugin install prisme 2>&1');
    if (!ok) {
      process.stderr.write(`  Could not auto-install plugin. Run manually:\n`);
      process.stderr.write(`    claude plugin marketplace add a-diarrassouba/oh-my-mermaid-le-retour\n`);
      process.stderr.write(`    claude plugin install prisme\n`);
      return;
    }
    process.stderr.write(`  ${out}\n`);
  },

  teardown(): void {
    run('claude plugin uninstall prisme 2>&1');
    run('claude plugin marketplace remove prisme 2>&1');
  },
};
