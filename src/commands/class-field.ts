import { ensureOmmForRead, isValidField, readField, writeField, classExists } from '../lib/store.js';
import { VALID_FIELDS, type Field } from '../types.js';
import { msg } from '../lib/messages.js';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

export async function commandClassField(className: string, field: string, content?: string): Promise<void> {
  if (!isValidField(field)) {
    process.stderr.write(msg('invalidField', { field, valid: VALID_FIELDS.join(', ') }) + '\n');
    process.exit(1);
  }

  const typedField = field as Field;

  // Read mode: no content argument
  if (content === undefined) {
    if (!ensureOmmForRead()) return;
    if (!classExists(className)) {
      process.stderr.write(msg('elementNotFound', { path: className }) + '\n');
      process.exit(1);
    }
    const value = readField(className, typedField);
    if (value === null) {
      process.stderr.write(msg('fieldEmpty', { path: `${className}/${field}` }) + '\n');
      process.exit(1);
    }
    process.stdout.write(value);
    return;
  }

  // Write mode: writeField() handles lazy-init internally
  let finalContent: string;
  if (content === '-') {
    finalContent = await readStdin();
  } else {
    finalContent = content;
  }

  writeField(className, typedField, finalContent);
}
