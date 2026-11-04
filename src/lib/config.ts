import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ensureOmmForWrite, getOmmDir } from './store.js';
import type { OmmConfig } from '../types.js';

const CONFIG_FILE = 'config.yaml';

export function readConfig(cwd?: string): OmmConfig {
  const filePath = path.join(getOmmDir(cwd), CONFIG_FILE);
  if (!fs.existsSync(filePath)) return { version: '0.1.0' };
  return (YAML.parse(fs.readFileSync(filePath, 'utf-8')) as OmmConfig | null) ?? { version: '0.1.0' };
}

export function writeConfig(config: OmmConfig, cwd?: string): void {
  ensureOmmForWrite(cwd);
  fs.writeFileSync(path.join(getOmmDir(cwd), CONFIG_FILE), YAML.stringify(config), 'utf-8');
}

/** Settings with a default, shown by `prisme config <key>` when unset. */
export const CONFIG_DEFAULTS: Record<string, string> = {
  'scan.max_depth': '3',
};
