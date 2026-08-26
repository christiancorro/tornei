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
import { proxy, fetchOrigin, finalizeProxy } from './proxy.js';
import { getTorneo } from './firebase.js';
import { buildPreview, applyPreview } from './preview.js';

/* Gli slug prodotti da slugify() in src/services/tournaments.js
   sono minuscoli, alfanumerici e separati da trattini. Accetto
   anche maiuscole e underscore per non lasciare fuori i vecchi
   ID auto-generati di Firestore, che potrebbero girare ancora
   in qualche link condiviso prima della migrazione.

   Quello che conta è cosa NON passa: `/`, `.`, `%`, `?`, spazi,
   caratteri di controllo. Uno slug che non supera questo
   controllo non genera nessuna richiesta a Firestore. */
export const SLUG_VALIDO = /^[A-Za-z0-9_-]{1,120}$/;

/* Il sito è una SPA servita su `/`: la navigazione avviene per
   query string, non per path (vedi gli effect di deep link in
   src/app.jsx). Quindi il documento è solo questo. */
const PATH_DOCUMENTO = new Set(['/', '/index.html']);

export function leggiSlug(url) {
  const raw = url.searchParams.get('torneo');
  if (!raw) return null;                    // assente o stringa vuota
  const slug = raw.trim();
  if (!SLUG_VALIDO.test(slug)) return null; // parametro malformato: ignorato
  return slug;
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
  if (!PATH_DOCUMENTO.has(url.pathname)) return false;
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

function chiaveCache(env, slug) {
  const base = String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
  return new Request(`${base}/__og-cache/${encodeURIComponent(slug)}`, { method: 'GET' });
}

function ttl(env) {
  const n = Number(env.PREVIEW_TTL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
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

async function gestisciPreview(request, env, ctx, slug) {
  const cache = caches.default;
  const key = chiaveCache(env, slug);

  const inCache = await cache.match(key);
  if (inCache) {
    const html = await inCache.text();
    const res = rispostaHtml(html, ttl(env), 'preview-cache', false);
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers: res.headers })
      : res;
  }

  /* Le due letture non dipendono l'una dall'altra: partono
     insieme e la preview costa il tempo della più lenta, non
     della somma. */
  const [originRes, torneo] = await Promise.all([
    fetchOrigin(request, env),
    getTorneo(slug, env),
  ]);

  const tipo = originRes.headers.get('content-type') || '';
  /* Origin non-200, redirect, o qualcosa che non è HTML: non c'è
     niente in cui iniettare. Torna al comportamento proxy puro,
     che sa già gestire redirect e ping-pong. */
  if (originRes.status !== 200 || !tipo.includes('text/html')) {
    return finalizeProxy(originRes, request, env, 'preview-passthrough');
  }

  /* Torneo inesistente, non pubblicato, oppure Firestore non ha
     risposto in tempo: consegno l'HTML di GitHub Pages così
     com'è. Il visitatore vede il sito, il crawler vede i meta tag
     generici del sito. Mai un 5xx per colpa di una preview. */
  if (!torneo) {
    return finalizeProxy(originRes, request, env, 'preview-generica');
  }

  const preview = buildPreview(torneo, slug, env);
  const html = await applyPreview(originRes, preview).text();

  ctx.waitUntil(cache.put(key, rispostaHtml(html, ttl(env), 'preview', true)));

  const res = rispostaHtml(html, ttl(env), 'preview', false);
  return request.method === 'HEAD'
    ? new Response(null, { status: 200, headers: res.headers })
    : res;
}

async function gestisci(request, env, ctx) {
  const www = redirectWww(request, env);
  if (www) return www;

  const url = new URL(request.url);
  if (!eRichiestaDocumento(request, url)) return proxy(request, env);

  const slug = leggiSlug(url);
  if (!slug) return proxy(request, env);

  return gestisciPreview(request, env, ctx, slug);
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
