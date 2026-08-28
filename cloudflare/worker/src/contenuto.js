/* ---------------------------------------------------------
   Il contenuto che leggono i crawler.

   Stessa filosofia di preview.js — una pagina sola, non una
   versione finta per i bot — portata un piano più giù. preview.js
   riscrive la testa del documento; questo file riempie il corpo.

   Serve perché i crawler che contano per le risposte AI (GPTBot,
   OAI-SearchBot, ClaudeBot, PerplexityBot) NON eseguono
   JavaScript: scaricano l'HTML e si fermano lì. Con #root vuoto
   quello che leggono è una pagina bianca.

   React azzera il contenuto del container quando monta, quindi
   quello che scriviamo qui l'utente lo vede per una frazione di
   secondo come stato di caricamento, e sparisce da solo. Il
   sito non cambia di una riga.

   Regola: ogni valore dinamico passa da escapeHtml(). Nessuna
   eccezione, come in preview.js.
--------------------------------------------------------- */
import { escapeHtml } from './preview.js';
import {
  formatData,
  formatDataBreve,
  formatLuogo,
  formatCosto,
  offsetRoma,
} from './format.js';

/* Le sigle delle province che compaiono nei luoghi dei tornei.
   Servono a dire "Friuli-Venezia Giulia" per esteso: è la parola
   che compare nella domanda ("tornei in Friuli"), e un modello
   che legge solo "(UD)" deve poterci arrivare. */
const REGIONI = {
  UD: 'Friuli-Venezia Giulia', PN: 'Friuli-Venezia Giulia',
  GO: 'Friuli-Venezia Giulia', TS: 'Friuli-Venezia Giulia',
  VE: 'Veneto', TV: 'Veneto', BL: 'Veneto', PD: 'Veneto',
  VR: 'Veneto', VI: 'Veneto', RO: 'Veneto',
};
const REGIONE_DEFAULT = 'Friuli-Venezia Giulia';

/* "Mels (UD)" → { nome: 'Mels', prov: 'UD', regione: '...' }.
   Il campo è testo libero: se non c'è la sigla tra parentesi
   teniamo la stringa così com'è e diamo per buona la regione
   del sito. */
export function scomponiLuogo(torneo) {
  const raw = formatLuogo(torneo);
  const m = raw.match(/^(.*?)\s*\(([A-Za-z]{2})\)\s*$/);
  const nome = m ? m[1].trim() : raw;
  const prov = m ? m[2].toUpperCase() : '';
  return { raw, nome, prov, regione: REGIONI[prov] || REGIONE_DEFAULT };
}

/* formatData() apre con la maiuscola perché nella preview la data
   è l'inizio della frase. Dentro un periodo ("da martedì 1 a
   sabato 12") quella maiuscola è sbagliata: qui la abbasso. */
function minuscola(s) {
  return s ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : s;
}

export function urlTorneo(slug, env) {
  const base = String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
  return `${base}/torneo/${encodeURIComponent(slug)}`;
}

function baseSito(env) {
  return String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
}

/* Una frase intera, non un elenco di campi separati da punti.
   È la forma che i modelli citano meglio, ed è anche la prima
   cosa che si legge nella pagina. */
export function fraseTorneo(torneo) {
  const L = scomponiLuogo(torneo);
  const testa = ['Torneo di', torneo.disciplina || 'volley'];
  if (torneo.formati && torneo.formati.length) testa.push(torneo.formati.join(' e '));
  if (torneo.modalita) testa.push(String(torneo.modalita).toLowerCase());

  let s = testa.join(' ');
  s += ` a ${L.nome || L.raw}${L.prov ? ` (${L.prov})` : ''}, ${L.regione}`;

  const quando = formatData(torneo.data, torneo.dataFine);
  if (quando) s += `, ${minuscola(quando)}`;
  if (torneo.ora) s += ` alle ${torneo.ora}`;

  const costo = formatCosto(torneo.costo);
  if (costo) s += `. Iscrizione ${costo} a squadra`;
  if (torneo.organizzatore) s += `. Organizzato da ${torneo.organizzatore}`;
  return `${s}.`;
}

/* ---------------------------------------------------------
   Lo stile del primo istante.

   Il blocco qui sotto è quello che si vede prima che il bundle
   React sia pronto — su una connessione lenta, o al primo
   accesso, è un secondo o due. Senza CSS il browser lo disegna
   con i suoi default: Times New Roman, link blu sottolineati,
   tabella a sette colonne che esce dallo schermo. Brutto, e
   sembra un errore.

   Con queste poche regole diventa uno stato di caricamento
   intenzionale, negli stessi colori del sito (SAND di sfondo,
   INK per il testo, GRASS_DARK per i link). Il min-height
   copre la viewport, così non si vede il bianco del browser
   sotto.

   Va in fondo a questo file e non nel <head> apposta: sta
   dentro #root, quindi quando React monta se ne va insieme al
   resto. Nessun CSS orfano che sopravvive alla pagina.

   Nota sui crawler: il CSS non li riguarda: leggono l'HTML e
   basta. Impaginare le righe come schede invece che come
   tabella non cambia una virgola di quello che vedono loro,
   che è sempre una <table> con <th> e <td> al posto giusto.
--------------------------------------------------------- */
const STILI_BOOT = `<style>
.vfvg-boot{background:#fffefb;color:#282828;min-height:100vh;margin:0;padding:24px 18px 56px;
font:400 15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.vfvg-boot .w{max-width:760px;margin:0 auto}
.vfvg-boot h1{margin:0 0 10px;font-size:21px;line-height:1.28;font-weight:700;letter-spacing:-.015em}
.vfvg-boot p{margin:0 0 14px;font-size:14px;color:#6f6c63}
.vfvg-boot strong{font-weight:600;color:#282828}
.vfvg-boot em{font-style:normal;color:#a3a096}
.vfvg-boot a{color:#488222;text-decoration:none}
.vfvg-boot ul{margin:0 0 16px;padding:0;list-style:none}
.vfvg-boot li{padding:9px 0;border-bottom:1px solid #efece3;font-size:14px;color:#6f6c63}
.vfvg-boot li strong{margin-right:6px}
.vfvg-boot table{width:100%;border-collapse:collapse}
.vfvg-boot thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.vfvg-boot tr{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;
padding:12px 0;border-bottom:1px solid #efece3}
.vfvg-boot td{padding:0;font-size:13px;color:#7d7a70}
.vfvg-boot td:nth-child(1){flex:0 0 100%;font-size:11.5px;letter-spacing:.04em;
text-transform:uppercase;color:#a3a096}
.vfvg-boot td:nth-child(2){flex:0 0 100%;margin:1px 0 3px;font-size:15.5px;
font-weight:600;line-height:1.3;color:#282828}
.vfvg-boot td:nth-child(n+4)::before{content:"·";margin-right:8px;color:#d2cfc4}
.vfvg-boot .w::after{content:"Caricamento…";display:block;margin-top:26px;
font-size:12.5px;color:#b6b3a9}
</style>`;

/* Il contenuto vero e proprio, vestito. Lo stile viaggia con il
   blocco: un solo pezzo da iniettare, e sparisce tutto insieme. */
function avvolgi(articolo) {
  return `<div class="vfvg-boot">${STILI_BOOT}
<div class="w">${articolo}</div>
</div>`;
}

/* ---------------------------------------------------------
   bloccoTorneo() — il corpo della pagina di un torneo.

   Un h1 col nome, la frase completa, poi le voci etichettate.
   Le etichette esplicite ("Luogo:", "Iscrizione:") non sono
   decorazione: sono quello che permette a un modello di dire
   "costa 15 euro" invece di tirare a indovinare quale numero
   nella pagina sia il prezzo.
--------------------------------------------------------- */
export function bloccoTorneo(torneo, slug, env) {
  const L = scomponiLuogo(torneo);
  const luogoCompleto = `${L.nome || L.raw}${L.prov ? ` (${L.prov})` : ''}, ${L.regione}, Italia`;

  const voci = [
    ['Data', formatData(torneo.data, torneo.dataFine)],
    ['Orario', torneo.ora],
    ['Luogo', L.raw ? luogoCompleto : ''],
    ['Disciplina', torneo.disciplina],
    ['Formato', (torneo.formati || []).join(', ')],
    ['Modalità', torneo.modalita],
    ['Iscrizione', formatCosto(torneo.costo)],
    ['Organizzatore', torneo.organizzatore],
  ].filter(([, v]) => v);

  const righe = voci
    .map(([k, v]) => `      <li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
    .join('\n');

  const nota = torneo.descrizioneOrganizzatore
    ? `\n    <p>${escapeHtml(torneo.descrizioneOrganizzatore)}</p>`
    : '';

  return avvolgi(`
  <article>
    <h1>${escapeHtml(torneo.nome)}</h1>
    <p>${escapeHtml(fraseTorneo(torneo))}</p>
    <ul>
${righe}
    </ul>${nota}
    <p><a href="${escapeHtml(baseSito(env))}/">Tutti i tornei di volley in Friuli Venezia Giulia</a></p>
  </article>
`);
}

/* ---------------------------------------------------------
   bloccoLista() — il corpo della homepage.

   Questa è la pagina che risponde alla domanda. La prima frase
   contiene già la risposta (quanti tornei, da quando a quando,
   dove): è la parte che pesa di più quando un motore decide se
   citare una fonte. La tabella sotto tiene una riga per torneo,
   con province e regione scritte per esteso.
--------------------------------------------------------- */
export function bloccoLista(tornei, env, oggiISO) {
  const titolo = 'Tornei di green volley, beach volley e pallavolo in Friuli Venezia Giulia';

  if (!tornei.length) {
    return avvolgi(`
  <article>
    <h1>${escapeHtml(titolo)}</h1>
    <p>Al momento non ci sono tornei in programma. Il calendario viene aggiornato
    di continuo: torna a controllare, oppure pubblica il tuo torneo.</p>
  </article>
`);
  }

  const dal = minuscola(formatData(tornei[0].data, ''));
  const al = minuscola(formatData(tornei[tornei.length - 1].data, ''));

  const righe = tornei.map((t) => {
    const L = scomponiLuogo(t);

    /* Il link è l'unica cella che contiene HTML voluto, e il suo
       contenuto è comunque escapato. Tutte le altre partono da
       testo grezzo e passano da escapeHtml qui sotto: nessuna
       cella arriva nell'output senza essere passata di qui. */
    const link = `<a href="${escapeHtml(urlTorneo(t.id, env))}">${escapeHtml(t.nome)}</a>`;

    const testo = [
      formatDataBreve(t.data, t.dataFine),
      null, // il posto del link
      t.disciplina || '',
      [(t.formati || []).join(', '), t.modalita].filter(Boolean).join(' '),
      `${L.nome || L.raw}${L.prov ? ` (${L.prov})` : ''}`,
      L.regione,
      formatCosto(t.costo) || '—',
    ];

    const celle = testo.map((v, i) => (i === 1 ? link : escapeHtml(v)));
    return `      <tr>\n${celle.map((c) => `        <td>${c}</td>`).join('\n')}\n      </tr>`;
  }).join('\n');

  return avvolgi(`
  <article>
    <h1>${escapeHtml(titolo)}</h1>
    <p>Ci sono <strong>${tornei.length} tornei</strong> in programma, da ${escapeHtml(dal)}
    a ${escapeHtml(al)}, in Friuli Venezia Giulia e dintorni: green volley, beach volley
    e pallavolo, con data, luogo, provincia, formato e costo di iscrizione.
    <em>Elenco aggiornato ${escapeHtml(minuscola(formatData(oggiISO, '')))}.</em></p>
    <table>
      <thead>
        <tr><th>Data</th><th>Torneo</th><th>Disciplina</th><th>Formato</th><th>Luogo</th><th>Regione</th><th>Iscrizione</th></tr>
      </thead>
      <tbody>
${righe}
      </tbody>
    </table>
  </article>
`);
}

export function bloccoNonTrovato(env) {
  return avvolgi(`
  <article>
    <h1>Torneo non trovato</h1>
    <p>Questo torneo non è più in programma oppure è stato rimosso.</p>
    <p><a href="${escapeHtml(baseSito(env))}/">Vedi tutti i tornei di volley in Friuli Venezia Giulia</a></p>
  </article>
`);
}

/* ---------------------------------------------------------
   JSON-LD.

   Da tenere in prospettiva: i test più recenti dicono che i
   modelli NON interpretano lo schema, lo leggono come testo
   qualsiasi. Serve a Google, che con SportsEvent può mostrare
   la scheda evento con data e luogo — e quella richiede una
   pagina per evento, che è il motivo per cui i tornei sono
   passati a /torneo/<slug>.
--------------------------------------------------------- */
export function jsonLdTorneo(torneo, slug, env) {
  const L = scomponiLuogo(torneo);
  const url = urlTorneo(slug, env);
  const ora = /^\d{1,2}:\d{2}$/.test(String(torneo.ora || '')) ? torneo.ora : null;
  const off = offsetRoma(torneo.data);

  const ev = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: torneo.nome,
    url,
    startDate: ora ? `${torneo.data}T${ora.padStart(5, '0')}:00${off}` : torneo.data,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    sport: torneo.disciplina || 'Volley',
    description: fraseTorneo(torneo),
    location: {
      '@type': 'Place',
      name: L.nome || L.raw,
      address: {
        '@type': 'PostalAddress',
        addressLocality: L.nome || L.raw,
        addressRegion: L.regione,
        addressCountry: 'IT',
      },
    },
  };

  if (torneo.dataFine && torneo.dataFine !== torneo.data) {
    ev.endDate = ora ? `${torneo.dataFine}T23:59:00${offsetRoma(torneo.dataFine)}` : torneo.dataFine;
  }

  const lat = Number(torneo.lat);
  const lng = Number(torneo.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    ev.location.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }

  if (torneo.locandina) ev.image = [torneo.locandina];

  if (torneo.organizzatore) {
    ev.organizer = { '@type': 'Organization', name: torneo.organizzatore };
    if (torneo.sitoWeb) ev.organizer.url = torneo.sitoWeb;
  }

  /* Il costo è testo libero ("10 (pranzo incluso)", "gratuito"):
     offers lo dichiaro solo quando riesco a estrarne un numero,
     perché un price non numerico rende l'intero blocco invalido
     per Google. */
  const num = String(torneo.costo ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (num) {
    ev.offers = {
      '@type': 'Offer',
      price: num[0],
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url,
    };
    ev.isAccessibleForFree = Number(num[0]) === 0;
  }

  return ev;
}

export function jsonLdLista(tornei, env) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Tornei di green volley, beach volley e pallavolo in Friuli Venezia Giulia',
    numberOfItems: tornei.length,
    itemListElement: tornei.slice(0, 100).map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: urlTorneo(t.id, env),
      name: t.nome,
    })),
  };
}

/* JSON dentro <script> ha un solo modo di rompersi: la sequenza
   "</script>" dentro una stringa chiuderebbe il tag in anticipo.
   Escapando "<" il JSON resta valido e il tag non si chiude. */
export function tagJsonLd(oggetto) {
  const json = JSON.stringify(oggetto).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

/* ---------------------------------------------------------
   sitemapXml()

   Generata qui e non più a build time. Il motivo è concreto:
   scripts/generate_sitemap.mjs gira durante `npm run build`,
   quindi un torneo approvato dopo l'ultimo deploy non entra
   nella sitemap finché non ne fai un altro. Un calendario di
   eventi è esattamente il caso in cui questo fa male.
--------------------------------------------------------- */
export function sitemapXml(tornei, env, oggiISO) {
  const base = baseSito(env);
  const voce = (loc, lastmod, priority, changefreq) =>
    '  <url>\n' +
    `    <loc>${escapeHtml(loc)}</loc>\n` +
    `    <lastmod>${escapeHtml(lastmod)}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    '  </url>';

  const righe = tornei.map((t) => {
    const agg = typeof t.updatedAt === 'string' && t.updatedAt.length >= 10
      ? t.updatedAt.slice(0, 10)
      : oggiISO;
    return voce(urlTorneo(t.id, env), agg, '0.8', 'weekly');
  });

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [voce(`${base}/`, oggiISO, '1.0', 'daily'), ...righe].join('\n') +
    '\n</urlset>\n';
}
