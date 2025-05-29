// File: project-root/public/service-worker.js
// Service Worker for Crypto Airdrop Task Manager

// Increment this version to trigger an update to the service worker and cache.
const CACHE_NAME = 'airdrop-manager-cache-v6'; 

// List of URLs to pre-cache during the service worker installation.
// This should include the main app shell and critical static assets.
// Dynamically generated assets (like JS/CSS bundles with hashes) will be cached on first fetch.
const urlsToCache = [
  './', // The root index.html - the main entry point of the PWA
  './manifest.json', // The Web App Manifest
  './favicon.ico',   // Main application icon
  './logo192.png',   // Icon for PWA, common size
  './logo512.png',   // Larger icon for PWA
  // Critical external resources (CDNs)
  'https://cdn.tailwindcss.com', // Tailwind CSS
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap', // Google Fonts CSS
  // Note: Specific font files (e.g., .woff2) from Google Fonts are often versioned and have CORS headers,
  // so they are usually best cached dynamically by the fetch handler when requested by the above CSS.
];

// Event: install
// Triggered when the service worker is first registered or when a new version is detected.
self.addEventListener('install', event => {
  console.log(`SW: Install event for version ${CACHE_NAME}`);
  // Ensures the service worker activates as soon as it's finished installing,
  // rather than waiting for the existing service worker to stop controlling clients.
  self.skipWaiting(); 

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`SW: Cache opened: ${CACHE_NAME}`);
        // Attempt to cache all specified URLs.
        const cachePromises = urlsToCache.map(urlToCache => {
          // Create a new Request object. For cross-origin requests, 'cors' mode is appropriate
          // if the server supports it (which CDNs and Google services usually do).
          // 'no-cors' can be a fallback for opaque resources but offers less control.
          let request = new Request(urlToCache, { mode: 'cors' }); 
          
          return cache.add(request).catch(err => {
            console.warn(`SW: Failed to cache ${urlToCache} with mode 'cors'. Error: ${err}.`);
            // Optionally, try 'no-cors' as a fallback for cross-origin resources if 'cors' failed.
            // This is generally for resources that don't serve with CORS headers but are still desired in cache.
            if (new URL(urlToCache, self.location.origin).origin !== self.location.origin) {
                console.log(`SW: Retrying ${urlToCache} with mode 'no-cors'.`);
                return cache.add(new Request(urlToCache, {mode: 'no-cors'})).catch(noCorsErr => {
                    console.warn(`SW: Failed to cache ${urlToCache} with mode 'no-cors' as well. Error: ${noCorsErr}`);
                });
            }
          });
        });
        return Promise.all(cachePromises)
            .then(() => console.log("SW: All specified URLs added to cache."))
            .catch(err => console.error("SW: Some URLs failed to cache during install:", err));
      })
      .catch(err => {
        console.error("SW: Cache open/add failed during install phase: ", err);
      })
  );
});

// Event: activate
// Triggered after the install event, when the new service worker takes control.
// This is a good place to clean up old caches.
self.addEventListener('activate', event => {
  console.log(`SW: Activate event for version ${CACHE_NAME}`);
  const cacheWhitelist = [CACHE_NAME]; // Only the current cache should remain.
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
      // Take control of all open clients (pages) immediately.
      return self.clients.claim(); 
    })
  );
});

// Event: fetch
// Intercepts network requests made by the application.
self.addEventListener('fetch', event => {
  // We only handle GET requests for caching. Other requests (POST, PUT, etc.) are passed through.
  if (event.request.method !== 'GET') {
    // console.log('SW: Non-GET request, not handling:', event.request.url);
    return; 
  }
  
  // Determine if the request is for HTML navigation.
  const isHTMLNavigation = event.request.mode === 'navigate' || 
                           (event.request.method === 'GET' && 
                            event.request.headers.get('accept') && 
                            event.request.headers.get('accept').includes('text/html'));

  if (isHTMLNavigation) {
    // Strategy for HTML: Network first, then Cache.
    // This ensures users get the latest version of the app shell if online.
    // console.log('SW: Handling HTML navigation request (network-first):', event.request.url);
    event.respondWith(
      fetch(event.request) 
        .then(response => {
          // If the network request is successful, clone it, cache it, and return it.
          if (response && response.ok) {
            // console.log('SW: HTML fetched from network, caching and returning:', event.request.url);
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache); 
            });
          } else if (response) {
            // console.log('SW: HTML network request not "ok" (status: ${response.status}), trying cache for:', event.request.url);
          }
          return response; // Return the network response (even if not 'ok', to let browser handle errors).
        })
        .catch(() => { // If network fails (e.g., offline), try to serve from cache.
          // console.log('SW: HTML network fetch failed, trying cache for:', event.request.url);
          return caches.match(event.request)
            .then(cachedResponse => {
              // If the request is in cache, return it.
              if (cachedResponse) {
                // console.log('SW: HTML found in cache:', event.request.url);
                return cachedResponse;
              }
              // As an ultimate fallback for navigation, try to serve the root index.html from cache.
              // console.log('SW: HTML not in cache, falling back to root cached HTML for:', event.request.url);
              return caches.match('./'); 
            });
        })
    );
  } else { 
    // Strategy for non-HTML assets (JS, CSS, images, fonts): Cache first, then Network.
    // console.log('SW: Handling asset request (cache-first):', event.request.url);
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Cache hit - return response from cache.
          if (cachedResponse) {
            // console.log('SW: Asset found in cache:', event.request.url);
            return cachedResponse;
          }
          // Not in cache - fetch from network.
          // console.log('SW: Asset not in cache, fetching from network:', event.request.url);
          return fetch(event.request).then(
            networkResponse => {
              // Check if we received a valid response to cache.
              // Opaque responses (type 'opaque') are from no-cors requests; cache them but be aware of limitations.
              if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
                // console.log('SW: Asset network response not cacheable (status: ${networkResponse.status}, type: ${networkResponse.type}), not caching:', event.request.url);
                return networkResponse;
              }
              
              // Clone the response and cache it.
              // console.log('SW: Asset fetched from network, caching and returning:', event.request.url);
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              return networkResponse;
            }
          ).catch(error => {
            console.error('SW: Asset fetch failed; error:', error, 'URL:', event.request.url);
            // Optionally, return a fallback generic asset here if appropriate (e.g., offline image placeholder).
            // For now, just let the browser handle the failed fetch.
          });
        })
    );
  }
});
