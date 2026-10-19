import { ITEMS } from './items.js';
import { fetchTgju, parseTgju, fetchTgjuToday, parseTgjuToday } from './sources/tgju.js';
import { fetchNobitex, parseNobitex } from './sources/nobitex.js';

const POLL_MS = 60_000;
// The day chart needs today's snapshots; keep a second day as margin.
const KEEP_MS = 2 * 864e5;

const COINS = ITEMS.filter(i => i.source === 'nobitex').map(i => i.key);
const TGJU_ITEMS = ITEMS.filter(i => i.source === 'tgju');
const DEFAULT_FETCHERS = { tgju: fetchTgju, nobitex: () => fetchNobitex(COINS), tgjuToday: fetchTgjuToday };
const PARSERS = { tgju: parseTgju, nobitex: parseNobitex };

export function createPoller({ db, fetchers = DEFAULT_FETCHERS, onQuotes = () => {}, log = console }) {
  const quotes = new Map();
  const insert = db.prepare('INSERT OR IGNORE INTO snapshots (id, t, price) VALUES (?, ?, ?)');
  // tgju re-stamps a finished day's close as that day's 00:00; only newer times are real ticks.
  const insertNewer = db.prepare(`INSERT OR IGNORE INTO snapshots (id, t, price) SELECT $id, $t, $price
    WHERE $t > COALESCE((SELECT MAX(t) FROM snapshots WHERE id = $id), 0)`);
  const prune = db.prepare('DELETE FROM snapshots WHERE t < ?');
  let timer = null;

  async function poll() {
    const sources = Object.keys(PARSERS);
    const results = await Promise.allSettled(sources.map(s => fetchers[s]()));
    results.forEach((r, i) => {
      if (r.status === 'rejected') return log.error(`[poll] ${sources[i]}: ${r.reason?.message ?? r.reason}`);
      // A source that answers junk yields no quotes; the last good ones stay.
      for (const q of PARSERS[sources[i]](r.value, ITEMS)) {
        quotes.set(q.id, q);
        insertNewer.run({ id: q.id, t: q.updatedAt, price: q.price });
      }
    });
    prune.run(Date.now() - KEEP_MS);
    await onQuotes(quotes);
  }

  // A server started mid-day missed the morning; tgju still lists every change made today.
  async function backfill() {
    for (const item of TGJU_ITEMS) {
      try {
        for (const p of parseTgjuToday(await fetchers.tgjuToday(item.key), item)) insert.run(item.id, p.t, p.price);
      } catch (err) {
        log.error(`[backfill] ${item.id}: ${err.message}`);
      }
    }
  }

  return {
    quotes,
    poll,
    backfill,
    start(ms = POLL_MS) {
      const run = () => poll().catch(err => log.error('[poll]', err));
      run();
      backfill();
      timer = setInterval(run, ms);
    },
    stop() { clearInterval(timer); },
  };
}
