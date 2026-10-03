# Command contract (verified by running each one, 2026-10-03, Windows 11, Git Bash, Node v24.19.0)

## Prerequisites

- Node.js ≥ 22.13 (tested on 24.19.0) **on PATH**. On this machine Node was installed at `C:\Program Files\nodejs`
  but not on PATH; in Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`. Hooks run `node`, so if Node is not
  on PATH the hooks error out and do not block — fix PATH before relying on them.
- npm (lockfiles committed: `api/package-lock.json`, `web/package-lock.json`, `package-lock.json`). Use `npm ci`.
- Git. Edge or Chrome only for `evidence:capture`.
- No database server or Docker: SQLite is Node's built-in `node:sqlite`; tests create a temporary file.

## Commands (all non-interactive)

| Purpose | Command | Success signal |
|---|---|---|
| Install | `npm ci && npm ci --prefix api && npm ci --prefix web` | exit 0 |
| API static check | `npm run lint --prefix api` | exit 0 |
| Format check | `npm run format:check` | "All matched files use Prettier code style!" |
| API tests (real HTTP + SQLite) | `npm test --prefix api` | **21 pass, 0 fail** |
| Client tests | `npm test --prefix web` | **8 pass, 0 fail** |
| Client build | `npm run build --prefix web` | "built in …", output in `web/dist` |
| Hook tests | `npm run test:hooks` | **36 pass, 0 fail** |
| UI + API evidence | `npm run build --prefix web && npm run evidence:capture` | writes `docs/evidence/07-*`, `09-*`, `screens/` |
| Run API | `npm start --prefix api` | "Leave API on http://localhost:3000" |
| Run client | `npm run dev --prefix web` | http://localhost:5173 |

## Not available

| Check | Why |
|---|---|
| Browser e2e tests | No Playwright suite; UI states are captured by `evidence:capture`, not asserted |
| React component tests | No jsdom / Testing Library installed |
| CI | No pipeline on the repository yet |
| iOS / Android / Frappe | Not part of this stack |
