#!/usr/bin/env node
// PostToolUse hook (matcher "Edit|Write"): run the repository formatter (prettier) on the edited file.
// - Parses stdin JSON; the file name is passed as an argv element, never interpolated into a shell.
// - Extension filter, binary check, bounded runtime (8 s).
// - Observes only: it cannot undo the write, and a Bash command that writes a file bypasses this matcher.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, resolve, relative, isAbsolute } from 'node:path';

const FORMATTABLE = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.html']);
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = resolve(projectDir, 'node_modules/prettier/bin/prettier.cjs');

let file;
try {
  file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
} catch {
  process.exit(0); // nothing to format; a PostToolUse hook cannot block the write anyway
}
if (typeof file !== 'string' || !FORMATTABLE.has(extname(file).toLowerCase())) process.exit(0);

const abs = resolve(projectDir, file);
const rel = relative(projectDir, abs);
if (rel.startsWith('..') || isAbsolute(rel) || rel.includes('node_modules') || !existsSync(abs)) process.exit(0);
if (readFileSync(abs).subarray(0, 8000).includes(0)) process.exit(0); // binary content, wrong extension

try {
  execFileSync(process.execPath, [prettier, '--write', '--log-level', 'warn', abs], {
    cwd: projectDir,
    timeout: 8000,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
} catch (err) {
  // Tell Claude the formatter failed (usually a syntax error) instead of failing silently.
  const detail = String(err.stderr ?? err.message)
    .split('\n')
    .slice(0, 6)
    .join('\n');
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `Formatter failed on ${rel}. Fix the file before continuing:\n${detail}`,
    }),
  );
}
process.exit(0);
