import { useEffect, useRef, useState } from 'react';
import { API, createApprovalIntent, sendApproval, messageFor } from './approvalClient.js';

// Synthetic demo users (see api/src/seed.js). Never real credentials.
const USERS = [
  { label: 'Employee A (North)', token: 'tok-north-employee-a' },
  { label: 'Manager B (North)', token: 'tok-north-manager-b' },
  { label: 'Manager C (South)', token: 'tok-south-manager-c' },
];

export default function App() {
  const [token, setToken] = useState(USERS[1].token);
  const [list, setList] = useState({ state: 'loading', items: [] });
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState(null);
  const intents = useRef(new Map()); // request id -> pending intent (kept until success)

  useEffect(() => {
    // Ignore stale responses when the user switches quickly.
    const controller = new AbortController();
    setList({ state: 'loading', items: [] });
    fetch(API, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(messageFor(res.status));
        setList({ state: 'ready', items: await res.json() });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setList({ state: 'error', items: [], error: err.message });
      });
    intents.current.clear();
    return () => controller.abort();
  }, [token]);

  async function approve(id) {
    const intent = intents.current.get(id) ?? createApprovalIntent(id, 'Approved via web');
    intents.current.set(id, intent);
    setBusyId(id);
    setStatus(`Approving request ${id}…`);
    try {
      const result = await sendApproval(intent, token);
      if (result.ok) {
        intents.current.delete(id);
        setList((l) => ({ ...l, items: l.items.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)) }));
        setStatus(`Request ${id} approved.`);
      } else {
        if (result.status !== 409) intents.current.delete(id);
        setStatus(result.message);
      }
    } catch {
      // Network failure: keep the intent so "Retry" re-sends the same key.
      setStatus(`Network error. Press Approve again to retry request ${id} safely.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '2rem auto', padding: '0 16px' }}>
      <h1>Leave approvals</h1>
      <label>
        Signed in as{' '}
        <select value={token} onChange={(e) => setToken(e.target.value)}>
          {USERS.map((u) => <option key={u.token} value={u.token}>{u.label}</option>)}
        </select>
      </label>

      <p role="status" aria-live="polite">{status}</p>

      {list.state === 'loading' && <p>Loading requests…</p>}
      {list.state === 'error' && <p role="alert">{list.error}</p>}
      {list.state === 'ready' && list.items.length === 0 && <p>No leave requests in your organisation.</p>}
      {list.state === 'ready' && list.items.length > 0 && (
        <table>
          <caption>Leave requests</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Days</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {list.items.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.days}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === 'pending' && (
                    <button onClick={() => approve(r.id)} disabled={busyId === r.id} aria-busy={busyId === r.id}>
                      {busyId === r.id ? 'Approving…' : `Approve ${r.id}`}
                    </button>
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
