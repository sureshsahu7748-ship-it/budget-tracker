const CACHE_NAME = 'procash-v14';

// 📌 ऐप की सभी लोकल फाइल्स और external libraries
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/logo.svg',
  // Firebase CDN Libraries (अगर यह भी ऑफलाइन सपोर्ट चाहिए)
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
  // Other External Libraries
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

// 1. Install Event - सभी फ़ाइलों को कैशे में सेव करना
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event - पुराना कैशे (v12 आदि) हटाना
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event - नेटवर्क न होने पर कैशे से फाइल्स लोड करना
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // अगर फ़ाइल कैशे में है तो सीधे वहाँ से लोड करो
      if (cachedResponse) {
        return cachedResponse;
      }
      // अगर कैशे में नहीं है तो नेटवर्क से लाओ
      return fetch(event.request).catch(() => {
        // अगर पूरी तरह ऑफ़लाइन हैं और कोई HTML फ़ाइल माँगी गई है तो fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match(event.request) || caches.match('/index.html');
        }
      });
    })
  );
});
   
