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

test('a new intent gets a new key', () => {
  assert.notEqual(createApprovalIntent('101', 'ok').key, createApprovalIntent('101', 'ok').key);
});

test('404 message does not reveal whether the request exists in another tenant', () => {
  assert.match(messageFor(404), /does not exist or is not visible/);
});
