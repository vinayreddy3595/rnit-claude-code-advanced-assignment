// UI-independent client logic, so it can be tested without a browser.
// The server is the authority: a disabled button is NOT idempotency (see .claude/rules/react.md).

export const API = 'http://localhost:3000/api/requests';

const MESSAGES = {
  400: 'The request was incomplete. Please try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'Only managers can approve leave.',
  404: 'This request does not exist or is not visible to you.',
  409: 'This request was already decided, or the retry did not match the original.',
};

export function messageFor(status) {
  return MESSAGES[status] ?? 'Something went wrong. Your decision was not recorded.';
}

/**
 * One approval "intent" keeps one Idempotency-Key across retries, so a timeout
 * followed by a retry can never record two decisions.
 */
export function createApprovalIntent(id, comment, newKey = () => crypto.randomUUID()) {
  return { id, comment, key: newKey() };
}

export async function sendApproval(intent, token, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}/${encodeURIComponent(intent.id)}/approve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': intent.key,
    },
    body: JSON.stringify({ comment: intent.comment }),
  });
  if (res.ok) return { ok: true, data: await res.json() };
  return { ok: false, status: res.status, message: messageFor(res.status) };
}
