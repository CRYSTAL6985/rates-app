import { itemById } from './items.js';
import { fetchTgjuHistory, parseTgjuHistory, tehranMidnight } from './sources/tgju.js';
import { fetchNobitexHistory, parseNobitexHistory } from './sources/nobitex.js';

export const RANGE_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const DAY_MS = 864e5;
const CACHE_MS = 10 * 60_000;

export function createHistory({ db, fetchers = { tgju: fetchTgjuHistory, nobitex: fetchNobitexHistory }, now = Date.now }) {
  const cache = new Map();
  // Nobitex sits behind Cloudflare, which answers 403 to bursts: one request at a time.
  let queue = Promise.resolve();
  const oneAtATime = fn => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };
  const fromSnapshots = db.prepare('SELECT t, price FROM snapshots WHERE id = ? AND t > ? ORDER BY t');

  // An item may take its history from another source (Nobitex blocks USDT history).
  const historySource = item => item.historySource ?? item.source;

  async function load(item, range, since) {
    if (historySource(item) === 'nobitex') {
      const resolution = range === 'day' ? '60' : 'D';
      const json = await oneAtATime(() => fetchers.nobitex(`${item.key.toUpperCase()}IRT`, resolution, Math.floor(since / 1000), Math.floor(now() / 1000)));
      return parseNobitexHistory(json);
    }
    const points = parseTgjuHistory(await fetchers.tgju(item.historyKey ?? item.key), item);
    return points.filter(p => p.t >= since);
  }

  return {
    // Caller has validated id and range.
    async get(id, range) {
      const item = itemById(id);
      const since = now() - RANGE_DAYS[range] * DAY_MS;
      // tgju history is daily only, so its day chart comes from our own snapshots.
      // Today's session only: before the open it is empty, after it the chart can't start on yesterday's close.
      // Strictly after midnight, because tgju stamps a finished day's close at 00:00. The day's first tick
      // is dropped too: tgju opens gold on yesterday's price and moves to the real one seconds later.
      if (historySource(item) === 'tgju' && range === 'day') {
        return fromSnapshots.all(id, tehranMidnight(now())).slice(1).map(r => ({ t: r.t, price: r.price }));
      }
      const key = `${id}:${range}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_MS) return hit.points;
      const points = await load(item, range, since);
      cache.set(key, { at: now(), points });
      return points;
    },
  };
}
