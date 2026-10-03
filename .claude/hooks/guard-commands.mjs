#!/usr/bin/env node
// PreToolUse hook (matcher "Bash"): deny dangerous commands before they run,
// whatever the prompt said. Written in Node because jq is not installed on this machine.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const cmd = input?.tool_input?.command ?? '';

const DENY = [
  /prod[-.a-z0-9]*\.rnit/i,          // production hosts
  /git\s+push\b.*(--force|-f\b)/i,   // force push
  /rm\s+-rf\s+\/(\s|$)/i,            // wipe root
  /\bDROP\s+(TABLE|DATABASE)\b/i,    // destructive SQL
  /\bTRUNCATE\s+TABLE\b/i,
];

const hit = DENY.find((re) => re.test(cmd));
if (hit) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Blocked by RNIT guard (${hit})`,
    },
  }));
}
process.exit(0);
