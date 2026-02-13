/**
 * Satu Ramadhan - Service Worker
 * PWA offline support with caching strategy
 * Network-first for JS to ensure users get latest code
 */

const CACHE_VERSION = 'v25';

// Cache base names must match SaturaConfig.CACHE.names in config.js.
// Duplicated here because Service Workers cannot import app modules.
const CACHE_NAMES = {
    static: `satura-static-${CACHE_VERSION}`,
    api: `satura-api-${CACHE_VERSION}`,
    database: `satura-db-${CACHE_VERSION}`
};

// Static assets to cache on install
const STATIC_ASSETS = [
    '/saturamadhan/',
    '/saturamadhan/index.html',
    '/saturamadhan/manifest.json',

    // CSS Core
    '/saturamadhan/assets/css/style.css',
    '/saturamadhan/assets/vendor/boxicons/css/boxicons.min.css',

    // CSS Components (referenced via @import)
    '/saturamadhan/assets/css/base/_variables.css',
    '/saturamadhan/assets/css/base/_fonts.css',
    '/saturamadhan/assets/css/base/_reset.css',
    '/saturamadhan/assets/css/base/_typography.css',
    '/saturamadhan/assets/css/layout/_container.css',
    '/saturamadhan/assets/css/components/_header.css',
    '/saturamadhan/assets/css/components/_hero.css',
    '/saturamadhan/assets/css/components/_countdown.css',
    '/saturamadhan/assets/css/components/_schedule.css',
    '/saturamadhan/assets/css/components/_location.css',
    '/saturamadhan/assets/css/components/_modal.css',
    '/saturamadhan/assets/css/components/_buttons.css',
    '/saturamadhan/assets/css/components/_footer.css',
    '/saturamadhan/assets/css/components/_animations.css',
    '/saturamadhan/assets/css/components/_settings.css',

    // Icons - Prayer Times
    '/saturamadhan/assets/icon/cloud-sun.svg',
    '/saturamadhan/assets/icon/moon-stars.svg',
    '/saturamadhan/assets/icon/moon.svg',
    '/saturamadhan/assets/icon/sun-fog.svg',
    '/saturamadhan/assets/icon/sun-rise.svg',
    '/saturamadhan/assets/icon/sun-set.svg',
    '/saturamadhan/assets/icon/sun.svg',

    // Fonts - Poppins
    '/saturamadhan/assets/font/poppins/Poppins-Light.ttf',
    '/saturamadhan/assets/font/poppins/Poppins-Regular.ttf',
    '/saturamadhan/assets/font/poppins/Poppins-Medium.ttf',
    '/saturamadhan/assets/font/poppins/Poppins-SemiBold.ttf',
    '/saturamadhan/assets/font/poppins/Poppins-Bold.ttf',

    // Fonts - Amiri
    '/saturamadhan/assets/font/amiri/Amiri-Regular.ttf',
    '/saturamadhan/assets/font/amiri/Amiri-Bold.ttf',

    // Fonts - Boxicons
    '/saturamadhan/assets/vendor/boxicons/fonts/boxicons.woff2',
    '/saturamadhan/assets/vendor/boxicons/fonts/boxicons.woff',
    '/saturamadhan/assets/vendor/boxicons/fonts/boxicons.ttf',

    // JS - Loader and Modules
    '/saturamadhan/assets/js/loader.js',
    '/saturamadhan/assets/js/app.js',
    '/saturamadhan/assets/js/main.js',
    '/saturamadhan/assets/js/modules/config.js',
    '/saturamadhan/assets/js/modules/api.js',
    '/saturamadhan/assets/js/modules/database.js',
    '/saturamadhan/assets/js/modules/location.js',
    '/saturamadhan/assets/js/modules/prayer.js',
    '/saturamadhan/assets/js/modules/storage.js',
    '/saturamadhan/assets/js/modules/ui.js',
];

// JS files that should use network-first strategy (for updates)
const JS_FILES_PATTERN = /\.js$/;

// Database files to cache
const DATABASE_ASSETS = [
    '/saturamadhan/database/province.json',
    '/saturamadhan/database/regency.json',
    '/saturamadhan/database/ramadhan.json'
];

// API domains to cache
const API_DOMAINS = [
    'api.aladhan.com',
    'aladhan.api.islamic.network',
    'aladhan.api.alislam.ru'
];

// ===========================================
// INSTALL EVENT
// ===========================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAMES.static).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),

            // Cache database assets
            caches.open(CACHE_NAMES.database).then((cache) => {
                console.log('[SW] Caching database assets');
                return cache.addAll(DATABASE_ASSETS);
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            // Take control immediately
            return self.skipWaiting();
        })
    );
});

// ===========================================
// ACTIVATE EVENT
// ===========================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        // Clean up old caches
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        // Delete caches that don't match current version
                        return name.startsWith('satura-') &&
                            !Object.values(CACHE_NAMES).includes(name);
                    })
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            // Take control of all clients
            return self.clients.claim();
        })
    );
});

// ===========================================
// FETCH EVENT
// ===========================================

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Determine caching strategy based on request type
    if (isApiRequest(url)) {
        // Stale-while-revalidate for API with GPS coordinate normalization
        event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.api, url));
    } else if (isDatabaseRequest(url)) {
        // Cache-first for database files
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.database));
    } else if (isJavaScriptFile(url)) {
        // Network-first for JS files to ensure latest code
        event.respondWith(networkFirstStrategy(request, CACHE_NAMES.static));
    } else if (isHtmlFile(url)) {
        // Network-first for HTML to get latest structure
        event.respondWith(networkFirstStrategy(request, CACHE_NAMES.static));
    } else if (isStaticAsset(url)) {
        // Cache-first for other static assets (CSS, fonts, images)
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.static));
    } else {
        // Network-first for other requests
        event.respondWith(networkFirstStrategy(request, CACHE_NAMES.static));
    }
});

/**
 * Check if request is for JavaScript file
 */
function isJavaScriptFile(url) {
    return JS_FILES_PATTERN.test(url.pathname);
}

/**
 * Check if request is for HTML file
 */
function isHtmlFile(url) {
    return url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
}

// ===========================================
// CACHING STRATEGIES
// ===========================================

/**
 * Cache-first strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            console.log('[SW] Cache hit:', request.url);
            return cachedResponse;
        }

        console.log('[SW] Cache miss, fetching:', request.url);
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.error('[SW] Cache-first fetch failed:', error);

        // Return offline fallback if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/saturamadhan/index.html');
        }

        throw error;
    }
}

/**
 * Network-first strategy
 * Try network first, fallback to cache
 */
async function networkFirstStrategy(request, cacheName) {
    try {
        console.log('[SW] Network request:', request.url);
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('[SW] Network failed, checking cache:', request.url);

        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            console.log('[SW] Returning cached response');
            return cachedResponse;
        }

        console.error('[SW] No cached response available');

        // Return error response for API requests
        if (isApiRequest(new URL(request.url))) {
            return new Response(
                JSON.stringify({
                    code: 503,
                    status: 'Service Unavailable',
                    message: 'Anda sedang offline dan data tidak tersedia dalam cache'
                }),
                {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        throw error;
    }
}

/**
 * Normalize API URL for cache key consistency
 * Rounds GPS coordinates to 4 decimals (~11m) so that slight GPS drift
 * doesn't cause cache misses, while the actual API request uses full precision.
 * @param {URL} url - Original request URL
 * @returns {string} - Normalized URL string for cache key
 */
function normalizeApiUrl(url) {
    const normalized = new URL(url.toString());
    ['latitude', 'longitude'].forEach(param => {
        if (normalized.searchParams.has(param)) {
            const val = Number(normalized.searchParams.get(param));
            if (!isNaN(val)) {
                normalized.searchParams.set(param, val.toFixed(4));
            }
        }
    });
    return normalized.toString();
}

/**
 * Stale-while-revalidate strategy with URL normalization for API requests
 * Uses normalized URL (rounded GPS coords) as cache key for high hit rate,
 * but fetches with original URL for maximum accuracy.
 * @param {Request} request - Original request with full-precision GPS
 * @param {string} cacheName - Cache name to use
 * @param {URL} requestUrl - Parsed URL for normalization (optional)
 */
async function staleWhileRevalidateStrategy(request, cacheName, requestUrl = null) {
    const cache = await caches.open(cacheName);

    // For API requests: normalize GPS coordinates in cache key
    let cacheKey = request;
    if (requestUrl && isApiRequest(requestUrl)) {
        const normalizedUrl = normalizeApiUrl(requestUrl);
        cacheKey = new Request(normalizedUrl, {
            method: request.method,
            headers: request.headers
        });
    }

    const cachedResponse = await cache.match(cacheKey);

    // Fetch with ORIGINAL URL (full precision) in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            // Store with NORMALIZED key for future cache hits
            cache.put(cacheKey, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => cachedResponse);

    // Return cached response immediately if available
    return cachedResponse || fetchPromise;
}

// ===========================================
// REQUEST TYPE HELPERS
// ===========================================

/**
 * Check if request is for API
 */
function isApiRequest(url) {
    return API_DOMAINS.some(domain => url.hostname.includes(domain));
}

/**
 * Check if request is for database files
 */
function isDatabaseRequest(url) {
    return url.pathname.includes('/database/') &&
        url.pathname.endsWith('.json');
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// ===========================================
// BACKGROUND SYNC
// ===========================================

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-prayer-times') {
        event.waitUntil(syncPrayerTimes());
    }
});

/**
 * Sync prayer times in background
 */
async function syncPrayerTimes() {
    try {
        // This would be called from the app when online
        console.log('[SW] Syncing prayer times...');
        // Implementation would fetch and cache prayer times
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// ===========================================
// PUSH NOTIFICATIONS
// ===========================================

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'Waktu sholat telah tiba',
        icon: '/saturamadhan/assets/favicon/favicon.png',
        badge: '/saturamadhan/assets/favicon/favicon.png',
        vibrate: [100, 50, 100],
        data: data,
        actions: [
            { action: 'open', title: 'Buka Aplikasi' },
            { action: 'close', title: 'Tutup' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Satu Ramadhan', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Focus existing window if open
                for (const client of clientList) {
                    if (client.url.includes('saturamadhan') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (clients.openWindow) {
                    return clients.openWindow('/saturamadhan/');
                }
            })
        );
    }
});

// ===========================================
// MESSAGE HANDLING
// ===========================================

self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    const { type, payload } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CACHE_PRAYER_TIMES':
            cachePrayerTimesData(payload);
            break;

        case 'CLEAR_CACHE':
            clearAllCaches();
            break;

        case 'GET_CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0].postMessage(status);
            });
            break;

        default:
            console.log('[SW] Unknown message type:', type);
    }
});

/**
 * Cache prayer times data manually
 */
async function cachePrayerTimesData(data) {
    try {
        const cache = await caches.open(CACHE_NAMES.api);
        const url = data.url || `prayer-times-${data.date}`;

        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });

        await cache.put(url, response);
        console.log('[SW] Prayer times cached for:', data.date);

    } catch (error) {
        console.error('[SW] Failed to cache prayer times:', error);
    }
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames
            .filter(name => name.startsWith('satura-'))
            .map(name => caches.delete(name))
    );
    console.log('[SW] All caches cleared');
}

/**
 * Get cache status
 */
async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};

    for (const name of cacheNames) {
        if (name.startsWith('satura-')) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            status[name] = {
                count: keys.length,
                urls: keys.map(r => r.url)
            };
        }
    }

    return status;
}

console.log('[SW] Service Worker loaded');
