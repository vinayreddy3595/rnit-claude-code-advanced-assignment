# RNIT Claude Code Advanced — RNIT-TRAIN-101 Leave Approval

A tenant-safe, retry-safe leave-approval slice (Express API + React client) built with the course loop:
**audit → contract → plan → build → CLAUDE.md and rules → hooks and permissions → delegate → prove → hand off**.
All data is synthetic (tenants `north` / `south`).


## Where each assignment's evidence is

| Assignment | Read these |
|---|---|
| **1 · Repository baseline** | [docs/audit.md](docs/audit.md) · [docs/engineering/commands.md](docs/engineering/commands.md) · [CLAUDE.md](CLAUDE.md) · [.claude/rules/](.claude/rules/) · [.claude/hooks/](.claude/hooks/) · [.claude/settings.json](.claude/settings.json) · [.claude/skills/rnit-evidence/](.claude/skills/rnit-evidence/SKILL.md) · [docs/engineering/enforcement-decisions.md](docs/engineering/enforcement-decisions.md) · [docs/engineering/tool-access.md](docs/engineering/tool-access.md) · [05-hooks](docs/evidence/05-hooks.txt) · [08-live-claude-drills](docs/evidence/08-live-claude-drills.md) · [docs/notes/video-notes.md](docs/notes/video-notes.md) (you fill in) |
| **2 · One technology lab** | Not done here: needs the course repo `rnit-claude-code-training` (no access yet) |
| **3 · Integration capstone** | [docs/tasks/RNIT-TRAIN-101.md](docs/tasks/RNIT-TRAIN-101.md) (handoff) · [docs/contract.md](docs/contract.md) · [docs/plan.md](docs/plan.md) · [docs/evidence/](docs/evidence/) (01–11, screens) |
| **4 · Adoption review** | Not done here: needs your real two-week trial |

## Run it

```bash
export PATH="/c/Program Files/nodejs:$PATH"   # Git Bash, if node is not on PATH
npm ci && npm ci --prefix api && npm ci --prefix web
npm test --prefix api        # 21 integration tests (real HTTP + SQLite)
npm test --prefix web        # 8 client tests
npm run test:hooks           # 36 hook tests
npm start --prefix api       # http://localhost:3000
npm run dev --prefix web     # http://localhost:5173 — switch users in the dropdown
```

## Layout

```
CLAUDE.md                          root rules (loaded every request)
.claude/settings.json              deny/allow permissions + hook wiring
.claude/hooks/                     guard-commands, block-secrets, format-after-edit, rewrite-npm-install (+ tests)
.claude/rules/                     express.md, react.md (path-scoped)
.claude/agents/rnit-authz-reviewer.md   read-only reviewer subagent
.claude/skills/rnit-evidence/      /rnit-evidence <ticket>
api/src/                           db.js (all SQL), auth.js, routes/requests.js, app.js, seed.js, server.js
api/test/                          approval.test.js (C1–C15), race-worker.js
web/src/                           App.jsx, approvalClient.js (+ test)
scripts/capture-evidence.mjs       replayable UI screenshots + API transcript
docs/                              contract, audit, plan, tasks, engineering, evidence, notes, video
```
