# RNIT-TRAIN-101 — Leave approval contract

Written before the code (lesson 1-3). Two synthetic tenants, **North** and **South**. Request **#101** belongs to North.
Status codes are this lab's contract. Tenant identity comes from the authenticated user; a request-body field is never authority.

## Fixtures (synthetic)

| Fixture | Tenant | Role | Token (synthetic) |
|---|---|---|---|
| Employee A | North | employee | `tok-north-employee-a` |
| Manager B | North | manager | `tok-north-manager-b` |
| Manager C | South | manager | `tok-south-manager-c` |
| Request #101 | North | pending | — |
| Request #102 | North | pending | — |
| Request #201 | South | pending | — |

## Acceptance table — every row maps to a test

| # | Case | Expected | Proved by (`api/test/approval.test.js`) |
|---|---|---|---|
| C1 | No valid session approves #101 | **401**, no change, 0 events | `C1` |
| C2 | Employee A approves #101 | **403**, no change, 0 events | `C2` |
| C14 | Employee A rejects #101 | **403**, 0 events | `C14` |
| C3 | Manager C (South) reads #101 / lists requests | **404**; #101 absent from South list | `C3` |
| C3b | Manager C (South) approves #101 | **404**, no change, 0 events | `C3b` |
| C13 | Manager C sends `tenantId: "north"` in the body | **404** — body is not authority | `C13` |
| C4 | Manager B approves pending #101 | **200 approved once**: status approved, event count 1 | `C4` |
| C10 | Manager B rejects pending #101 | **200 rejected**, event count 1 | `C10` |
| C5 | Same key + same payload retried | **Same recorded outcome**, `Idempotent-Replayed: true`, still 1 event | `C5` |
| C5b | Same retry after API restart | **Same outcome** (keys persisted in DB) | `C5b` |
| C6 | Same key + different payload | **409** `idempotency_key_reused_with_different_body` | `C6` |
| C6b | Same key reused on another request (#102) | **409**, #102 untouched | `C6b` |
| C6c | Key first used on a hidden id (South #201 → 404), then on #101 | 404, then **200** (404s are not stored) | `C6c` |
| C7 | New key, request already approved | **409** `invalid_transition` | `C7` |
| C12 | Reject after approve | **409** `invalid_transition`, stays approved | `C12` |
| C8 | 10 approvals in one process | exactly **one 200**, nine 409, 1 event | `C8` |
| C8b | 6 approvals, separate DB connections, same instant | exactly **one 200**, five 409, 1 event | `C8b` |
| C11 | Approve and reject concurrently (separate connections) | **one transition wins**, others 409; final status = winner | `C11` |
| C9 | Approve without `Idempotency-Key` | **400**, no change | `C9` |

## Client rows (`web/src/approvalClient.test.js`)

| Case | Expected |
|---|---|
| Retry of one intent | Re-sends the **same** Idempotency-Key |
| New intent | New key |
| Reject | Goes to `/reject` with its own key |
| User switches during an approval | Request is aborted; stale response never updates the new user's screen |
| ISSUE-17: list loaded for another user | **Never rendered**, not even for one frame (`visibleList`) |
| 404 message | Same text for "missing" and "other tenant" |

**Rule:** a convincing demo proves how it looks, not that another tenant can't reach the data.
