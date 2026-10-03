# Move 2 — Plan, then attack the plan

## Prompt

> Implement RNIT-TRAIN-101 only after we agree on the plan. Propose the minimum design, transaction
> boundary and test fixtures. Explain how concurrent approvals are serialized.

## Plan (v1)

- Add `tenantId` to `findRequest`; return 404 when not found in the caller's tenant.
- `requireRole('manager')` on the approve route.
- Store idempotency keys; replay the stored response for the same key.
- Unit-test the route with a mocked `requireUser`.

## Challenge

> "Which assumption lets every test pass while production is still wrong?"

**Answer:** the tests mock `requireUser()` and use one admin fixture, so they pass even if the tenant
check is deleted. Also, an in-memory idempotency map would pass every test and fail after a restart.

## Plan (v2 — revised)

- **Transaction boundary:** one `BEGIN IMMEDIATE` transaction around idempotency lookup → guarded
  `UPDATE … WHERE id=? AND tenant_id=? AND status='pending'` → audit event → stored response.
- **Concurrency:** `BEGIN IMMEDIATE` takes SQLite's write lock, so concurrent approvals are serialized;
  the guarded UPDATE means only the first changes a row (`changes === 1`), the rest get 409.
- **Idempotency:** key scoped by (tenant, actor, key) and stored with a SHA-256 of the body.
  Same body → replay; different body → 409. Stored in the DB so it survives restarts.
- **Fixtures:** Employee A (North), Manager B (North), Manager C (South), request #101 in North.
- **Tests:** real HTTP + real SQLite file, nothing mocked.

## Slices (each with a stopping point)

1. Reproduce the missing check with two tenants → C3/C3b fail on the starter. **Stop:** failing test exists.
2. Add the server-side rule + integration tests → C1–C14 pass. **Stop:** `npm test --prefix api` green.
3. Add accessible UI states → client tests + build pass. **Stop:** `npm test/build --prefix web` green.
4. Capture evidence, mutation check, write the handoff. **Stop:** `docs/tasks/RNIT-TRAIN-101.md` complete.

## The behavioural difference v2 protects

With v1 (mocked `requireUser`, one admin fixture) the suite stays **green even if the tenant filter is deleted**.
With v2 the same deletion turns C3, C3b and C6c **red** (docs/evidence/04-mutation.txt). v1 also kept idempotency
keys in a `Map`: a retry after a restart would approve twice. v2 persists them (C5b).

## Rejected out-of-scope change (and why)

Considered during planning: *"Replace the static bearer tokens with JWT login and password hashing."*
**Rejected.** The ticket is approval authorization, not authentication; the lesson says "avoid replacing the existing
authentication framework". It would add dependencies and a new failure surface with no acceptance row to prove it.
Recorded as a separate follow-up, not done here.

A second one, seen in the UI screenshots and also rejected for this ticket: *"Hide the Approve/Reject buttons from employees."* Useful UX, but it is not a security
control (the server's 403 is, C2/C14) and it is not in the contract. Logged as a gap in the handoff.

## Rollback approach (agreed before coding)

- **Code:** `git revert` of the feature commits restores the previous behaviour.
- **Schema:** additive only (`idempotency_keys`, `audit_events` tables created `IF NOT EXISTS`). The previous app
  version ignores them, so rolling the code back needs no migration. Dropping them is a separate, reviewed step.
- **Data:** approvals already made stay approved after a rollback; there is no "un-approve". A wrongly approved
  request is corrected by a manager decision recorded as a new audit event, never by editing rows.
- **Side effects:** none exist (no notifications are sent in this lab). If a notifier is added later, a sent message
  cannot be recalled by a revert — it needs its own recovery plan.
