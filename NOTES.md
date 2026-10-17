# Rates app: brainstorm notes (2026-10-16)

Working name: **نرخ** (placeholder; no final name yet).
Status: **design conversation in progress, no app code written.** Resume from "Open question" below.

## What it is

A Persian app that shows live prices in **toman** for:

- **Currencies:** dollar, euro, pound, dirham, Turkish lira, Iraqi dinar, yuan
- **Crypto:** BTC, ETH, USDT, DOGE (plus SOL and XRP in the mockup)
- **Gold and coins:** 18k and 24k gold per gram, مثقال, سکه امامی, سکه بهار آزادی, نیم سکه, ربع سکه, سکه گرمی, gold ounce
- **Silver:** 999, 925, silver ounce

**Why:** I check these prices for almost everything. Existing apps cram gold, dollar and bitcoin into one small leaderboard, which is crowded and annoying.

**Goal:** for my own use, for my portfolio, and to publish if it turns out well made.

## Decided by me

- The top of the home screen is **one leaderboard of the 3 main prices: gold, dollar, BTC**.
- Below that, everything is **split into tabs**: ارز · رمزارز · طلا و سکه · نقره.
  This was option B of three; the others were stacked sections and category tiles.
- It must look **full and polished**. The first mockups felt empty.
- **Apple-style design.** The interactive prototype in `prototype/home-apple.html` "looks nice": this is the approved look.
- **JavaScript only.** I don't want to learn another language yet.
- **Cheapest data option.**

## Added along the way, not objected to (can still drop)

- Chart you can drag across, with day / week / month / year ranges
- Tap a row → detail sheet with buy and sell price, day high and low, and a calculator (amount ↔ toman)
- Coin **bubble** (حباب) shown under each coin
- Tap a badge to switch between % and toman change
- Light and dark mode, Persian digits, Jalali date

## Recommended, not yet confirmed

- **Installable web app (PWA) + a small Node server.** iPhone works without the App Store, since Iranian developers can't publish there. Later it can be wrapped for Cafe Bazaar or Myket. Google Play is also closed to Iranian developers.
- **The server polls the price sources once a minute and caches the results.** Phones only talk to our server. A source can then be swapped without an app update, and API keys never sit on the phones.

## Data sources (both called directly, they work, 0 toman)

| Data | Endpoint | Notes |
|---|---|---|
| Crypto | `GET https://apiv2.nobitex.ir/market/stats?srcCurrency=btc,eth,doge,usdt&dstCurrency=rls` | Official public API, no key. Prices are in **rial** (÷10 for toman). Fields: `latest`, `bestBuy`, `bestSell`, `dayHigh`, `dayLow`, `dayOpen`, `dayChange`. |
| Everything else | `GET https://call2.tgju.org/ajax.json` → `.current[key]` | About 960 items. `p` is the price in rial as a string with commas; `t` is the time or date of the last update. **Unofficial** (it's the file their own site uses) and terms are unknown. |

tgju keys confirmed working:

| Key | Item |
|---|---|
| `price_dollar_rl` | dollar |
| `price_eur` | euro |
| `price_aed` | dirham |
| `price_try` | lira |
| `price_iqd` | Iraqi dinar |
| `sekee` | امامی |
| `sekeb` | بهار آزادی |
| `nim` | نیم سکه |
| `rob` | ربع سکه |
| `gerami` | سکه گرمی |
| `geram18` | 18k gold per gram |
| `geram24` | 24k gold per gram |
| `mesghal` | مثقال |
| `silver_999` | silver 999 |

Not looked up yet: GBP, CNY, gold ounce, silver 925, silver ounce.

**Warnings**

- tgju may change or block the file at any time. Before publishing, either ask tgju for permission or switch to a keyed source.
  - Backups: **BrsApi** (free key, but its pricing page returned 404) and **navasan.tech** (key by email, pricing not public).
- **Some prices go stale at the source.** `price_iqd` was last updated ۱۶ مهر, 8 days old. Show "updated X ago" **on every price**, not once for the whole app.
- Real prices on 2026-10-16:
  - dollar ≈ ۲۶۷٬۹۰۰ toman
  - امامی ≈ ۲۶۹٬۹۲۰٬۰۰۰ toman
  - 18k gold ≈ ۲۶٬۲۵۵٬۱۰۰ toman per gram
  - BTC ≈ ۲۱٫۵ billion toman

  The prototype's numbers are made up and far off.
- Publishing open-market rates has sometimes drawn attention from the authorities, and some rate sites have been filtered in the past. Think about this before making it a public business.

## Open question (resume here)

> Are you OK starting on free Nobitex + tgju now, and settling permission or a keyed source only when we decide to publish?

## Still to cover after that

- Anything beyond viewing prices? Price alerts, favourites/pinning, home-screen widgets (widgets need a real Android app).
- App name and icon.
- Then: write the design doc, then the build plan, then build with teaching.

## Files

- `prototype/home-apple.html`: the approved interactive prototype. Open it in Chrome; it has no app logic, all data is fake.
- `prototype/home.png`, `prototype/detail-sheet.png`: screenshots of it.
