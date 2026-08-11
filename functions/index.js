/* ---------------------------------------------------------
   torneoOg — HTML "share preview" per la card di un torneo.

   Perché esiste: la SPA di default risponde a Telegram, WhatsApp,
   Facebook & co. con un index.html vuoto (i dati del torneo li carica
   il JS dopo). I loro crawler non eseguono JS, quindi non vedono
   titolo, descrizione, locandina — niente anteprima.

   Cosa fa: alla richiesta di /torneo/<id> legge il torneo da
   Firestore e restituisce una pagina con i meta Open Graph (title,
   description, image, url). Per gli utenti umani fa un redirect
   302 a /?torneo=<id>, dove la SPA li porta dritti sul dettaglio.

   Il crawler viene distinto per user-agent: sono quelli noti dei
   servizi di preview. Un browser normale non li matcha e viene
   rimandato all'app.
--------------------------------------------------------- */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Espressione regolare volutamente generosa: se non riconosco lo
// user-agent tratto la richiesta come umana e rimando all'app (nel
// peggiore dei casi si perde l'anteprima, mai l'accesso alla pagina).
const CRAWLER_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|telegrambot|whatsapp|pinterest|discordbot|slackbot|preview|embed|link.?preview|meta-external|vkshare|redditbot|iframely|skype/i;

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
    const isCrawler = CRAWLER_RE.test(ua);

    // Utente umano: bounce diretto alla SPA. Niente HTML intermedio,
    // così il tasto Indietro salta la pagina di preview.
    if (!isCrawler) {
      res.redirect(302, `/?torneo=${encodeURIComponent(id)}`);
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

      // Host preso dalla richiesta: funziona sia sul dominio custom sia
      // sul .web.app di default, senza doverlo hard-codare.
      const host = `${req.protocol}://${req.get('host')}`;
      const urlCanonico = `${host}/?torneo=${encodeURIComponent(id)}`;

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
<p>Apertura del torneo in corso… <a href="${escapeHtml(url)}">Vai alla pagina</a>.</p>
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
