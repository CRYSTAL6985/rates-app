import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { ITEMS, TOP_IDS, itemById } from './items.js';
import { RANGE_DAYS } from './history.js';
import { isPushEndpoint } from './push.js';

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

const MAX_BODY = 1024;
const MAX_TARGET = 1e15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class BadRequest extends Error {}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new BadRequest('body too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new BadRequest('invalid json'); }
}

// Checks each field that is present; `required` lists the ones that must be.
const ALERT_FIELDS = {
  item: v => typeof v === 'string' && !!itemById(v),
  direction: v => v === 'above' || v === 'below',
  target: v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < MAX_TARGET,
  repeat: v => typeof v === 'boolean',
  enabled: v => typeof v === 'boolean',
};
function validAlert(body, allowed, required) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length > 0
    && keys.every(k => allowed.includes(k) && ALERT_FIELDS[k](body[k]))
    && required.every(k => k in body);
}

function validSubscription(s) {
  return !!s && typeof s.endpoint === 'string' && s.endpoint.length < 2048 && isPushEndpoint(s.endpoint)
    && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string'
    && s.keys.p256dh.length < 256 && s.keys.auth.length < 256;
}

// The device id never leaves the server.
const publicAlert = ({ device, ...rest }) => rest;

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

export function createApp({ poller, history, alerts, push, publicDir, log = console }) {
  async function handleAlerts(req, res, path) {
    const device = req.headers['x-device'];
    if (typeof device !== 'string' || !UUID.test(device)) return sendJson(res, 400, { error: 'missing device id' });

    if (path === '/api/push/subscribe' && req.method === 'POST') {
      const sub = await readJson(req);
      if (!validSubscription(sub)) return sendJson(res, 400, { error: 'invalid subscription' });
      push.subscribe(device, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
      res.writeHead(204).end();
      return;
    }
    if (path === '/api/alerts' && req.method === 'GET') {
      return sendJson(res, 200, { alerts: alerts.list(device).map(publicAlert) });
    }
    if (path === '/api/alerts' && req.method === 'POST') {
      const body = await readJson(req);
      if (!validAlert(body, ['item', 'direction', 'target', 'repeat'], ['item', 'direction', 'target'])) return sendJson(res, 400, { error: 'invalid alert' });
      return sendJson(res, 201, { alert: publicAlert(alerts.create(device, { repeat: false, ...body })) });
    }
    const one = path.match(/^\/api\/alerts\/([0-9a-f-]{1,64})$/);
    if (one && req.method === 'PATCH') {
      const body = await readJson(req);
      if (!validAlert(body, ['direction', 'target', 'repeat', 'enabled'], [])) return sendJson(res, 400, { error: 'invalid alert' });
      const updated = alerts.update(device, one[1], body);
      return updated ? sendJson(res, 200, { alert: publicAlert(updated) }) : sendJson(res, 404, { error: 'not found' });
    }
    if (one && req.method === 'DELETE') {
      if (!alerts.remove(device, one[1])) return sendJson(res, 404, { error: 'not found' });
      res.writeHead(204).end();
      return;
    }
    return sendJson(res, 404, { error: 'not found' });
  }

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

    if (req.method === 'GET' && path === '/api/push/key') return sendJson(res, 200, { key: push.publicKey });
    if (path.startsWith('/api/alerts') || path.startsWith('/api/push/')) return handleAlerts(req, res, path);

    if (path.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
    return serveStatic(res, publicDir, path);
  }

  return http.createServer((req, res) => {
    handle(req, res).catch(err => {
      if (err instanceof BadRequest) return sendJson(res, 400, { error: err.message });
      log.error('[http]', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'server error' });
    });
  });
}
