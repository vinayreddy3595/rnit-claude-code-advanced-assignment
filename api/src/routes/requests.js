import { createHash } from 'node:crypto';
import { Router } from 'express';
import { requireUser, requireRole } from '../auth.js';
import { findRequest, listRequests, approveRequest } from '../db.js';

const hashBody = (body) => createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');

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

  router.post('/:id/approve', requireRole('manager'), (req, res) => {
    const key = req.get('idempotency-key');
    if (!key || key.length > 200) {
      return res.status(400).json({ error: 'idempotency_key_required' });
    }
    const body = req.body ?? {};
    const result = approveRequest(db, {
      id: req.params.id,
      actor: req.user,
      key,
      bodyHash: hashBody({ id: req.params.id, comment: body.comment ?? null }),
      comment: body.comment,
    });
    if (result.replayed) res.set('Idempotent-Replayed', 'true');
    res.status(result.code).json(result.body);
  });

  return router;
}
