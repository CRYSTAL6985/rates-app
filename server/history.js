import { itemById } from './items.js';
import { fetchTgjuHistory, parseTgjuHistory } from './sources/tgju.js';
import { fetchNobitexHistory, parseNobitexHistory } from './sources/nobitex.js';

export const RANGE_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const DAY_MS = 864e5;
const CACHE_MS = 10 * 60_000;

export function createHistory({ db, fetchers = { tgju: fetchTgjuHistory, nobitex: fetchNobitexHistory }, now = Date.now }) {
  const cache = new Map();
  const fromSnapshots = db.prepare('SELECT t, price FROM snapshots WHERE id = ? AND t >= ? ORDER BY t');

  async function load(item, range, since) {
    if (item.source === 'nobitex') {
      const resolution = range === 'day' ? '60' : 'D';
      const json = await fetchers.nobitex(`${item.key.toUpperCase()}IRT`, resolution, Math.floor(since / 1000), Math.floor(now() / 1000));
      return parseNobitexHistory(json);
    }
    const points = parseTgjuHistory(await fetchers.tgju(item.key), item);
    return points.filter(p => p.t >= since);
  }

  return {
    // Caller has validated id and range.
    async get(id, range) {
      const item = itemById(id);
      const since = now() - RANGE_DAYS[range] * DAY_MS;
      // tgju history is daily only, so its day chart comes from our own snapshots.
      if (item.source === 'tgju' && range === 'day') {
        return fromSnapshots.all(id, since).map(r => ({ t: r.t, price: r.price }));
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
