import { getJson } from './get-json.js';

const RIAL_PER_TOMAN = 10;

export const fetchNobitex = coins =>
  getJson(`https://apiv2.nobitex.ir/market/stats?srcCurrency=${coins.join(',')}&dstCurrency=rls`);

export const fetchNobitexHistory = (symbol, resolution, fromSec, toSec) =>
  getJson(`https://apiv2.nobitex.ir/market/udf/history?symbol=${symbol}&resolution=${resolution}&from=${fromSec}&to=${toSec}`);

export function parseNobitex(json, items, now = Date.now()) {
  const stats = json?.stats ?? {};
  const quotes = [];
  for (const item of items) {
    const s = stats[`${item.key}-rls`];
    if (item.source !== 'nobitex' || !s) continue;
    const price = Number(s.latest) / RIAL_PER_TOMAN;
    if (!Number.isFinite(price)) continue;
    quotes.push({
      id: item.id,
      price,
      change: (Number(s.latest) - Number(s.dayOpen)) / RIAL_PER_TOMAN,
      changePct: Number(s.dayChange),
      high: Number(s.dayHigh) / RIAL_PER_TOMAN,
      low: Number(s.dayLow) / RIAL_PER_TOMAN,
      buy: Number(s.bestBuy) / RIAL_PER_TOMAN,
      sell: Number(s.bestSell) / RIAL_PER_TOMAN,
      // The stats endpoint carries no timestamp; it is live market data.
      updatedAt: now,
    });
  }
  return quotes;
}

export function parseNobitexHistory(json) {
  if (json?.s !== 'ok') return [];
  return json.t.map((t, i) => ({ t: t * 1000, price: json.c[i] / RIAL_PER_TOMAN }));
}
