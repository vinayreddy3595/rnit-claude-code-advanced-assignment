---
paths:
  - "api/src/**/*.js"
  - "api/test/**/*.js"
---

# RNIT Node + Express rules (from the course starter, globs adapted to api/)

- Express 5: synchronous handlers and rejected promises reach the error middleware in `api/src/app.js`; do not add per-route try/catch that swallows errors.
- Validate request shape and keep the 10 kb JSON body limit before expensive processing.
- Authentication (`requireUser`) only answers "who". Object access needs `findRequest(db, id, tenantId)`.
- Scope idempotency keys by trusted tenant + actor; bind each key to a fingerprint of operation + request id + payload.
- Persist the idempotency record, the guarded `UPDATE … WHERE status = 'pending'` and the audit event in one `BEGIN IMMEDIATE` transaction; check `changes === 1`.
- Never log authorization headers or tokens.
- Tests use real HTTP + a real SQLite file with North and South fixtures. Do not mock `requireUser` or `db.js`.
