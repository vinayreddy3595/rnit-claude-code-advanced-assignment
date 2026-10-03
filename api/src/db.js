// All database access goes through this module. Routes never write SQL.
// Every read of a leave request is scoped by tenantId (see docs/audit.md, finding F1).
import { DatabaseSync } from 'node:sqlite';

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000; -- a second process waits for the write lock instead of failing
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name      TEXT NOT NULL,
      role      TEXT NOT NULL CHECK (role IN ('employee','manager')),
      token     TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      days        INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
      decided_by  TEXT,
      comment     TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id  TEXT NOT NULL,
      request_id TEXT NOT NULL,
      actor_id   TEXT NOT NULL,
      action     TEXT NOT NULL,
      at         TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Persisted, not an in-memory Map, so a retry after a restart still replays.
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      tenant_id     TEXT NOT NULL,
      actor_id      TEXT NOT NULL,
      key           TEXT NOT NULL,
      body_hash     TEXT NOT NULL,
      response_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      PRIMARY KEY (tenant_id, actor_id, key)
    );
  `);
  return db;
}

export function findUserByToken(db, token) {
  return db.prepare('SELECT id, tenant_id AS tenantId, name, role FROM users WHERE token = ?').get(token);
}

// Tenant-scoped: a request in another tenant is indistinguishable from a missing one.
export function findRequest(db, id, tenantId) {
  return db
    .prepare(
      `SELECT id, tenant_id AS tenantId, employee_id AS employeeId, days, status,
                     decided_by AS decidedBy, comment
              FROM leave_requests WHERE id = ? AND tenant_id = ?`,
    )
    .get(id, tenantId);
}

export function listRequests(db, tenantId) {
  return db
    .prepare(
      `SELECT id, employee_id AS employeeId, days, status, decided_by AS decidedBy
              FROM leave_requests WHERE tenant_id = ? ORDER BY id`,
    )
    .all(tenantId);
}

export function countEvents(db, requestId, tenantId) {
  return db
    .prepare('SELECT COUNT(*) AS n FROM audit_events WHERE request_id = ? AND tenant_id = ?')
    .get(requestId, tenantId).n;
}

const DECISIONS = { approve: 'approved', reject: 'rejected' };

/**
 * Decide (approve or reject) a pending request exactly once.
 * Runs in one IMMEDIATE transaction: idempotency lookup, guarded state transition,
 * audit event and stored response commit together or not at all.
 * Returns { code, body }.
 */
export function decideRequest(db, { id, actor, key, bodyHash, comment, decision }) {
  const newStatus = DECISIONS[decision];
  if (!newStatus) throw new Error(`unknown decision: ${decision}`);
  db.exec('BEGIN IMMEDIATE');
  try {
    const prior = db
      .prepare(
        `SELECT body_hash AS bodyHash, response_code AS code, response_body AS body
                FROM idempotency_keys WHERE tenant_id = ? AND actor_id = ? AND key = ?`,
      )
      .get(actor.tenantId, actor.id, key);
    if (prior) {
      db.exec('ROLLBACK'); // read-only path: nothing to commit
      if (prior.bodyHash !== bodyHash) {
        return { code: 409, body: { error: 'idempotency_key_reused_with_different_body' } };
      }
      return { code: prior.code, body: JSON.parse(prior.body), replayed: true };
    }

    const request = findRequest(db, id, actor.tenantId);
    let result;
    if (!request) {
      result = { code: 404, body: { error: 'not_found' } };
    } else {
      // Guarded transition: only pending -> approved|rejected, and only in the actor's tenant.
      // Whichever decision commits first wins; the other sees changes === 0 and gets 409.
      const changed = db
        .prepare(
          `UPDATE leave_requests SET status = ?, decided_by = ?, comment = ?
                  WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
        )
        .run(newStatus, actor.id, comment ?? null, id, actor.tenantId).changes;
      if (changed !== 1) {
        result = { code: 409, body: { error: 'invalid_transition', status: request.status } };
      } else {
        db.prepare(
          `INSERT INTO audit_events (tenant_id, request_id, actor_id, action)
                    VALUES (?, ?, ?, ?)`,
        ).run(actor.tenantId, id, actor.id, newStatus);
        result = { code: 200, body: { id, status: newStatus, decidedBy: actor.id } };
      }
    }

    // 404s are not stored: they reveal nothing and must not pin a key to a missing id.
    if (result.code !== 404) {
      db.prepare(
        `INSERT INTO idempotency_keys
                  (tenant_id, actor_id, key, body_hash, response_code, response_body)
                  VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(actor.tenantId, actor.id, key, bodyHash, result.code, JSON.stringify(result.body));
    }
    db.exec('COMMIT');
    return result;
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK'); // never mask the original error
    throw err;
  }
}
