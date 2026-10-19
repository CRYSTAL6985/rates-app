import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDb } from '../server/db.js';
import { createPoller } from '../server/poller.js';

const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
const ok = json => async () => json;
const fail = async () => { throw new Error('source down'); };
const quiet = { error() {} };

test('poll fills quotes from both sources', async () => {
  const poller = createPoller({ db: openDb(':memory:'), fetchers: { tgju: ok(fixture('tgju.json')), nobitex: ok(fixture('nobitex.json')) }, log: quiet });
  await poller.poll();
  assert.ok(poller.quotes.get('usd'));
  assert.ok(poller.quotes.get('btc'));
});

test('a failing source keeps the last good quotes', async () => {
  const fetchers = { tgju: ok(fixture('tgju.json')), nobitex: ok(fixture('nobitex.json')) };
  const poller = createPoller({ db: openDb(':memory:'), fetchers, log: quiet });
  await poller.poll();
  const usd = poller.quotes.get('usd');

  const moved = fixture('nobitex.json');
  moved.stats['btc-rls'].latest = '1230';
  fetchers.tgju = fail;
  fetchers.nobitex = ok(moved);
  await poller.poll();

  assert.deepEqual(poller.quotes.get('usd'), usd);
  assert.equal(poller.quotes.get('btc').price, 123);
});

test('junk payload does not crash the poller', async () => {
  const poller = createPoller({ db: openDb(':memory:'), fetchers: { tgju: ok({}), nobitex: ok('<html>') }, log: quiet });
  await poller.poll();
  assert.equal(poller.quotes.size, 0);
});

test('a new source time records a snapshot, the same time does not', async () => {
  const db = openDb(':memory:');
  const tgju = fixture('tgju.json');
  // Own timestamps: the fixture's real one falls out of the keep window as days pass.
  const at = ts => ({ current: { ...tgju.current, price_dollar_rl: { ...tgju.current.price_dollar_rl, ts } } });
  const fetchers = { tgju: ok(at('2030-01-01 09:00:00')), nobitex: ok({}) };
  const poller = createPoller({ db, fetchers, log: quiet });
  const count = () => db.prepare("SELECT count(*) AS n FROM snapshots WHERE id = 'usd'").get().n;

  await poller.poll();
  await poller.poll();
  assert.equal(count(), 1);

  fetchers.tgju = ok(at('2030-01-01 10:00:00'));
  await poller.poll();
  assert.equal(count(), 2);
});

test('snapshots older than two days are pruned', async () => {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO snapshots VALUES ('usd', ?, 1)").run(Date.now() - 3 * 864e5);
  const poller = createPoller({ db, fetchers: { tgju: ok({}), nobitex: ok({}) }, log: quiet });
  await poller.poll();
  assert.equal(db.prepare('SELECT count(*) AS n FROM snapshots').get().n, 0);
});

test('poll hands the quotes to onQuotes', async () => {
  let seen;
  const poller = createPoller({ db: openDb(':memory:'), fetchers: { tgju: ok(fixture('tgju.json')), nobitex: ok({}) }, onQuotes: q => { seen = q; }, log: quiet });
  await poller.poll();
  assert.equal(seen, poller.quotes);
});

test('backfill saves today\'s tgju ticks for tgju items only', async () => {
  const db = openDb(':memory:');
  const asked = [];
  const tgjuToday = async key => { asked.push(key); return { data: [['2,640,000', '10:05:00', '', '']] }; };
  const poller = createPoller({ db, fetchers: { tgjuToday }, log: quiet });
  await poller.backfill();
  assert.ok(asked.includes('price_dollar_rl'));
  assert.ok(!asked.includes('btc') && !asked.includes('crypto-tether-irr'));
  assert.equal(db.prepare("SELECT price FROM snapshots WHERE id = 'usd'").get().price, 264000);
});

test('one failing backfill request does not stop the rest', async () => {
  const db = openDb(':memory:');
  let calls = 0;
  const tgjuToday = async () => { if (++calls === 1) throw new Error('403'); return { data: [['2,640,000', '10:05:00', '', '']] }; };
  const poller = createPoller({ db, fetchers: { tgjuToday }, log: quiet });
  await poller.backfill();
  assert.ok(db.prepare('SELECT count(*) AS n FROM snapshots').get().n > 1);
});

// After a day ends tgju re-stamps its close as that day's 00:00, which would land before the day's real prices.
test('a source time older than the newest snapshot is not recorded', async () => {
  const db = openDb(':memory:');
  const tgju = fixture('tgju.json');
  const at = ts => ok({ current: { price_dollar_rl: { ...tgju.current.price_dollar_rl, ts } } });
  const fetchers = { tgju: at('2030-01-01 17:00:00'), nobitex: ok({}) };
  const poller = createPoller({ db, fetchers, log: quiet });
  await poller.poll();
  fetchers.tgju = at('2030-01-01 00:00:00');
  await poller.poll();
  assert.deepEqual(db.prepare("SELECT t FROM snapshots WHERE id = 'usd'").all().map(r => r.t), [Date.parse('2030-01-01T17:00:00+03:30')]);
});
