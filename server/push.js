import webpush from 'web-push';
import { itemById } from './items.js';

// The server POSTs to whatever endpoint a browser hands it, so only real push services are allowed.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const GONE = new Set([404, 410]);
// A push service that never answers must not hold up the next price check.
const SEND_TIMEOUT_MS = 10_000;

export function isPushEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { return false; }
  return url.protocol === 'https:' && PUSH_HOSTS.some(re => re.test(url.hostname));
}

export function createPush({ db, publicKey, privateKey, subject, log = console }) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const upsert = db.prepare('INSERT INTO subscriptions (device, json) VALUES (?, ?) ON CONFLICT (device) DO UPDATE SET json = excluded.json');
  const get = db.prepare('SELECT json FROM subscriptions WHERE device = ?');
  const drop = db.prepare('DELETE FROM subscriptions WHERE device = ?');

  return {
    publicKey,
    subscribe: (device, subscription) => upsert.run(device, JSON.stringify(subscription)),
    async notify(device, payload) {
      const row = get.get(device);
      if (!row) return;
      try {
        await webpush.sendNotification(JSON.parse(row.json), JSON.stringify(payload), { timeout: SEND_TIMEOUT_MS });
      } catch (err) {
        // The browser unsubscribed or the subscription expired.
        if (GONE.has(err.statusCode)) return drop.run(device);
        log.error(`[push] ${err.statusCode ?? ''} ${err.message}`);
      }
    },
  };
}

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

// Poller hook: check every alert against the new prices and notify the ones that fired.
export const alertNotifier = ({ alerts, push, log = console }) => async quotes => {
  for (const a of alerts.checkAll(quotes)) {
    const item = itemById(a.item), unit = item.unit === 'usd' ? 'دلار' : 'تومان';
    const crossed = a.direction === 'above' ? 'رفت بالای' : 'آمد زیر';
    await push.notify(a.device, {
      title: item.name,
      body: `${crossed} ${nf.format(a.target)} ${unit} · الان ${nf.format(quotes.get(a.item).price)}`,
      item: a.item,
      alert: a.id,
    }).catch(err => log.error('[push]', err));
  }
};
