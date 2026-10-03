# Steps log — everything done, in order, with the exact commands

Course: **RNIT Claude Code Advanced** · Ticket: **RNIT-TRAIN-101 (leave approval)** · Stack: **Node + Express API, React client**
Machine: Windows 11, Git Bash, Node v24.19.0, Git 2.55. Date: 2026-10-03.

---

## Step 0 — Environment check

```bash
node -v        # "command not found": Node is installed but not on PATH
ls "/c/Program Files/nodejs"
export PATH="/c/Program Files/nodejs:$PATH"   # needed in every new Git Bash window
node -v        # v24.19.0
git --version  # 2.55.0
jq --version   # not installed -> hooks written in Node instead of bash+jq
```

## Step 1 — Move 1: Audit before delegating (plan mode)

```bash
claude --permission-mode plan
```
Prompt: *"Inspect this repo for the leave-approval change. Do not implement. Cite file path + symbol for every finding. Mark assumptions separately. Return the smallest affected file set."*

Output → [docs/audit.md](docs/audit.md) (F1 missing tenant filter, F2 role ≠ authorization, F3 mocked tests,
F4 no persisted idempotency, F5 no state guard). Verified commands → [docs/engineering/commands.md](docs/engineering/commands.md).

## Step 2 — Write the contract before code

Behaviour table (401 / 403 / 404 / approved-once / replay / 409) → [docs/contract.md](docs/contract.md).

## Step 3 — Move 2: Plan, then attack the plan

Challenge question: *"Which assumption lets every test pass while production is still wrong?"*
Answer: mocked `requireUser()` + in-memory idempotency map. Revised plan, transaction boundary and 4 slices → [docs/plan.md](docs/plan.md).

## Step 4 — Implement the API (slices 1–2)

```bash
mkdir rnit-claude-code-advanced-assignment && cd rnit-claude-code-advanced-assignment
# wrote api/package.json, api/src/{db,auth,app,seed,server}.js, api/src/routes/requests.js
npm install --prefix api          # added 68 packages (express 5)
# wrote api/test/approval.test.js — real HTTP + real SQLite file, no mocks
npm test --prefix api             # first run failed: "node --test test/" not valid on Node 24
# fixed script to: node --test --test-reporter=spec test/approval.test.js
npm test --prefix api             # 11 passed, 0 failed
```

Key design (see `api/src/db.js → approveRequest`):
- `findRequest(db, id, tenantId)` — other tenant's request = 404.
- One `BEGIN IMMEDIATE` transaction: idempotency lookup → `UPDATE … WHERE id=? AND tenant_id=? AND status='pending'` → audit event → stored response.
- Idempotency keys in a DB table with a SHA-256 body hash (survives restart; different body → 409).

## Step 5 — React client (slice 3)

```bash
# wrote web/package.json, vite.config.js, index.html, src/{main.jsx,App.jsx,approvalClient.js,approvalClient.test.js}
npm install --prefix web          # added 19 packages (react 19, vite 8)
npm run build --prefix web        # built OK
npm test --prefix web             # 3 passed
```
UI: AbortController on fetch, one Idempotency-Key per intent reused on retry, loading/empty/error states, `aria-live` status.

## Step 6 — Move 3: CLAUDE.md + path-scoped rules

- [CLAUDE.md](CLAUDE.md) — short; only what every task needs. (Draft with `/init`, check what loaded with `/memory`.)
- [.claude/rules/api.md](.claude/rules/api.md) — loads only for `api/src/**`, `api/test/**`.
- [.claude/rules/react.md](.claude/rules/react.md) — loads only for `web/src/**`.

## Step 7 — Move 4: Hooks + permissions

- [.claude/hooks/guard-commands.mjs](.claude/hooks/guard-commands.mjs) — PreToolUse/Bash: denies prod hosts, force push, `rm -rf /`, DROP/TRUNCATE.
- [.claude/hooks/block-secrets.mjs](.claude/hooks/block-secrets.mjs) — UserPromptSubmit: blocks `sk-ant-…`, `ghp_…`, AWS keys, `password=…`, private keys.
- [.claude/settings.json](.claude/settings.json) — deny `.env`, `secrets/**`, `curl`, `wget`, force push; allow test/lint/build. Deny beats allow.

## Step 8 — Move 5: Delegate safely

- [.claude/agents/reviewer.md](.claude/agents/reviewer.md) — subagent with only `Read, Grep, Glob` (cannot edit).
- [.claude/skills/rnit-evidence/SKILL.md](.claude/skills/rnit-evidence/SKILL.md) — repeatable evidence routine (`/rnit-evidence`).

## Step 9 — Commit

```bash
git init -b main
git config user.email "chemsoman@gmail.com"; git config user.name "RNIT"   # repo-local only
printf '* text=auto eol=lf\n' > .gitattributes
git add -A && git commit -m "RNIT-TRAIN-101: tenant-safe, idempotent leave approval with Claude Code guards"
```

## Step 10 — Move 6: Prove it (evidence in docs/evidence/)

```bash
npm run lint --prefix api   > docs/evidence/01-lint.txt        # exit 0
npm test --prefix api       > docs/evidence/02-api-tests.txt   # 11 pass, 0 fail
npm test --prefix web; npm run build --prefix web > docs/evidence/03-web.txt   # 3 pass, build OK
```

**Mutation check** (throwaway branch):
```bash
git switch -c mutation/no-tenant-filter
# replaced "tenant_id = ?" with "? IS NOT NULL" in findRequest and the guarded UPDATE (filter removed)
npm test --prefix api       # RED: C3 and C3b fail (9 pass, 2 fail) -> the tests really guard tenancy
git checkout -- . && git switch main && git branch -D mutation/no-tenant-filter
```
→ [docs/evidence/04-mutation.txt](docs/evidence/04-mutation.txt)

**Guard drills** — fed each hook the JSON Claude Code sends → [docs/evidence/05-guards.txt](docs/evidence/05-guards.txt):
prod psql, force push, DROP TABLE → denied; `npm test` → allowed; prompts with `sk-ant-…` / `password=` → blocked.

**Read-only review** with the reviewer checklist → [docs/evidence/06-review.md](docs/evidence/06-review.md).

## Step 11 — Handoff

[docs/handoff.md](docs/handoff.md): decisions, changed files, exact results, skipped checks, gaps, next step.

---

## To do yourself (needs a person, not Claude)

1. Run the live drills inside Claude Code in this folder (see the handoff, "Skipped checks").
2. Human review — read `api/src/db.js` and the tests and be able to explain them.
3. Read the assignment brief and adjust anything it asks for differently.
4. Zip the folder **without** `node_modules` and submit it on the LMS yourself.
