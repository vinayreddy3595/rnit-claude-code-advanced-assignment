---
paths:
  - "api/src/**/*.js"
  - "api/test/**/*.js"
---

- Express: `requireUser` authenticates only. Object access needs `findRequest(db, id, tenantId)`.
- State changes use a guarded `UPDATE ... WHERE status = 'pending'` inside `BEGIN IMMEDIATE`, and check `changes === 1`.
- The idempotency record, state change and audit event commit in the same transaction.
- Tests go through real HTTP + real SQLite with North and South fixtures. Do not mock `requireUser` or `db.js`.
