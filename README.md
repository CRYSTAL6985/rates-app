# نرخ

Live toman prices for currencies, gold and coins, silver and crypto, with price alerts.
An installable web app (PWA) plus a small Node server.

- Home: gold, dollar and bitcoin on one board, everything else in four tabs.
- Tap any price: chart (day, week, month, year), buy/sell, day high/low, calculator, coin bubble.
- Alerts: "tell me when the dollar goes above 270,000". Once, or every time it crosses.

## Run it

Needs Node 24 or newer.

```bash
npm install
npm start          # http://localhost:3000
npm test
```

On first start the server makes its push keys and saves them to `.env` (never commit that file).
Prices and alerts are stored in `rates.db` (SQLite, also not committed).

| Env var | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `VAPID_PUBLIC`, `VAPID_PRIVATE` | made on first start | Push keys. Changing them breaks existing subscriptions |
| `VAPID_SUBJECT` | `mailto:rates-app@example.com` | Contact for push services. Set a real `mailto:` before publishing |

## How it fits together

```
Nobitex (crypto) ─┐
                  ├─ server/poller.js  every 60 s ──► quotes in memory ──► GET /api/quotes
tgju (the rest) ──┘        │                                              
                           ├─► snapshots table (day charts for tgju items)
                           └─► alerts.checkAll ──► push.notify ──► phone
history (week/month/year) ── server/history.js ──► GET /api/history/:id?range=
public/  ── the app: home.js, sheet.js, alerts.js, sw.js (offline shell + notifications)
```

- `server/items.js` is the list of every price and where it comes from.
- `server/sources/` turns each source's answer into the same shape (`Quote`).
- `server/alerts.js` holds the alert rules. A repeating alert fires again only after the price
  goes back across the line, so a price hovering around the target doesn't spam.

## Things to know

- **tgju is unofficial.** The app reads the same file tgju's own site uses. It can change or be
  blocked at any time. Before publishing, get permission or move to a keyed source
  (BrsApi, navasan.tech). Each source sits behind one module in `server/sources/`.
- **Nobitex blocks bursts** (Cloudflare 403), so history requests go one at a time, and USDT's
  chart comes from tgju because Nobitex refuses USDT history.
- **Day charts for tgju items come from the server's own saved prices.** tgju's history is daily
  only. On start the server also saves tgju's list of every change made *today*, so starting late
  doesn't lose the morning; a day the server never ran is lost. The day
  chart is today's (Tehran) session only: empty before the open, so the app shows just the price, and
  never starting on yesterday's close, so the open isn't drawn as a cliff. After a day ends tgju
  re-stamps its close as that day's 00:00; the poller ignores times older than the newest it has,
  and the day chart starts strictly after midnight, so that stamp never shows.
- **The top tiles are each visitor's own.** A first visit shows `TOP_IDS` (18k gold, dollar, USDT);
  starring any price adds a tile and un-starring removes one, defaults included, but never the last.
  The list lives in that browser's localStorage (`public/favs.js`), so it isn't shared between devices.
- **The money in the background** (`public/img/*.webp`) was generated with Figma AI (file "نرخ – 3D
  background objects") and cut out of its backdrop by script. They tilt and drift but never turn
  fully, because they're flat images. `--x` places them for phones, `--xd` for screens 900px and wider.
- **Notifications need HTTPS** (localhost is fine for testing on the same computer). On iPhone they
  work only after "Add to Home Screen", iOS 16.4+.
- **Push inside Iran is not proven on a phone yet.** Google's push server accepted a test
  notification sent from the dev PC (2026-10-17). Whether an Android phone receives it without VPN
  is still to test.

## Phone test (to do)

1. Put the server behind HTTPS (deploy, or a tunnel).
2. On an Android phone, **without VPN**: open the site, install it, set an alert that will fire
   (dollar above 1), lock the phone, wait a minute.
3. Write down whether the notification arrived. Repeat with VPN on.
