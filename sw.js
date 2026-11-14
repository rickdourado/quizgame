/**
 * Service Worker — Portal de Estudos & Quiz Game TIC (PWA)
 * Estratégia: Network-First com Fallback Offline e auto-atualização transparente.
 * Armazena 100% dos módulos, questões, leis e resumos no Cache do aparelho.
 */

const CACHE_NAME = 'portal-tic-pwa-v1.1';

const CORE_ASSETS = [
  './',
  './index.html',
  './quiz.html',
  './fichas.html',
  './resumos.html',
  './leis.html',
  './ufrrj_quadro.html',
  './transpetro_quadro.html',
  
  // Resumos Didáticos por Disciplina
  './resumo_portugues.html',
  './resumo_ingles.html',
  './resumo_raciocinio_logico.html',
  './resumo_legislacao.html',
  './resumo_informatica.html',
  './resumo_governanca_ti.html',
  './resumo_redes.html',
  './resumo_infraestrutura.html',
  './resumo_banco_de_dados.html',
  './resumo_atualidades_ia.html',
  './resumo_ciberseguranca.html',

  // Biblioteca de Leis Secas
  './lei_8112.html',
  './lei_cf88.html',
  './lei_decreto_7724.html',
  './lei_decreto_7845.html',
  './lei_delitos_informaticos.html',
  './lei_estatais_13303.html',
  './lei_etica_1171.html',
  './lei_governanca_9203.html',
  './lei_in05.html',
  './lei_in94.html',
  './lei_lai.html',
  './lei_lgpd.html',
  './lei_licitacoes_14133.html',
  './lei_marco_civil.html',

  // Metadados PWA e Ícones
  './manifest.webmanifest',
  './manifest.json',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Instalação do Service Worker: pré-armazena todo o acervo
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Pré-cache individual falhou para:', asset, err);
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

// Interceptação de requisições: Network-First com Fallback Offline imediato
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const isHtml = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Sem conexão de rede: busca instantaneamente no cache local
          const cached = await caches.match(req);
          if (cached) return cached;

          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;

          return new Response('Você está offline e esta página não foi armazenada anteriormente.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Demais recursos: Stale-While-Revalidate
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
