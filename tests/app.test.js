import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { openDb } from '../server/db.js';
import { createPoller } from '../server/poller.js';
import { createHistory } from '../server/history.js';
import { createApp } from '../server/app.js';

const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
const quiet = { error() {} };
let server, base, db, historyCalls;

before(async () => {
  db = openDb(':memory:');
  const poller = createPoller({ db, fetchers: { tgju: async () => fixture('tgju.json'), nobitex: async () => fixture('nobitex.json') }, log: quiet });
  await poller.poll();
  historyCalls = 0;
  const history = createHistory({
    db,
    fetchers: {
      tgju: async () => { historyCalls++; return fixture('tgju-history.json'); },
      nobitex: async () => { throw new Error('nobitex down'); },
    },
  });
  const publicDir = mkdtempSync(join(tmpdir(), 'rates-public-'));
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>نرخ</title>');
  server = createApp({ poller, history, publicDir, log: quiet });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const rawGet = path => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: server.address().port, path }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
});

test('GET /api/quotes returns items and quotes', async () => {
  const body = await (await fetch(`${base}/api/quotes`)).json();
  assert.equal(body.items.length, 25);
  assert.deepEqual(body.top, ['g18', 'usd', 'btc']);
  assert.ok(body.quotes.find(q => q.id === 'usd').price > 0);
  assert.ok(Number.isFinite(body.serverTime));
});

test('coin quotes include bubblePct', async () => {
  const body = await (await fetch(`${base}/api/quotes`)).json();
  const emami = body.quotes.find(q => q.id === 'emami');
  assert.ok(emami.bubblePct > 0 && emami.bubblePct < 50, String(emami.bubblePct));
  assert.equal(body.quotes.find(q => q.id === 'usd').bubblePct, undefined);
});

test('GET /api/history rejects unknown item', async () => {
  assert.equal((await fetch(`${base}/api/history/nope?range=day`)).status, 400);
});

test('GET /api/history rejects unknown range', async () => {
  assert.equal((await fetch(`${base}/api/history/usd?range=decade`)).status, 400);
});

test('day history for a tgju item comes from snapshots', async () => {
  const now = Date.now();
  db.prepare("DELETE FROM snapshots WHERE id = 'aed'").run();
  for (const [i, p] of [1, 2, 3, 4].entries()) db.prepare("INSERT INTO snapshots VALUES ('aed', ?, ?)").run(now - (i + 1) * 60e3, p);
  const { points } = await (await fetch(`${base}/api/history/aed?range=day`)).json();
  assert.equal(points.length, 3, 'the day\'s first tick is dropped');
  assert.ok(points[0].t < points[2].t);
});

test('week history for a tgju item comes from the daily history and is cached', async () => {
  const before = historyCalls;
  const a = await (await fetch(`${base}/api/history/usd?range=year`)).json();
  await fetch(`${base}/api/history/usd?range=year`);
  assert.ok(a.points.length > 0);
  assert.equal(historyCalls, before + 1);
});

test('history source failure is a 502 without internals', async () => {
  const res = await fetch(`${base}/api/history/btc?range=week`);
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes('at '));
});

test('static files are served and unknown paths are 404', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
});

test('static path traversal is refused', async () => {
  assert.equal(await rawGet('/../package.json'), 404);
  assert.equal(await rawGet('/..%2fpackage.json'), 404);
  assert.equal(await rawGet('/%2e%2e/%2e%2e/etc/passwd'), 404);
});
