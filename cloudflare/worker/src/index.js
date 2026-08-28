/* ---------------------------------------------------------
   volleyfvg.it — preview social dinamiche.

   Il Worker sta davanti a GitHub Pages e fa due cose sole:

   1. inoltra tutto a GitHub Pages, senza toccare niente;
   2. quando la richiesta è la pagina del sito CON il parametro
      ?torneo=<slug>, legge quel torneo da Firestore e riscrive
      i meta tag social dentro l'HTML vero prima di consegnarlo.

   Non c'è un ramo "pagina per i crawler". C'è una pagina sola,
   quella di sempre, con i tag giusti in testa. Vedi preview.js
   per il perché.

   Nessun secret: Firestore è leggibile in anonimo sui tornei
   pubblicati (vedi firebase.js).
--------------------------------------------------------- */
import { proxy, fetchOrigin, fetchOriginIndex, finalizeProxy } from './proxy.js';
import { getTorneo, listTornei } from './firebase.js';
import { buildPreview, applyPreview } from './preview.js';
import { oggiRoma } from './format.js';
import {
  bloccoTorneo,
  bloccoLista,
  bloccoNonTrovato,
  jsonLdTorneo,
  jsonLdLista,
  tagJsonLd,
  sitemapXml,
  urlTorneo,
  scomponiLuogo,
} from './contenuto.js';

/* Gli slug prodotti da slugify() in src/services/tournaments.js
   sono minuscoli, alfanumerici e separati da trattini. Accetto
   anche maiuscole e underscore per non lasciare fuori i vecchi
   ID auto-generati di Firestore, che potrebbero girare ancora
   in qualche link condiviso prima della migrazione.

   Quello che conta è cosa NON passa: `/`, `.`, `%`, `?`, spazi,
   caratteri di controllo. Uno slug che non supera questo
   controllo non genera nessuna richiesta a Firestore. */
export const SLUG_VALIDO = /^[A-Za-z0-9_-]{1,120}$/;

/* La home. Il resto del sito è una SPA: qualunque altro path che
   non sia /torneo/<slug> è un file vero (asset, icone, sw.js) e
   passa dal proxy senza essere toccato. */
const PATH_DOCUMENTO = new Set(['/', '/index.html']);

/* /torneo/<slug>. Lo slug ha lo stesso vincolo di prima, quindi
   un path malformato non genera nessuna richiesta a Firestore. */
const PATH_TORNEO = /^\/torneo\/([^/]+)\/?$/;

/* Lo slug dal vecchio formato ?torneo=<slug>. Non lo serviamo
   più: lo usiamo per costruire il 301 verso il path nuovo. */
export function leggiSlug(url) {
  const raw = url.searchParams.get('torneo');
  if (!raw) return null;                    // assente o stringa vuota
  const slug = raw.trim();
  if (!SLUG_VALIDO.test(slug)) return null; // parametro malformato: ignorato
  return slug;
}

/* Lo slug dal path. Stesso controllo, stessa promessa: quello che
   non passa di qui non arriva a Firestore. */
export function leggiSlugPath(url) {
  const m = PATH_TORNEO.exec(url.pathname);
  if (!m) return null;
  let slug;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null; // percent-encoding rotto
  }
  return SLUG_VALIDO.test(slug) ? slug : null;
}

/* Vale la pena costruire una preview per questa richiesta?

   Sec-Fetch-Dest lo mandano tutti i browser moderni e lo
   mandano corretto: se c'è e NON dice "document", siamo dentro
   una fetch() del bundle o un prefetch, non una navigazione, e
   non serve toccare niente. Se manca — vecchi browser, crawler,
   curl — non deduco nulla e procedo: costa una lettura in cache
   e il risultato è comunque la pagina giusta. */
export function eRichiestaDocumento(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (!PATH_DOCUMENTO.has(url.pathname) && !PATH_TORNEO.test(url.pathname)) return false;
  const dest = request.headers.get('sec-fetch-dest');
  if (dest && dest !== 'document') return false;
  return true;
}

/* GitHub Pages oggi risponde a www.volleyfvg.it con un 301 verso
   il dominio nudo. Lo rifaccio qui perché il comportamento
   pubblico resti identico a prima del Worker: stesso status,
   stesso path, stessa query. */
function redirectWww(request, env) {
  const canonico = String(env.CANONICAL_HOST || '').trim();
  if (!canonico) return null;
  const url = new URL(request.url);
  if (url.hostname !== `www.${canonico}`) return null;
  url.hostname = canonico;
  url.protocol = 'https:';
  url.port = '';
  return Response.redirect(url.toString(), 301);
}

/* Chiave sintetica, non la Request in arrivo: così la stessa
   pagina non finisce in cache una volta per ogni combinazione di
   query string e header con cui qualcuno la chiede. */
function chiaveCache(env, nome) {
  const base = String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
  return new Request(`${base}/__og-cache/${encodeURIComponent(nome)}`, { method: 'GET' });
}

function ttl(env) {
  const n = Number(env.PREVIEW_TTL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

/* La home e la sitemap costano una query che legge OGNI torneo
   futuro, e Firestore fattura a documento letto. A 5 minuti di
   TTL, moltiplicati per i data center Cloudflare che servono
   l'Italia, ci si avvicina alle 50.000 letture al giorno del
   piano gratuito; a 15 si sta sotto le 10.000. Un torneo appena
   approvato compare comunque entro un quarto d'ora — e chi ha il
   sito aperto lo vede subito, perché React legge Firestore in
   diretta e non da qui. */
function ttlLista(env) {
  const n = Number(env.LIST_TTL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 900;
}

/* La stessa stringa HTML serve due volte: una al visitatore e
   una alla cache. Le costruisco separate invece di clonare, così
   nessuno dei due stream può restare bloccato dall'altro. */
function rispostaHtml(html, secondi, tag, perCache) {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      /* s-maxage governa il bordo Cloudflare; max-age=0 tiene i
         browser fuori dai giochi, così un deploy del frontend non
         resta invisibile a chi ha già aperto il sito. */
      'cache-control': perCache
        ? `public, s-maxage=${secondi}`
        : `public, max-age=0, s-maxage=${secondi}, must-revalidate`,
      'x-vfvg-worker': tag,
    },
  });
}

async function gestisciTorneo(request, env, ctx, slug) {
  const cache = caches.default;
  const key = chiaveCache(env, `torneo/${slug}`);

  const inCache = await cache.match(key);
  if (inCache) {
    const html = await inCache.text();
    const res = rispostaHtml(html, ttl(env), 'torneo-cache', false);
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers: res.headers })
      : res;
  }

  /* Le due letture non dipendono l'una dall'altra: partono
     insieme e la pagina costa il tempo della più lenta, non
     della somma. */
  const [originRes, torneo] = await Promise.all([
    fetchOriginIndex(request, env),
    getTorneo(slug, env),
  ]);

  const tipo = originRes.headers.get('content-type') || '';
  /* Origin non-200, redirect, o qualcosa che non è HTML: non c'è
     niente in cui iniettare. Torna al comportamento proxy puro,
     che sa già gestire redirect e ping-pong. */
  if (originRes.status !== 200 || !tipo.includes('text/html')) {
    return finalizeProxy(originRes, request, env, 'torneo-passthrough');
  }

  /* Torneo inesistente, non pubblicato, oppure Firestore non ha
     risposto in tempo.

     Qui c'è una differenza rispetto a prima. Con ?torneo= la
     risposta giusta era la home: il parametro era un dettaglio
     dell'URL della home. Ora /torneo/<slug> è una pagina a sé,
     e una pagina che non esiste deve dirlo con un 404 — è così
     che un torneo cancellato esce dall'indice invece di restarci
     come doppione della home.

     Ma solo se è davvero assente: se Firestore ha avuto un
     problema, un 404 cancellerebbe dall'indice tornei validi.
     Non sappiamo distinguere i due casi (getTorneo restituisce
     null per entrambi), quindi la cache di questa risposta dura
     poco e il TTL breve la fa riprovare presto. */
  if (!torneo) {
    const preview = buildPreview({}, slug, env);
    preview.title = 'Torneo non trovato';
    preview.description = 'Questo torneo non è più in programma.';
    const html = await applyPreview(originRes, preview, {
      body: bloccoNonTrovato(env),
    }).text();
    const res = new Response(request.method === 'HEAD' ? null : html, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'x-vfvg-worker': 'torneo-404',
      },
    });
    return res;
  }

  const preview = buildPreview(torneo, slug, env);
  const html = await applyPreview(originRes, preview, {
    body: bloccoTorneo(torneo, slug, env),
    ldTag: tagJsonLd(jsonLdTorneo(torneo, slug, env)),
  }).text();

  ctx.waitUntil(cache.put(key, rispostaHtml(html, ttl(env), 'torneo', true)));

  const res = rispostaHtml(html, ttl(env), 'torneo', false);
  return request.method === 'HEAD'
    ? new Response(null, { status: 200, headers: res.headers })
    : res;
}

/* ---------------------------------------------------------
   La home.

   È la pagina che risponde a "quali tornei ci sono la prossima
   settimana in Friuli": l'unica che, con una richiesta sola,
   consegna l'elenco completo con date e luoghi. Se Firestore non
   risponde la lista è vuota e la home torna quella di sempre —
   mai un errore per colpa di questa aggiunta.
--------------------------------------------------------- */
async function gestisciHome(request, env, ctx) {
  const cache = caches.default;
  const key = chiaveCache(env, 'home');

  const inCache = await cache.match(key);
  if (inCache) {
    const html = await inCache.text();
    const res = rispostaHtml(html, ttlLista(env), 'home-cache', false);
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers: res.headers })
      : res;
  }

  const oggi = oggiRoma();
  const [originRes, tornei] = await Promise.all([
    fetchOrigin(request, env),
    listTornei(env, oggi, 300),
  ]);

  const tipo = originRes.headers.get('content-type') || '';
  if (originRes.status !== 200 || !tipo.includes('text/html')) {
    return finalizeProxy(originRes, request, env, 'home-passthrough');
  }
  if (!tornei.length) {
    // Nessun torneo, o Firestore muto: la home di sempre.
    return finalizeProxy(originRes, request, env, 'home-generica');
  }

  /* preview = null: la home tiene il <title> e la description di
     index.html. Non è pigrizia, è la scelta giusta — quel titolo
     dice "Tornei di Green Volley, Beach Volley e Pallavolo in
     Friuli Venezia Giulia", cioè esattamente la domanda a cui
     vogliamo rispondere. Sostituirlo col nome del sito butterebbe
     via il segnale on-page più forte che c'è. */
  const html = await applyPreview(originRes, null, {
    body: bloccoLista(tornei, env, oggi),
    ldTag: tagJsonLd(jsonLdLista(tornei, env)),
    canonical: `${String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '')}/`,
  }).text();

  ctx.waitUntil(cache.put(key, rispostaHtml(html, ttlLista(env), 'home', true)));

  const res = rispostaHtml(html, ttlLista(env), 'home', false);
  return request.method === 'HEAD'
    ? new Response(null, { status: 200, headers: res.headers })
    : res;
}

/* ---------------------------------------------------------
   sitemap.xml e il feed JSON.

   La sitemap la generiamo qui e non più a build time: un torneo
   approvato di sera entrava in sitemap solo al deploy successivo.
   Ricordati di togliere generate_sitemap.mjs dallo script di
   build, altrimenti restano due sitemap che dicono cose diverse
   (quella statica su GitHub Pages non viene più servita, perché
   questa la intercetta prima — ma tenerla è solo confusione).
--------------------------------------------------------- */
async function gestisciSitemap(request, env, ctx) {
  const cache = caches.default;
  const key = chiaveCache(env, 'sitemap');
  const inCache = await cache.match(key);
  if (inCache) return inCache;

  const oggi = oggiRoma();
  // Anche i tornei passati: restano URL validi e indicizzati.
  const tornei = await listTornei(env, '2000-01-01', 1000);
  if (!tornei.length) return proxy(request, env); // ripiego sulla statica

  const xml = sitemapXml(tornei, env, oggi);
  const headers = {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': `public, max-age=0, s-maxage=${ttlLista(env)}, must-revalidate`,
    'x-vfvg-worker': 'sitemap',
  };
  ctx.waitUntil(cache.put(key, new Response(xml, {
    headers: { ...headers, 'cache-control': `public, s-maxage=${ttlLista(env)}` },
  })));
  return new Response(request.method === 'HEAD' ? null : xml, { headers });
}

async function gestisciFeed(request, env, ctx) {
  const cache = caches.default;
  const key = chiaveCache(env, 'feed');
  const inCache = await cache.match(key);
  if (inCache) return inCache;

  const oggi = oggiRoma();
  const tornei = await listTornei(env, oggi, 500);

  const dati = tornei.map((t) => {
    const L = scomponiLuogo(t);
    return {
      id: t.id,
      nome: t.nome,
      url: urlTorneo(t.id, env),
      disciplina: t.disciplina || null,
      formati: t.formati || [],
      modalita: t.modalita || null,
      dataInizio: t.data,
      dataFine: t.dataFine || t.data,
      ora: t.ora || null,
      luogo: L.nome || L.raw || null,
      provincia: L.prov || null,
      regione: L.regione,
      paese: 'IT',
      lat: Number.isFinite(Number(t.lat)) ? Number(t.lat) : null,
      lng: Number.isFinite(Number(t.lng)) ? Number(t.lng) : null,
      costo: t.costo || null,
      organizzatore: t.organizzatore || null,
      locandina: t.locandina || null,
    };
  });

  const json = JSON.stringify({
    aggiornato: new Date().toISOString(),
    fonte: `${String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '')}/`,
    totale: dati.length,
    tornei: dati,
  }, null, 2);

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': `public, max-age=0, s-maxage=${ttlLista(env)}, must-revalidate`,
    'x-vfvg-worker': 'feed',
  };
  ctx.waitUntil(cache.put(key, new Response(json, {
    headers: { ...headers, 'cache-control': `public, s-maxage=${ttlLista(env)}` },
  })));
  return new Response(request.method === 'HEAD' ? null : json, { headers });
}

async function gestisci(request, env, ctx) {
  const www = redirectWww(request, env);
  if (www) return www;

  const url = new URL(request.url);
  const leggibile = request.method === 'GET' || request.method === 'HEAD';

  /* I vecchi link ?torneo=<slug> passano il testimone ai nuovi.
     301 e non 302: è un trasloco definitivo, ed è il 301 a
     spostare sul nuovo URL il valore dei link già esistenti e
     delle pagine già indicizzate. */
  if (leggibile && PATH_DOCUMENTO.has(url.pathname)) {
    const vecchio = leggiSlug(url);
    if (vecchio) {
      return new Response(null, {
        status: 301,
        headers: {
          location: urlTorneo(vecchio, env),
          'cache-control': 'public, max-age=86400',
          'x-vfvg-worker': 'redirect-slug',
        },
      });
    }
  }

  if (leggibile && url.pathname === '/sitemap.xml') {
    return gestisciSitemap(request, env, ctx);
  }

  if (leggibile && url.pathname === '/api/tornei.json') {
    return gestisciFeed(request, env, ctx);
  }

  if (!eRichiestaDocumento(request, url)) return proxy(request, env);

  const slug = leggiSlugPath(url);
  if (slug) return gestisciTorneo(request, env, ctx, slug);

  /* La lista va solo su `/`, non su `/index.html`.

     Il motivo è il service worker: in fase di install mette in
     cache /index.html come shell, e quella copia resta lì finché
     non cambia versione del SW. Se ci iniettassimo la tabella dei
     tornei, ogni utente si porterebbe dietro per mesi un elenco
     congelato al giorno dell'installazione. React lo cancella
     comunque al mount, quindi non si romperebbe niente — ma è
     peso inutile in cache, e la shell è più pulita senza.

     /index.html non lo cerca nessun crawler (non è linkato da
     nessuna parte e non è in sitemap), quindi non perdiamo
     niente lato indicizzazione. */
  if (url.pathname === '/') return gestisciHome(request, env, ctx);
  if (url.pathname === '/index.html') return proxy(request, env);

  /* /torneo/<qualcosa di malformato>: niente Firestore, niente
     pagina inventata. Il proxy risponderà con il 404 dell'origin. */
  return proxy(request, env);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await gestisci(request, env, ctx);
    } catch (err) {
      /* Rete di sicurezza finale. Qualunque cosa sia andata storta
         nel ramo preview, il sito deve restare in piedi: si riparte
         da zero con un proxy semplice. Se fallisce anche quello
         l'origin è davvero irraggiungibile e il 502 è onesto. */
      try {
        return await proxy(request, env);
      } catch (err2) {
        return new Response('Sito temporaneamente non raggiungibile.', {
          status: 502,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
            'x-vfvg-worker': 'origin-down',
          },
        });
      }
    }
  },
};
