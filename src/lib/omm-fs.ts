import fs from 'node:fs';
import path from 'node:path';

/** omm never follows a symlink inside .omm/: it could lead outside the project. */
export class OmmSymlinkError extends Error {
  constructor(target: string) {
    super(`refusing to follow a symlink in .omm/: ${target}`);
    this.name = 'OmmSymlinkError';
  }
}

/**
 * Throws when .omm/ itself, or any existing part of `target` below it, is a
 * symlink, or when `target` is not inside .omm/. Parts that do not exist yet
 * are fine: they will be created as plain folders and files.
 */
export function assertNoSymlink(ommDir: string, target: string): void {
  const root = path.resolve(ommDir);
  const relative = path.relative(root, path.resolve(target));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path leaves the .omm directory: ${target}`);
  }
  const segments = relative === '' ? [] : relative.split(path.sep);
  let current = root;
  for (let i = 0; i <= segments.length; i++) {
    if (i > 0) current = path.join(current, segments[i - 1]);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return;
      throw err;
    }
    if (stat.isSymbolicLink()) throw new OmmSymlinkError(path.join('.omm', path.relative(root, current)));
  }
}

/** Whether `target` is inside .omm/ and reached without any symlink. */
export function isPlainOmmPath(ommDir: string, target: string): boolean {
  try {
    assertNoSymlink(ommDir, target);
    return true;
  } catch (err) {
    if (err instanceof OmmSymlinkError) return false;
    throw err;
  }
}

const warned = new Set<string>();

/** Reads a file of .omm/; null when it is missing, not a regular file, or behind a symlink. */
export function readOmmFile(ommDir: string, file: string): string | null {
  try {
    assertNoSymlink(ommDir, file);
  } catch (err) {
    if (!(err instanceof OmmSymlinkError)) throw err;
    if (!warned.has(err.message)) process.stderr.write(`warning: ${err.message}\n`);
    warned.add(err.message);
    return null;
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return null;
  }
  return stat.isFile() ? fs.readFileSync(file, 'utf-8') : null;
}

/** Creates the folders of `dir` inside .omm/, never through a symlink. */
export function makeOmmDir(ommDir: string, dir: string): void {
  assertNoSymlink(ommDir, dir);
  fs.mkdirSync(dir, { recursive: true });
}

/** Writes a file of .omm/ and creates its folders, never through a symlink. */
export function writeOmmFile(ommDir: string, file: string, content: string): void {
  makeOmmDir(ommDir, path.dirname(file));
  assertNoSymlink(ommDir, file);
  const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW = 0 } = fs.constants;
  const fd = fs.openSync(file, O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0o666); // minus umask, as before
  try {
    fs.writeFileSync(fd, content, 'utf-8');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Removes a file or folder of .omm/, never through a symlink. When `target`
 * itself is a symlink, only the link goes (rm does not follow it).
 */
export function removeOmmPath(ommDir: string, target: string): void {
  if (path.resolve(target) === path.resolve(ommDir)) throw new Error('refusing to remove .omm/ itself');
  assertNoSymlink(ommDir, path.dirname(target));
  fs.rmSync(target, { recursive: true });
}
