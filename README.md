# RNIT Claude Code Advanced — RNIT-TRAIN-101 Leave Approval

A tenant-safe, idempotent leave-approval feature (Express API + React client) built with the course's six moves:
**Audit → Spec → CLAUDE.md → Hooks + permissions → Delegate → Prove**.

| Read this | For |
|---|---|
| [STEPS.md](STEPS.md) | every step and command, in order |
| [docs/contract.md](docs/contract.md) | the behaviour contract (each row → a test) |
| [docs/audit.md](docs/audit.md) · [docs/plan.md](docs/plan.md) | Move 1 and Move 2 |
| [docs/evidence/](docs/evidence/) | test output, mutation check, guard drills, review |
| [docs/handoff.md](docs/handoff.md) | decisions, results, gaps, next step |

## Run it

```bash
export PATH="/c/Program Files/nodejs:$PATH"   # Git Bash, if node is not on PATH
npm install --prefix api && npm install --prefix web
npm test --prefix api        # 11 integration tests (real HTTP + SQLite)
npm test --prefix web        # 3 client tests
npm start --prefix api       # http://localhost:3000
npm run dev --prefix web     # http://localhost:5173 — switch users in the dropdown
```

## Layout

```
CLAUDE.md                         root rules (loaded every request)
.claude/settings.json             deny/allow permissions + hook wiring
.claude/hooks/                    guard-commands.mjs (PreToolUse), block-secrets.mjs (UserPromptSubmit)
.claude/rules/                    api.md, react.md (path-scoped)
.claude/agents/reviewer.md        read-only reviewer subagent
.claude/skills/rnit-evidence/     evidence routine
api/src/                          db.js (all SQL), auth.js, routes/requests.js, app.js, seed.js, server.js
api/test/approval.test.js         contract tests C1–C9
web/src/                          App.jsx, approvalClient.js (+ test)
docs/                             contract, audit, plan, commands, evidence, handoff
```

All data is synthetic (tenants `north` / `south`).
