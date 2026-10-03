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
2. Add the server-side rule + integration tests → C1–C9 pass. **Stop:** `npm test --prefix api` green.
3. Add accessible UI states → client tests + build pass. **Stop:** `npm test/build --prefix web` green.
4. Capture evidence, mutation check, write the handoff. **Stop:** `docs/handoff.md` complete.
