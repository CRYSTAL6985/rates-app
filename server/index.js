import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createPoller } from './poller.js';
import { createHistory } from './history.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

const db = openDb(fileURLToPath(new URL('../rates.db', import.meta.url)));
const poller = createPoller({ db });
const history = createHistory({ db });

createApp({ poller, history, publicDir }).listen(PORT, () => {
  console.log(`نرخ running on http://localhost:${PORT}`);
  poller.start();
});
