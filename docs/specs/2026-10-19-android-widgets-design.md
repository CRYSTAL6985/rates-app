# نرخ for Android, with home-screen widgets: design

Date: 2026-10-19. Builds on `2026-10-17-rates-app-design.md`, which said widgets need a native
Android app. This is that app.

## Why

The big Iranian price apps (Mesghal, Arz) and most currency apps have home-screen widgets;
نرخ doesn't, and a web app can't. The prices I check most (18k gold, dollar, USDT) should be
on my home screen without opening anything. That is the one feature worth going native for.
Shipping to Cafe Bazaar and Myket comes with it.

## Goals

- نرخ installs on Android as a real app: its own icon, full screen, no browser bar.
- A **favourites widget**: «قیمت‌های من», my starred prices, each with today's change and a
  small day chart. The same list as the top row in the app, in the same order.
- A **single-price widget**: one price, big, with today's change and a small chart, or the
  3D render when that price has one (gold, bitcoin, USDT, euro, dollar). I choose which price
  when I add it, so I can have several.
- Tapping a widget opens the app on that price's detail sheet. Tapping the favourites widget's
  header opens the app.
- Widgets look like the showcase we approved:
  dark/light following the phone, Persian digits, right-to-left, rounded Material You cards.
- Every widget shows how old its prices are, like the app does.

## Non-goals (this round)

- The morning summary notification (shown in the showcase, not asked for).
- iPhone. Apple removes apps by Iranian developers and builds need a Mac; iPhone users keep
  "Add to Home Screen".
- Publishing to Cafe Bazaar / Myket. That needs a final name, package id, icon and a hosted
  server. This round ends with an APK I install on my own phone.
- Lock-screen widgets.
- Instant (Firebase) push. Inside the Android app, alerts arrive through the background check below.

## Anti-goals

- A widget showing an old price as if it were fresh.
- A widget that drains the battery or wakes the phone constantly.
- A rewrite. The app stays the web app it is; Android only adds the shell and the widgets.

## How it's built

- **Capacitor 8** wraps the app. The Android shell loads the نرخ server's address (on my PC
  during development, the hosted server later), so the app updates without a new APK.
  *Builder's call, can change.*
- **Favourites reach the widget through Capacitor Preferences** (`@capacitor/preferences`,
  stored in Android's SharedPreferences). When `public/home.js` saves favourites it also
  writes them there if it's running inside the Android app. On the web nothing changes.
- **Widgets are native Kotlin** using RemoteViews and XML layouts (the classic widget API,
  no Compose), in the Capacitor `android/` project.
- **Refreshing:** Android lets a widget refresh in the background about every 15 minutes
  (WorkManager). It also refreshes when favourites change and when the app comes to the
  front. Each refresh is one call to `/api/quotes`, plus `/api/history/<id>?range=day` for the
  charts on show.
- **Opening a price:** the widget opens the app with `?item=<id>`, which the web app already
  handles (notifications use it today) by opening that price's sheet.
- **Choosing the price for a single-price widget:** adding one opens a short native list of every
  price (fetched from `/api/quotes`). Offline at that moment: say so and offer to retry. *Builder's call.*
- **Before the app has ever run:** the favourites widget shows the server's defaults (`top` in
  `/api/quotes`: 18k gold, dollar, USDT). *Builder's call.*
- **One server address** for the shell and the widgets, set at build time (debug: my PC's
  Wi-Fi address; release: the hosted server). *Builder's call.*
- **Stale prices:** the widget shows the age of the newest price («۲ دقیقه پیش») and turns it
  red past the same 6 h the app uses. With no network it keeps the last prices and their age.

## Constraints and risks

- **Server:** the widget needs the نرخ server reachable from the phone. During development
  that's my PC over Wi-Fi (plain http, allowed only in the debug build). A hosted HTTPS server
  is needed before anyone else can use it.
- **Android SDK:** not installed on this PC yet (~1.5 GB); I OK'd installing it into
  `~/Android/Sdk` on 2026-10-19. Java 21 is installed. I have an Android phone for testing. Google's download
  servers answered on 2026-10-19 but are often blocked from Iran.
- **Package id and name are permanent once published.** Development uses
  `ir.nerkh.app` / نرخ; they must be final before the store step.
- I'm new to Kotlin, so every native file gets explained like the JS was.

- **Price alerts inside the Android app** (decided 2026-10-19): Android's WebView has no web push,
  so the same 15-minute background refresh also checks my alerts. The server already evaluates
  alerts on every poll and stamps `firedAt`; the worker calls `GET /api/alerts` with my device id
  (synced from the web app like the favourites) and shows a normal Android notification for each
  `firedAt` newer than the last one it saw. Up to ~15 min late; nothing from Google needed. In the
  app, the alerts screen asks for Android's notification permission instead of web push.

## Left to the builder

- Widget sizes and how many favourites fit at each size (resizable; the extra rows are cut off).
- How the small charts are drawn (a bitmap made from the day history).
- Exact colours, as long as they match the app's tokens.
- How to test the Kotlin parts (unit tests for formatting and parsing at least).
