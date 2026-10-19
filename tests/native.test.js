import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNative, shareWithAndroid, androidNotifications, DENIED } from '../public/native.js';

// A fake window with Capacitor's bridge; records every native call in order.
function android({ granted = true } = {}) {
  const calls = [];
  const win = {
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: {
        Preferences: { set: async opts => { calls.push(['set', opts]); } },
        Nerkh: {
          refreshWidgets: async () => { calls.push(['refreshWidgets']); },
          requestNotifications: async () => ({ granted }),
        },
      },
    },
  };
  return { win, calls };
}

test('not native: nothing is called', async () => {
  assert.equal(isNative({}), false);
  await assert.doesNotReject(shareWithAndroid('favs', '[]', {}));
  assert.equal(await androidNotifications({}), null);
});

test('native: favourites are stored then widgets refresh', async () => {
  const { win, calls } = android();
  assert.equal(isNative(win), true);
  await shareWithAndroid('favs', '["usd"]', win);
  assert.deepEqual(calls, [['set', { key: 'favs', value: '["usd"]' }], ['refreshWidgets']]);
});

test('a failing bridge is logged, not thrown', async () => {
  const { win } = android();
  win.Capacitor.Plugins.Preferences.set = async () => { throw new Error('boom'); };
  const warned = [];
  await assert.doesNotReject(shareWithAndroid('favs', '[]', win, { warn: (...a) => warned.push(a) }));
  assert.equal(warned.length, 1);
});

test('denied permission returns the message', async () => {
  assert.equal(await androidNotifications(android({ granted: false }).win), DENIED);
  assert.equal(await androidNotifications(android({ granted: true }).win), null);
});
