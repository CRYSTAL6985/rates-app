import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { evaluateAlert, createAlertStore } from '../server/alerts.js';

const base = { id: 'a1', device: 'd1', item: 'usd', direction: 'above', target: 270000, repeat: false, enabled: true, armed: true, firedAt: null };
const run = (alert, prices) => {
  let fired = 0;
  for (const [i, p] of prices.entries()) {
    const r = evaluateAlert(alert, p, i + 1);
    if (r.fire) fired++;
    alert = r.alert;
  }
  return { fired, alert };
};

test('above alert fires when the price reaches the target', () => {
  assert.equal(evaluateAlert(base, 270000, 1).fire, true);
  assert.equal(evaluateAlert(base, 269999, 1).fire, false);
});

test('once alert turns itself off after firing', () => {
  const { alert } = evaluateAlert(base, 270000, 5);
  assert.equal(alert.enabled, false);
  assert.equal(alert.firedAt, 5);
});

test('repeat alert does not fire twice while price stays above', () => {
  assert.equal(run({ ...base, repeat: true }, [270100, 270500, 271000]).fired, 1);
});

test('repeat alert fires again after going back below and up', () => {
  assert.equal(run({ ...base, repeat: true }, [270100, 268000, 270000]).fired, 2);
});

test('below alert works the other way', () => {
  const below = { ...base, direction: 'below', target: 260000 };
  assert.equal(evaluateAlert(below, 259000, 1).fire, true);
  assert.equal(evaluateAlert(below, 261000, 1).fire, false);
});

test('disabled alert never fires', () => {
  assert.equal(evaluateAlert({ ...base, enabled: false }, 300000, 1).fire, false);
});

test('evaluateAlert does not mutate its input', () => {
  const input = Object.freeze({ ...base });
  evaluateAlert(input, 300000, 1);
  assert.equal(input.enabled, true);
});

test('checkAll only touches the item it is about', () => {
  const store = createAlertStore(openDb(':memory:'));
  store.create('d1', { item: 'usd', direction: 'above', target: 270000, repeat: false });
  store.create('d1', { item: 'eur', direction: 'above', target: 1, repeat: false });
  const fired = store.checkAll(new Map([['usd', { price: 271000 }]]), 10);
  assert.deepEqual(fired.map(a => a.item), ['usd']);
  assert.equal(store.list('d1').find(a => a.item === 'eur').enabled, true);
  assert.equal(store.list('d1').find(a => a.item === 'usd').enabled, false);
});

test('list is scoped to the device', () => {
  const store = createAlertStore(openDb(':memory:'));
  store.create('d1', { item: 'usd', direction: 'above', target: 1, repeat: false });
  assert.equal(store.list('d1').length, 1);
  assert.equal(store.list('d2').length, 0);
});

test('re-enabling a fired alert arms it again', () => {
  const store = createAlertStore(openDb(':memory:'));
  const a = store.create('d1', { item: 'usd', direction: 'above', target: 1, repeat: false });
  store.checkAll(new Map([['usd', { price: 5 }]]), 1);
  const b = store.update('d1', a.id, { enabled: true });
  assert.equal(b.enabled, true);
  assert.equal(b.armed, true);
  assert.equal(store.checkAll(new Map([['usd', { price: 5 }]]), 2).length, 1);
});

test('update and remove refuse another device', () => {
  const store = createAlertStore(openDb(':memory:'));
  const a = store.create('d1', { item: 'usd', direction: 'above', target: 1, repeat: false });
  assert.equal(store.update('d2', a.id, { target: 2 }), null);
  assert.equal(store.remove('d2', a.id), false);
  assert.equal(store.remove('d1', a.id), true);
  assert.equal(store.list('d1').length, 0);
});
