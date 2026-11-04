import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getSkillsSource } from '../lib/platforms/utils.js';

// prisme is not on npm yet: it is installed from a clone of this repository
// (`npm install` builds it, `npm link` exposes the command), so updating means
// pulling that clone and building it again.
export const REPO_URL = 'https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git';

const INSTALL_STEPS = `  git clone ${REPO_URL} prisme
  cd prisme && npm install && npm link`;

export async function commandUpdate(): Promise<void> {
  const skills = getSkillsSource();
  const root = skills ? path.dirname(skills) : null;
  if (!root || !fs.existsSync(path.join(root, '.git'))) {
    process.stderr.write(`prisme was not installed from a clone of its repository, so it cannot update itself.\nReinstall it with:\n${INSTALL_STEPS}\n`);
    return;
  }

  // Step 1: Update the clone and rebuild it
  process.stderr.write(`Updating prisme in ${root}...\n`);
  try {
    execFileSync('git', ['-C', root, 'pull', '--ff-only'], { stdio: 'inherit' });
    execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit' });
    process.stderr.write('  CLI updated.\n');
  } catch (err: any) {
    process.stderr.write(`  update failed: ${err.message}\n`);
    process.stderr.write(`  Try manually: cd ${root} && git pull && npm install\n`);
    return;
  }

  // Step 2: Re-run setup through the freshly built CLI
  process.stderr.write('\nUpdating platform plugins...\n');
  try {
    execFileSync('prisme', ['setup'], { stdio: 'inherit' });
  } catch (err: any) {
    process.stderr.write('  Updated the CLI, but failed to re-run `prisme setup`.\n');
    throw err;
  }
}
