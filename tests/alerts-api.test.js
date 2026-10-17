import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.js';
import { createAlertStore } from '../server/alerts.js';
import { createApp } from '../server/app.js';
import { alertNotifier, isPushEndpoint } from '../server/push.js';

const quiet = { error() {} };
const D1 = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const D2 = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
let server, base, db, alerts, subscribed;

before(async () => {
  db = openDb(':memory:');
  alerts = createAlertStore(db);
  subscribed = [];
  const push = { publicKey: 'PUBKEY', subscribe: (device, sub) => subscribed.push([device, sub]) };
  server = createApp({ poller: { quotes: new Map() }, history: {}, alerts, push, publicDir: mkdtempSync(join(tmpdir(), 'p-')), log: quiet });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (method, path, { device = D1, body } = {}) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', ...(device ? { 'X-Device': device } : {}) },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});
const good = { item: 'usd', direction: 'above', target: 270000, repeat: false };

test('creates and lists an alert for the device', async () => {
  const res = await call('POST', '/api/alerts', { body: good });
  assert.equal(res.status, 201);
  const { alerts: list } = await (await call('GET', '/api/alerts')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].target, 270000);
  assert.equal(list[0].device, undefined);
});

test('another device cannot see or delete it', async () => {
  const { alert } = await (await call('POST', '/api/alerts', { body: good })).json();
  const { alerts: list } = await (await call('GET', '/api/alerts', { device: D2 })).json();
  assert.equal(list.length, 0);
  assert.equal((await call('DELETE', `/api/alerts/${alert.id}`, { device: D2 })).status, 404);
  assert.equal((await call('PATCH', `/api/alerts/${alert.id}`, { device: D2, body: { target: 1 } })).status, 404);
  assert.equal((await call('DELETE', `/api/alerts/${alert.id}`)).status, 204);
});

test('rejects bad alert input', async () => {
  const count = () => db.prepare('SELECT count(*) AS n FROM alerts').get().n;
  const before = count();
  const bad = [
    { ...good, item: 'nope' },
    { ...good, direction: 'up' },
    { ...good, target: -1 },
    { ...good, target: 'abc' },
    { ...good, target: 1e16 },
    { ...good, repeat: 'yes' },
    { ...good, extra: 1 },
  ];
  for (const body of bad) assert.equal((await call('POST', '/api/alerts', { body })).status, 400, JSON.stringify(body));
  assert.equal((await call('POST', '/api/alerts', { body: '{not json' })).status, 400);
  assert.equal((await call('POST', '/api/alerts', { body: { ...good, pad: 'x'.repeat(2000) } })).status, 400);
  assert.equal((await call('POST', '/api/alerts', { device: null, body: good })).status, 400);
  assert.equal((await call('POST', '/api/alerts', { device: 'not-a-uuid', body: good })).status, 400);
  assert.equal((await call('PATCH', '/api/alerts/abc', { body: { enabled: 'no' } })).status, 400);
  assert.equal(count(), before);
});

test('patch changes only the given fields', async () => {
  const { alert } = await (await call('POST', '/api/alerts', { body: good })).json();
  const res = await call('PATCH', `/api/alerts/${alert.id}`, { body: { target: 280000, repeat: true } });
  const { alert: after } = await res.json();
  assert.equal(after.target, 280000);
  assert.equal(after.repeat, true);
  assert.equal(after.direction, 'above');
});

test('push key and subscription', async () => {
  assert.deepEqual(await (await call('GET', '/api/push/key')).json(), { key: 'PUBKEY' });
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BKey', auth: 'auth' } };
  assert.equal((await call('POST', '/api/push/subscribe', { body: sub })).status, 204);
  assert.deepEqual(subscribed.at(-1), [D1, sub]);
});

test('subscription to a non-push host is refused', async () => {
  const n = subscribed.length;
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x']) {
    const res = await call('POST', '/api/push/subscribe', { body: { endpoint, keys: { p256dh: 'a', auth: 'b' } } });
    assert.equal(res.status, 400, endpoint);
  }
  assert.equal(subscribed.length, n);
});

test('known push services are accepted as endpoints', () => {
  for (const u of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) assert.ok(isPushEndpoint(u), u);
});

test('fired alert triggers a push to that device', async () => {
  const store = createAlertStore(openDb(':memory:'));
  store.create(D1, good);
  const sent = [];
  const notify = alertNotifier({ alerts: store, push: { notify: async (device, payload) => sent.push([device, payload]) }, log: quiet });
  await notify(new Map([['usd', { price: 260000 }]]));
  assert.equal(sent.length, 0);
  await notify(new Map([['usd', { price: 271000 }]]));
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], D1);
  assert.equal(sent[0][1].title, 'دلار آمریکا');
  assert.equal(sent[0][1].item, 'usd');
});
