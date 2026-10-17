import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS } from '../server/items.js';
import { parseTgju, parseTgjuHistory } from '../server/sources/tgju.js';
import { parseNobitex, parseNobitexHistory } from '../server/sources/nobitex.js';

const fixture = name => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url)));
const num = s => Number(s.replaceAll(',', ''));
const byId = quotes => Object.fromEntries(quotes.map(q => [q.id, q]));

test('tgju rial prices become toman', () => {
  const json = fixture('tgju.json');
  const q = byId(parseTgju(json, ITEMS));
  assert.equal(q.usd.price, num(json.current.price_dollar_rl.p) / 10);
  assert.equal(q.emami.high, num(json.current.sekee.h) / 10);
});

test('tgju ounce stays in dollars with decimals', () => {
  const json = fixture('tgju.json');
  const q = byId(parseTgju(json, ITEMS));
  assert.equal(q.goz.price, num(json.current.ons.p));
});

test('tgju change sign comes from dt', () => {
  const row = { p: '2,638,000', h: '2,658,000', l: '2,633,600', d: '41,000', dp: 1.55, ts: '2026-10-17 18:25:00' };
  const down = byId(parseTgju({ current: { price_dollar_rl: { ...row, dt: 'low' } } }, ITEMS)).usd;
  assert.equal(down.change, -4100);
  assert.equal(down.changePct, -1.55);
  const up = byId(parseTgju({ current: { price_dollar_rl: { ...row, dt: 'high' } } }, ITEMS)).usd;
  assert.equal(up.change, 4100);
  assert.equal(up.changePct, 1.55);
});

test('tgju timestamp is Tehran time', () => {
  const row = { p: '1', h: '1', l: '1', d: '0', dp: 0, dt: '', ts: '2026-10-17 18:25:00' };
  const q = parseTgju({ current: { price_dollar_rl: row } }, ITEMS)[0];
  assert.equal(q.updatedAt, Date.parse('2026-10-17T18:25:00+03:30'));
});

test('missing tgju key is skipped', () => {
  const json = fixture('tgju.json');
  delete json.current.price_iqd;
  const q = byId(parseTgju(json, ITEMS));
  assert.equal(q.iqd, undefined);
  assert.ok(q.usd);
});

test('junk tgju payload gives no quotes instead of throwing', () => {
  assert.deepEqual(parseTgju({}, ITEMS), []);
  assert.deepEqual(parseTgju({ current: { price_dollar_rl: { p: 'n/a' } } }, ITEMS), []);
});

test('nobitex gives buy/sell and day change in toman', () => {
  const json = fixture('nobitex.json');
  const s = json.stats['btc-rls'];
  const q = byId(parseNobitex(json, ITEMS));
  assert.equal(q.btc.price, Number(s.latest) / 10);
  assert.equal(q.btc.buy, Number(s.bestBuy) / 10);
  assert.equal(q.btc.sell, Number(s.bestSell) / 10);
  assert.equal(q.btc.changePct, Number(s.dayChange));
  assert.equal(q.btc.change, (Number(s.latest) - Number(s.dayOpen)) / 10);
  assert.equal(Object.keys(q).length, 6);
});

test('tgju history returns oldest-first toman closes', () => {
  const json = fixture('tgju-history.json');
  const points = parseTgjuHistory(json, ITEMS[0]);
  assert.equal(points.length, json.data.length);
  assert.ok(points[0].t < points.at(-1).t);
  assert.equal(points.at(-1).price, num(json.data[0][3]) / 10);
});

test('nobitex history returns oldest-first toman closes', () => {
  const json = fixture('nobitex-history.json');
  const points = parseNobitexHistory(json);
  assert.equal(points.length, json.t.length);
  assert.ok(points[0].t < points.at(-1).t);
  assert.equal(points.at(-1).price, json.c.at(-1) / 10);
  assert.deepEqual(parseNobitexHistory({ s: 'no_data' }), []);
});
