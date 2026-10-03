---
paths:
  - "web/src/**/*.jsx"
  - "web/src/**/*.js"
---

# RNIT React rules (from the course starter, globs adapted to web/src)

- No server-state library is installed; keep fetching in `approvalClient.js` and do not add one incidentally.
- Cancel or ignore obsolete requests: every fetch takes the current `AbortController` signal, aborted when the user changes.
- Keep one `Idempotency-Key` per user intent (request id + decision) and reuse it on retry.
- Represent loading, error, empty and success states explicitly; announce status with `role="status"` / `aria-live`.
- A disabled button is user feedback, not server idempotency or authorization.
- Show the same message for "not found" and "other tenant" (both are 404).
