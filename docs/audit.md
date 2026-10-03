# Repository map — lesson 1-2 audit (plan mode, read-only)

**Context:** the course repo `rnitai-solutions/rnit-claude-code-training` returned "Repository not found" from this
account (probably private to the org), so this project re-implements the same contract. Defects F1–F5 are the ones
the course describes for the starter; each is designed out here and has a test.

Prompt (in `claude --permission-mode plan`):

```text
Inspect this repository for the leave-approval change. Do not implement yet.
Identify the runtime/framework versions from manifests and lockfiles, entry points,
authentication and tenant lookup, data-access boundary, test fixtures, and CI commands.
For every finding cite the file path and relevant symbol. Mark assumptions separately.
Trace one existing request from UI through authorization to persistence.
Return the smallest affected file set and three likely failure cases.
```

## Map (every claim has a path)

| Boundary | Path → symbol | Evidence |
|---|---|---|
| Runtime | `api/package.json` → `engines.node >=22.13`; installed v24.19.0 | `node -v` |
| Framework versions | `api/package-lock.json` → express 5.2.1; `web/package-lock.json` → react 19.2, vite 8 | lockfiles |
| Package manager | npm (only `package-lock.json` present, no pnpm/yarn lock) | `ls api web` |
| API entry point | `api/src/server.js` → `createApp(db).listen` | file |
| App wiring | `api/src/app.js` → `createApp` (JSON 10 kb limit, dev CORS, error middleware) | file |
| Authentication | `api/src/auth.js` → `requireUser` (Bearer token → `findUserByToken`) | file |
| Role check | `api/src/auth.js` → `requireRole('manager')` | file |
| Tenant lookup | `api/src/db.js` → `findRequest(db, id, tenantId)` (`WHERE id = ? AND tenant_id = ?`) | file |
| Data-access boundary | `api/src/db.js` — the only file with SQL | `grep -rn "SELECT\|UPDATE" api/src` |
| State transition | `api/src/db.js` → `decideRequest` (guarded UPDATE in `BEGIN IMMEDIATE`) | file |
| Fixtures | `api/src/seed.js` → `FIXTURES`, `seed` | file |
| Tests | `api/test/approval.test.js`, `api/test/race-worker.js`, `web/src/approvalClient.test.js`, `.claude/hooks/hooks.test.mjs` | files |
| Client entry | `web/src/main.jsx` → `App`; fetch logic `web/src/approvalClient.js` | files |
| CI | **None** — no `.github/workflows` | `ls .github` → missing |

## One request traced end to end — Manager B approves #101

1. `web/src/App.jsx → decide('101','approve')` creates or reuses an intent (`createDecisionIntent`) with a UUID key.
2. `web/src/approvalClient.js → sendDecision` → `POST /api/requests/101/approve`, headers `Authorization: Bearer …`, `Idempotency-Key`.
3. `api/src/app.js` → `express.json` → `requestsRouter`.
4. `api/src/auth.js → requireUser` resolves the token to `{ id, tenantId: 'north', role: 'manager' }`; `requireRole('manager')` passes.
5. `api/src/routes/requests.js` validates key and comment, computes the fingerprint `{decision, id, comment}`.
6. `api/src/db.js → decideRequest`: `BEGIN IMMEDIATE` → idempotency lookup → `findRequest(…, 'north')` → guarded `UPDATE … status='pending'` → `INSERT audit_events` → `INSERT idempotency_keys` → `COMMIT`.
7. Response `200 {status:'approved'}` → `App.jsx` updates the row and announces it in `role="status"`.

## Findings (the defects the course starter has)

| ID | Path → symbol (starter) | Finding | Designed out in | Test |
|---|---|---|---|---|
| F1 | `db.js → findRequest(id)` | No tenant filter | `findRequest(db, id, tenantId)` | C3, C3b, C13 + mutation |
| F2 | `auth.js → requireUser()` | Role check treated as authorization | role → tenant lookup → guarded transition | C2, C3b, C7 |
| F3 | `approval.test.js` | One admin fixture, `requireUser` mocked | real HTTP + DB, North/South fixtures | all C-rows |
| F4 | approve route | No persisted idempotency | `idempotency_keys` table in the same transaction | C5, C5b, C6 |
| F5 | approve route | No state guard | `UPDATE … WHERE status='pending'`, `changes === 1` | C7, C8, C8b, C11, C12 |

## Contradiction (lesson 1-2 step 3)

**Assumption, not fact:** the starter README says "all service calls carry tenantId" while `findRequest(id)` does not.
We trust the code and tests, not the prose. Unrelated migration work would be a separate ticket.

## Smallest affected file set

`api/src/db.js`, `api/src/routes/requests.js`, `api/test/approval.test.js` (+ `web/src/*` for the UI slice).

## Three likely failure cases

1. A South manager approves North's #101 because the lookup ignores tenant (F1) → C3b, mutation check.
2. A double-click or retry records two approvals and two notifications (F4) → C5, C8b.
3. Approve and reject race and both "win" (F5) → C11.

## Baseline (lesson 1-2 step 4)

Command `npm test --prefix api` on the first commit `477ff55`: **11 passed, 0 failed** (see git history).
Command contract: `docs/engineering/commands.md`.

## Unknowns

- The real course repo's structure and its existing tests (not accessible).
- Behaviour under several API processes on separate machines (tested only with separate connections in one machine).
