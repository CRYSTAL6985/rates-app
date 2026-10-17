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
  const fetchers = { tgju: ok(tgju), nobitex: ok({}) };
  const poller = createPoller({ db, fetchers, log: quiet });
  const count = () => db.prepare("SELECT count(*) AS n FROM snapshots WHERE id = 'usd'").get().n;

  await poller.poll();
  await poller.poll();
  assert.equal(count(), 1);

  fetchers.tgju = ok({ current: { ...tgju.current, price_dollar_rl: { ...tgju.current.price_dollar_rl, ts: '2030-01-01 10:00:00' } } });
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
