// Helper for test C8b: one thread = one separate DB connection, like a second API process.
import { parentPort, workerData } from 'node:worker_threads';
import { openDb, approveRequest } from '../src/db.js';

const { dbFile, gate, actor, key } = workerData;
const db = openDb(dbFile);
Atomics.wait(gate, 0, 0); // block until the test releases every worker together
const result = approveRequest(db, { id: '101', actor, key, bodyHash: `hash-${key}`, comment: 'race' });
db.close();
parentPort.postMessage({ code: result.code });
