import { createHash } from 'node:crypto';
import { Router } from 'express';
import { requireUser, requireRole } from '../auth.js';
import { findRequest, listRequests, decideRequest } from '../db.js';

// The fingerprint binds a key to one operation on one request with one payload.
const fingerprint = (parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export function requestsRouter(db) {
  const router = Router();
  router.use(requireUser(db));

  router.get('/', (req, res) => {
    res.json(listRequests(db, req.user.tenantId));
  });

  router.get('/:id', (req, res) => {
    const request = findRequest(db, req.params.id, req.user.tenantId);
    if (!request) return res.status(404).json({ error: 'not_found' });
    res.json(request);
  });

  for (const decision of ['approve', 'reject']) {
    router.post(`/:id/${decision}`, requireRole('manager'), (req, res) => {
      const key = req.get('idempotency-key');
      if (!key || key.length > 200) {
        return res.status(400).json({ error: 'idempotency_key_required' });
      }
      const comment = req.body?.comment ?? null;
      if (comment !== null && (typeof comment !== 'string' || comment.length > 500)) {
        return res.status(400).json({ error: 'invalid_comment' });
      }
      const result = decideRequest(db, {
        id: req.params.id,
        actor: req.user, // tenant comes from the authenticated user, never from the body
        key,
        bodyHash: fingerprint({ decision, id: req.params.id, comment }),
        comment,
        decision,
      });
      if (result.replayed) res.set('Idempotent-Replayed', 'true');
      res.status(result.code).json(result.body);
    });
  }

  return router;
}
