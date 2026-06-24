/* The Vael Field Journal — service worker (cache-first app shell, offline-capable).
   Canon/GitHub requests are never cached; they must stay live. */
const CACHE = 'vfj-survival-20260623-1';
const PATCH = './app-patch.js?v=20260623-1';
const ASSETS = ['./', './index.html', './app-patch.js', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function injectPatch(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!/text\/html/i.test(type)) return response;
  let html = await response.text();
  if (!html.includes('app-patch.js')) {
    const tag = `<script src="${PATCH}"></script>`;
    html = html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag;
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status:response.status, statusText:response.statusText, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  // Always go to the network for GitHub (API + raw) so canon is never stale.
  if (/github/i.test(url.host)) return;

  // Network-first for app documents, injecting the public patch into the old shell.
  if (url.origin === location.origin && (request.mode === 'navigate' || request.destination === 'document')) {
    event.respondWith((async () => {
      try {
        const network = await fetch(request, { cache:'no-store' });
        const patched = await injectPatch(network);
        const copy = patched.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return patched;
      } catch (_) {
        const cached = await caches.match(request) || await caches.match('./index.html');
        return injectPatch(cached);
      }
    })());
    return;
  }

  // Cache-first for the rest (patch, icon, manifest, fonts) — fast and offline-safe.
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response && response.ok && url.origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
