# RNIT baseline — leave approval (Express API + React client)

- Commands (verified by a human): @docs/engineering/commands.md
- Behaviour contract: @docs/contract.md — every row must map to a test.
- DB access only via `api/src/db.js`. Routes never write SQL; the web client never talks to the DB.
- Every leave-request query is scoped by `tenantId`. Cross-tenant reads return 404, not 403.
- A role check is not authorization: also check tenant ownership and that the state transition is allowed.
- Approvals require an `Idempotency-Key`; keys are persisted in the DB, never in memory.
- Synthetic data only (tenants `north` / `south`). No secrets in prompts, code or logs.
- Done = all contract rows have passing tests, the mutation check goes red, and `docs/handoff.md` is updated.
  Report skipped checks. Never weaken, skip or mock away a test to make it pass.
