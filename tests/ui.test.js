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
