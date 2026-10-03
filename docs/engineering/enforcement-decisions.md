# Enforcement decisions — which layer carries each rule

Rule of thumb from the course: if Claude needs to **think** about it → instruction or skill. If it must happen
**every time** → hook. If it must **never** happen → permission deny (+ sandbox). Only reviewed code merges → CI.
`CLAUDE.md` says *please*; `settings.json` says *no*.

| Need in this repo | Layer chosen | File | Why this layer and not another |
|---|---|---|---|
| Explain the DB boundary and tenant invariants | Instruction (root) | `CLAUDE.md` → Architecture invariants | Every task touching API or UI must know it; three lines |
| Express transaction / idempotency details | Path-scoped rule | `.claude/rules/express.md` (`api/src/**`, `api/test/**`) | Only relevant when editing the API; would waste context on UI work |
| Stale-request and accessible-state rules | Path-scoped rule | `.claude/rules/react.md` (`web/src/**`) | Only relevant to the client |
| Collect acceptance evidence | Skill, manual only | `.claude/skills/rnit-evidence/` (`disable-model-invocation: true`) | A multi-step procedure, not permanent context; must not run on its own |
| Format after every edit | `PostToolUse` hook | `.claude/hooks/format-after-edit.mjs` | Must happen every time; Claude forgets. Observes only — cannot stop the write |
| Never touch prod, force-push, `reset --hard`, DROP, `kubectl delete`, `rm -rf /` | `PreToolUse` hook (Bash **and** PowerShell) | `.claude/hooks/guard-commands.mjs` | Must never happen whatever the prompt says; pattern-based, so also see deny rules |
| Install only from the lockfile | `PreToolUse` rewrite (`updatedInput`) | `.claude/hooks/rewrite-npm-install.mjs` | Fix the command instead of blocking it; every rewrite logged to `.claude/logs/rewrites.log` so a reviewer sees what really ran |
| Never let a pasted credential enter the session | `UserPromptSubmit` hook | `.claude/hooks/block-secrets.mjs` (`suppressOriginalPrompt`) | Runs before the prompt enters context or the transcript |
| Never read `.env` / `secrets/`, no `curl`/`wget`/`Invoke-WebRequest` | Permission deny | `.claude/settings.json` | Enforced by Claude Code, not the model; deny beats allow |
| Only reviewed changes reach `main` | CI + protected branch | **Not set up** (GitHub repo is private, no Actions yet) | Hooks are not a merge gate — recorded as a gap in the handoff |
| Processes Claude starts reading `.env` directly (node script, `grep -r`) | Sandbox | **Not enabled** on this Windows machine | Deny rules cover Claude's tools and common shell readers only — recorded as a gap |

## What moved out of CLAUDE.md, and why

| Line considered for the root | Moved to | Reason |
|---|---|---|
| Full command list | `docs/engineering/commands.md` via `@import` | Long; changes often; one place to verify |
| "Persist idempotency in the same transaction" | `rules/express.md` | API-only |
| "Abort stale fetches" | `rules/react.md` | Client-only |
| "Run prettier after editing" | PostToolUse hook | An instruction can be forgotten; the hook cannot |
| "Never run against production" | PreToolUse hook + deny rules | Must be enforced, not requested |
| 6-step evidence routine | `/rnit-evidence` skill | A workflow, invoked on demand |
| Yesterday's failing test notes | `docs/tasks/RNIT-TRAIN-101.md` | Temporary task state |

## Why hooks are Node, not bash + jq

The course hooks use bash + `jq`. `jq` is not installed on this Windows machine and Claude Code here can also run
PowerShell. Node is already a project prerequisite, parses JSON safely, and works under both shells, so the four
hooks are `.mjs`. Behaviour matches the course scripts and is covered by `npm run test:hooks` (36 tests).

## Known limits (honest)

- A pattern list is a net, not a guarantee: a script Claude writes and then runs can bypass the guard.
- `format-after-edit` only sees `Edit|Write`; a Bash command that writes a file is not formatted.
- Hook changes are code: review them like code (they are tested in `.claude/hooks/hooks.test.mjs`).
