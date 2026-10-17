import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNum, ago, formatPrice, formatPct } from '../public/format.js';

test('parseNum reads Persian digits and separators', () => {
  assert.equal(parseNum('۱۲٬۵۰۰'), 12500);
  assert.equal(parseNum('١٢٥٠٠'), 12500);
  assert.equal(parseNum('۱۲٫۵'), 12.5);
  assert.equal(parseNum('12,500'), 12500);
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.ok(Number.isNaN(parseNum('')));
});

test('ago shows minutes, hours and days', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  assert.equal(ago(now - 30e3, now), 'همین الان');
  assert.equal(ago(now - 5 * 60e3, now), '۵ دقیقه پیش');
  assert.equal(ago(now - 3 * 3600e3, now), '۳ ساعت پیش');
  assert.equal(ago(now - 8 * 864e5, now), '۸ روز پیش');
});

test('formatPrice shows ounces in dollars and toman as whole numbers', () => {
  assert.match(formatPrice({ unit: 'usd' }, 4166.39), /دلار/);
  assert.equal(formatPrice({ unit: 'toman' }, 263800.4), '۲۶۳٬۸۰۰');
  assert.match(formatPrice({ unit: 'toman' }, 21_400_000_000, true), /میلیارد/);
});

test('formatPct is unsigned with a Persian percent sign', () => {
  assert.equal(formatPct(-1.55), '۱٫۵۵٪');
});

test('tomanPer converts dollar-priced ounces through the dollar rate', async () => {
  const { tomanPer } = await import('../public/format.js');
  assert.equal(tomanPer({ unit: 'toman' }, { price: 263800 }, { price: 263800 }), 263800);
  assert.equal(tomanPer({ unit: 'usd' }, { price: 4000 }, { price: 250000 }), 1_000_000_000);
  assert.ok(Number.isNaN(tomanPer({ unit: 'usd' }, { price: 4000 }, undefined)));
});
