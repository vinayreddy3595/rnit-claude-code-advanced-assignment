---
name: rnit-evidence
description: Collect proof that a change works - run checks, mutation-check the key test, and update the handoff. Use when finishing a ticket.
---

Run these in order and save each output under docs/evidence/. Never summarise a result you did not run.

1. Static check: `npm run lint --prefix api` → docs/evidence/01-lint.txt
2. Domain + integration tests: `npm test --prefix api` → docs/evidence/02-api-tests.txt
3. Client checks: `npm test --prefix web` and `npm run build --prefix web` → docs/evidence/03-web.txt
4. Mutation check (throwaway branch):
   - `git switch -c mutation/no-tenant-filter`
   - remove `AND tenant_id = ?` from `findRequest` and the guarded UPDATE in api/src/db.js
   - run `npm test --prefix api` → docs/evidence/04-mutation.txt. It MUST fail (C3/C3b). If it stays green, the tests prove nothing: stop and report.
   - `git checkout -- . && git switch main && git branch -D mutation/no-tenant-filter`
5. Hook + permission drills → docs/evidence/05-guards.txt
6. Update docs/handoff.md: decisions, changed files, exact results, skipped checks, gaps, next step.
