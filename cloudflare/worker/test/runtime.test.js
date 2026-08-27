/* ---------------------------------------------------------
   Test del Worker dentro il runtime vero (workerd, via
   Miniflare): HTMLRewriter, cache, proxy, redirect.

     npm run test:runtime

   L'origin GitHub Pages e Firestore sono finti — `outboundService`
   intercetta ogni fetch in uscita — cosi' i test girano offline,
   in fretta e con dati prevedibili. Quello che NON e' finto e' il
   runtime: HTMLRewriter e caches.default sono quelli di Cloudflare.
--------------------------------------------------------- */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const VARS = {
  ORIGIN: 'https://christiancorro.github.io/tornei',
  SITE_URL: 'https://volleyfvg.it',
  SITE_NAME: 'Tornei Volley FVG',
  CANONICAL_HOST: 'volleyfvg.it',
  FIREBASE_PROJECT_ID: 'volleyfvg-6ad3e',
  FIRESTORE_COLLECTION: 'tornei',
  PREVIEW_TTL: '300',
  FALLBACK_IMAGE: 'https://volleyfvg.it/icons/icon512.png',
  FALLBACK_IMAGE_WIDTH: '512',
  FALLBACK_IMAGE_HEIGHT: '512',
  FALLBACK_DESCRIPTION: 'Tornei di green volley, beach volley e pallavolo in Friuli-Venezia Giulia e dintorni.',
};

/* L'index.html vero del sito, ridotto ai tag che contano. */
const INDEX_HTML = `<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <title>Tornei di green volley, beach volley e pallavolo in FVG e dintorni</title>
  <meta name="description" content="Trova tornei di green volley, beach volley e pallavolo in Friuli-Venezia Giulia." />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Tornei Volley FVG" />
  <meta property="og:title" content="Tornei Volley FVG" />
  <meta property="og:description" content="Trova tornei di beach volley, green volley e volley." />
  <meta property="og:locale" content="it_IT" />
  <meta property="og:image" content="/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Tornei Volley FVG" />
  <meta name="twitter:image" content="/og-image.png" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index-a1b2c3.js"></script>
</body>
</html>`;

const LOCANDINA =
  'https://firebasestorage.googleapis.com/v0/b/volleyfvg-6ad3e.firebasestorage.app/o/locandine%2F178714.webp?alt=media&token=6c903180-3b4a';

const TORNEI = {
  '1-madonna-del-bembo-6-set-2026': {
    nome: { stringValue: '1° Madonna del Bembo' },
    data: { stringValue: '2026-09-06' },
    ora: { stringValue: '09:00' },
    comune: { stringValue: 'Azzano Decimo (PN)' },
    locandina: { stringValue: LOCANDINA },
    status: { stringValue: 'published' },
  },
  'torneo-in-bozza-1-set-2026': {
    nome: { stringValue: 'Bozza segreta' },
    data: { stringValue: '2026-09-01' },
    comune: { stringValue: 'Udine' },
    status: { stringValue: 'pending' },
  },
  'torneo-senza-locandina-2-set-2026': {
    nome: { stringValue: 'Torneo spartano' },
    data: { stringValue: '2026-09-02' },
    comune: { stringValue: 'Gorizia' },
    status: { stringValue: 'published' },
  },
};

/* Stato manovrabile dai test: quante volte e' stato interrogato
   Firestore, e se l'origin deve fingere il redirect del custom
   domain ancora impostato. */
const spia = { firestore: 0, origin: 0, originRimanda: false, firestoreRotto: false };

function fintoFirestore(url) {
  spia.firestore += 1;
  if (spia.firestoreRotto) return new Response('boom', { status: 500 });
  const slug = decodeURIComponent(url.pathname.split('/').pop());
  const doc = TORNEI[slug];
  if (!doc) {
    return new Response(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND' } }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  // Rispetto la field mask: rispondo solo i campi richiesti.
  const richiesti = url.searchParams.getAll('mask.fieldPaths');
  const fields = {};
  for (const k of richiesti) if (doc[k] !== undefined) fields[k] = doc[k];
  return new Response(JSON.stringify({ name: `projects/x/documents/tornei/${slug}`, fields }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function fintoGithub(url) {
  spia.origin += 1;
  if (spia.originRimanda) {
    return new Response(null, { status: 302, headers: { location: 'http://volleyfvg.it/' } });
  }
  if (!url.pathname.startsWith('/tornei')) {
    return new Response('not found', { status: 404 });
  }
  const path = url.pathname.slice('/tornei'.length) || '/';
  if (path === '/' || path === '/index.html') {
    return new Response(INDEX_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (path.startsWith('/assets/')) {
    return new Response('console.log(1)', {
      status: 200,
      headers: { 'content-type': 'application/javascript', 'x-origin-path': path },
    });
  }
  if (path === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new Response('404', { status: 404, headers: { 'content-type': 'text/html' } });
}

let mf;

before(async () => {
  mf = new Miniflare({
    modules: true,
    /* Senza questa regola Miniflare tratterebbe i .js come CommonJS
       e si fermerebbe al primo `import`. Wrangler non ne ha bisogno
       perche' passa da esbuild. */
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    scriptPath: join(SRC, 'index.js'),
    modulesRoot: SRC,
    compatibilityDate: '2026-08-01',
    cache: true,
    bindings: VARS,
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === 'firestore.googleapis.com') return fintoFirestore(url);
      if (url.hostname === 'christiancorro.github.io') return fintoGithub(url);
      return new Response('origin inatteso: ' + url.href, { status: 500 });
    },
  });
  await mf.ready;
});

after(async () => { await mf?.dispose(); });

function get(href, headers = {}) {
  return mf.dispatchFetch(href, { headers });
}

function meta(html, chiave) {
  const re = new RegExp(
    `<meta\\s+(?:property|name)="${chiave.replace(/[:]/g, ':')}"\\s+content="([^"]*)"`,
    'i',
  );
  const m = re.exec(html);
  return m ? m[1] : null;
}

function titolo(html) {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1] : null;
}

/* ============ 1. GET / ============ */

test('GET / passa dritto a GitHub Pages, senza modifiche', async () => {
  const res = await get('https://volleyfvg.it/');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('x-vfvg-worker'), 'proxy');
  assert.equal(meta(html, 'og:title'), 'Tornei Volley FVG');
  assert.ok(html.includes('<div id="root"></div>'), "l'app React e' intatta");
});

/* ============ 2. GET /?torneo=VALIDO ============ */

test('GET /?torneo=<valido> inietta i meta tag del torneo', async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);

  assert.equal(titolo(html), '1° Madonna del Bembo');
  assert.equal(meta(html, 'og:title'), '1° Madonna del Bembo');
  assert.equal(
    meta(html, 'og:description'),
    'domenica 6 settembre 2026, ore 09:00 · Azzano Decimo (PN)',
  );
  assert.equal(meta(html, 'og:image'), LOCANDINA.replace(/&/g, '&amp;'));
  assert.equal(
    meta(html, 'og:url'),
    'https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026',
  );
  assert.equal(meta(html, 'og:type'), 'website');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(html, 'twitter:title'), '1° Madonna del Bembo');
  assert.equal(meta(html, 'twitter:image'), LOCANDINA.replace(/&/g, '&amp;'));

  assert.ok(html.includes('<link rel="canonical" href="https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026">'));
});

test('i vecchi tag generici vengono rimossi, non duplicati', async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
  const html = await res.text();
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal((html.match(/property="og:image"/g) || []).length, 1);
  assert.equal((html.match(/name="twitter:image"/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.ok(!html.includes('/og-image.png'), "l'og:image relativo e' sparito");
});

test("l'applicazione React resta intatta sotto i meta tag", async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
  const html = await res.text();
  assert.ok(html.includes('<div id="root"></div>'));
  assert.ok(html.includes('/assets/index-a1b2c3.js'));
  assert.ok(html.includes('rel="manifest"'));
});

/* ============ 3. torneo inesistente ============ */

test('torneo inesistente: 200 con la pagina normale, mai un 5xx', async () => {
  const res = await get('https://volleyfvg.it/?torneo=questo-non-esiste-1-gen-2020');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-vfvg-worker'), 'preview-generica');
  assert.equal(meta(html, 'og:title'), 'Tornei Volley FVG');
});

test('torneo non pubblicato: nessuna preview, nessuna fuga di dati', async () => {
  const res = await get('https://volleyfvg.it/?torneo=torneo-in-bozza-1-set-2026');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes('Bozza segreta'), 'una bozza non deve comparire da nessuna parte');
  assert.equal(meta(html, 'og:title'), 'Tornei Volley FVG');
});

/* ============ 4. parametro vuoto / non valido ============ */

test('?torneo= vuoto non interroga Firestore', async () => {
  const prima = spia.firestore;
  const res = await get('https://volleyfvg.it/?torneo=');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-vfvg-worker'), 'proxy');
  assert.equal(spia.firestore, prima, 'nessuna query partita');
});

test('slug malformato non interroga Firestore', async () => {
  const prima = spia.firestore;
  for (const cattivo of ['../../users/abc', 'a b', '<script>', 'x'.repeat(200)]) {
    const res = await get(`https://volleyfvg.it/?torneo=${encodeURIComponent(cattivo)}`);
    assert.equal(res.status, 200, cattivo);
  }
  assert.equal(spia.firestore, prima, 'nessuna query partita');
});

/* ============ 5-6. crawler vs browser ============ */

const UA_CRAWLER = [
  'WhatsApp/2.23.20.0 A',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'TelegramBot (like TwitterBot)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'CrawlerCheMiSonoInventato/9.9',
];

for (const ua of UA_CRAWLER) {
  test(`crawler "${ua.slice(0, 28)}" riceve i meta tag del torneo`, async () => {
    const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026', {
      'user-agent': ua,
    });
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.equal(meta(html, 'og:title'), '1° Madonna del Bembo');
    assert.equal(meta(html, 'og:image'), LOCANDINA.replace(/&/g, '&amp;'));
  });
}

test('un browser normale riceve gli stessi tag E il sito completo', async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026', {
    'user-agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
  });
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(meta(html, 'og:title'), '1° Madonna del Bembo');
  assert.ok(html.includes('<div id="root"></div>'), 'il browser riceve comunque la SPA');
  assert.ok(html.includes('/assets/index-a1b2c3.js'));
});

test('una fetch() del bundle non fa lavorare il Worker per niente', async () => {
  const prima = spia.firestore;
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026', {
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-vfvg-worker'), 'proxy');
  assert.equal(spia.firestore, prima);
});

/* ============ 7. asset e query string ============ */

test('gli asset della SPA vengono inoltrati con il prefisso del repository', async () => {
  const res = await get('https://volleyfvg.it/assets/index-a1b2c3.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.equal(res.headers.get('x-origin-path'), '/assets/index-a1b2c3.js');
});

test('robots.txt e gli altri file di public/ passano', async () => {
  const res = await get('https://volleyfvg.it/robots.txt');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /User-agent/);
});

test('la query string arriva intatta all origin', async () => {
  const res = await get('https://volleyfvg.it/assets/x.js?v=42&a=b');
  assert.equal(res.headers.get('x-origin-path'), '/assets/x.js');
  assert.equal(res.status, 200);
});

/* ============ 8. cache ============ */

test('la seconda richiesta identica non ritocca Firestore', async () => {
  const url = 'https://volleyfvg.it/?torneo=torneo-senza-locandina-2-set-2026';
  await get(url);                      // riempie la cache
  const dopoPrima = spia.firestore;
  const res = await get(url);          // deve pescare dalla cache
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(spia.firestore, dopoPrima, 'Firestore interrogato una volta sola');
  assert.equal(res.headers.get('x-vfvg-worker'), 'preview-cache');
  assert.equal(meta(html, 'og:title'), 'Torneo spartano');
});

test('il Cache-Control tiene il bordo caldo e i browser fuori', async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
  const cc = res.headers.get('cache-control');
  assert.match(cc, /s-maxage=300/);
  assert.match(cc, /max-age=0/);
  assert.match(cc, /must-revalidate/);
});

/* ============ fallback immagine e descrizione ============ */

test('torneo senza locandina: immagine di fallback con le sue dimensioni', async () => {
  const res = await get('https://volleyfvg.it/?torneo=torneo-senza-locandina-2-set-2026');
  const html = await res.text();
  assert.equal(meta(html, 'og:image'), VARS.FALLBACK_IMAGE);
  assert.equal(meta(html, 'og:image:width'), '512');
  assert.equal(meta(html, 'og:image:height'), '512');
  assert.equal(meta(html, 'og:description'), 'mercoledì 2 settembre 2026 · Gorizia');
});

test('con la locandina non vengono dichiarate dimensioni inventate', async () => {
  const res = await get('https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026');
  const html = await res.text();
  assert.equal(meta(html, 'og:image:width'), null);
  assert.equal(meta(html, 'og:image:height'), null);
});

/* ============ 9. www ============ */

test('www.volleyfvg.it fa 301 sul dominio nudo, come oggi', async () => {
  /* redirect:'manual' o dispatchFetch seguirebbe il 301 e finirebbe
     sulla rete vera, che qui non esiste. */
  const res = await mf.dispatchFetch(
    'https://www.volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026',
    { redirect: 'manual' },
  );
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get('location'),
    'https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026',
  );
});

/* ============ 10. HEAD (curl -I) ============ */

test('HEAD /?torneo=<valido> risponde 200 senza body', async () => {
  const res = await mf.dispatchFetch(
    'https://volleyfvg.it/?torneo=1-madonna-del-bembo-6-set-2026',
    { method: 'HEAD' },
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(await res.text(), '');
});

/* ============ 11. Firebase giu' ============ */

test('se Firestore non risponde il sito continua a funzionare', async () => {
  spia.firestoreRotto = true;
  try {
    const res = await get('https://volleyfvg.it/?torneo=un-torneo-mai-visto-9-set-2026');
    const html = await res.text();
    assert.equal(res.status, 200, 'niente 5xx per colpa di un meta tag');
    assert.ok(html.includes('<div id="root"></div>'), "l'app React arriva lo stesso");
    assert.equal(meta(html, 'og:title'), 'Tornei Volley FVG');
  } finally {
    spia.firestoreRotto = false;
  }
});

/* ============ 12. custom domain non rimosso ============ */

test("se l'origin rimanda al dominio il Worker lo dice, invece di ciclare", async () => {
  spia.originRimanda = true;
  try {
    const res = await get('https://volleyfvg.it/');
    const testo = await res.text();
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('x-vfvg-worker'), 'origin-loop');
    assert.match(testo, /custom domain/i);
    assert.ok(!res.headers.get('location'), 'nessun redirect che rimbalzi');
  } finally {
    spia.originRimanda = false;
  }
});
