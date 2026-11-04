/**
 * prisme config <key> [value] — read/write project config (.prisme/config.yaml)
 *
 * Usage:
 *   prisme config                  Show all config
 *   prisme config language         Show language setting
 *   prisme config language fr      Set language to fr (a language code)
 */

import YAML from 'yaml';
import { CONFIG_DEFAULTS, readConfig, writeConfig } from '../lib/config.js';
import { DEFAULT_LANGUAGE, getLanguage, normalizeLanguage } from '../lib/language.js';
import { msg } from '../lib/messages.js';

export function commandConfig(args: string[]): void {
  const key = args[0];
  const value = args[1];

  // prisme config — show all
  if (!key) {
    process.stdout.write(YAML.stringify(readConfig()));
    return;
  }

  // prisme config <key> — read
  if (!value) {
    const config = readConfig();
    if (key === 'language') {
      if (config.language !== undefined && normalizeLanguage(config.language) === null) {
        process.stderr.write(msg('configWarnLanguage', { value: String(config.language), fallback: DEFAULT_LANGUAGE }) + '\n');
      }
      process.stdout.write(getLanguage() + '\n');
      return;
    }
    const val = config[key] ?? CONFIG_DEFAULTS[key];
    process.stdout.write((val !== undefined ? String(val) : msg('configNotSet')) + '\n');
    return;
  }

  // prisme config <key> <value> — write
  let stored = value;
  if (key === 'language') {
    const code = normalizeLanguage(value);
    if (!code) {
      process.stderr.write(msg('configBadLanguage', { value }) + '\n');
      process.exit(1);
    }
    stored = code;
  }
  const config = readConfig();
  config[key] = stored;
  writeConfig(config);
  process.stderr.write(msg('configSet', { key, value: stored }) + '\n');
}
