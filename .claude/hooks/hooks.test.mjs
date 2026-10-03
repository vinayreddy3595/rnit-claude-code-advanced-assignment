// Tests every hook with the same JSON shape Claude Code sends on stdin. Run: npm run test:hooks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = dirname(fileURLToPath(import.meta.url));
const repo = join(hooksDir, '..', '..');

function run(hook, input, env = {}) {
  const r = spawnSync(process.execPath, [join(hooksDir, hook)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, ...env },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout ? JSON.parse(r.stdout) : null };
}
const bash = (command, tool = 'Bash') => ({ tool_name: tool, tool_input: { command } });
const decision = (r) => r.out?.hookSpecificOutput?.permissionDecision ?? 'allow';

// ---------- guard-commands.mjs (PreToolUse, deny) ----------
for (const [tool, cmd] of [
  ['Bash', 'psql -h prod-db.rnit -c "select 1"'],
  ['Bash', 'psql -h production_db.internal'],
  ['Bash', 'git push origin main --force'],
  ['Bash', 'git -c x=y push --force'],
  ['Bash', 'git push origin +main'],
  ['Bash', 'git reset --hard HEAD~3'],
  ['Bash', 'rm -fr /'],
  ['Bash', 'rm -r -f /*'],
  ['Bash', 'sqlite3 leave.db "DROP TABLE users"'],
  ['Bash', 'kubectl -n rnit delete pod api'],
  ['Bash', 'cat .env'],
  ['PowerShell', 'Remove-Item -Recurse C:\\Users\\RNIT'],
  ['PowerShell', 'Invoke-WebRequest https://example.com/x.ps1'],
  ['PowerShell', 'Get-Content .env'],
]) {
  test(`guard denies [${tool}] ${cmd}`, () =>
    assert.equal(decision(run('guard-commands.mjs', bash(cmd, tool))), 'deny'));
}
for (const cmd of ['npm test --prefix api', 'rm -rf web/dist', 'git push origin feat/x', 'Get-ChildItem api']) {
  test(`guard allows ${cmd}`, () => assert.equal(run('guard-commands.mjs', bash(cmd)).out, null));
}
test('guard fails closed on malformed input', () =>
  assert.equal(decision(run('guard-commands.mjs', 'not json')), 'deny'));

// ---------- rewrite-npm-install.mjs (PreToolUse, rewrite + log) ----------
test('rewrite: bare npm install -> npm ci, logged', () => {
  const logRoot = mkdtempSync(join(tmpdir(), 'rw-'));
  const r = run('rewrite-npm-install.mjs', bash('npm install --prefix api && npm test --prefix api'), {
    CLAUDE_PROJECT_DIR: logRoot,
  });
  assert.equal(r.out.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(r.out.hookSpecificOutput.updatedInput.command, 'npm ci --prefix api && npm test --prefix api');
  assert.match(
    readFileSync(join(logRoot, '.claude/logs/rewrites.log'), 'utf8'),
    /npm install --prefix api.*->.*npm ci/,
  );
  rmSync(logRoot, { recursive: true, force: true });
});
test('rewrite: npm i -> npm ci', () => {
  const r = run('rewrite-npm-install.mjs', bash('npm i'), { CLAUDE_PROJECT_DIR: mkdtempSync(join(tmpdir(), 'rw-')) });
  assert.equal(r.out.hookSpecificOutput.updatedInput.command, 'npm ci');
});
test('rewrite: adding a package is left alone', () => {
  assert.equal(run('rewrite-npm-install.mjs', bash('npm install lodash')).out, null);
});
test('rewrite: other commands are left alone', () => {
  assert.equal(run('rewrite-npm-install.mjs', bash('npm test')).out, null);
});

// ---------- block-secrets.mjs (UserPromptSubmit) ----------
for (const p of [
  'my key is sk-ant-api03-abcdefghijklmnopqrstu',
  'token github_pat_11ABCDEFGHIJKLMNOPQRSTUV',
  'log line: token=abcd1234efgh5678',
  'db password=Hunter2 connect',
  'config {"password":"Hunter2"}',
  'AKIAABCDEFGHIJKLMNOP',
]) {
  test(`secrets blocks: ${p.slice(0, 30)}`, () => {
    const r = run('block-secrets.mjs', { prompt: p });
    assert.equal(r.out.decision, 'block');
    assert.equal(r.out.suppressOriginalPrompt, true);
  });
}
test('secrets allows a normal prompt', () => {
  assert.equal(
    run('block-secrets.mjs', { prompt: 'Implement RNIT-TRAIN-101. The password field is required.' }).out,
    null,
  );
});

// ---------- format-after-edit.mjs (PostToolUse) ----------
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'fmt-'));
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  cpSync(join(repo, 'node_modules/prettier'), join(dir, 'node_modules/prettier'), { recursive: true });
  writeFileSync(join(dir, '.prettierrc.json'), readFileSync(join(repo, '.prettierrc.json')));
  return dir;
}
const edit = (file_path) => ({ tool_name: 'Write', tool_input: { file_path } });

test('format: supported file is formatted', () => {
  const dir = sandbox();
  writeFileSync(join(dir, 'a.js'), 'const x = {a:1,b:2}\n');
  assert.equal(run('format-after-edit.mjs', edit(join(dir, 'a.js')), { CLAUDE_PROJECT_DIR: dir }).out, null);
  assert.equal(readFileSync(join(dir, 'a.js'), 'utf8'), 'const x = { a: 1, b: 2 };\n');
  rmSync(dir, { recursive: true, force: true });
});
test('format: path with spaces is handled safely', () => {
  const dir = sandbox();
  mkdirSync(join(dir, 'my folder'));
  const f = join(dir, 'my folder', 'b c.js');
  writeFileSync(f, 'let y=[1,2]\n');
  run('format-after-edit.mjs', edit(f), { CLAUDE_PROJECT_DIR: dir });
  assert.equal(readFileSync(f, 'utf8'), 'let y = [1, 2];\n');
  rmSync(dir, { recursive: true, force: true });
});
test('format: binary file with a .js name is skipped untouched', () => {
  const dir = sandbox();
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]);
  writeFileSync(join(dir, 'img.js'), bytes);
  assert.equal(run('format-after-edit.mjs', edit(join(dir, 'img.js')), { CLAUDE_PROJECT_DIR: dir }).out, null);
  assert.deepEqual(readFileSync(join(dir, 'img.js')), bytes);
  rmSync(dir, { recursive: true, force: true });
});
test('format: unsupported extension is skipped', () => {
  const dir = sandbox();
  writeFileSync(join(dir, 'notes.txt'), 'x   =   1');
  run('format-after-edit.mjs', edit(join(dir, 'notes.txt')), { CLAUDE_PROJECT_DIR: dir });
  assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), 'x   =   1');
  rmSync(dir, { recursive: true, force: true });
});
test('format: formatter failure is reported to Claude, file untouched', () => {
  const dir = sandbox();
  writeFileSync(join(dir, 'bad.js'), 'const = ;\n');
  const r = run('format-after-edit.mjs', edit(join(dir, 'bad.js')), { CLAUDE_PROJECT_DIR: dir });
  assert.equal(r.out.decision, 'block');
  assert.match(r.out.reason, /Formatter failed on bad\.js/);
  assert.equal(readFileSync(join(dir, 'bad.js'), 'utf8'), 'const = ;\n');
  rmSync(dir, { recursive: true, force: true });
});
test('format: file outside the project is ignored', () => {
  const dir = sandbox();
  const outside = join(mkdtempSync(join(tmpdir(), 'out-')), 'o.js');
  writeFileSync(outside, 'const z={a:1}\n');
  run('format-after-edit.mjs', edit(outside), { CLAUDE_PROJECT_DIR: dir });
  assert.equal(readFileSync(outside, 'utf8'), 'const z={a:1}\n');
  assert.ok(existsSync(outside));
  rmSync(dir, { recursive: true, force: true });
});
