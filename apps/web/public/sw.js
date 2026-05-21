/**
 * Marketer Pro — Service Worker
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS): Cache-first with network fallback.
 *   - API calls (/api/*): Network-first with no caching (live data always).
 *   - Static assets (/icons/*, /screenshots/*): Cache-first, long-lived.
 *
 * This service worker satisfies PWA requirements for Microsoft Store submission
 * via PWABuilder and enables offline shell display on iOS/Android via Capacitor.
 */

const CACHE_NAME = 'marketer-pro-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
]

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Cache-first for everything else (app shell, assets)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque' ||
          url.origin !== self.location.origin
        ) {
          return response
        }

        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
    })
  )
})
