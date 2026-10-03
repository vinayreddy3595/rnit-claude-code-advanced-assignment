# Integration review — rnit-authz-reviewer (lesson 6-1 prompt)

Run: 2026-10-03, Claude Code 2.1.288 headless, 2 turns, cost about $1.11.

```bash
claude -p "Use the rnit-authz-reviewer subagent to review RNIT-TRAIN-101. Integration review: Compare the client, API and persisted behavior against docs/tasks/RNIT-TRAIN-101.md and docs/contract.md. Trace tenant identity and operation identity across every boundary. Find mismatched status/error assumptions and tests that mock away the risky boundary. Run the agreed checks. Produce an evidence table, not an unsupported approval verdict. Do not deploy, do not edit files, do not alter any data." \
  --allowedTools "Read,Grep,Glob,Task,Agent,Bash(npm test *)" --max-turns 40
```

Output below is verbatim. The **Follow-up** section at the end says what was done about each finding.

---
The rnit-authz-reviewer review of RNIT-TRAIN-101 is done. It found no path for one tenant, or a replayed idempotency key, to reach another tenant's data. The gaps are in what the tests prove, not in what the code does today. There's no approval verdict below, and **both agreed test commands are still unverified**: this non-interactive session couldn't approve running `npm test --prefix api` or `npm test --prefix web`. The reviewer only read files, so pass counts (19 API, 6 web) come from the repo's own evidence files from commit `5b4f556`, not from a run this session.

I checked findings 1 and 2 against the source myself. The key lookup at `api/src/db.js:95` does filter by tenant and actor, but no test has two different actors use the same key in one database. For finding 2, the guard at `web/src/App.jsx:64` exists and no web test exercises it.

## Tenant and operation identity

- **Tenant:** comes only from the bearer token (`auth.js:5-14` and `db.js:49-51`) and is passed on as `req.user.tenantId`. Nothing in the request body, query or headers can set it. Every SQL statement filters or writes by `tenant_id`, except the token lookup, which is what establishes the tenant. The web client never sends a tenant value.
- **Operation:**
  - The client makes one `randomUUID()` per decision (`approvalClient.js:31-33`) and keeps it while the request is in flight or after a network error (`App.jsx:55-77`).
  - The key is sent in the `idempotency-key` header, and keys are stored per tenant, actor and key (`db.js:36-44`).
  - The fingerprint covers decision, id and comment.
  - The key record, the "only if still pending" update and the audit event are written in one locked transaction, which must change exactly one row (`db.js:90-126`).

## Evidence table

| Area | Contract row | Code | Test | Status |
|---|---|---|---|---|
| No token → 401 | C1 | auth.js:7-10 | approval.test.js:46 | verified by reading |
| Employee can't approve or reject (403) | C2, C14 | auth.js:16-21 | :53, :223 | verified by reading |
| Other tenant's request → 404 (read, list, approve) | C3, C3b | db.js:54-71, :106-109 | :60, :67 | verified by reading (a mutation check turns it red) |
| `tenantId` sent in body is ignored | C13 | requests.js:29,35 | :217 | verified by reading (doesn't check that no event was written) |
| Approve or reject happens once | C4, C10 | db.js:113-126 | :74, :182 | verified by reading |
| Same key and body replays the stored answer (also after restart) | C5, C5b | db.js:92-104 | :82, :91 | verified by reading (approve only) |
| Same key with different body, or on another request → 409 | C6, C6b | db.js:100-101 | :101, :109 | verified by reading |
| 404 answers aren't stored | C6c | db.js:131 | :123 | verified by reading |
| Decision on a non-pending request → 409 | C7, C12 | db.js:119-120 | :136, :204 | verified by reading (C12 doesn't check the event count) |
| Missing key → 400 | C9 | requests.js:25-28 | :234 | verified by reading (approve only; 200-character limit untested) |
| Concurrent decisions from separate connections | C8b, C11 | db.js:90 | :175, :195 | **risk:** the test worker calls the DB function directly, skipping HTTP and auth (finding 3) |
| Key scoped to tenant and actor | express rules | db.js:95 | **none** | **gap** (finding 1) |
| Tenant filter inside the guarded update | defence in depth | db.js:116 | **none** | **gap** (mutation M1b stays green) |
| Client retry reuses the key | Client 1 | App.jsx:55-77 | approvalClient.test.js:5 | **gap:** App's keep/delete logic isn't tested |
| Client user switch cancels the in-flight decision | Client 4 | App.jsx:64,75,79 | approvalClient.test.js:18 | **gap** (finding 2) |
| ISSUE-17: never show another user's list | Client 5 | App.jsx:14 | approvalClient.test.js:50 | verified by reading (helper only; nothing checks App calls it) |
| Client handling of 400/401/403/409/5xx | task, client section | approvalClient.js:6-12; App.jsx:70-73 | **none** | **mismatch** (finding 6) |
| `npm test --prefix api` | agreed check | — | — | **unverified, not run** |
| `npm test --prefix web` | agreed check | — | — | **unverified, not run** |

## Findings, most severe first

1. **Medium – key scoping isn't tested.** If the tenant and actor filters were dropped from `db.js:95`, this would happen:
   - Manager B approves #101 with key `k1`.
   - Manager C (South) then sends `k1`.
   - C gets B's stored North answer back as a "replay".

   Every API test would still pass, because each test starts with a fresh database and none has two managers use the same key.
2. **Medium – the client tests stub out the risky part.** The web tests check only that the abort signal is passed through. Removing the `signal.aborted` guard at `App.jsx:64` would leave all web tests green. A late answer for the old user would then write status text into the new user's screen.
3. **Medium-low – the concurrency tests skip the route.** `race-worker.js` passes in the actor and the fingerprint directly. That's enough to prove the database locking works, but not the route under contention. No test sends the same key from two connections at once.
4. **Low – the tenant filter in the guarded update (`db.js:116`) has no test of its own.** It's a second line of defence, so if the earlier tenant lookup ever broke, nothing would catch it.
5. **Low – what employees can see isn't defined.** Any employee can list every request in their own tenant, including colleagues' `employeeId`, `comment` and `decidedBy`. Nothing crosses tenants, but the contract doesn't say whether this is intended.
6. **Low – client and API disagree on errors:**
   - The 403 message always says "approve", even for a reject.
   - Both kinds of 409 (invalid transition, and key reused with a different body) get the same message.
   - Any 5xx says "not recorded". That would be false if a proxy timed out after the database commit.
   - The `Idempotent-Replayed` header isn't exposed to the browser.
   - None of these error paths are tested, because the web stubs return `{ok:true}` with no status.
7. **Low – the docs have drifted:**
   - `commands.md` says 14 and 4 tests pass, but the evidence files show 19 and 6.
   - The task file links `04-mutation.txt`, but the file is `.md`.
   - `10-integration-review.md` and `11-rnit-evidence-skill.md` don't exist.
   - `npm run lint` doesn't check `seed.js` or `server.js`.
8. **Low – small assertion gaps:** C12 and C13 don't check event counts, and C9 doesn't cover `/reject`.

## Not verified
- Both test suites. To run them in Git Bash:
  ```
  export PATH="/c/Program Files/nodejs:$PATH"
  npm test --prefix api
  npm test --prefix web
  ```
  They use a temporary SQLite file and don't touch `leave.db`. Or allow `npm test` for this project and I'll run them.
- Anything that needs a browser: React render timing for ISSUE-17, aborting while an answer is arriving, and CORS for POST with `Authorization` and `Idempotency-Key`. There are no e2e tests in this repo.
- The rollback on error uses `db.isTransaction` (`db.js:141`), which needs a recent Node. `package.json` allows `>=22.13`, so older versions in that range might not support it; the repo pins Node 24.
- Running several API processes against one database is only simulated with worker threads, not separate processes.

No files were edited, nothing was deployed and no data was changed.

---

## Follow-up (what was done about each finding)

| # | Finding | Action | Proof |
|---|---|---|---|
| 1 | Key scoping (tenant + actor) untested | **Fixed:** test C15 (South manager reuses North key → 404, no replay) | M5 in 04-mutation.md goes red |
| 2 | App-level abort guard untested | **Gap kept:** needs a component test setup (jsdom + Testing Library), not installed; the helper-level test exists | task file, "Not run" |
| 3 | Race tests call the DB function, not HTTP | **Accepted as scoped:** C8 covers HTTP in one process; C8b/C11 prove DB locking across connections | contract C8/C8b/C11 |
| 4 | Guarded-UPDATE tenant filter has no own test | **Gap kept, documented:** defence in depth behind findRequest | M1b in 04-mutation.md |
| 5 | Employees see all same-tenant requests | **Gap kept:** not in the contract; recorded as a product question | task file, "Remaining risks" |
| 6 | 403/409/5xx messages inaccurate | **Fixed:** 403 says approve or reject; a race and a mismatched retry get different 409 messages; 5xx no longer claims "not recorded" | 2 new client tests |
| 7 | Docs drift; lint misses seed/server | **Fixed:** links, counts, lint script | same commit |
| 8 | C12/C13 event counts, C9 reject variant | **Fixed** | 02-api-tests.txt |
| — | "Both suites unverified" | That reviewer session could not run npm; the suites were run by the evidence skill (11) and recorded in 02/03 | 02, 03, 11 |
