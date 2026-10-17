import { ITEMS } from './items.js';
import { fetchTgju, parseTgju } from './sources/tgju.js';
import { fetchNobitex, parseNobitex } from './sources/nobitex.js';

const POLL_MS = 60_000;
// The day chart needs 24 h of snapshots; keep a second day as margin.
const KEEP_MS = 2 * 864e5;

const COINS = ITEMS.filter(i => i.source === 'nobitex').map(i => i.key);
const DEFAULT_FETCHERS = { tgju: fetchTgju, nobitex: () => fetchNobitex(COINS) };
const PARSERS = { tgju: parseTgju, nobitex: parseNobitex };

export function createPoller({ db, fetchers = DEFAULT_FETCHERS, onQuotes = () => {}, log = console }) {
  const quotes = new Map();
  const insert = db.prepare('INSERT OR IGNORE INTO snapshots (id, t, price) VALUES (?, ?, ?)');
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
        insert.run(q.id, q.updatedAt, q.price);
      }
    });
    prune.run(Date.now() - KEEP_MS);
    await onQuotes(quotes);
  }

  return {
    quotes,
    poll,
    start(ms = POLL_MS) {
      const run = () => poll().catch(err => log.error('[poll]', err));
      run();
      timer = setInterval(run, ms);
    },
    stop() { clearInterval(timer); },
  };
}
