# نرخ: design

Date: 2026-10-17. Working name نرخ (placeholder).

## Why

I check toman prices for almost everything: dollar, gold, coins, crypto. Existing apps
cram gold, dollar and bitcoin into one small, crowded leaderboard. This app gives the
three that matter most their own board and puts everything else in clean tabs.

Who it's for, in order: my own daily use, my portfolio, and the public if it turns out well.

I'm learning JavaScript, so the code has to be something I can read and understand.
Every part gets explained as it's built.

## Goals

- See gold, dollar and BTC at a glance the moment the app opens.
- Find any other price in one tap through the tabs: ارز · رمزارز · طلا و سکه · نقره.
- Trust what I see. Every price shows how long ago it was updated, because some
  sources go stale (tgju's Iraqi dinar was 8 days old on 2026-10-16).
- Get notified when a price crosses a number I set.
- Looks and feels like a polished Apple-style app, not an empty mockup.

## Non-goals (v1)

- Accounts or login. Alerts belong to the device.
- Home-screen widgets (need a native Android app).
- Favourites or pinning.
- App store releases. Cafe Bazaar and Myket can come later by wrapping the web app.
- Trading, portfolios or news.

## Anti-goals

- Another crowded single list.
- A stale price shown as if it were live.
- Code I can't follow: no framework magic I haven't been taught.

## What's in it

### Home

- Top: one board with **gold (18k per gram), dollar and BTC**: price, change, small sparkline.
- Below: four tabs.
  - **ارز:** dollar, euro, pound, dirham, Turkish lira, Iraqi dinar, yuan
  - **رمزارز:** BTC, ETH, USDT, DOGE, SOL, XRP
  - **طلا و سکه:** 18k and 24k gold per gram, مثقال, امامی, بهار آزادی, نیم, ربع, گرمی, gold ounce
  - **نقره:** 999, 925, silver ounce
- Each row shows name, price in toman, change badge (tap to switch % ↔ toman) and
  "updated X ago".
- Light and dark mode (follows the phone), Persian digits, Jalali date, RTL.

**Visual reference:** `prototype/home-apple.html` (approved look). Its numbers are fake.

### Detail sheet (tap a row)

- Chart you can drag across, ranges: day / week / month / year.
- Buy and sell price, day high and low.
- Calculator: amount ↔ toman, both directions.
- Coins only: bubble (حباب), meaning the coin price vs the value of the gold in it.
- "Set an alert" button.

### Alerts

- Pick an item, choose **above** or **below**, enter a price.
- When it's reached: a phone notification, even if the app is closed.
- Default: fires **once**, then turns itself off. A per-alert **repeat** switch keeps it
  armed. Repeat fires again only after the price has gone back across the line first,
  so a price wobbling around the target doesn't spam.
- Alert list: edit, delete, re-enable with one tap.
- Fired alerts also show inside the app the next time it opens, in case the
  notification never arrived.

## How it's built

All JavaScript, Node 24 (already installed).

- **Web app (PWA):** plain HTML, CSS and JavaScript, no framework. Installable on Android
  and iPhone from the browser (iPhone needs iOS 16.4+ for notifications, installed to
  the home screen). A service worker caches the app shell so it opens instantly.
- **Server:** small Node server that
  - fetches prices every minute and caches them, so phones only talk to our server;
  - serves the web app and a small JSON API;
  - stores alerts and minute-by-minute price snapshots in SQLite (`node:sqlite`, built in);
  - checks alerts after every fetch and sends web push notifications.
- **Dependencies:** as few as possible. Web push encryption is the one place a library
  (`web-push`) is worth it.
- **Tests:** `node:test` (built in). Price parsing and alert logic are tested first.

### Data sources (verified 2026-10-16 and 2026-10-17, free, no key)

| What | Endpoint | Notes |
|---|---|---|
| Crypto, live | `https://apiv2.nobitex.ir/market/stats?srcCurrency=btc,eth,doge,usdt&dstCurrency=rls` | Rial (÷10 for toman). `latest`, `bestBuy`, `bestSell`, `dayHigh`, `dayLow`, `dayChange` |
| Crypto, history | `https://apiv2.nobitex.ir/market/udf/history?symbol=BTCIRT&resolution=D\|60&from=&to=` | OHLC arrays. Hourly works for the day chart |
| Everything else, live | `https://call2.tgju.org/ajax.json` → `.current[key]` | Unofficial. `p` = rial with commas, `t` = last update |
| Everything else, history | `https://api.tgju.org/v1/market/indicator/summary-table-data/<key>` | Daily rows back to 2011, values with commas, includes Jalali date |

tgju keys confirmed: `price_dollar_rl`, `price_eur`, `price_aed`, `price_try`, `price_iqd`,
`sekee`, `sekeb`, `nim`, `rob`, `gerami`, `geram18`, `geram24`, `mesghal`, `silver_999`.
Still to find: pound, yuan, gold ounce, silver 925, silver ounce, and SOL/XRP on Nobitex.

The **day** chart for tgju items comes from our own minute snapshots, since tgju history is
daily only. Week/month/year come from the history endpoints.

## Constraints and risks

- **tgju is unofficial** and may change or block the file. Fine for now. Before a public
  release: get permission or switch to a keyed source (BrsApi, navasan.tech).
  Source code keeps each source behind one small module so it can be swapped.
- **Push delivery inside Iran is unproven.** The push services are reachable from this
  machine, but Android phones receive push through Google services, which can be blocked
  for Iranian users. Test on a real phone early. If it fails without VPN, fallbacks are
  the in-app list (already in the design) and a Telegram bot (later).
- **Hosting is not decided.** v1 runs locally. Parspack (where ABRISHAM runs) is the
  obvious candidate later.
- Publishing open-market rates has drawn attention from authorities before. Decide this
  before going public.

## Left to the builder

- File layout, API shape, database tables.
- Exact chart library or hand-drawn SVG (prototype draws its own).
- How long to keep minute snapshots.
- Item display names and icons.
