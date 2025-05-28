// File: project-root/public/service-worker.js
const CACHE_NAME = 'airdrop-manager-cache-v3'; // Incremented version
const urlsToCache = [
  './', 
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // Specific font files if known and stable, e.g.:
  // 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js',
  'https://placehold.co/64x64/1F2937/FFFFFF?text=Icon&font=Inter',
  'https://placehold.co/192x192/1F2937/FFFFFF?text=Icon&font=Inter',
  'https://placehold.co/512x512/1F2937/FFFFFF?text=Icon&font=Inter'
  // Add actual paths to favicon.ico, logo192.png, logo512.png if they are local and not placeholders
  // './favicon.ico', './logo192.png', './logo512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Opened cache ' + CACHE_NAME);
        const cachePromises = urlsToCache.map(urlToCache => {
          let request = urlToCache;
          // For cross-origin resources, create a Request object with 'no-cors' mode.
          // This allows caching opaque responses, but you can't inspect them.
          if (urlToCache.startsWith('http') && new URL(urlToCache).origin !== self.location.origin) {
             request = new Request(urlToCache, { mode: 'no-cors' }); 
          }
          return cache.add(request).catch(err => {
            console.warn(`SW: Failed to cache ${urlToCache}: ${err} (Request mode: ${request.mode || 'default'})`);
          });
        });
        return Promise.all(cachePromises);
      })
      .catch(err => {
        console.error("SW: Cache open/add failed during install: ", err);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activated and old caches cleaned.');
      return self.clients.claim(); 
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return; 
  }
  
  const isHTMLNavigation = event.request.mode === 'navigate' || 
                           (event.request.method === 'GET' && 
                            event.request.headers.get('accept') && 
                            event.request.headers.get('accept').includes('text/html'));

  if (isHTMLNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response; 
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('./index.html'); 
            });
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(
            networkResponse => {
              if (!networkResponse) { 
                  return networkResponse;
              }
              
              let shouldCache = false;
              if (networkResponse.status === 200 && networkResponse.type === 'basic') {
                  shouldCache = true; 
              } else if (networkResponse.type === 'opaque') { // Opaque responses are from no-cors requests
                  shouldCache = true; 
              }

              if (shouldCache) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            }
          ).catch(error => {
            console.error('SW: Fetch failed for non-HTML asset; error:', error, 'URL:', event.request.url);
          });
        })
    );
  }
});