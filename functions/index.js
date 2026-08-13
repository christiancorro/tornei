/* ---------------------------------------------------------
   torneoOg — HTML "share preview" per la card di un torneo.

   Perché esiste: la SPA di default risponde a Telegram, WhatsApp,
   Facebook & co. con un index.html vuoto (i dati del torneo li carica
   il JS dopo). I loro crawler non eseguono JS, quindi non vedono
   titolo, descrizione, locandina — niente anteprima.

   Cosa fa: alla richiesta di /torneo/<id> legge il torneo da
   Firestore e restituisce SEMPRE una pagina con i meta Open Graph
   (title, description, image, url). Nella stessa pagina c'è un
   `<script>` che fa `window.location.replace('/?torneo=<id>')`:
   i browser reali eseguono JS e vengono reindirizzati alla SPA in
   pochi ms; i crawler (Telegram/Facebook/opengraph.xyz/...) non
   eseguono JS e leggono i meta.

   In precedenza distinguevo crawler da browser via user-agent, ma
   servizi come opengraph.xyz mandano UA neutri, cadevano nel "non
   riconosciuto", ricevevano il 302, seguivano fino alla SPA e
   leggevano i suoi meta di default. Ora invece funziona per tutti.
--------------------------------------------------------- */
/* firebase-functions v5: la vecchia API .region().https.onRequest(...)
   vive sotto /v1. Se importi il pacchetto liscio, `.region()` non esiste
   più al top level e il deploy fallisce con "codebase could not be
   analyzed successfully". */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();

/* Regex "browser reale": Mozilla/5.0 + almeno uno tra Chrome/Firefox/
   Safari/Edge, MA senza 'bot'/'crawl'/'spider'/'preview' (Facebook,
   Twitter, Slack, ecc. mettono "Mozilla" nell'UA per compatibilità
   ma includono anche il loro nome bot). Se matcha → è un umano e
   lo mando alla SPA con 302. Se NON matcha → serviamo OG HTML puro,
   niente redirect, così il crawler legge i meta senza andare oltre. */
const REAL_BROWSER_RE = /Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edge)/i;
const CRAWLER_TAG_RE = /bot|crawl|spider|slurp|preview|embed|meta-external|link.?preview|scraper|fetcher|monitor|check|whatsapp|telegram|facebook|twitter|linkedin|discord|slack|iframely|opengraph/i;

exports.torneoOg = functions
  .region('europe-west1') // stessa regione del progetto (regolare al bisogno)
  .https.onRequest(async (req, res) => {
    // path: /torneo/<id>  oppure  /torneo/<id>/
    const id = (req.path || '').replace(/^\/torneo\/?/, '').replace(/\/+$/, '');
    if (!id) {
      res.status(404).send('Torneo non specificato.');
      return;
    }

    const ua = req.get('user-agent') || '';
    const isRealBrowser = REAL_BROWSER_RE.test(ua) && !CRAWLER_TAG_RE.test(ua);

    try {
      const snap = await admin.firestore().collection('tornei').doc(id).get();
      if (!snap.exists) {
        res.status(404).send(paginaMinima('Torneo non trovato'));
        return;
      }

      const t = snap.data() || {};

      const titolo = t.nome || 'Torneo';
      const descRighe = [
        [t.disciplina, (t.formati || []).join(', ')].filter(Boolean).join(' · '),
        formatoData(t.data, t.dataFine),
        t.comune,
      ].filter(Boolean);
      const descrizione = descRighe.join(' · ');

      /* URL canonico del sito. Firebase Hosting, quando fa da proxy
         alla function, NON passa in modo affidabile il dominio originale
         nei headers (X-Forwarded-Host spesso non c'è, e req.get('host')
         restituisce l'URL interno di Cloud Functions). Preferisco quindi
         costruirlo dal project ID: `https://<PROJECT_ID>.web.app` è
         sempre valido. Se hai un dominio custom (o preferisci il suffisso
         .firebaseapp.com), impostalo via variabile d'ambiente:
           firebase functions:config:set site.url="https://tuodominio.it"
         oppure via .env di firebase-functions. */
      const projectId = process.env.GCLOUD_PROJECT
        || (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId);
      const siteUrl = process.env.SITE_URL
        || (projectId ? `https://${projectId}.web.app` : `${req.protocol}://${req.get('host')}`);
      const urlCanonico = `${siteUrl}/?torneo=${encodeURIComponent(id)}`;

      // Se è un browser reale, redirect immediato alla SPA — evita
      // qualsiasi pagina intermedia e mantiene la cronologia pulita.
      if (isRealBrowser) {
        res.redirect(302, urlCanonico);
        return;
      }

      // Altrimenti (crawler, servizi di preview, UA sconosciuti) servi
      // l'HTML con i meta OG e basta: nessun redirect, così anche gli
      // scraper che eseguono JavaScript si fermano sui meta corretti.
      const html = paginaOg({
        titolo,
        descrizione,
        immagine: t.locandina || '',
        url: urlCanonico,
      });

      // Cache lato CDN: i crawler ripassano più volte, non ha senso
      // rifare il fetch a Firestore ogni volta. Vary sull'user-agent
      // perché due UA diversi possono avere risposte diverse
      // (browser → 302, crawler → HTML).
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
      res.set('Vary', 'User-Agent');
      res.status(200).send(html);
    } catch (err) {
      console.error('[torneoOg] errore:', err);
      res.status(500).send(paginaMinima('Errore temporaneo'));
    }
  });

function formatoData(inizio, fine) {
  if (!inizio) return '';
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  const d1 = new Date(inizio).toLocaleDateString('it-IT', opts);
  if (!fine || fine === inizio) return d1;
  const d2 = new Date(fine).toLocaleDateString('it-IT', opts);
  return `${d1} – ${d2}`;
}

function paginaOg({ titolo, descrizione, immagine, url }) {
  /* Solo meta OG — nessun redirect (né meta refresh né JS): i browser
     reali vengono già 302-reindirizzati prima ancora di arrivare qui,
     quindi questa pagina la vedono solo i crawler. Crawler che leggono
     l'HTML statico → OK, meta corretti. Crawler headless che eseguono
     JS → OK lo stesso, non hanno redirect da eseguire e restano sui
     meta corretti. */
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titolo)}</title>
<link rel="canonical" href="${escapeHtml(url)}">
<meta name="description" content="${escapeHtml(descrizione)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tornei FVG">
<meta property="og:title" content="${escapeHtml(titolo)}">
<meta property="og:description" content="${escapeHtml(descrizione)}">
<meta property="og:url" content="${escapeHtml(url)}">
${immagine ? `<meta property="og:image" content="${escapeHtml(immagine)}">
<meta property="og:image:alt" content="Locandina di ${escapeHtml(titolo)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHtml(immagine)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${escapeHtml(titolo)}">
<meta name="twitter:description" content="${escapeHtml(descrizione)}">
</head>
<body>
<p><a href="${escapeHtml(url)}">${escapeHtml(titolo)}</a></p>
</body>
</html>`;
}

function paginaMinima(messaggio) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${escapeHtml(messaggio)}</title></head><body><p>${escapeHtml(messaggio)}.</p></body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}