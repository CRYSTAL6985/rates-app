import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { createHistory } from '../server/history.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Nobitex sits behind Cloudflare, which answers 403 to bursts.
test('nobitex history requests run one at a time', async () => {
  let running = 0, most = 0;
  const nobitex = async () => {
    running++; most = Math.max(most, running);
    await sleep(5);
    running--;
    return { s: 'ok', t: [1, 2], c: [1, 2] };
  };
  const history = createHistory({ db: openDb(':memory:'), fetchers: { tgju: async () => ({}), nobitex } });
  await Promise.all(['btc', 'eth', 'usdt', 'doge'].map(id => history.get(id, 'day')));
  assert.equal(most, 1);
});

test('one failed nobitex request does not block the next', async () => {
  let calls = 0;
  const nobitex = async () => { if (++calls === 1) throw new Error('403'); return { s: 'ok', t: [1, 2], c: [1, 2] }; };
  const history = createHistory({ db: openDb(':memory:'), fetchers: { tgju: async () => ({}), nobitex } });
  const [a, b] = await Promise.allSettled([history.get('btc', 'day'), history.get('eth', 'day')]);
  assert.equal(a.status, 'rejected');
  assert.equal(b.value.length, 2);
});

// Nobitex answers 403 to USDTIRT history every time, so tether's chart comes from tgju.
test('usdt history comes from tgju, not nobitex', async () => {
  const asked = [];
  const history = createHistory({
    db: openDb(':memory:'),
    fetchers: {
      tgju: async key => { asked.push(key); return { data: [['1', '1', '1', '2,640,510', '', '', '2026/10/16', '']] }; },
      nobitex: async () => { throw new Error('should not be called'); },
    },
    now: () => Date.parse('2026-10-17T12:00:00Z'),
  });
  const points = await history.get('usdt', 'week');
  assert.deepEqual(asked, ['crypto-tether-irr']);
  assert.equal(points[0].price, 264051);
});

// The day chart is today's session only, so it never opens with yesterday's close.
const daySnapshots = (rows, id = 'usd') => {
  const db = openDb(':memory:');
  const add = db.prepare(`INSERT INTO snapshots VALUES ('${id}', ?, ?)`);
  for (const [ts, price] of rows) add.run(Date.parse(ts + '+03:30'), price);
  return db;
};

test('tgju day chart is empty before the market opens', async () => {
  const db = daySnapshots([['2026-10-18T19:00:00', 260000], ['2026-10-19T00:00:00', 262000]]);
  const history = createHistory({ db, fetchers: {}, now: () => Date.parse('2026-10-19T09:00:00+03:30') });
  assert.deepEqual(await history.get('usd', 'day'), []);
});

// tgju opens gold on yesterday's price and moves to the real one seconds later.
test('tgju day chart starts at today\'s first real price, not yesterday\'s', async () => {
  const db = daySnapshots([['2026-10-18T19:00:00', 260000], ['2026-10-19T00:00:00', 262000],
    ['2026-10-19T10:00:08', 261900], ['2026-10-19T10:00:16', 255000], ['2026-10-19T11:00:00', 256000]]);
  const history = createHistory({ db, fetchers: {}, now: () => Date.parse('2026-10-19T11:30:00+03:30') });
  assert.deepEqual((await history.get('usd', 'day')).map(p => p.price), [255000, 256000]);
});

// USDT's history comes from tgju too (Nobitex blocks it), but crypto trades around the clock.
test('usdt day chart is the last 24 hours, across midnight', async () => {
  const db = daySnapshots([['2026-10-18T23:00:00', 259000], ['2026-10-19T00:00:00', 260000],
    ['2026-10-19T01:00:00', 261000], ['2026-10-18T00:30:00', 250000]], 'usdt');
  const history = createHistory({ db, fetchers: {}, now: () => Date.parse('2026-10-19T01:30:00+03:30') });
  assert.deepEqual((await history.get('usdt', 'day')).map(p => p.price), [259000, 260000, 261000]);
});
