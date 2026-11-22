const CACHE_NAME = 'commitscape-shell-v15';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './styles/tokens.css',
  './styles/components.css',
  './styles/scene3d.css',
  './src/utils/sanitize.js',
  './src/domain/linguistColors.js',
  './src/api/cacheStore.js',
  './src/api/githubClient.js',
  './src/domain/analytics.js',
  './src/ui/stage3d.js',
  './src/ui/exportCard.js',
  './src/ui/neuralNet.js',
  './src/ui/renderHome.js',
  './src/ui/renderProfile.js',
  './src/ui/renderRepos.js',
  './src/ui/renderCompare.js',
  './src/state.js',
  './src/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((asset) =>
            fetch(new Request(asset, { cache: 'reload' })).then((res) => {
              if (res && res.ok) return cache.put(asset, res);
              return null;
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
