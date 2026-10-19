import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFavs, saveFavs, toggleFav } from '../public/favs.js';

const DEFAULTS = ['g18', 'usd', 'usdt'];
const KNOWN = new Set(['g18', 'usd', 'usdt', 'eur', 'emami']);
const memory = (saved = {}) => ({ getItem: k => saved[k] ?? null, setItem: (k, v) => { saved[k] = v; }, saved });
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const quiet = { warn() {} };

test('a first-time visitor gets the defaults', () => {
  assert.deepEqual(loadFavs(memory(), DEFAULTS, KNOWN), DEFAULTS);
});

test('saved favourites come back in their order', () => {
  const store = memory();
  saveFavs(store, ['eur', 'g18'], quiet);
  assert.deepEqual(loadFavs(store, DEFAULTS, KNOWN), ['eur', 'g18']);
});

test('prices the app no longer lists are dropped', () => {
  assert.deepEqual(loadFavs(memory({ favs: '["gone","eur"]' }), DEFAULTS, KNOWN), ['eur']);
});

test('junk or an empty list falls back to the defaults', () => {
  assert.deepEqual(loadFavs(memory({ favs: '{oops' }), DEFAULTS, KNOWN, quiet), DEFAULTS);
  assert.deepEqual(loadFavs(memory({ favs: '["gone"]' }), DEFAULTS, KNOWN), DEFAULTS);
  assert.deepEqual(loadFavs(memory({ favs: '"g18"' }), DEFAULTS, KNOWN), DEFAULTS);
});

test('blocked storage shows the defaults and saving does not throw', () => {
  assert.deepEqual(loadFavs(broken, DEFAULTS, KNOWN, quiet), DEFAULTS);
  assert.doesNotThrow(() => saveFavs(broken, ['eur'], quiet));
});

test('starring adds to the end, defaults stay', () => {
  assert.deepEqual(toggleFav(DEFAULTS, 'emami'), ['g18', 'usd', 'usdt', 'emami']);
});

test('un-starring removes it, defaults included', () => {
  assert.deepEqual(toggleFav(DEFAULTS, 'g18'), ['usd', 'usdt']);
});

test('the last favourite cannot be removed', () => {
  const one = ['usd'];
  assert.equal(toggleFav(one, 'usd'), one);
});

test('toggling never changes the list it was given', () => {
  const favs = [...DEFAULTS];
  toggleFav(favs, 'eur'); toggleFav(favs, 'usd');
  assert.deepEqual(favs, DEFAULTS);
});
