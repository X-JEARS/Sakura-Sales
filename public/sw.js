const CACHE = 'field-orders-shell-v39';
const SHELL = ['/', '/index.html', '/styles.css', '/styles.css?v=39', '/app-runtime.js', '/app-runtime.js?v=39', '/app.js', '/app.js?v=39', '/antd-icons.js', '/antd-icons.js?v=39', '/manifest.webmanifest', '/manifest.webmanifest?v=39', '/manifest.zh-CN.webmanifest?v=39', '/manifest.zh-TW.webmanifest?v=39', '/manifest.zh-HK.webmanifest?v=39', '/manifest.en.webmanifest?v=39', '/manifest.ja.webmanifest?v=39', '/sakura.png', '/sakura.png?v=39'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('/index.html'))));
});
