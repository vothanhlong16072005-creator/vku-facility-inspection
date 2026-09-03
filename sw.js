/**
 * sw.js — Service Worker for Facility Inspection PWA
 * Strategy: Cache-First for App Shell, Network-Only for Google APIs
 * Enables sub-second offline boot
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `facility-inspection-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/api.js',
  './js/sync.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing - caching app shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each asset individually so one failure doesn't break everything
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to cache:', url, err.message);
          })
        )
      );
    })
  );
  // Immediately take control without waiting for old SW to die
  self.skipWaiting();
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating - cleaning old caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('facility-inspection-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  // Network-Only: Google APIs (Apps Script, fonts APIs, etc.)
  if (
    url.hostname === 'script.google.com' ||
    url.hostname === 'script.googleusercontent.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        // For font failures, return empty response to not block rendering
        if (url.hostname.includes('google')) {
          return new Response('', { status: 200 });
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Offline — không thể kết nối' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Cache-First: App Shell and local assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Serve from cache immediately (sub-second boot)
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Navigation fallback
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  if (event.tag === 'sync-inspections') {
    event.waitUntil(
      // Notify all open clients to trigger sync
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
        });
      })
    );
  }
});

// ==================== MESSAGES ====================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
      break;
  }
});
