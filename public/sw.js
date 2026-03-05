/**
 * FlightScore Service Worker — Stale-While-Revalidate
 *
 * Serves cached responses immediately while fetching updates in the background.
 * This lets the app load on the ramp without cell service, and silently refresh
 * when connectivity returns.
 */

var CACHE_NAME = 'flightscore-v1';

// Static assets to pre-cache on install
var PRE_CACHE = [
    '/',
    '/index.html'
];

// Install: pre-cache the app shell
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(PRE_CACHE);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: Stale-While-Revalidate strategy
// - Serve from cache immediately (if available)
// - Fetch fresh copy in the background and update cache
// - API calls (weather, Firebase) are NOT cached — they pass through directly
self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // Skip caching for non-GET requests and external API calls
    if (event.request.method !== 'GET') return;
    if (url.hostname === 'api.anthropic.com') return;
    if (url.hostname === 'aviationweather.gov') return;
    if (url.hostname === 'api.weather.gov') return;
    if (url.hostname.includes('cloudfunctions.net')) return;
    if (url.hostname.includes('googleapis.com') && url.pathname.includes('/v1')) return;

    event.respondWith(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.match(event.request).then(function(cachedResponse) {
                // Always attempt a network fetch to revalidate
                var fetchPromise = fetch(event.request).then(function(networkResponse) {
                    // Only cache successful responses
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(function() {
                    // Network failed — cachedResponse (if any) is already being returned
                    return cachedResponse;
                });

                // Return cached response immediately, or wait for network
                return cachedResponse || fetchPromise;
            });
        })
    );
});
