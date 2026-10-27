/**
 * omm config <key> [value] — read/write project config (.omm/config.yaml)
 *
 * Usage:
 *   omm config                  Show all config
 *   omm config language         Show language setting
 *   omm config language fr      Set language to fr (a language code)
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ensureOmmForWrite, getOmmDir } from '../lib/store.js';
import { DEFAULT_LANGUAGE, getLanguage, normalizeLanguage } from '../lib/language.js';
import type { OmmConfig } from '../types.js';

const CONFIG_FILE = 'config.yaml';

function readConfig(cwd?: string): OmmConfig {
  const filePath = path.join(getOmmDir(cwd), CONFIG_FILE);
  if (!fs.existsSync(filePath)) return { version: '0.1.0' };
  return YAML.parse(fs.readFileSync(filePath, 'utf-8')) as OmmConfig;
}

function writeConfig(config: OmmConfig, cwd?: string): void {
  ensureOmmForWrite(cwd);
  const filePath = path.join(getOmmDir(cwd), CONFIG_FILE);
  fs.writeFileSync(filePath, YAML.stringify(config), 'utf-8');
}

export function commandConfig(args: string[]): void {
  const key = args[0];
  const value = args[1];

  // omm config — show all
  if (!key) {
    const config = readConfig();
    process.stdout.write(YAML.stringify(config));
    return;
  }

  // omm config <key> — read
  if (!value) {
    const config = readConfig();
    if (key === 'language') {
      if (config.language !== undefined && normalizeLanguage(config.language) === null) {
        process.stderr.write(`warning: '${config.language}' in .omm/config.yaml is not a language code, using ${DEFAULT_LANGUAGE}. Fix it with: omm config language fr\n`);
      }
      process.stdout.write(getLanguage() + '\n');
      return;
    }
    const val = (config as Record<string, unknown>)[key];
    process.stdout.write((val !== undefined ? String(val) : '(not set)') + '\n');
    return;
  }

  // omm config <key> <value> — write
  let stored = value;
  if (key === 'language') {
    const code = normalizeLanguage(value);
    if (!code) {
      process.stderr.write(`error: '${value}' is not a language code. Use a code such as fr, en, ko, ja, zh or pt-BR.\n`);
      process.exit(1);
    }
    stored = code;
  }
  const config = readConfig();
  (config as Record<string, unknown>)[key] = stored;
  writeConfig(config);
  process.stderr.write(`config: ${key}=${stored}\n`);
}
