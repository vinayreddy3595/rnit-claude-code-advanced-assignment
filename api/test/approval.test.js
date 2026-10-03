// Integration tests: real HTTP, real auth middleware, real SQLite file. Nothing is mocked.
// Each test maps to one row of docs/contract.md.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, countEvents, findRequest } from '../src/db.js';
import { seed, FIXTURES } from '../src/seed.js';
import { createApp } from '../src/app.js';

let dir, dbFile, db, server, base;

async function start() {
  db = seed(openDb(dbFile));
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() {
  await new Promise((r) => server.close(r));
  db.close();
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'leave-'));
  dbFile = join(dir, 'test.db');
  await start();
});
afterEach(async () => {
  await stop();
  rmSync(dir, { recursive: true, force: true });
});

function call(path, { user, method = 'GET', key, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (user) headers.authorization = `Bearer ${user.token}`;
  if (key) headers['idempotency-key'] = key;
  return fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
}
const approve = (user, key, body = { comment: 'ok' }) =>
  call('/api/requests/101/approve', { user, method: 'POST', key, body });

test('C1: no session -> 401', async () => {
  const res = await call('/api/requests/101/approve', { method: 'POST', key: 'k1', body: {} });
  assert.equal(res.status, 401);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
});

test('C2: employee A (north) approves #101 -> 403, nothing changes', async () => {
  const res = await approve(FIXTURES.employeeA, 'k1');
  assert.equal(res.status, 403);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
  assert.equal(countEvents(db, '101'), 0);
});

test('C3: manager C (south) cannot read #101 -> 404', async () => {
  const res = await call('/api/requests/101', { user: FIXTURES.managerC });
  assert.equal(res.status, 404);
  const list = await (await call('/api/requests', { user: FIXTURES.managerC })).json();
  assert.ok(!list.some((r) => r.id === '101'), 'north request leaked into south list');
});

test('C3b: manager C (south) approves #101 -> 404, nothing changes', async () => {
  const res = await approve(FIXTURES.managerC, 'k1');
  assert.equal(res.status, 404);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
  assert.equal(countEvents(db, '101'), 0);
});

test('C4: manager B (north) approves #101 -> approved once, exactly one event', async () => {
  const res = await approve(FIXTURES.managerB, 'k1');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'approved');
  assert.equal(findRequest(db, '101', 'north').status, 'approved');
  assert.equal(countEvents(db, '101'), 1);
});

test('C5: same key + same body retried -> same result, still one event', async () => {
  const first = await approve(FIXTURES.managerB, 'k1');
  const second = await approve(FIXTURES.managerB, 'k1');
  assert.equal(second.status, first.status);
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(second.headers.get('idempotent-replayed'), 'true');
  assert.equal(countEvents(db, '101'), 1);
});

test('C5b: replay survives an API restart (not an in-memory map)', async () => {
  const first = await (await approve(FIXTURES.managerB, 'k1')).json();
  await stop();
  await start();
  const res = await approve(FIXTURES.managerB, 'k1');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), first);
  assert.equal(countEvents(db, '101'), 1);
});

test('C6: same key + different body -> 409', async () => {
  await approve(FIXTURES.managerB, 'k1', { comment: 'ok' });
  const res = await approve(FIXTURES.managerB, 'k1', { comment: 'changed' });
  assert.equal(res.status, 409);
  assert.equal(countEvents(db, '101'), 1);
});

test('C7: new key on an already-approved request -> 409 invalid transition', async () => {
  await approve(FIXTURES.managerB, 'k1');
  const res = await approve(FIXTURES.managerB, 'k2');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'invalid_transition');
  assert.equal(countEvents(db, '101'), 1);
});

test('C8: concurrent approvals with different keys -> exactly one succeeds', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => approve(FIXTURES.managerB, `race-${i}`)),
  );
  const codes = results.map((r) => r.status).sort();
  assert.equal(codes.filter((c) => c === 200).length, 1);
  assert.equal(codes.filter((c) => c === 409).length, 9);
  assert.equal(countEvents(db, '101'), 1);
});

test('C9: missing Idempotency-Key -> 400', async () => {
  const res = await approve(FIXTURES.managerB, undefined);
  assert.equal(res.status, 400);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
});
