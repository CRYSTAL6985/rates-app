import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { ITEMS, TOP_IDS, itemById } from './items.js';
import { RANGE_DAYS } from './history.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
// Coins are 900/1000 gold; 18k gold is 750/1000.
const COIN_FINENESS_VS_18K = 900 / 750;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function withBubble(quotes) {
  const gram18 = quotes.get('g18')?.price;
  return [...quotes.values()].map(q => {
    const weight = itemById(q.id).weight;
    if (!weight || !gram18) return q;
    return { ...q, bubblePct: (q.price / (gram18 * weight * COIN_FINENESS_VS_18K) - 1) * 100 };
  });
}

async function serveStatic(res, publicDir, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return sendJson(res, 404, { error: 'not found' }); }
  const file = resolve(publicDir, '.' + (decoded.endsWith('/') ? decoded + 'index.html' : decoded));
  if (!file.startsWith(resolve(publicDir) + sep)) return sendJson(res, 404, { error: 'not found' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

export function createApp({ poller, history, publicDir, log = console }) {
  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/api/quotes') {
      return sendJson(res, 200, { items: ITEMS, quotes: withBubble(poller.quotes), top: TOP_IDS, serverTime: Date.now() });
    }

    const historyMatch = path.match(/^\/api\/history\/([a-z0-9]+)$/);
    if (req.method === 'GET' && historyMatch) {
      const id = historyMatch[1];
      const range = url.searchParams.get('range');
      if (!itemById(id) || !Object.hasOwn(RANGE_DAYS, range ?? '')) return sendJson(res, 400, { error: 'unknown item or range' });
      try {
        return sendJson(res, 200, { points: await history.get(id, range) });
      } catch (err) {
        log.error(`[history] ${id} ${range}: ${err.message}`);
        return sendJson(res, 502, { error: 'price source unavailable' });
      }
    }

    if (path.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
    return serveStatic(res, publicDir, path);
  }

  return http.createServer((req, res) => {
    handle(req, res).catch(err => {
      log.error('[http]', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'server error' });
    });
  });
}
