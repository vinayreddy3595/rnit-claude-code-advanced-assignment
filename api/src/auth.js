// Authentication only answers "who is this?". It does NOT authorize access to a record:
// object-level checks (tenant + state) live in db.js / routes.
import { findUserByToken } from './db.js';

export function requireUser(db) {
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const user = token && findUserByToken(db, token);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    req.user = user;
    next();
  };
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
