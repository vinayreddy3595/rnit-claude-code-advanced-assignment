// Replayable capture of user-visible and API evidence for RNIT-TRAIN-101.
//   npm run build --prefix web && npm run evidence:capture
// Starts the API on a fresh synthetic DB and the built web client, then writes:
//   docs/evidence/07-api-transcript.md   sanitized request/response pairs
//   docs/evidence/screens/*.png          UI states at desktop and phone width
//   docs/evidence/09-ui-evidence.md      what each screenshot shows and cannot prove
// Uses an installed Edge/Chrome (BROWSER env var to override). Tokens are synthetic and still redacted.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'docs/evidence');
const shots = join(out, 'screens');
mkdirSync(shots, { recursive: true });

const BROWSER =
  process.env.BROWSER ??
  [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find(existsSync);
if (!BROWSER) throw new Error('No browser found; set BROWSER to a Chrome/Edge executable');

const API = 'http://localhost:3000/api/requests';
const TOKENS = {
  'tok-north-employee-a': 'Employee A (North)',
  'tok-north-manager-b': 'Manager B (North)',
  'tok-south-manager-c': 'Manager C (South)',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`timed out waiting for ${url}`);
}

function startApi() {
  const dir = mkdtempSync(join(tmpdir(), 'evidence-'));
  const proc = spawn(process.execPath, ['src/server.js'], {
    cwd: join(root, 'api'),
    env: { ...process.env, DB_FILE: join(dir, 'leave.db'), PORT: '3000' },
    stdio: 'ignore',
  });
  return {
    ready: waitFor(API),
    stop: async () => {
      proc.kill();
      await sleep(400);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function startWeb() {
  const vite = join(root, 'web/node_modules/vite/bin/vite.js');
  const proc = spawn(process.execPath, [vite, 'preview', '--port', '5173', '--strictPort'], {
    cwd: join(root, 'web'),
    stdio: 'ignore',
  });
  return { ready: waitFor('http://localhost:5173'), stop: () => proc.kill() };
}

// ---------------- 1. API transcript ----------------
async function apiTranscript() {
  const api = startApi();
  await api.ready;
  const rows = [];
  async function call(label, method, path, { token, key, body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (key) headers['idempotency-key'] = key;
    const res = await fetch(API + path, { method, headers, body: body && JSON.stringify(body) });
    const text = await res.text();
    rows.push({
      label,
      req: [
        `${method} /api/requests${path}`,
        token ? `Authorization: Bearer <redacted: ${TOKENS[token]}>` : '(no Authorization header)',
        key ? `Idempotency-Key: ${key}` : null,
        body ? JSON.stringify(body) : null,
      ]
        .filter(Boolean)
        .join('\n'),
      res: `HTTP ${res.status}${res.headers.get('idempotent-replayed') ? '  Idempotent-Replayed: true' : ''}\n${text}`,
    });
  }
  const B = 'tok-north-manager-b';
  await call('C1 no session', 'POST', '/101/approve', { key: 'k1', body: {} });
  await call('C2 employee approves', 'POST', '/101/approve', {
    token: 'tok-north-employee-a',
    key: 'k1',
    body: { comment: 'ok' },
  });
  await call('C3 South manager reads North #101', 'GET', '/101', { token: 'tok-south-manager-c' });
  await call('C13 South manager claims tenant north in body', 'POST', '/101/approve', {
    token: 'tok-south-manager-c',
    key: 'k1',
    body: { comment: 'ok', tenantId: 'north' },
  });
  await call('C4 North manager approves #101', 'POST', '/101/approve', {
    token: B,
    key: 'k1',
    body: { comment: 'ok' },
  });
  await call('C5 same key, same body (retry)', 'POST', '/101/approve', {
    token: B,
    key: 'k1',
    body: { comment: 'ok' },
  });
  await call('C6 same key, different body', 'POST', '/101/approve', {
    token: B,
    key: 'k1',
    body: { comment: 'changed' },
  });
  await call('C12 reject after approve (new key)', 'POST', '/101/reject', { token: B, key: 'r1', body: {} });
  await call('North list after the run', 'GET', '', { token: B });
  await call('South list (never contains #101)', 'GET', '', { token: 'tok-south-manager-c' });
  await api.stop();

  const md = [
    `# API request/response evidence — ${new Date().toISOString()}`,
    '',
    'Captured by `npm run evidence:capture` against a fresh synthetic database (real Express app, real SQLite).',
    'Bearer tokens are synthetic and still redacted. Order matters: each call runs against the state left by the previous one.',
    '',
    ...rows.flatMap((r) => [`## ${r.label}`, '', '```http', r.req, '```', '', '```', r.res, '```', '']),
  ].join('\n');
  writeFileSync(join(out, '07-api-transcript.md'), md);
  console.log(`API transcript: ${rows.length} calls`);
}

// ---------------- 2. UI screenshots ----------------
async function uiShots() {
  const web = startWeb();
  await web.ready;
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
  const notes = [];
  const sizes = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 760, isMobile: true } };

  for (const [size, viewport] of Object.entries(sizes)) {
    const api = startApi(); // fresh synthetic DB per width, so #101 starts pending
    await api.ready;
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const shot = async (name, action, expected) => {
      const file = `${size}-${name}.png`;
      await page.screenshot({ path: join(shots, file) });
      if (size === 'desktop') notes.push({ file: name, action, expected });
    };
    const status = () => page.$eval('[role="status"]', (el) => el.textContent);

    // Loading: hold the list request open so the loading state is visible.
    await page.setRequestInterception(true);
    let release;
    const held = new Promise((r) => (release = r));
    page.on('request', async (req) => {
      if (req.url() === API && req.method() === 'GET' && release) {
        await held;
      }
      req.continue();
    });
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main');
    await shot('01-loading', 'Open the app as Manager B (North); list request held open', '"Loading requests…" shown');
    release();
    release = null;
    await page.waitForSelector('table');
    await shot('02-manager-b-list', 'List loads for Manager B (North)', 'North requests #101 and #102, both pending');

    await page.click('button ::-p-text(Approve 101)');
    await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes('approved'));
    await shot('03-approved', 'Click "Approve 101"', `Status "${await status()}"; #101 shows approved, buttons gone`);

    await page.select('select', 'tok-south-manager-c');
    await page.waitForFunction(() => document.querySelector('table') && !document.body.innerText.includes('\n101\t'));
    await page.waitForSelector('table');
    await shot(
      '04-manager-c-south',
      'Switch user to Manager C (South)',
      'Only South request #201; North #101 not listed',
    );

    await page.select('select', 'tok-north-employee-a');
    await page.waitForSelector('button ::-p-text(Approve 102)');
    await page.click('button ::-p-text(Approve 102)');
    await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes('Only managers'));
    await shot('05-employee-403', 'Employee A (North) clicks "Approve 102"', `Server says 403: "${await status()}"`);
    await page.close();
    await api.stop();
  }

  // Error state: no API running.
  const page = await browser.newPage();
  await page.setViewport(sizes.desktop);
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role="alert"]');
  await page.screenshot({ path: join(shots, 'desktop-06-api-down.png') });
  notes.push({
    file: '06-api-down',
    action: 'API stopped, open the app',
    expected: 'Error shown in an alert region; no stale rows',
  });

  await browser.close();
  web.stop();

  const md = [
    `# UI evidence — ${new Date().toISOString()}`,
    '',
    `Captured by \`npm run evidence:capture\` with ${BROWSER.split('/').pop()} (headless) against the built client`,
    '(`vite preview`, port 5173) and the real API on a fresh synthetic DB. Each state at desktop (1280×720) and',
    'phone width (390×760) under `screens/`. No credentials appear on screen; all records are synthetic.',
    '',
    '| Screenshot (desktop / phone) | Action | Expected and observed |',
    '|---|---|---|',
    ...notes.map(
      (n) =>
        `| [${n.file}](screens/desktop-${n.file}.png)${n.file === '06-api-down' ? '' : ` · [phone](screens/phone-${n.file}.png)`} | ${n.action} | ${n.expected} |`,
    ),
    '',
    '## What these screenshots prove, and what they cannot',
    '',
    '| Can show | Cannot prove |',
    '|---|---|',
    '| Loading, approved, 403 and error states; layout at two widths | Authorization: that is proved by API tests C1–C14 and 07-api-transcript.md |',
    "| South user's screen does not list North's #101 | That the API refuses it: proved by C3/C3b/C13 and the mutation check |",
    '| Status announcements exist (`role="status"`, `role="alert"`) | Screen-reader behaviour; not tested with a real screen reader |',
  ].join('\n');
  writeFileSync(join(out, '09-ui-evidence.md'), md);
  console.log(`UI screenshots: ${notes.length} states × 2 widths`);
}

await apiTranscript();
await uiShots();
process.exit(0);
