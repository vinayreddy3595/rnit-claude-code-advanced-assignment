# Move 1 — Audit (plan mode, read-only)

**Note:** the course's practice repo (`rnit-claude-code-training`) was not available on this machine,
so this project is a fresh Express + React implementation. The audit below records the defects the course
describes for the starter repo, and each one is designed out and tested here.

Prompt used (with `claude --permission-mode plan`):

> Inspect this repo for the leave-approval change. Do not implement. Cite file path + symbol for every
> finding. Mark assumptions separately. Return the smallest affected file set.

| ID | Area | File → symbol (starter repo) | Finding | Fixed here in |
|---|---|---|---|---|
| F1 | Lookup | `api/src/db.js → findRequest(id)` | **No tenantId filter** — any manager can load any tenant's request | `api/src/db.js → findRequest(db, id, tenantId)` |
| F2 | Auth | `api/src/auth.js → requireUser()` | Authenticates only; route treats the role check as full authorization | `routes/requests.js` (role) + tenant-scoped lookup + guarded UPDATE |
| F3 | Tests | `api/test/approval.test.js` | One admin fixture; `requireUser()` mocked → tests pass even if the tenant check is deleted | Real HTTP + DB, North and South fixtures, no mocks |
| F4 | Idempotency | approve route | Retry / double-click records two decisions; an in-memory Map would be lost on restart | `idempotency_keys` table, same transaction (C5, C5b, C6) |
| F5 | State | approve route | No guard on status — an approved request can be re-approved | `UPDATE … WHERE status='pending'` + `changes === 1` (C7, C8) |

**Assumption (not fact):** the README's "all calls carry tenantId" contradicted `db.js` in the starter repo; we trust the code, not the README.

**Smallest change set:** `api/src/db.js`, `api/src/routes/requests.js`, `api/test/approval.test.js`.

Verified test commands were written to `docs/engineering/commands.md` by running them, not by guessing.
