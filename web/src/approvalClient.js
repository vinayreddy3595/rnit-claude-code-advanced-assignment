// UI-independent client logic, so it can be tested without a browser.
// The server is the authority: a disabled button is NOT idempotency (see .claude/rules/react.md).

export const API = 'http://localhost:3000/api/requests';

const MESSAGES = {
  400: 'The request was incomplete. Please try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'Only managers can approve or reject leave.',
  404: 'This request does not exist or is not visible to you.',
  409: 'This request was already decided. The list now shows its current status.',
};
// The server says which kind of conflict it was; a key reused with different content is a client bug, not a race.
const ERRORS = {
  idempotency_key_reused_with_different_body:
    'This retry did not match the original request, so nothing was changed. Start a new decision.',
};

/**
 * ISSUE-17: state updates after a user switch land one render late, so a list is tagged with
 * the token it was loaded for and is shown only to that user. Correct by construction.
 */
const LOADING = { state: 'loading', items: [] };
export function visibleList(list, token) {
  return list.owner === token ? list : LOADING;
}

export function messageFor(status, error) {
  // A 5xx may come after the server committed, so never claim the decision was not recorded.
  return ERRORS[error] ?? MESSAGES[status] ?? 'Something went wrong. Refresh to see whether the decision was recorded.';
}

/**
 * One decision "intent" (approve or reject) keeps one Idempotency-Key across retries,
 * so a timeout followed by a retry can never record two decisions.
 */
export function createDecisionIntent(id, decision, comment, newKey = () => crypto.randomUUID()) {
  return { id, decision, comment, key: newKey() };
}

export async function sendDecision(intent, token, fetchImpl = fetch, signal) {
  const res = await fetchImpl(`${API}/${encodeURIComponent(intent.id)}/${intent.decision}`, {
    method: 'POST',
    signal,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': intent.key,
    },
    body: JSON.stringify({ comment: intent.comment }),
  });
  if (res.ok) return { ok: true, data: await res.json() };
  const error = await res
    .json()
    .then((b) => b?.error)
    .catch(() => undefined);
  return { ok: false, status: res.status, error, message: messageFor(res.status, error) };
}
