import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeValue } from '../public/ui.js';

const item = { unit: 'toman' };
const write = (series, r) => {
  const price = {}, change = {};
  writeValue(item, { price: 262000 }, series, r, null, price, change);
  return { price: price.textContent, change: change.innerHTML };
};

test('closed market: the day view shows only the price', () => {
  const { price, change } = write([], 0);
  assert.ok(price.length > 0);
  assert.equal(change, '');
});

test('longer ranges without enough points still say so', () => {
  assert.match(write([], 1).change, /هنوز نمودار کافی نیست/);
});

import { matchItem } from '../public/ui.js';

test('search matches Persian names, short names and codes, ignoring case and Arabic letter forms', () => {
  const usd = { id: 'usd', name: 'دلار آمریکا', short: 'دلار', sub: 'USD' };
  const gold = { id: 'g18', name: 'طلای ۱۸ عیار', sub: 'هر گرم' };
  assert.ok(matchItem(usd, 'دلار'));
  assert.ok(matchItem(usd, 'usd'));
  assert.ok(matchItem(usd, '  آمریکا '));
  assert.ok(matchItem(gold, 'طلاي'), 'Arabic ي finds Persian ی');
  assert.ok(matchItem(gold, '18'), 'Latin digits find Persian ones');
  assert.ok(!matchItem(usd, 'یورو'));
  assert.ok(matchItem(usd, ''), 'empty query matches everything');
});
