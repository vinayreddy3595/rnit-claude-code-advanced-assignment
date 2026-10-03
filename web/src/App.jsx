import { useCallback, useEffect, useRef, useState } from 'react';
import { API, createDecisionIntent, sendDecision, messageFor, visibleList } from './approvalClient.js';

// Synthetic demo users (see api/src/seed.js). Never real credentials.
const USERS = [
  { label: 'Employee A (North)', token: 'tok-north-employee-a' },
  { label: 'Manager B (North)', token: 'tok-north-manager-b' },
  { label: 'Manager C (South)', token: 'tok-south-manager-c' },
];

export default function App() {
  const [token, setToken] = useState(USERS[1].token);
  const [ownedList, setList] = useState({ owner: null, state: 'loading', items: [] });
  const list = visibleList(ownedList, token); // never render another user's rows (ISSUE-17)
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(() => new Set()); // request ids with an approval in flight
  const intents = useRef(new Map()); // "id:decision" -> pending intent (kept until a final answer)
  const session = useRef(new AbortController()); // aborted when the signed-in user changes

  const load = useCallback(
    (signal) => {
      setList({ owner: token, state: 'loading', items: [] });
      return fetch(API, { headers: { authorization: `Bearer ${token}` }, signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(messageFor(res.status));
          setList({ owner: token, state: 'ready', items: await res.json() });
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setList({ owner: token, state: 'error', items: [], error: err.message });
        });
    },
    [token],
  );

  useEffect(() => {
    // Switching user aborts the list fetch AND any approval in flight, so a stale
    // response can never update the new user's screen.
    const controller = new AbortController();
    session.current = controller;
    intents.current = new Map();
    setBusy(new Set());
    setStatus('');
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const setRowBusy = (id, on) =>
    setBusy((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  async function decide(id, decision) {
    const { signal } = session.current;
    const ownIntents = intents.current;
    const intentKey = `${id}:${decision}`;
    const intent = ownIntents.get(intentKey) ?? createDecisionIntent(id, decision, `${decision} via web`);
    ownIntents.set(intentKey, intent);
    setRowBusy(id, true);
    setStatus(`${decision === 'approve' ? 'Approving' : 'Rejecting'} request ${id}…`);
    try {
      const result = await sendDecision(intent, token, fetch, signal);
      if (signal.aborted) return;
      ownIntents.delete(intentKey); // the server gave a final answer for this intent
      if (result.ok) {
        const status = result.data.status;
        setList((l) => ({ ...l, items: l.items.map((r) => (r.id === id ? { ...r, status } : r)) }));
        setStatus(`Request ${id} ${status}.`);
      } else {
        setStatus(result.message);
        if (result.status === 409) load(signal); // someone else decided it: show the real state
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Network failure: keep the intent so pressing the same button again re-sends the same key.
      setStatus(`Network error. Press the same button again to retry request ${id} safely.`);
    } finally {
      if (!signal.aborted) setRowBusy(id, false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '2rem auto', padding: '0 16px' }}>
      <h1>Leave approvals</h1>
      <label>
        Signed in as{' '}
        <select value={token} onChange={(e) => setToken(e.target.value)}>
          {USERS.map((u) => (
            <option key={u.token} value={u.token}>
              {u.label}
            </option>
          ))}
        </select>
      </label>

      <p role="status" aria-live="polite">
        {status}
      </p>

      {list.state === 'loading' && <p>Loading requests…</p>}
      {list.state === 'error' && <p role="alert">{list.error}</p>}
      {list.state === 'ready' && list.items.length === 0 && <p>No leave requests in your organisation.</p>}
      {list.state === 'ready' && list.items.length > 0 && (
        <table>
          <caption>Leave requests</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Days</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.days}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => decide(r.id, 'approve')}
                        disabled={busy.has(r.id)}
                        aria-busy={busy.has(r.id)}
                      >
                        {busy.has(r.id) ? 'Working…' : `Approve ${r.id}`}
                      </button>{' '}
                      <button onClick={() => decide(r.id, 'reject')} disabled={busy.has(r.id)}>
                        Reject {r.id}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
