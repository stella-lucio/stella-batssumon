/* 받쓰몬 서비스 워커
 * - 앱 화면(HTML): 네트워크 우선, 오프라인이면 캐시
 * - JS/CSS/아이콘 등: 캐시 우선 + 백그라운드 갱신
 * - OCR 엔진/글꼴 CDN 파일도 한 번 받으면 캐시 (오프라인 OCR 대비)
 * 사진이나 학습 데이터는 여기서 다루지 않는다.
 */
const VERSION = 'v1';
const APP_CACHE = `batssumon-app-${VERSION}`;
const CDN_CACHE = `batssumon-cdn-${VERSION}`;
const SCOPE = self.registration.scope; // 예: https://user.github.io/batssumon/

const PRECACHE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png'];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, SCOPE).toString())))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('batssumon-') && k !== APP_CACHE && k !== CDN_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = (await cache.match(request)) || (await cache.match(new URL('./', SCOPE).toString()));
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.href.startsWith(SCOPE)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.href.startsWith(SCOPE)) {
    event.respondWith(staleWhileRevalidate(request, APP_CACHE));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE));
  }
});
