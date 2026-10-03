// Helper for tests C8b / C11: one thread = one separate DB connection, like a second API process.
import { parentPort, workerData } from 'node:worker_threads';
import { openDb, decideRequest } from '../src/db.js';

const { dbFile, gate, actor, key, decision = 'approve' } = workerData;
const db = openDb(dbFile);
Atomics.wait(gate, 0, 0); // block until the test releases every worker together
const result = decideRequest(db, {
  id: '101', actor, key, bodyHash: `hash-${decision}-${key}`, comment: 'race', decision,
});
db.close();
parentPort.postMessage({ code: result.code, decision, status: result.body.status });
