/**
 * Service Worker — Portal de Estudos & Quiz Game TIC (PWA)
 * Estratégia: Network-First com Fallback Offline e auto-atualização transparente.
 */

const CACHE_NAME = 'portal-tic-pwa-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './quiz.html',
  './fichas.html',
  './resumos.html',
  './ufrrj_quadro.html',
  './transpetro_quadro.html',
  './manifest.webmanifest',
  './manifest.json',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Usa addAll resiliente para que uma falha isolada não aborte a instalação
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Não foi possível pré-armazenar:', asset, err);
        }
      }
    })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Apenas requisições GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Apenas mesma origem
  if (url.origin !== self.location.origin) return;

  // Requisições de navegação ou páginas HTML: NETWORK-FIRST com FALLBACK OFFLINE
  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // Se obteve resposta com sucesso, atualiza o cache e entrega
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Falhou a rede (offline): busca no cache
          const cached = await caches.match(req);
          if (cached) return cached;

          // Se a rota específica não estiver em cache, entrega index.html
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;

          return new Response('Você está offline e esta página não foi armazenada anteriormente.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Demais recursos (CSS, JS, Ícones, JSON, Imagens): STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
