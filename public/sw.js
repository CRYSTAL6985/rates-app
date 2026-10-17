// Bump when the app shell changes, so old caches are dropped.
const CACHE = 'nerkh-v1';
const SHELL = [
  '/', '/styles.css', '/manifest.webmanifest',
  '/app.js', '/home.js', '/sheet.js', '/alerts.js', '/chart.js', '/series.js', '/motion.js', '/format.js', '/ui.js',
  '/fonts/Vazirmatn.woff2', '/icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files: answer from cache at once, refresh the cache in the background.
// Prices (/api/*) always go to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
  }));
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { data = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title ?? 'نرخ', {
    body: data.body ?? '',
    tag: data.alert,
    data: { item: data.item },
    icon: '/icons/icon-192.png',
    lang: 'fa',
    dir: 'rtl',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const item = e.notification.data?.item;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const client = list[0];
    if (!client) return self.clients.openWindow(item ? `/?item=${encodeURIComponent(item)}` : '/');
    client.postMessage({ open: item });
    return client.focus();
  }));
});
