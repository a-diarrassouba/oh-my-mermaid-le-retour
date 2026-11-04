import { execFileSync, execSync } from 'node:child_process';

// prisme is not on npm yet: it installs from the GitHub repository, which
// builds it on install (the "prepare" script).
export const INSTALL_SOURCE = 'github:a-diarrassouba/oh-my-mermaid-le-retour';

export async function commandUpdate(): Promise<void> {
  // Step 1: Update the CLI
  process.stderr.write('Updating prisme CLI...\n');
  try {
    const out = execSync(`npm install -g ${INSTALL_SOURCE} 2>&1`, { encoding: 'utf-8' }).trim();
    if (out) process.stderr.write(`  ${out}\n`);
    process.stderr.write('  CLI updated.\n');
  } catch (err: any) {
    process.stderr.write(`  update failed: ${err.message}\n`);
    process.stderr.write(`  Try manually: npm install -g ${INSTALL_SOURCE}\n`);
    return;
  }

  // Step 2: Re-run setup through the freshly installed CLI
  process.stderr.write('\nUpdating platform plugins...\n');
  try {
    execFileSync('prisme', ['setup'], { stdio: 'inherit' });
  } catch (err: any) {
    process.stderr.write('  Updated the CLI, but failed to re-run `prisme setup`.\n');
    throw err;
  }
}
