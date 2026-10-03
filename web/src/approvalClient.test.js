import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionIntent, sendDecision, messageFor } from './approvalClient.js';

test('a retry of the same intent reuses the same Idempotency-Key', async () => {
  const sent = [];
  const fakeFetch = async (_url, init) => {
    sent.push(init.headers['idempotency-key']);
    return { ok: true, json: async () => ({ status: 'approved' }) };
  };
  const intent = createDecisionIntent('101', 'approve', 'ok');
  await sendDecision(intent, 't', fakeFetch);
  await sendDecision(intent, 't', fakeFetch); // user retries after a timeout
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
});

test('an approval can be aborted (stale response after switching user)', async () => {
  let seen;
  const fakeFetch = async (_url, init) => {
    seen = init.signal;
    throw new DOMException('aborted', 'AbortError');
  };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sendDecision(createDecisionIntent('101', 'approve', 'ok'), 't', fakeFetch, controller.signal), {
    name: 'AbortError',
  });
  assert.equal(seen, controller.signal);
});

test('a new intent gets a new key', () => {
  assert.notEqual(createDecisionIntent('101', 'approve', 'ok').key, createDecisionIntent('101', 'approve', 'ok').key);
});

test('404 message does not reveal whether the request exists in another tenant', () => {
  assert.match(messageFor(404), /does not exist or is not visible/);
});

test('reject goes to the reject endpoint with its own key', async () => {
  let url;
  const fakeFetch = async (u) => {
    url = u;
    return { ok: true, json: async () => ({ status: 'rejected' }) };
  };
  await sendDecision(createDecisionIntent('101', 'reject', 'overlap'), 't', fakeFetch);
  assert.match(url, /\/101\/reject$/);
});
