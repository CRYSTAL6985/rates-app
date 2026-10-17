import { fileURLToPath } from 'node:url';
import { existsSync, appendFileSync } from 'node:fs';
import webpush from 'web-push';
import { openDb } from './db.js';
import { createPoller } from './poller.js';
import { createHistory } from './history.js';
import { createAlertStore } from './alerts.js';
import { createPush, alertNotifier } from './push.js';
import { createApp } from './app.js';

const root = new URL('../', import.meta.url);
const envFile = fileURLToPath(new URL('.env', root));
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Push subscriptions are tied to these keys, so they're made once and kept in .env (git-ignored).
if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
  const keys = webpush.generateVAPIDKeys();
  appendFileSync(envFile, `VAPID_PUBLIC=${keys.publicKey}\nVAPID_PRIVATE=${keys.privateKey}\n`);
  process.env.VAPID_PUBLIC = keys.publicKey;
  process.env.VAPID_PRIVATE = keys.privateKey;
  console.log('Made new push keys and saved them to .env');
}

const PORT = Number(process.env.PORT) || 3000;
// Push services want a way to contact the sender. Set VAPID_SUBJECT to a real mailto: before publishing.
const subject = process.env.VAPID_SUBJECT || 'mailto:rates-app@example.com';

const db = openDb(fileURLToPath(new URL('rates.db', root)));
const alerts = createAlertStore(db);
const push = createPush({ db, publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE, subject });
const poller = createPoller({ db, onQuotes: alertNotifier({ alerts, push }) });
const history = createHistory({ db });

createApp({ poller, history, alerts, push, publicDir: fileURLToPath(new URL('public', root)) }).listen(PORT, () => {
  console.log(`نرخ running on http://localhost:${PORT}`);
  poller.start();
});
