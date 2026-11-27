// Domo service worker: caches the app shell; never caches /api (always live data).
const CACHE = 'domo-v39';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/badge-96.png', '/ill/offline.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only same-origin requests: other sites (Google Fonts, analytics) go straight to the network.
  // The worker's CSP would block those fetches and break fonts with ERR_FAILED.
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/index.html', copy)); } return res; })
      .catch(() => caches.match('/index.html').then(hit => hit || caches.match('/')).then(hit => hit || offline())));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
// Never leave the browser with an error page: a small retry page when there is no network and no cache.
const offline = () => new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Domo</title><body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f7fc;color:#0e1630;text-align:center;padding:24px"><div><h1 style="font-size:22px;margin:0 0 8px">Connexion impossible</h1><p style="margin:0 0 18px;color:#4d5774">Vérifiez votre connexion internet, puis réessayez.</p><button onclick="location.reload()" style="font:600 16px system-ui;padding:12px 22px;border-radius:999px;border:0;background:#0133F8;color:#fff">Réessayer</button></div></body></html>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });

// ---- push notifications (Android, desktop, and iOS 16.4+ home-screen app)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Domo', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Domo';
  const opts = {
    body: d.body || '', icon: '/icon-192.png', badge: '/badge-96.png', tag: d.tag || undefined, renotify: !!d.tag,
    data: { url: d.url || '/' }, requireInteraction: !!d.call, vibrate: d.call ? [400, 200, 400, 200, 400] : [120, 60, 120],
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    (typeof d.badge === 'number' && self.navigator && self.navigator.setAppBadge) ? self.navigator.setAppBadge(d.badge).catch(() => {}) : null,
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => new URL(c.url).origin === self.location.origin);
    if (win) { win.postMessage({ type: 'open', url }); return win.focus(); }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('pushsubscriptionchange', e => {
  // the browser rotated the subscription: the page re-registers it on next open
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => l.forEach(c => c.postMessage({ type: 'resubscribe' }))));
});
