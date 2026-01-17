// Service Worker for Image Caching and Push Notifications
const CACHE_NAME = 'team-gs-cache-v1';
const IMAGE_CACHE = 'team-gs-images-v1';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/ui.js'
];

// Image directories to cache
const IMAGE_PATTERNS = [
    /\/2stars\//,
    /\/3stars\//,
    /\/4stars\//,
    /\/GIF\//,
    /\/IMAGE\//
];

// Counter for cached images served
let cachedImagesCount = 0;
let lastLogTime = Date.now();

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Cache Strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Check if it's an image request
    const isImage = IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname)) ||
        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname);

    if (isImage) {
        // Cache First strategy for images
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        // Increment counter
                        cachedImagesCount++;

                        // Log summary every 3 seconds instead of logging each image
                        const now = Date.now();
                        if (now - lastLogTime >= 3000) {
                            console.log(`[Service Worker] Serving from cache: ${cachedImagesCount} صورة`);
                            lastLogTime = now;
                        }

                        return cachedResponse;
                    }

                    // Not in cache, fetch from network
                    return fetch(request).then(networkResponse => {
                        // Cache the new image
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                            console.log('[Service Worker] Cached new image:', url.pathname);
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // Return a placeholder or error image if needed
                        return new Response('Image not available', { status: 404 });
                    });
                });
            })
        );
    } else {
        // Network First strategy for other resources
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(request);
            })
        );
    }
});

// Push Notification Event
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');

    let notificationData = {
        title: 'TEAM GS',
        body: 'لديك إشعار جديد',
        icon: '/IMAGE/logo.png',
        badge: '/IMAGE/badge.png',
        tag: 'team-gs-notification',
        requireInteraction: false,
        data: {}
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || notificationData.title,
                body: data.body || data.message || notificationData.body,
                icon: data.icon || notificationData.icon,
                badge: data.badge || notificationData.badge,
                tag: data.tag || notificationData.tag,
                requireInteraction: data.requireInteraction || false,
                data: data.data || {}
            };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            data: notificationData.data,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'فتح', icon: '/IMAGE/open-icon.png' },
                { action: 'close', title: 'إغلاق', icon: '/IMAGE/close-icon.png' }
            ]
        })
    );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Check if there's already a window open
                for (let client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    const targetUrl = event.notification.data?.url || '/';
                    return clients.openWindow(targetUrl);
                }
            })
    );
});
