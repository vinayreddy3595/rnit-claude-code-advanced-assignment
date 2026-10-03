#!/usr/bin/env node
// PreToolUse hook (matcher "Bash|PowerShell"): this repository installs from the committed lockfile.
// A bare `npm install` / `npm i` (no package names) is rewritten to `npm ci`, which never edits
// package-lock.json. Adding a package (`npm install foo`) is left alone for a human to review.
// Every rewrite is logged to .claude/logs/rewrites.log so a reviewer can see what actually ran.
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

let cmd;
try {
  cmd = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command;
} catch {
  process.exit(0); // guard-commands.mjs already denies unreadable input
}
if (typeof cmd !== 'string') process.exit(0);

// npm install|i, optionally followed only by flags like --prefix api / --no-audit, then end or a separator.
const BARE_INSTALL = /(^|[;&|]\s*)npm\s+(install|i)((?:\s+--?[\w-]+(?:[=\s](?!-)[\w./-]+)?)*)(?=\s*(?:$|[;&|]))/g;
const rewritten = cmd.replace(BARE_INSTALL, (_m, sep, _verb, flags) => `${sep}npm ci${flags}`);

if (rewritten !== cmd) {
  const logDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.claude/logs');
  mkdirSync(logDir, { recursive: true });
  appendFileSync(
    resolve(logDir, 'rewrites.log'),
    `${new Date().toISOString()}\t${JSON.stringify(cmd)}\t->\t${JSON.stringify(rewritten)}\n`,
  );
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: `RNIT rewrite (logged): ${cmd} -> ${rewritten}`,
        updatedInput: { command: rewritten },
      },
    }),
  );
}
process.exit(0);
