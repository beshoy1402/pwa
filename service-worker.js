/**
 * service-worker.js — AquaTrack Service Worker
 * Handles caching, offline support, and push notifications.
 */

const CACHE_NAME = 'aquatrack-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/admin.html',
    '/calendar.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/notifications.js',
    '/js/calendar.js',
    '/config/config.js',
    '/firebase/firebase.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// ── Install: Cache static assets ───────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
        }).catch(err => console.warn('Cache install partial:', err))
    );
    self.skipWaiting();
});

// ── Activate: Remove old caches ────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: Network-first with cache fallback ───────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and external requests (Firebase API, etc.)
    if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) return;

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
});

// ── Push Notifications ─────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'AquaTrack', body: 'New notification', icon: '/images/icon-192.png' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch (e) {}

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/images/icon-192.png',
            badge: '/images/icon-72.png',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' },
            actions: data.actions || [],
            tag: data.tag || 'aquatrack',
            renotify: true
        })
    );
});

// ── Notification Click ─────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(targetUrl);
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

// ── Background Sync (for offline submissions) ──────────────
self.addEventListener('sync', event => {
    if (event.tag === 'sync-refills') {
        event.waitUntil(syncPendingRefills());
    }
});

async function syncPendingRefills() {
    // Placeholder: in a full implementation this would sync
    // IndexedDB queued refills when connectivity is restored.
    console.log('Background sync: syncing pending refills...');
}
