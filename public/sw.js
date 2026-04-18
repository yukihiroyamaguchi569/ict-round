const CACHE_VERSION = 'v2';
const SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const FONTS_CACHE = `google-fonts-${CACHE_VERSION}`;

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './meguru.png',
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
  const isSameOriginGet =
    request.method === 'GET' && url.origin === self.location.origin;
  const isNavigationRequest =
    request.mode === 'navigate' || url.pathname.endsWith('/index.html');

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

  // ナビゲーションと index.html → Network First
  if (isSameOriginGet && isNavigationRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // /assets/ → Cache First（Viteのcontent-hashed assets）
  if (isSameOriginGet && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // その他の同一オリジンGET → Network First
  if (isSameOriginGet) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }

  // その他 → Network Only（IndexedDB操作等はSW経由しない）
});
