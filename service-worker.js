importScripts('./offline-assets.js');

const VERSION = 'emileeverse-v8';
const CORE_CACHE = `${VERSION}-core`;
const MEDIA_CACHE = `${VERSION}-media`;
const CORE_ASSETS = ['./', './index.html', './styles.css?v=8', './app.js?v=8', './manifest.webmanifest', './assets/icons/emileeverse-192.png', './assets/icons/emileeverse-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('emileeverse-') && ![CORE_CACHE, MEDIA_CACHE].includes(key)).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const requestUrl = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CORE_CACHE).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(requestUrl.pathname.startsWith('/assets/') ? MEDIA_CACHE : CORE_CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});

async function prepareFullLibrary(source) {
  const assets = self.EMILEEVERSE_OFFLINE_ASSETS || [];
  const cache = await caches.open(MEDIA_CACHE);
  let completed = 0;
  let failed = 0;
  for (const asset of assets) {
    try {
      const response = await fetch(asset);
      if (!response.ok) throw new Error(String(response.status));
      await cache.put(asset, response);
    } catch (error) {
      failed++;
    }
    completed++;
    if (completed % 10 === 0 || completed === assets.length) source.postMessage({type: 'OFFLINE_PROGRESS', completed, total: assets.length, failed});
  }
  source.postMessage({type: 'OFFLINE_COMPLETE', completed, total: assets.length, failed});
}

self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_FULL_LIBRARY') event.waitUntil(prepareFullLibrary(event.source));
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
