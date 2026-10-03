#!/usr/bin/env node
// UserPromptSubmit hook: reject prompts that contain secrets so they never reach the transcript.
import { readFileSync } from 'node:fs';

let prompt = '';
try {
  prompt = JSON.parse(readFileSync(0, 'utf8')).prompt ?? '';
} catch {
  prompt = '';
}

const SECRETS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /github_pat_[A-Za-z0-9_]{20,}/, // GitHub fine-grained token
  /sk-ant-[A-Za-z0-9_-]{10,}/, // Anthropic key
  /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, // AWS access keys
  /["']?(password|passwd|pwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?[^\s"']{8,}/i,
  /["']?(password|passwd|pwd)["']?\s*[:=]\s*["']?[^\s"']{3,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

if (SECRETS.some((re) => re.test(prompt))) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: 'The prompt looks like it contains a credential. Redact it and refer to the value by name.',
      // Without this the block message echoes the secret back to the terminal.
      suppressOriginalPrompt: true,
    }),
  );
}
process.exit(0);
