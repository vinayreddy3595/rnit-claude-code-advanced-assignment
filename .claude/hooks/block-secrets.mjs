#!/usr/bin/env node
// UserPromptSubmit hook: reject prompts that contain secrets so they never reach the transcript.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const prompt = input?.prompt ?? '';

const SECRETS = [
  /ghp_[A-Za-z0-9]{20,}/,           // GitHub token
  /sk-ant-[A-Za-z0-9_-]{10,}/,      // Anthropic key
  /AKIA[0-9A-Z]{16}/,               // AWS access key
  /password\s*=\s*\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

if (SECRETS.some((re) => re.test(prompt))) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: 'Prompt looks like it contains a secret. Remove it and use a placeholder.',
  }));
}
process.exit(0);
