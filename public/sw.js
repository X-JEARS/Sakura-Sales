const CACHE = 'field-orders-shell-v27';
const SHELL = ['/', '/index.html', '/styles.css', '/styles.css?v=27', '/app.js', '/app.js?v=27', '/antd-icons.js', '/antd-icons.js?v=27', '/manifest.webmanifest', '/manifest.webmanifest?v=27', '/sakura.png', '/sakura.png?v=27'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('/index.html'))));
});
