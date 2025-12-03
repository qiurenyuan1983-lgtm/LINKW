const CACHE_NAME = 'linkw-cache-v1';
// This list can be expanded to include all static assets.
// For this app, the core files are loaded from index.html.
const urlsToCache = [
  '/',
  '/index.html',
  // You can add more assets here like CSS, JS files if they were separate
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For requests to external CDNs, use a network-first strategy
  if (event.request.url.includes('aistudiocdn.com') || event.request.url.includes('tailwindcss.com')) {
      event.respondWith(
          caches.open(CACHE_NAME).then(cache => {
              return fetch(event.request).then(response => {
                  cache.put(event.request, response.clone());
                  return response;
              }).catch(() => {
                  return caches.match(event.request);
              });
          })
      );
      return;
  }

  // For app's own assets, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Serve from cache
        }
        return fetch(event.request); // Fetch from network if not in cache
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
