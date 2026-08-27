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

/* ---------------------------------------------------------
   NOTIFICHE PUSH

   Il service worker è l'unico pezzo di sito che il browser
   risveglia quando la pagina è chiusa: è qui, e solo qui, che una
   notifica può essere mostrata.

   Le Cloud Functions inviano messaggi di soli dati (niente blocco
   `notification`), così la notifica la disegniamo noi: icona,
   raggruppamento e link restano decisi dal sito invece che dal
   server. In cambio siamo obbligati a chiamare showNotification ad
   ogni push — se un push non mostrasse niente, Chrome ci metterebbe
   del suo un avviso generico tipo "questo sito è stato aggiornato
   in background".
--------------------------------------------------------- */

function datiNotifica(event) {
  if (!event.data) return {};

  try {
    const payload = event.data.json();
    // FCM impacchetta i dati sotto `data`; teniamo anche il caso
    // `notification` per un eventuale invio fatto in altro modo.
    return payload.data || payload.notification || payload;
  } catch (err) {
    // Payload non JSON: meglio una notifica scarna che nessuna.
    return { corpo: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const d = datiNotifica(event);

  const titolo = d.titolo || d.title || 'volleyFVG';
  const tag = d.tag || 'volleyfvg';

  const opzioni = {
    body: d.corpo || d.body || '',
    icon: '/icons/icon192.png',
    badge: '/icons/favicon48.png',
    tag,
    // Stesso tag = la notifica nuova sostituisce la vecchia (due
    // messaggi nella stessa conversazione non fanno due righe).
    // renotify vuole che il dispositivo avvisi comunque, se no la
    // sostituzione avverrebbe in silenzio.
    renotify: true,
    data: { url: d.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      /* Se il sito è già aperto da qualche parte lo riuso: portare
         a fuoco quella scheda e navigarla è meglio che aprirne una
         nuova ogni volta che arriva una notifica. */
      for (const finestra of finestre) {
        if (new URL(finestra.url).origin !== self.location.origin) continue;
        await finestra.focus();
        if ('navigate' in finestra) await finestra.navigate(url);
        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});