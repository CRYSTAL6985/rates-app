import { resample, withLive } from './series.js';

const REFRESH_MS = 60_000;
const HISTORY_CACHE_MS = 5 * 60_000;

export const state = { items: new Map(), quotes: new Map(), top: [], lastLoad: 0, online: true };
// 'quotes' fires after each load with detail = Map(id → direction of the move).
export const bus = new EventTarget();

export async function loadQuotes() {
  try {
    const res = await fetch('/api/quotes');
    if (!res.ok) throw new Error(res.status);
    const body = await res.json();
    const moved = new Map();
    for (const item of body.items) state.items.set(item.id, item);
    for (const q of body.quotes) {
      const before = state.quotes.get(q.id);
      if (before) moved.set(q.id, Math.sign(q.price - before.price));
      state.quotes.set(q.id, q);
    }
    state.top = body.top;
    state.lastLoad = Date.now();
    state.online = true;
    bus.dispatchEvent(new CustomEvent('quotes', { detail: moved }));
  } catch (err) {
    console.warn('[quotes]', err);
    state.online = false;
    bus.dispatchEvent(new CustomEvent('offline'));
  }
}

const historyCache = new Map();

export async function getHistory(id, range) {
  const key = `${id}:${range}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_CACHE_MS) return hit.points;
  try {
    const res = await fetch(`/api/history/${id}?range=${range}`);
    if (!res.ok) throw new Error(res.status);
    const { points } = await res.json();
    historyCache.set(key, { at: Date.now(), points });
    return points;
  } catch (err) {
    console.warn('[history]', id, range, err);
    return hit?.points ?? [];
  }
}

// Chart-ready: N evenly spaced points ending at the live price.
export const series = async (id, range) => resample(withLive(await getHistory(id, range), state.quotes.get(id)));

export function start() {
  setInterval(loadQuotes, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadQuotes(); });
  return loadQuotes();
}
