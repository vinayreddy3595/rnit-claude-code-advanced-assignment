# Steps log — everything done, in order, with the commands

Course: **RNIT Claude Code Advanced** · Ticket **RNIT-TRAIN-101** · Stack: Node + Express API, React client.
Machine: Windows 11, Git Bash, Node v24.19.0, Git 2.55, Claude Code 2.1.288. Date: 2026-10-03.
Git history has the exact commits for each step (`git log --oneline`).

## 0 · Environment

```bash
node -v                                        # "command not found": installed but not on PATH
export PATH="/c/Program Files/nodejs:$PATH"    # every new Git Bash window
node -v; git --version                         # v24.19.0, 2.55.0
jq --version                                   # not installed -> hooks written in Node
```

## 1 · Audit (lesson 1-2) → [docs/audit.md](docs/audit.md)

`claude --permission-mode plan` with the course prompt. Map with a path for every boundary, one request traced
UI → auth → persistence, three likely failures, unknowns. The course repo was not accessible ("Repository not found"),
so this is a fresh implementation of the same contract. Commands verified by running them → `docs/engineering/commands.md`.

## 2 · Contract (lesson 1-3) → [docs/contract.md](docs/contract.md)

Written before code: 401 / 403 / cross-tenant 404 / approve-or-reject once / replay / 409s / race → C1–C15.

## 3 · Plan and challenge (lesson 1-3) → [docs/plan.md](docs/plan.md)

"Which assumption lets every test pass while production is still wrong?" → mocks + in-memory keys. v2 tests the real
boundary. Two out-of-scope changes rejected with reasons. Rollback agreed before coding.

## 4 · Build, in slices

```bash
git init -b main
npm install --prefix api       # express 5
npm install --prefix web       # react 19, vite 8
npm test --prefix api          # first run: 11 pass (baseline commit 477ff55)
git switch -c feat/train-101-baseline-capstone
# + reject transition, approve-vs-reject race (C11), body-tenant test (C13)
```

## 5 · CLAUDE.md and rules (lesson 2-1)

Course starter downloaded from the LMS, adapted: [CLAUDE.md](CLAUDE.md), `.claude/rules/express.md` (`api/**`),
`.claude/rules/react.md` (`web/src/**`). Why each line is where it is → `docs/engineering/enforcement-decisions.md`.

## 6 · Skill, hooks, permissions (lessons 2-2, 2-3)

```bash
npm install --save-dev prettier            # formatter for the PostToolUse hook
npm run test:hooks                         # 36 pass (one real bug found and fixed in the rewrite regex)
```
Four hooks (guard, secrets, format-after-edit, rewrite npm install → npm ci with a log), deny rules for `.env`,
secrets, curl/wget/Invoke-WebRequest, `/rnit-evidence` skill with `disable-model-invocation`. Tool-access plan →
`docs/engineering/tool-access.md`.

## 7 · Live drills inside Claude Code → [08-live-claude-drills.md](docs/evidence/08-live-claude-drills.md)

`claude -p … --output-format stream-json` in this repo: Read `.env` → denied by settings; `cat .env` → blocked by
hook; prod `psql` → blocked; injected instruction in an issue → ignored; `npm install` → rewritten to `npm ci` and
logged, while Claude claimed it ran the original (the reason rewrites must be logged). The injection drill also
found a real bug (ISSUE-17: other user's list visible for one frame) → failing test first, then fixed.

## 8 · Delegate and review (lesson 3-1)

Read-only reviewer (`tools: Read, Grep, Glob`) → 12 findings, all fixed → [06-review.md](docs/evidence/06-review.md).
Integration review prompt from lesson 6-1 → [10-integration-review.md](docs/evidence/10-integration-review.md):
no cross-tenant path; 5 findings fixed (incl. new test C15), 3 kept as named gaps. `/rnit-evidence` skill run →
[11-rnit-evidence-skill.md](docs/evidence/11-rnit-evidence-skill.md).

## 9 · Prove (lesson 3-2) → [docs/evidence/](docs/evidence/)

```bash
npm run lint --prefix api && npm run format:check   # 01
npm test --prefix api                               # 02: 21 pass
npm test --prefix web && npm run build --prefix web # 03: 8 pass
# 04: mutation checks on a throwaway branch — M1 tenant lookup, M2 ISSUE-17, M3 state guard,
#     M4 idempotency lookup, M5 key scoping: each turns named tests red; M1b stays green (documented)
npm run test:hooks                                  # 05: 36 pass
npm run build --prefix web && npm run evidence:capture   # 07 API transcript, 09 + screens/ UI states
```

Mistake made and corrected on the way: a `git checkout -- .` on the mutation branch also reverted uncommitted
evidence files; evidence is now committed before any mutation.

## 10 · Hand off and publish

[docs/tasks/RNIT-TRAIN-101.md](docs/tasks/RNIT-TRAIN-101.md): decisions, changed files, exact results, checks not
run, risks, rollback, next action.

```bash
git switch main && git merge --no-ff feat/train-101-baseline-capstone
git push origin main feat/train-101-baseline-capstone
git archive --format=zip -o ../rnit-claude-code-advanced-assignment.zip HEAD
```

## Still for you to do

1. Fill in [docs/notes/video-notes.md](docs/notes/video-notes.md) with your own timestamps (lesson 1-1).
2. Run Claude Code once interactively in this folder and accept the trust dialog, so the settings `allow` list applies.
3. Be able to explain `api/src/db.js → decideRequest`, the contract table and the mutation checks in your own words.
4. Assignment 2 needs the course repo; assignment 4 needs your real two-week trial.
