---
name: rnit-evidence
description: Prepare acceptance evidence for an RNIT training ticket.
disable-model-invocation: true
---

Read docs/tasks/$ARGUMENTS.md, docs/contract.md and docs/engineering/commands.md.
Compare the current diff with the ticket acceptance criteria.
Run the relevant documented checks within the authorized local environment:
`npm test --prefix api`, `npm test --prefix web`, `npm run build --prefix web`, `npm run test:hooks`.
Return a table: criterion, evidence path or command, result, remaining gap.
Flag untested authorization, tenant isolation, retry, and cancellation behavior.
If a two-tenant test, replay test or race test is missing, report it as missing; do not write it or invent it.
Do not commit, push, deploy, or report a check as passed without running it.
