/*
 * Screenage service worker — makes the app installable and resilient offline.
 * Strategy:
 *   - Static assets (icons, _next/static): cache-first.
 *   - Navigations (HTML pages): network-first, fall back to cache, then offline page.
 *   - Never cache API/auth/market-service calls (always network).
 * Bump CACHE_VERSION to invalidate old caches on deploy.
 */
const CACHE_VERSION = 'screenage-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
        ).then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // skip cross-origin (APIs, CDNs)

    // Never cache API / auth routes — always go to network.
    if (url.pathname.startsWith('/api/')) return;

    // App-shell navigations: network-first with offline fallback.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
                    return res;
                })
                .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
        );
        return;
    }

    // Static assets: cache-first.
    if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname.startsWith('/assets')) {
        event.respondWith(
            caches.match(request).then((cached) =>
                cached ||
                fetch(request).then((res) => {
                    const copy = res.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
                    return res;
                }),
            ),
        );
    }
});
