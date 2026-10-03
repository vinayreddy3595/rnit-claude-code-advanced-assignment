---
paths:
  - "web/src/**/*.jsx"
  - "web/src/**/*.js"
---

- Ignore stale responses: every fetch in an effect uses an `AbortController` and aborts on cleanup.
- A disabled button is not server idempotency. Keep one `Idempotency-Key` per user intent and reuse it on retry.
- Every async view has loading, empty, error and success states; status changes are announced with `role="status"` / `aria-live`.
- Never show a different message for "not found" and "other tenant" — both are 404.
