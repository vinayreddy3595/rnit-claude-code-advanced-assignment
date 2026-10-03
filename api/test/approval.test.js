// Integration tests: real HTTP, real auth middleware, real SQLite file. Nothing is mocked.
// Each test maps to one row of docs/contract.md.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
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
  assert.equal(countEvents(db, '101', 'north'), 0);
});

test('C2: employee A (north) approves #101 -> 403, nothing changes', async () => {
  const res = await approve(FIXTURES.employeeA, 'k1');
  assert.equal(res.status, 403);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
  assert.equal(countEvents(db, '101', 'north'), 0);
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
  assert.equal(countEvents(db, '101', 'north'), 0);
});

test('C4: manager B (north) approves #101 -> approved once, exactly one event', async () => {
  const res = await approve(FIXTURES.managerB, 'k1');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'approved');
  assert.equal(findRequest(db, '101', 'north').status, 'approved');
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C5: same key + same body retried -> same result, still one event', async () => {
  const first = await approve(FIXTURES.managerB, 'k1');
  const second = await approve(FIXTURES.managerB, 'k1');
  assert.equal(second.status, first.status);
  assert.deepEqual(await second.json(), await first.json());
  assert.equal(second.headers.get('idempotent-replayed'), 'true');
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C5b: replay survives an API restart (not an in-memory map)', async () => {
  const first = await (await approve(FIXTURES.managerB, 'k1')).json();
  await stop();
  await start();
  const res = await approve(FIXTURES.managerB, 'k1');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), first);
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C6: same key + different body -> 409 key-reuse (not just invalid transition)', async () => {
  await approve(FIXTURES.managerB, 'k1', { comment: 'ok' });
  const res = await approve(FIXTURES.managerB, 'k1', { comment: 'changed' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'idempotency_key_reused_with_different_body');
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C6b: same key reused on a different request id -> 409, second request untouched', async () => {
  await approve(FIXTURES.managerB, 'k1');
  const res = await call('/api/requests/102/approve', {
    user: FIXTURES.managerB, method: 'POST', key: 'k1', body: { comment: 'ok' },
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'idempotency_key_reused_with_different_body');
  assert.equal(findRequest(db, '102', 'north').status, 'pending');
  assert.equal(countEvents(db, '102', 'north'), 0);
});

test('C6c: a key first used on a hidden/missing id still works on a valid id', async () => {
  const miss = await call('/api/requests/201/approve', {
    user: FIXTURES.managerB, method: 'POST', key: 'k1', body: { comment: 'ok' },
  });
  assert.equal(miss.status, 404); // #201 is South's
  const res = await approve(FIXTURES.managerB, 'k1');
  assert.equal(res.status, 200);
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C7: new key on an already-approved request -> 409 invalid transition', async () => {
  await approve(FIXTURES.managerB, 'k1');
  const res = await approve(FIXTURES.managerB, 'k2');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'invalid_transition');
  assert.equal(countEvents(db, '101', 'north'), 1);
});

// node:sqlite is synchronous, so in one process these requests are handled one after another.
// This proves the status guard; C8b proves behaviour across separate processes/connections.
test('C8: burst of 10 approvals with different keys (one process) -> exactly one succeeds', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => approve(FIXTURES.managerB, `race-${i}`)),
  );
  const codes = results.map((r) => r.status).sort();
  assert.equal(codes.filter((c) => c === 200).length, 1);
  assert.equal(codes.filter((c) => c === 409).length, 9);
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C8b: 6 worker threads, own DB connections, approve at the same instant -> exactly one 200', async () => {
  const N = 6;
  const gate = new Int32Array(new SharedArrayBuffer(4));
  const workerFile = fileURLToPath(new URL('./race-worker.js', import.meta.url));
  const actor = { id: FIXTURES.managerB.id, tenantId: 'north' };
  const workers = Array.from({ length: N }, (_, i) =>
    new Worker(workerFile, { workerData: { dbFile, gate, actor, key: `w-${i}` } }));
  const done = workers.map((w) => new Promise((ok, fail) => { w.once('message', ok); w.once('error', fail); }));
  await new Promise((r) => setTimeout(r, 300)); // let every worker open its connection
  Atomics.store(gate, 0, 1);
  Atomics.notify(gate, 0); // release all at once
  const codes = (await Promise.all(done)).map((m) => m.code);
  assert.deepEqual(codes.filter((c) => c === 200).length, 1, `codes: ${codes}`);
  assert.equal(codes.filter((c) => c === 409).length, N - 1, `codes: ${codes}`);
  assert.equal(countEvents(db, '101', 'north'), 1);
});

test('C9: missing Idempotency-Key -> 400', async () => {
  const res = await approve(FIXTURES.managerB, undefined);
  assert.equal(res.status, 400);
  assert.equal(findRequest(db, '101', 'north').status, 'pending');
  assert.equal(countEvents(db, '101', 'north'), 0);
});
