#!/usr/bin/env node
// PreToolUse hook (matcher "Bash|PowerShell"): deny dangerous commands before they run,
// whatever the prompt said. Written in Node because jq is not installed on this machine.
// Fails closed: unreadable input is denied, not allowed.
import { readFileSync } from 'node:fs';

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Blocked by RNIT guard (${reason})`,
    },
  }));
  process.exit(0);
}

let cmd;
try {
  cmd = JSON.parse(readFileSync(0, 'utf8')).tool_input.command;
  if (typeof cmd !== 'string') throw new Error('no command');
} catch {
  deny('unreadable hook input');
}

const DENY = [
  [/prod[-._a-z0-9]*\.rnit/i, 'production host'],
  [/\bgit\b.*\bpush\b.*(--force|--force-with-lease|\s-f\b|\s\+\S)/i, 'force push'],
  [/\brm\s+(-[a-z]*\s+)*-?[a-z]*[rf][a-z]*\s+(-[a-z]*\s+)*\/(\*|\s|$)/i, 'rm on filesystem root'],
  [/Remove-Item\b.*-Recurse/i, 'recursive delete (PowerShell)'],
  [/\b(Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i, 'network download (PowerShell)'],
  [/\bDROP\s+(TABLE|DATABASE)\b/i, 'destructive SQL'],
  [/\bTRUNCATE\s+TABLE\b/i, 'destructive SQL'],
  [/(^|[\s/\\"'])\.env(\.[\w-]+)?\b/i, 'reads .env'],
];

const hit = DENY.find(([re]) => re.test(cmd));
if (hit) deny(hit[1]);
process.exit(0);
