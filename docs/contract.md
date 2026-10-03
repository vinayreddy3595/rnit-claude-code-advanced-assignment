# RNIT-TRAIN-101 — Leave approval contract

Written before the code. Two synthetic tenants: **North** and **South**. Request **#101** belongs to North.

| # | Who / what | Tenant | Expected | Proved by (api/test/approval.test.js) |
|---|---|---|---|---|
| C1 | No session approves #101 | – | **401**, no change | `C1: no session -> 401` |
| C2 | Employee A approves #101 | North | **403**, no change, 0 events | `C2` |
| C3 | Manager C reads #101 / lists requests | South | **404**; #101 not in list | `C3` |
| C3b | Manager C approves #101 | South | **404**, no change, 0 events | `C3b` |
| C4 | Manager B approves #101 | North | **approved once**: status = approved, event count = 1 | `C4` |
| C5 | Same key, same body, retried | North | **same result**, still 1 event, `Idempotent-Replayed: true` | `C5` |
| C5b | Same retry after API restart | North | **same result** (key stored in DB, not memory) | `C5b` |
| C6 | Same key, different body | North | **409**, still 1 event | `C6` |
| C7 | New key, request already approved | North | **409 invalid_transition** | `C7` |
| C8 | 10 concurrent approvals, different keys | North | exactly **one 200**, nine 409, 1 event | `C8` |
| C9 | Approve without Idempotency-Key | North | **400**, no change | `C9` |

Client rows (web/src/approvalClient.test.js): a retry of one intent reuses the same key; 404 text does not reveal other tenants.

**Rule:** a convincing demo proves how it looks, not that another tenant can't reach the data.
