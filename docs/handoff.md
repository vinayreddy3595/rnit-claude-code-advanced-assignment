# Handoff — RNIT-TRAIN-101

## Decisions
- **Tenant isolation in the query, not the route:** `findRequest(db, id, tenantId)` and the guarded UPDATE filter by tenant; another tenant's request is a 404, identical to a missing one.
- **Role ≠ authorization:** route checks role (403), then tenant-scoped lookup (404), then the `pending → approved` transition (409).
- **One transaction** (`BEGIN IMMEDIATE`): idempotency lookup, guarded UPDATE, audit event and stored response commit together.
- **Idempotency keys persisted in SQLite**, scoped by (tenant, actor, key), with a body hash that includes the request id. 404s are not stored.
- **Node's built-in `node:sqlite`** so tests run against a real DB with no Docker/DB server.
- **Hooks in Node**, not bash + jq (jq not installed); guard covers Bash and PowerShell and fails closed.

## Changed files
`api/src/{db,auth,app,seed,server}.js`, `api/src/routes/requests.js`, `api/test/{approval.test.js,race-worker.js}`,
`web/src/{App.jsx,approvalClient.js,approvalClient.test.js,main.jsx}`, `CLAUDE.md`, `.claude/**`, `docs/**`.

## Exact results (docs/evidence/)
| Check | Result |
|---|---|
| API static check | exit 0 |
| API integration tests (real HTTP + SQLite) | **14 passed, 0 failed** |
| Web tests | **4 passed, 0 failed**; build OK |
| Mutation: tenant filter removed | **RED** — C3, C3b, C6c fail (11 pass, 3 fail) → restored |
| Guard drills | 13 dangerous commands blocked (Bash + PowerShell), malformed input blocked, 3 safe commands allowed; 5 secret prompts blocked, 1 normal prompt allowed |
| Read-only review | 12 findings, all fixed (06-review.md) |

## Skipped checks (honest list)
- **Live permission drill inside Claude Code** (ask Claude to read `.env` and confirm "Permission denied by settings") — the hook scripts were drilled directly, but not through a live Claude Code session in this folder.
- **Browser/e2e test of the UI** — no Playwright; UI logic is unit-tested and the build passes, but not clicked through in a browser.
- **Multi-process API** — C8b uses separate connections in worker threads, not separate OS processes.

## Gaps
- The course practice repo was not on this machine; this is a fresh implementation of the same contract.
- Auth uses static synthetic bearer tokens (fine for the lab, not production).
- No reject flow (only approve was in scope).

## Next step
1. Open this folder in Claude Code and run the live drills: `read .env` → denied; `check the production database` → blocked by hook.
2. `npm start --prefix api` + `npm run dev --prefix web`, click through as Manager B, Manager C and Employee A.
3. Human review of `api/src/db.js → approveRequest` and the tests.
