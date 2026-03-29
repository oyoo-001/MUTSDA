// ─── MUTSDA Church Service Worker ─────────────────────────
// Strategy: Network-first for API/dynamic, Cache-first for assets
// ────────────────────────────────────────────────────────────

const CACHE_NAME = 'mutsda-v1';

// Static shell assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// ── Install: pre-cache the app shell ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s) requests (e.g. chrome-extension://)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Skip API calls and socket.io — always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return;

  // For everything else: Network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Only cache successful same-origin responses
        if (
          networkResponse.ok &&
          url.origin === self.location.origin
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed — serve from cache
        const cached = await caches.match(request);
        if (cached) return cached;
        // For navigation requests (page loads), return the cached root
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// ── Push: show system notification ───────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: '🕊️ MUTSDA Church',
    body: 'You have a new update from MUTSDA.',
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1772797527/Christian_Globe_Design_e3befu.jpg',
    badge: 'https://res.cloudinary.com/dxzmo0roe/image/upload/v1772699359/seventh-day-adventist-church-seeklogo_abaiug.png',
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: 'mutsda-notification', // Replaces previous notification instead of stacking
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification click: focus or open the app ─────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});