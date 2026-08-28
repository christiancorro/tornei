/* ---------------------------------------------------------
   Reverse proxy verso GitHub Pages.

   Regola numero uno: l'origin è SEMPRE l'URL github.io del
   progetto, mai volleyfvg.it. Puntare il Worker al dominio
   pubblico significherebbe farlo chiamare se stesso.

   Regola numero due: path e query string arrivano all'origin
   identici a come sono partiti dal browser. Gli asset di Vite,
   il manifest, le icone, robots.txt, sitemap.xml e il service
   worker passano di qui senza sapere che esiste un Worker.
--------------------------------------------------------- */

/* Header che non hanno senso da inoltrare: li rigenera il
   runtime, o si riferiscono alla connessione con Cloudflare e
   non a quella con GitHub. */
const HEADER_DA_TOGLIERE = [
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-host',
  'x-forwarded-proto',
];

export function originBase(env) {
  return String(env.ORIGIN || '').replace(/\/+$/, '');
}

/* URL dell'origin corrispondente alla richiesta in arrivo.
   `/assets/index-a1b2.js` su volleyfvg.it diventa
   `<ORIGIN>/assets/index-a1b2.js`: se ORIGIN contiene già il
   path del repository (project page), il prefisso ci finisce
   automaticamente. */
export function originUrl(request, env) {
  const url = new URL(request.url);
  return `${originBase(env)}${url.pathname}${url.search}`;
}

function headerInoltrabili(request) {
  const h = new Headers(request.headers);
  for (const nome of HEADER_DA_TOGLIERE) h.delete(nome);
  return h;
}

/* GitHub Pages fa dei redirect legittimi (tipicamente
   `/cartella` → `/cartella/`). Quelli vanno inoltrati, ma con
   la Location riscritta sul dominio pubblico: altrimenti il
   browser se ne andrebbe su christiancorro.github.io e
   uscirebbe dal sito. */
function riscriviLocation(location, env, request) {
  const base = originBase(env);
  if (!location) return location;
  try {
    const assoluta = new URL(location, base);
    const baseUrl = new URL(base);
    if (assoluta.origin !== baseUrl.origin) return location; // esterno: lascio stare
    const prefisso = baseUrl.pathname.replace(/\/+$/, '');
    let path = assoluta.pathname;
    if (prefisso && path.startsWith(prefisso)) path = path.slice(prefisso.length) || '/';
    const pubblico = new URL(request.url);
    return `${pubblico.origin}${path}${assoluta.search}${assoluta.hash}`;
  } catch {
    return location;
  }
}

/* Se l'origin ci rimanda al dominio pubblico vuol dire che su
   GitHub è ancora impostato il custom domain: in quel caso il
   Worker e GitHub si rimpallerebbero la richiesta all'infinito.
   Meglio un errore che lo dice a chiare lettere. */
function ePingPong(location, request) {
  if (!location) return false;
  try {
    const dest = new URL(location, request.url);
    const qui = new URL(request.url);
    return dest.hostname === qui.hostname;
  } catch {
    return false;
  }
}

const ERRORE_PINGPONG =
  'Configurazione incompleta.\n\n' +
  "L'origin GitHub Pages sta rispondendo con un redirect verso questo stesso\n" +
  'dominio: vuol dire che il custom domain è ancora impostato sul repository.\n\n' +
  'Rimuovilo da GitHub -> Settings -> Pages -> Custom domain, poi ricarica.\n' +
  'Dettagli in docs/social-preview.md.\n';

/* ---------------------------------------------------------
   fetchOrigin() — la richiesta grezza verso GitHub Pages.
   Serve sia al proxy sia al ramo preview, che ha bisogno
   dell'HTML per riscriverne la testa.
--------------------------------------------------------- */
export function fetchOrigin(request, env) {
  const metodo = request.method === 'HEAD' ? 'GET' : request.method;
  return fetch(originUrl(request, env), {
    method: metodo,
    headers: headerInoltrabili(request),
    redirect: 'manual',
    body: metodo === 'GET' ? undefined : request.body,
  });
}

/* ---------------------------------------------------------
   proxy() — comportamento di default per tutto ciò che non è
   una preview: asset, homepage senza parametro, 404, qualsiasi
   cosa. Deve essere indistinguibile da GitHub Pages diretto.
--------------------------------------------------------- */
export async function proxy(request, env) {
  const res = await fetchOrigin(request, env);
  return finalizeProxy(res, request, env);
}

/* Trasforma una risposta gia' ottenuta dall'origin nella risposta
   da restituire al visitatore. Sta a parte da proxy() perche' il
   ramo preview scarica l'HTML una volta sola e poi decide: se non
   e' HTML, o se l'origin ha risposto qualcosa di diverso da 200,
   ricade esattamente qui. */
export function finalizeProxy(res, request, env, tag = 'proxy') {
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (ePingPong(location, request)) {
      return new Response(ERRORE_PINGPONG, {
        status: 502,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-vfvg-worker': 'origin-loop',
        },
      });
    }
    const headers = new Headers(res.headers);
    if (location) headers.set('location', riscriviLocation(location, env, request));
    headers.set('x-vfvg-worker', tag);
    return new Response(null, { status: res.status, headers });
  }

  const headers = new Headers(res.headers);
  headers.set('x-vfvg-worker', tag);

  // Su HEAD il body non deve esserci: l'abbiamo chiesto in GET
  // perché GitHub Pages sia coerente sugli header.
  const body = request.method === 'HEAD' ? null : res.body;
  return new Response(body, { status: res.status, headers });
}

/* ---------------------------------------------------------
   fetchOriginIndex() — lo shell del sito, qualunque sia il path.

   Serve per /torneo/<slug>. GitHub Pages serve file veri: non ha
   le rewrite di una SPA, quindi a quel percorso risponderebbe
   404 e non ci sarebbe nessun HTML in cui iniettare. Chiediamo
   quindi esplicitamente /index.html e lo consegniamo sotto
   l'URL richiesto — che è poi quello che fa qualunque hosting
   con il fallback SPA configurato.
--------------------------------------------------------- */
export function fetchOriginIndex(request, env) {
  return fetch(`${originBase(env)}/index.html`, {
    method: 'GET',
    headers: headerInoltrabili(request),
    redirect: 'manual',
  });
}
