import { getJson } from './get-json.js';

// tgju's own site reads this file. Unofficial: see the spec before publishing.
const LIVE_URL = 'https://call2.tgju.org/ajax.json';
const HISTORY_URL = key => `https://api.tgju.org/v1/market/indicator/summary-table-data/${key}?lang=fa&order_dir=desc&draw=1&start=0&length=400`;
// Every price change today (Tehran day), newest first. Empty before the market opens.
const TODAY_URL = key => `https://api.tgju.org/v1/market/indicator/today-table-data/${key}?lang=fa&order_dir=desc&draw=1&start=0&length=1000`;
const TEHRAN = '+03:30';
const TEHRAN_OFFSET_MS = 3.5 * 3600e3;
const DAY_MS = 864e5;
const RIAL_PER_TOMAN = 10;

// Iran has no daylight saving, so a Tehran day is a fixed 24 h.
export const tehranMidnight = now => Math.floor((now + TEHRAN_OFFSET_MS) / DAY_MS) * DAY_MS - TEHRAN_OFFSET_MS;

export const fetchTgju = () => getJson(LIVE_URL);
export const fetchTgjuHistory = key => getJson(HISTORY_URL(key));
export const fetchTgjuToday = key => getJson(TODAY_URL(key));

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

// Rows are [price, "HH:MM:SS", change, change%], newest first. Times are Tehran, on tgju's "today".
export function parseTgjuToday(json, item, now = Date.now()) {
  const scale = item.unit === 'toman' ? RIAL_PER_TOMAN : 1;
  const date = new Date(now + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows
    .map(row => {
      const t = Date.parse(`${date}T${row[1]}${TEHRAN}`);
      // Just after midnight tgju's "today" can still be yesterday.
      return { t: t > now ? t - DAY_MS : t, price: num(row[0]) / scale };
    })
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.price))
    .reverse();
}
