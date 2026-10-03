# Read-only review (reviewer checklist from .claude/agents/reviewer.md)

Reviewer had Read / Grep / Glob only — it could not edit. Run on 2026-10-03 after the first commit.
Result: **no tenant leak and no double-approval defect.** Gaps found in tests, client abort handling and hooks — all fixed below.

| # | Finding | File:symbol | Sev | Fix | Proof |
|---|---|---|---|---|---|
| R1 | Guard hook and curl/wget deny were Bash-only; PowerShell tool bypassed them | .claude/settings.json | high | matcher `Bash\|PowerShell`; PowerShell deny rules | 05-guards.txt (PowerShell rows) |
| R2 | Guard regexes bypassable (`rm -fr /`, `git push +main`, `prod_db.rnit`); fail-open on bad input | guard-commands.mjs `DENY` | med | Wider patterns; malformed input → deny | 05-guards.txt (all bypasses blocked) |
| R3 | C8 not truly concurrent (sync SQLite, one process) | approval.test.js `C8` | med | Renamed honestly + new **C8b**: 6 worker threads, separate connections, released together | 02-api-tests.txt |
| R4 | C6 only asserted 409, would pass via invalid_transition | `C6` | med | Asserts `idempotency_key_reused_with_different_body` | 02-api-tests.txt |
| R5 | Missing tests: key reused on other id, key after a 404, event counts in C1/C9 | approval.test.js | low | Added **C6b**, **C6c**, event-count asserts | 02, 04 (C6c also catches the mutation) |
| R6 | In-flight approve not aborted on user switch | App.jsx `approve` | med | Session AbortController passed to `sendApproval` | web test "an approval can be aborted" |
| R7 | 409 kept the intent → replayed forever, row never refreshed | App.jsx `approve` | low | Intent dropped on any server answer; 409 reloads list | code |
| R8 | One `busyId` for all rows | App.jsx | low | Per-row `busy` Set | code |
| R9 | `countEvents` not tenant-scoped | db.js `countEvents` | low | Takes `tenantId` | code |
| R10 | ROLLBACK after COMMIT could mask the original error | db.js `approveRequest` | low | Replay path rolls back; catch checks `db.isTransaction` | code |
| R11 | Secret patterns narrow | block-secrets.mjs | low | Added `github_pat_`, `ASIA`, `password:`, JSON form | 05-guards.txt |
| R12 | `cat .env` via Bash allowed | settings.json | low | Deny rule + guard pattern | 05-guards.txt |

Also added `PRAGMA busy_timeout = 5000` so a second API process waits for the write lock instead of returning 500.
