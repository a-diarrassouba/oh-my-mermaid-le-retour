/**
 * prisme read <path> <field>           — read a field
 * prisme write <path> <field> <text|-> — write a field
 *
 * Paths use / for nesting: overall-architecture/main-process
 */

import {
  isValidField,
  ensureOmmForRead,
  readField,
  writeField,
  readNodeField,
  writeNodeField,
  readTitle,
  writeTitle,
} from '../lib/store.js';
import { VALID_FIELDS, type Field } from '../types.js';
import { msg } from '../lib/messages.js';
import { readExplainSource, readIcon, writeExplain, writeIcon } from '../lib/explain.js';

// Besides the fields: the title and icon (meta.yaml) and the explanations (explain.yaml).
const EXTRA_NAMES = ['title', 'icon', 'explain'];
const VALID_NAMES = [...VALID_FIELDS, ...EXTRA_NAMES].join(', ');
const isName = (field: string) => EXTRA_NAMES.includes(field) || isValidField(field);

function parsePath(targetPath: string): { perspective: string; nodePath: string[] } {
  const parts = targetPath.split('/');
  return { perspective: parts[0], nodePath: parts.slice(1) };
}

export function commandRead(targetPath?: string, field?: string): void {
  if (!targetPath || !field) {
    process.stderr.write(msg('usage', { usage: 'prisme read <path> <field>' }) + '\n');
    process.exit(1);
  }
  if (!isName(field)) {
    process.stderr.write(msg('invalidField', { field, valid: VALID_NAMES }) + '\n');
    process.exit(1);
  }
  if (!ensureOmmForRead()) return;

  const { perspective, nodePath } = parsePath(targetPath);
  if (field === 'title') {
    const title = readTitle(perspective, nodePath);
    if (title) process.stdout.write(title + '\n');
    return;
  }
  if (field === 'icon') {
    const icon = readIcon(perspective, nodePath);
    if (icon) process.stdout.write(icon + '\n');
    return;
  }
  if (field === 'explain') {
    const source = readExplainSource(perspective, nodePath);
    if (source) process.stdout.write(source);
    return;
  }
  const content = nodePath.length === 0
    ? readField(perspective, field as Field)
    : readNodeField(perspective, nodePath, field as Field);

  if (content) {
    process.stdout.write(content);
  }
}

export async function commandWrite(targetPath?: string, field?: string, contentArgs?: string[]): Promise<void> {
  if (!targetPath || !field) {
    process.stderr.write(msg('usage', { usage: 'prisme write <path> <field> <content|->' }) + '\n');
    process.exit(1);
  }
  if (!isName(field)) {
    process.stderr.write(msg('invalidField', { field, valid: VALID_NAMES }) + '\n');
    process.exit(1);
  }

  const args = contentArgs ?? [];
  let content: string;

  if (args.length === 0) {
    process.stderr.write(msg('usage', { usage: 'prisme write <path> <field> <content|->' }) + '\n');
    process.exit(1);
    return;
  }

  if (args[0] === '-') {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf-8');
  } else {
    content = args.join(' ');
  }

  const { perspective, nodePath } = parsePath(targetPath);
  if (field === 'title') {
    writeTitle(perspective, nodePath, content);
    return;
  }
  if (field === 'icon') {
    const error = writeIcon(perspective, nodePath, content);
    if (error) {
      process.stderr.write(msg('error', { message: error }) + '\n');
      process.exit(1);
    }
    process.stderr.write(msg(content.trim() ? 'iconSet' : 'iconRemoved', { path: targetPath, icon: content.trim() }) + '\n');
    return;
  }
  if (field === 'explain') {
    const { written, issues } = writeExplain(perspective, nodePath, content);
    if (!written) {
      process.stderr.write(msg('explainRefused', { path: targetPath }) + '\n' + issues.map(i => `  ${i}\n`).join(''));
      process.exit(1);
    }
    process.stderr.write(msg('explainWritten', { path: targetPath }) + '\n');
    return;
  }
  if (nodePath.length === 0) {
    writeField(perspective, field as Field, content);
  } else {
    writeNodeField(perspective, nodePath, field as Field, content);
  }
}
