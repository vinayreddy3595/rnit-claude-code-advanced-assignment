# Commands (verified by running them on 2026-10-03, Windows 11, Node v24.19.0)

Node is installed at `C:\Program Files\nodejs` but was not on PATH. In Git Bash:
`export PATH="/c/Program Files/nodejs:$PATH"`

| Purpose | Command | Verified result |
|---|---|---|
| Install API | `npm install --prefix api` | 68 packages |
| API tests (real HTTP + SQLite) | `npm test --prefix api` | 11 passed, no DB server needed |
| API static check | `npm run lint --prefix api` | syntax check passes |
| Run API | `npm start --prefix api` | http://localhost:3000 |
| Install web | `npm install --prefix web` | 19 packages |
| Web tests | `npm test --prefix web` | 3 passed |
| Web build | `npm run build --prefix web` | builds to web/dist |
| Run web | `npm run dev --prefix web` | http://localhost:5173 |
| e2e browser tests | — | **not available** (no Playwright set up) |

SQLite is Node's built-in `node:sqlite`, so no Docker or database server is required.
