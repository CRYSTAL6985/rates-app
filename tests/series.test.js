import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, resample, withLive } from '../public/series.js';

test('resample spreads any number of points over N, oldest first', () => {
  const pts = [{ t: 0, price: 1 }, { t: 10, price: 2 }, { t: 100, price: 3 }];
  const out = resample(pts);
  assert.equal(out.length, N);
  assert.equal(out[0].price, 1);
  assert.equal(out.at(-1).price, 3);
  assert.equal(out.at(-1).t, 100);
  assert.ok(out.every((p, i) => i === 0 || p.t > out[i - 1].t));
});

test('resample holds the last known price between points', () => {
  const out = resample([{ t: 0, price: 5 }, { t: 1000, price: 9 }]);
  assert.equal(out[N - 2].price, 5);
});

test('resample of fewer than two points is empty', () => {
  assert.deepEqual(resample([]), []);
  assert.deepEqual(resample([{ t: 1, price: 1 }]), []);
});

test('withLive ends the series at the live price', () => {
  const pts = [{ t: 1, price: 1 }, { t: 2, price: 2 }];
  assert.deepEqual(withLive(pts, { price: 3, updatedAt: 5 }).at(-1), { t: 5, price: 3 });
  assert.equal(withLive(pts, { price: 3, updatedAt: 2 }).length, 2);
  assert.equal(pts.length, 2);
});
