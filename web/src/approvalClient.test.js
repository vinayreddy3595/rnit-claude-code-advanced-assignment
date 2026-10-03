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

test('ISSUE-17: a list loaded for another user is never shown, even for one render', async () => {
  const { visibleList } = await import('./approvalClient.js');
  const northList = { owner: 'tok-north-manager-b', state: 'ready', items: [{ id: '101' }] };
  assert.deepEqual(visibleList(northList, 'tok-south-manager-c'), { state: 'loading', items: [] });
  assert.equal(visibleList(northList, 'tok-north-manager-b'), northList);
});

test('409 messages tell a race apart from a mismatched retry', async () => {
  const reply = (status, error) => async () => ({ ok: false, status, json: async () => ({ error }) });
  const intent = createDecisionIntent('101', 'reject', 'x');
  const race = await sendDecision(intent, 't', reply(409, 'invalid_transition'));
  const reuse = await sendDecision(intent, 't', reply(409, 'idempotency_key_reused_with_different_body'));
  assert.match(race.message, /already decided/);
  assert.match(reuse.message, /did not match the original/);
  assert.notEqual(race.message, reuse.message);
});

test('403 and 5xx messages are accurate for reject and after a possible commit', () => {
  assert.match(messageFor(403), /approve or reject/);
  assert.match(messageFor(502), /Refresh to see whether/);
  assert.doesNotMatch(messageFor(502), /not recorded/);
});
