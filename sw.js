/* The Vael Field Journal — service worker (cache-first app shell, offline-capable).
   Canon/GitHub requests are never cached; they must stay live. */
const CACHE = 'vfj-84341623';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  // Always go to the network for GitHub (API + raw) so canon is never stale.
  if (/github/i.test(url.host)) return;
  // Network-first for the app document, so an update lands as soon as you reopen
  // online; fall back to the cached copy offline.
  if (url.origin === location.origin && (req.mode === 'navigate' || req.destination === 'document')) {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first for the rest (icon, manifest, fonts) — fast and offline-safe.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

// Web Push: the private backend posts an end-to-end-encrypted payload when a
// household note lands (subscribe flow in src/ui/messages.js; sender in
// backend/app.py). Payloads arrive even with the app closed; tapping the
// notification focuses an open journal or opens a fresh one.
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title || 'Field Journal', {
    body: data.body || 'A new note is waiting.',
    tag: 'vfj-message',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) { if ('focus' in client) return client.focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
