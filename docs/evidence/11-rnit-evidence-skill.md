# /rnit-evidence skill run (lesson 2-2)

Run: 2026-10-03, Claude Code 2.1.288 headless, 31 turns, cost about $0.70.

```bash
claude -p "/rnit-evidence RNIT-TRAIN-101" \
  --allowedTools "Read,Grep,Glob,Bash(npm test *),Bash(npm run *),Bash(git diff *),Bash(git log *),Bash(git status *)" --max-turns 40
```

Output below is verbatim. The **Follow-up** section at the end says what was done about each finding.

---
I ran `/rnit-evidence RNIT-TRAIN-101`. Your shell turned the leading `/` into `C:/Program Files/Git/`, so I read the skill file and followed its steps directly. The working tree is clean, so I compared the branch against `main` (7 commits) with the acceptance criteria. I didn't edit, commit or push anything.

## Checks run (2026-10-03, Node v24.19.0, Git Bash)

| Command | Result |
|---|---|
| `npm test --prefix api` | **19 passed**, 0 failed |
| `npm test --prefix web` | **6 passed**, 0 failed |
| `npm run build --prefix web` | **Built** to `web/dist` (223.53 kB JS) |
| `npm run test:hooks` | **36 passed**, 0 failed |

The skill doesn't list `npm run lint` or `format:check`, so I didn't run them. The last saved lint result is `docs/evidence/01-lint.txt`.

## Criteria against evidence

| Criterion | Evidence | Result | Remaining gap |
|---|---|---|---|
| C1 no session → 401 | `api/test/approval.test.js` C1 | Pass | — |
| C2 / C14 employee approves or rejects → 403 | C2, C14 | Pass | — |
| C3 South reads #101 or the list → 404, #101 not in list | C3 | Pass | — |
| C3b South approves #101 → 404, nothing changes | C3b | Pass | — |
| C13 `tenantId: "north"` in body → 404 | C13 | Pass | Checks status is still `pending`, but doesn't check that 0 events were written (C3b does) |
| C4 / C10 approve or reject once, 1 event | C4, C10 | Pass | — |
| C5 replay with same key and same body | C5 | Pass | — |
| C5b replay after API restart | C5b | Pass | — |
| C6 / C6b same key with different body or different id → 409 | C6, C6b | Pass | — |
| C6c a 404 doesn't use up the key | C6c | Pass | — |
| C7 / C12 invalid transition → 409 | C7, C12 | Pass | — |
| C8 / C8b race between approvals | C8, C8b (worker threads, separate connections) | Pass | — |
| C11 approve-vs-reject race | C11 | Pass, final status matches the winner | — |
| C9 no `Idempotency-Key` → 400 | C9 | Pass | — |
| Client: retry reuses the key; new intent gets a new key; reject has its own key | `web/src/approvalClient.test.js` | Pass | The retry test only fakes success; no timeout or network error is simulated |
| Client: user switch aborts the request and the stale response is never shown | "an approval can be aborted" | Pass, **partly proven** | Only shows that `sendDecision` passes the signal on and rejects. Nothing tests that `App.jsx` aborts when the user changes, or that a late response can't update the new user's screen |
| Client: ISSUE-17 list never shown to another user | ISSUE-17 test, `04-mutation.md` M2 | Pass | Tests the `visibleList` function, not the rendered component |
| Client: same 404 message for missing and other tenant | 404 message test | Pass | — |
| UI states | `docs/evidence/09-ui-evidence.md`, `screens/*.png` | Not re-run this session | Captured screenshots only; no browser e2e tests (none set up) |

## Untested behaviour

- **Missing two-tenant replay test.** Idempotency keys are stored per tenant, user and key (`api/src/db.js:95`), but no test has Manager B use key `k1` and then Manager C send the same `k1`. If that scoping broke, C could get back B's saved `200` response for North #101. No mutation in `04-mutation.md` covers this either. As the skill says, I'm reporting this rather than writing the test.
- **Missing same-tenant replay test.** No test has a different North manager reuse Manager B's key.
- **Cancellation is only partly covered**, as in the client row above.
- **Retry over a real failure is missing.** No test checks that a client retry after a lost response returns the saved outcome; C5 covers this on the server only.

## Problems with the ticket's own evidence list

- `docs/tasks/RNIT-TRAIN-101.md` links three files that don't exist: `04-mutation.txt` (the file is now `04-mutation.md`), `10-integration-review.md` and `11-rnit-evidence-skill.md`.
- The Handoff section says the branch was "merged to `main`", but `main..HEAD` still has 7 commits.
- `docs/engineering/commands.md` still lists 14 API and 4 web tests; they now run 19 and 6.
- Two notes on running commands: node is already on PATH in Git Bash, and this session's guard blocked the documented `export PATH=…` line, so the command doc needs updating. The allow-listed npm commands ran fine when run one at a time.

If you want, I can write this up as `docs/evidence/11-rnit-evidence-skill.md` and fix the broken links, as a separate change for you to review.

---

## Follow-up

- **Correction to the skill's own claim:** it said the guard blocked the documented `export PATH=…` line. Re-tested: `guard-commands.mjs` allows `export PATH=…` (empty output). The refusal came from Claude Code's permission system, because `export` was not in `--allowedTools` for that headless run. The hook was not involved.
- Missing two-tenant replay test → **added as C15** (see 10-integration-review.md follow-up).
- Broken links, stale counts, "merged to main" → fixed; the merge to `main` happens at the end of the branch.
- Lesson 2-2 skill test "on an incomplete change it must report the missing test, not invent it": **passed in practice** — it reported the missing two-tenant replay test without writing it.
