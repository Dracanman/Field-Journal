/* The Vael Field Journal — service worker (cache-first app shell, offline-capable).
   Canon/GitHub requests are never cached; they must stay live. */
<<<<<<< HEAD
const CACHE = 'vfj-56b84fe0';
=======
const CACHE = 'vfj-479a2d74';
>>>>>>> f701ff3 (feat-slice-13-button-grammar)
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
