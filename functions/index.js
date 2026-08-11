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

exports.torneoOg = functions
  .region('europe-west1') // stessa regione del progetto (regolare al bisogno)
  .https.onRequest(async (req, res) => {
    // path: /torneo/<id>  oppure  /torneo/<id>/
    const id = (req.path || '').replace(/^\/torneo\/?/, '').replace(/\/+$/, '');
    if (!id) {
      res.status(404).send('Torneo non specificato.');
      return;
    }

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

      const html = paginaOg({
        titolo,
        descrizione,
        immagine: t.locandina || '',
        url: urlCanonico,
      });

      // Cache lato CDN: i crawler ripassano più volte, non ha senso
      // rifare il fetch a Firestore ogni volta. 5 minuti sono un
      // compromesso tra freschezza e costo.
      res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
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
  /* Redirect JS + meta-refresh: i crawler (Telegram, Facebook,
     opengraph.xyz, ecc.) non eseguono JS e ignorano il meta refresh
     istantaneo, quindi si fermano sui meta OG. I browser reali
     eseguono `location.replace` in pochi ms e finiscono sulla SPA
     senza lasciare la pagina intermedia nella cronologia
     (replace, non assign). Il fallback <a> è per browser con JS
     disabilitato — comunque un click e sono sull'app. */
  const urlJson = JSON.stringify(url);
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
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}">
<script>window.location.replace(${urlJson});</script>
<style>body{font-family:system-ui,sans-serif;color:#666;padding:2rem;text-align:center}</style>
</head>
<body>
<p>Apertura del torneo… <a href="${escapeHtml(url)}">Vai alla pagina</a></p>
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