import { getJson } from './get-json.js';

// tgju's own site reads this file. Unofficial: see the spec before publishing.
const LIVE_URL = 'https://call2.tgju.org/ajax.json';
const HISTORY_URL = key => `https://api.tgju.org/v1/market/indicator/summary-table-data/${key}?lang=fa&order_dir=desc&draw=1&start=0&length=400`;
const TEHRAN = '+03:30';
const RIAL_PER_TOMAN = 10;

export const fetchTgju = () => getJson(LIVE_URL);
export const fetchTgjuHistory = key => getJson(HISTORY_URL(key));

const num = s => Number(String(s).replaceAll(',', ''));
const tehranTime = ts => Date.parse(ts.replace(' ', 'T') + TEHRAN);

// `d` and `dp` come unsigned; `dt` says which way the price moved.
const sign = dt => (dt === 'high' ? 1 : dt === 'low' ? -1 : 0);

export function parseTgju(json, items) {
  const current = json?.current ?? {};
  const quotes = [];
  for (const item of items) {
    const row = current[item.key];
    if (item.source !== 'tgju' || !row) continue;
    const scale = item.unit === 'toman' ? RIAL_PER_TOMAN : 1;
    const price = num(row.p) / scale;
    const updatedAt = tehranTime(String(row.ts));
    if (!Number.isFinite(price) || !Number.isFinite(updatedAt)) continue;
    const s = sign(row.dt);
    quotes.push({
      id: item.id,
      price,
      change: (s * num(row.d)) / scale || 0,
      changePct: s * Number(row.dp) || 0,
      high: num(row.h) / scale,
      low: num(row.l) / scale,
      buy: null,
      sell: null,
      updatedAt,
    });
  }
  return quotes;
}

// Rows are [open, low, high, close, change, change%, gregorian date, jalali date], newest first.
export function parseTgjuHistory(json, item) {
  const scale = item.unit === 'toman' ? RIAL_PER_TOMAN : 1;
  return (json?.data ?? [])
    .map(row => ({ t: Date.parse(row[6].replaceAll('/', '-') + 'T12:00:00' + TEHRAN), price: num(row[3]) / scale }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.price))
    .reverse();
}
