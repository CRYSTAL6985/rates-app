import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TOP_IDS, itemById } from '../server/items.js';

test('every item has a unique id and a known tab', () => {
  assert.equal(ITEMS.length, 25);
  assert.equal(new Set(ITEMS.map(i => i.id)).size, 25);
  for (const i of ITEMS) assert.ok(['fx', 'crypto', 'gold', 'silver'].includes(i.tab), i.id);
});

test('ounces are priced in dollars, everything else in toman', () => {
  assert.equal(itemById('goz').unit, 'usd');
  assert.equal(itemById('soz').unit, 'usd');
  assert.equal(itemById('usd').unit, 'toman');
});

test('coins carry their gold weight', () => {
  assert.equal(itemById('emami').weight, 8.133);
  assert.equal(itemById('gerami').weight, 1.011);
});

test('home board is gold, dollar and bitcoin', () => {
  assert.deepEqual(TOP_IDS, ['g18', 'usd', 'btc']);
});
