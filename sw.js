const CACHE_NAME = 'pro-gs-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/ui.js',
    '/app.js',
    '/IMAGE/FsMfvk8WcAEbc_0.jpg',
    '/GIF/luffy.gif',
    '/GIF/One_Piece_Zoro_Vs_King_GIF_-_One_piece_Zoro_vs_king_King_of_hell_-_Discover__Share_GIFs.gif'
];

// Install Event - Pre-cache basic assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event - Cache First Strategy for Media
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Check if the request is for an IMAGE or GIF
    if (url.pathname.includes('/IMAGE/') || url.pathname.includes('/GIF/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    } else {
        // Default Strategy: Network First for scripts/styles to ensure updates
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});
