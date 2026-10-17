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
