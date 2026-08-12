const CACHE_NAME = 'procash-v15'; // 👈 बस यहाँ v15 या v16 कर दें ताकि फ़ोन पुराना कैशे साफ़ कर ले

const assetsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/logo.svg',
  '/legal-style.css',
  '/privacy.html',
  '/terms.html',
  '/manifest.json',
  '/robots.txt',
  '/service-worker.js',
  '/_redirects',
  '/sitemap.xml'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Activate Event - पुराना कैशे साफ़ करने के लिए
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event (Network First, Cache Fallback)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
