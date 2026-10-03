# API request/response evidence — 2026-10-03T10:53:04.143Z

Captured by `npm run evidence:capture` against a fresh synthetic database (real Express app, real SQLite).
Bearer tokens are synthetic and still redacted. Order matters: each call runs against the state left by the previous one.

## C1 no session

```http
POST /api/requests/101/approve
(no Authorization header)
Idempotency-Key: k1
{}
```

```
HTTP 401
{"error":"unauthenticated"}
```

## C2 employee approves

```http
POST /api/requests/101/approve
Authorization: Bearer <redacted: Employee A (North)>
Idempotency-Key: k1
{"comment":"ok"}
```

```
HTTP 403
{"error":"forbidden"}
```

## C3 South manager reads North #101

```http
GET /api/requests/101
Authorization: Bearer <redacted: Manager C (South)>
```

```
HTTP 404
{"error":"not_found"}
```

## C13 South manager claims tenant north in body

```http
POST /api/requests/101/approve
Authorization: Bearer <redacted: Manager C (South)>
Idempotency-Key: k1
{"comment":"ok","tenantId":"north"}
```

```
HTTP 404
{"error":"not_found"}
```

## C4 North manager approves #101

```http
POST /api/requests/101/approve
Authorization: Bearer <redacted: Manager B (North)>
Idempotency-Key: k1
{"comment":"ok"}
```

```
HTTP 200
{"id":"101","status":"approved","decidedBy":"u-b"}
```

## C5 same key, same body (retry)

```http
POST /api/requests/101/approve
Authorization: Bearer <redacted: Manager B (North)>
Idempotency-Key: k1
{"comment":"ok"}
```

```
HTTP 200  Idempotent-Replayed: true
{"id":"101","status":"approved","decidedBy":"u-b"}
```

## C6 same key, different body

```http
POST /api/requests/101/approve
Authorization: Bearer <redacted: Manager B (North)>
Idempotency-Key: k1
{"comment":"changed"}
```

```
HTTP 409
{"error":"idempotency_key_reused_with_different_body"}
```

## C12 reject after approve (new key)

```http
POST /api/requests/101/reject
Authorization: Bearer <redacted: Manager B (North)>
Idempotency-Key: r1
{}
```

```
HTTP 409
{"error":"invalid_transition","status":"approved"}
```

## North list after the run

```http
GET /api/requests
Authorization: Bearer <redacted: Manager B (North)>
```

```
HTTP 200
[{"id":"101","employeeId":"u-a","days":3,"status":"approved","decidedBy":"u-b"},{"id":"102","employeeId":"u-a","days":1,"status":"pending","decidedBy":null}]
```

## South list (never contains #101)

```http
GET /api/requests
Authorization: Bearer <redacted: Manager C (South)>
```

```
HTTP 200
[{"id":"201","employeeId":"u-x","days":2,"status":"pending","decidedBy":null}]
```
