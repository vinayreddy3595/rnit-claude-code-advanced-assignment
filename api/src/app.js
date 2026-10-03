import express from 'express';
import { requestsRouter } from './routes/requests.js';

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  // Dev-only CORS for the Vite client on localhost.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api/requests', requestsRouter(db));
  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });
  return app;
}
