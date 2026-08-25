/* Service worker di volleyFVG.

   Obiettivo: rendere il sito installabile come app (PWA) e dargli un
   minimo di funzionamento offline, SENZA rischiare di servire dati
   vecchi. Per questo:
   • le NAVIGAZIONI usano "network-first" con fallback alla shell
     salvata (così offline si apre comunque l'app);
   • gli ASSET statici di Vite (JS/CSS/immagini, con nome hashato)
     usano "cache-first": una volta scaricati restano disponibili
     offline, e a ogni deploy cambiano nome quindi non c'è rischio di
     versioni obsolete;
   • tutto ciò che è cross-origin (Firebase/Firestore, Mapbox, Google
     Fonts, geocoder) NON viene intercettato: passa sempre alla rete,
     così i dati sono sempre freschi.

   Per forzare l'aggiornamento della cache in futuro basta cambiare
   VERSION. */
const VERSION = 'v1';
const SHELL_CACHE = `vfvg-shell-${VERSION}`;
const ASSET_CACHE = `vfvg-assets-${VERSION}`;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled: se uno dei due non è raggiungibile l'install non
      // fallisce (la shell si ripara comunque alla prima navigazione).
      await Promise.allSettled([
        cache.add(SHELL_URL),
        cache.add('/manifest.webmanifest'),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigazioni (apertura/refresh della pagina): network-first.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(SHELL_URL, res.clone());
          return res;
        } catch (err) {
          const cached = await caches.match(SHELL_URL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Asset statici di stessa origine: cache-first (nomi hashati da Vite).
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })(),
    );
    return;
  }

  // Cross-origin (Firebase, Mapbox, font, geocoder): niente cache,
  // lascio passare la richiesta normalmente.
});
