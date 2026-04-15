const CACHE_VERSION = 'v1';
const SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const FONTS_CACHE = `google-fonts-${CACHE_VERSION}`;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './ran-icon.png',
  './favicon.svg',
];

// インストール: アプリシェルをprecache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== FONTS_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ: キャッシュ戦略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Fonts → Cache First
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONTS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // 同一オリジンのGET → Cache First, fallback to network
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // JS/CSS/画像等はシェルキャッシュに追加
          if (response.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // その他 → Network Only（IndexedDB操作等はSW経由しない）
});
