import { openDb } from './db.js';
import { seed } from './seed.js';
import { createApp } from './app.js';

const db = seed(openDb(process.env.DB_FILE ?? 'leave.db'));
const port = Number(process.env.PORT ?? 3000);
createApp(db).listen(port, () => console.log(`Leave API on http://localhost:${port}`));
