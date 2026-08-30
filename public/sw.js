const CACHE = 'field-orders-shell-v40';
const SHELL = ['/', '/index.html', '/styles.css', '/styles.css?v=40', '/app-runtime.js', '/app-runtime.js?v=40', '/app.js', '/app.js?v=40', '/antd-icons.js', '/antd-icons.js?v=40', '/manifest.webmanifest', '/manifest.webmanifest?v=40', '/manifest.zh-CN.webmanifest?v=40', '/manifest.zh-TW.webmanifest?v=40', '/manifest.zh-HK.webmanifest?v=40', '/manifest.en.webmanifest?v=40', '/manifest.ja.webmanifest?v=40', '/sakura.png', '/sakura.png?v=40'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('/index.html'))));
});
