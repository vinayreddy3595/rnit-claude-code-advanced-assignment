# RNIT-TRAIN-101 — Tenant-safe, retry-safe leave approval

Structure from the course starter `docs/tasks/TEMPLATE.md`. This file is the handoff (lesson 3-1).

## Acceptance criteria

The full table is [docs/contract.md](../contract.md): 401 / 403 / cross-tenant 404 / approve or reject once /
replay / 409 key reuse / 409 invalid transition / one winner in an approve-vs-reject race / client key reuse,
cancellation and no cross-user render.

## Repository findings

[docs/audit.md](../audit.md): versions from lockfiles, entry points, auth and tenant lookup, the single SQL module,
fixtures, one request traced UI → auth → persistence, three likely failures, unknowns. Commands:
[docs/engineering/commands.md](../engineering/commands.md).

## Plan

[docs/plan.md](../plan.md): v1, the challenge question, v2, the behavioural difference v2 protects, two rejected
out-of-scope changes, slices with stopping points, rollback approach.

## Evidence

| Step | Artifact | Result |
|---|---|---|
| Baseline | first commit `477ff55`, `npm test --prefix api` | 11 passed |
| Static | [01-lint.txt](../evidence/01-lint.txt) | exit 0 |
| API (real HTTP + SQLite) | [02-api-tests.txt](../evidence/02-api-tests.txt) | see file |
| Client + build | [03-web.txt](../evidence/03-web.txt) | see file |
| Mutation checks | [04-mutation.txt](../evidence/04-mutation.txt) | see file |
| Hooks | [05-hooks.txt](../evidence/05-hooks.txt) | see file |
| Read-only review | [06-review.md](../evidence/06-review.md) | 12 findings, all fixed |
| API request/response | [07-api-transcript.md](../evidence/07-api-transcript.md) | 10 calls, sanitized |
| Live Claude Code drills | [08-live-claude-drills.md](../evidence/08-live-claude-drills.md) | 5 drills |
| UI states | [09-ui-evidence.md](../evidence/09-ui-evidence.md) | 6 states, desktop + phone |
| Integration review | [10-integration-review.md](../evidence/10-integration-review.md) | see file |
| Evidence skill run | [11-rnit-evidence-skill.md](../evidence/11-rnit-evidence-skill.md) | see file |

Unresolved checks are listed under **Handoff → Not run**.

## Handoff

**Branch:** `feat/train-101-baseline-capstone` (merged to `main`), remote `github.com/vinayreddy3595/rnit-claude-code-advanced-assignment` (private).

**Changed files:** `api/src/{db,auth,app,seed,server}.js`, `api/src/routes/requests.js`, `api/test/*`,
`web/src/*`, `CLAUDE.md`, `.claude/{settings.json,rules,hooks,agents,skills}`, `scripts/capture-evidence.mjs`, `docs/**`.

**Decisions taken**
- Tenant isolation inside the query (`findRequest(db, id, tenantId)`), 404 for other tenants.
- Role → tenant lookup → guarded transition; tenant always from the authenticated user.
- One `BEGIN IMMEDIATE` transaction for idempotency record + guarded UPDATE + audit event; `busy_timeout` 5 s.
- Idempotency keys persisted, scoped (tenant, actor, key), fingerprint = decision + id + comment; 404s not stored.
- Hooks in Node (no `jq`; PowerShell also covered); guard fails closed.
- Client: one key per intent; abort on user switch; list tagged with its owner (ISSUE-17).

**Decisions rejected:** JWT login (out of scope); hiding buttons as "security" (server 403 is the control);
in-memory idempotency map (fails after restart).

**Not run (honest gaps)**
- Course training repo not accessible → no focused diff against it (assignment 2 needs it).
- No CI pipeline or protected branch on the GitHub repo yet.
- No sandbox enabled; deny rules don't cover a script that opens `.env` itself.
- Live secret-prompt drill not run (hook tested by `npm run test:hooks` only, to keep secrets out of transcripts).
- No real screen reader test; no multi-machine API deployment test.
- Workspace not marked trusted in Claude Code, so settings `allow` entries were ignored during live drills.

**Remaining risks**
- Static synthetic tokens are not production authentication.
- UI shows Approve/Reject to employees (server refuses with 403).
- Pattern-based hooks can be bypassed by a script Claude writes and runs.
- `node` must be on PATH for hooks to run; if it isn't, Claude Code reports a hook error and the hook does not block.

**Rollback:** `git revert` the feature commits; schema changes are additive (`IF NOT EXISTS` tables) so the previous
version runs unchanged; decided requests stay decided (corrections are new audit events). Details: docs/plan.md.

**Next exact action:** obtain access to `rnitai-solutions/rnit-claude-code-training`, then run the Express lab
(lesson 4-3) as a focused diff on a disposable branch for assignment 2.
