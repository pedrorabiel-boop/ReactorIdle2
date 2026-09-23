const CACHE_NAME = 'nucleus-idle-v33-hybrid-turbines'
const STATIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './fonts/pixelify-sans-latin.woff2', './fonts/pixelify-sans-latin-ext.woff2', './fonts/press-start-2p-latin.woff2', './fonts/press-start-2p-latin-ext.woff2']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const rootUrl = new URL('./', self.registration.scope).toString()
      const response = await fetch(rootUrl)
      const html = await response.clone().text()
      const discoveredAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], rootUrl).toString())
        .filter((url) => new URL(url).origin === self.location.origin)

      await cache.put(rootUrl, response)
      const staticUrls = STATIC_FILES.map((path) => new URL(path, rootUrl).toString())
      await cache.addAll([...new Set([...staticUrls, ...discoveredAssets])])
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (event.request.mode === 'navigate') {
          const rootUrl = new URL('./', self.registration.scope).toString()
          const appShell = await caches.match(rootUrl)
          if (appShell) return appShell
        }
        return Response.error()
      }),
  )
})
