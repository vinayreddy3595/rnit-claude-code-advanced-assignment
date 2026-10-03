import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalIntent, sendApproval, messageFor } from './approvalClient.js';

test('a retry of the same intent reuses the same Idempotency-Key', async () => {
  const sent = [];
  const fakeFetch = async (_url, init) => {
    sent.push(init.headers['idempotency-key']);
    return { ok: true, json: async () => ({ status: 'approved' }) };
  };
  const intent = createApprovalIntent('101', 'ok');
  await sendApproval(intent, 't', fakeFetch);
  await sendApproval(intent, 't', fakeFetch); // user retries after a timeout
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
});

test('an approval can be aborted (stale response after switching user)', async () => {
  let seen;
  const fakeFetch = async (_url, init) => { seen = init.signal; throw new DOMException('aborted', 'AbortError'); };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sendApproval(createApprovalIntent('101', 'ok'), 't', fakeFetch, controller.signal), { name: 'AbortError' });
  assert.equal(seen, controller.signal);
});

test('a new intent gets a new key', () => {
  assert.notEqual(createApprovalIntent('101', 'ok').key, createApprovalIntent('101', 'ok').key);
});

test('404 message does not reveal whether the request exists in another tenant', () => {
  assert.match(messageFor(404), /does not exist or is not visible/);
});
