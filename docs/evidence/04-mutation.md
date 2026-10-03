# Mutation checks — throwaway branch mutation/throwaway from a36eaa6 (2026-10-03T16:15:09+05:30)
# Each mutation removes one protection; the named tests MUST go red. Source restored after each.

## M1: remove the tenant filter from the lookup (findRequest)
```diff
-              FROM leave_requests WHERE id = ? AND tenant_id = ?`,
+              FROM leave_requests WHERE id = ? AND ? IS NOT NULL`,
```
```
ℹ fail 4
ℹ pass 15
✖ C13: tenantId in the body is not authority (manager C sends tenantId: north) -> 404 (96.3733ms)
✖ C3: manager C (south) cannot read #101 -> 404 (98.6271ms)
✖ C3b: manager C (south) approves #101 -> 404, nothing changes (103.5471ms)
✖ C6c: a key first used on a hidden/missing id still works on a valid id (100.4511ms)
```

## M1b: remove the tenant filter from the guarded UPDATE only
```diff
-                  WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
+                  WHERE id = ? AND ? IS NOT NULL AND status = 'pending'`,
```
```
ℹ fail 0
ℹ pass 19
```
Stays green: the lookup in findRequest already returned 404, so this second filter is defence in depth. Recorded honestly as a check that is NOT independently tested.

## M2: remove the ISSUE-17 owner check (visibleList returns any list)
```diff
-  return list.owner === token ? list : LOADING;
+  return list; // MUTATION
```
```
ℹ fail 1
ℹ pass 5
✖ ISSUE-17: a list loaded for another user is never shown, even for one render (5.1021ms)
```

## M3: remove the state guard (AND status = 'pending')
```diff
-                  WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
+                  WHERE id = ? AND tenant_id = ?`,
```
```
ℹ fail 5
ℹ pass 14
✖ C11: approve and reject race (separate connections) -> one transition wins, other 409 (492.0975ms)
✖ C12: reject after approve -> 409 invalid transition, status stays approved (156.1836ms)
✖ C7: new key on an already-approved request -> 409 invalid transition (139.364ms)
✖ C8: burst of 10 approvals with different keys (one process) -> exactly one succeeds (218.6099ms)
✖ C8b: 6 worker threads, own DB connections, approve at the same instant -> exactly one 200 (496.112ms)
```

## M4: drop the idempotency lookup (replay never found)
```diff
-    if (prior) {
+    if (false && prior) { // MUTATION
```
```
ℹ fail 4
ℹ pass 15
✖ C5: same key + same body retried -> same result, still one event (76.4776ms)
✖ C5b: replay survives an API restart (not an in-memory map) (80.456ms)
✖ C6: same key + different body -> 409 key-reuse (not just invalid transition) (67.3222ms)
✖ C6b: same key reused on a different request id -> 409, second request untouched (70.6731ms)
```

## Restored
```
ℹ pass 19
ℹ fail 0
ℹ pass 6
ℹ fail 0
```
