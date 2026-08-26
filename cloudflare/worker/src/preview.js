/* ---------------------------------------------------------
   Costruzione dei meta tag e iniezione nell'HTML del sito.

   Il punto chiave dell'architettura sta qui: NON generiamo una
   pagina finta per i crawler. Prendiamo l'index.html vero di
   GitHub Pages e gli riscriviamo i meta tag al volo. Chi riceve
   la risposta — crawler o browser — ha in mano l'applicazione
   React funzionante, solo con i tag giusti in testa.

   Conseguenza voluta: riconoscere il crawler smette di essere
   critico. Se un crawler cambia User-Agent riceve comunque i
   tag corretti; se un browser venisse scambiato per un crawler
   riceverebbe comunque il sito completo. Non c'è un ramo in cui
   sbagliare costa la pagina.
--------------------------------------------------------- */
import {
  formatData,
  formatLuogo,
  formatCosto,
  troncaTesto,
} from './format.js';

const DESCRIZIONE_GENERICA =
  'Tornei di green volley, beach volley e pallavolo in Friuli-Venezia Giulia e dintorni.';

/* ---------------------------------------------------------
   escapeHtml()

   Usata su OGNI valore dinamico che finisce nell'HTML, senza
   eccezioni. I cinque caratteri sotto sono quelli che possono
   chiudere un attributo o aprire un tag; l'ampersand va per
   primo o ri-escaperebbe le entità appena prodotte.

   Un nome torneo come  " onerror="alert(1)  esce da qui come
   testo inerte, non come attributo nuovo.
--------------------------------------------------------- */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------------------------------------------------
   safeHttpsUrl()

   og:image deve essere un URL assoluto HTTPS pubblico. Qui
   cadono, in ordine: i percorsi relativi, http://, i blob:,
   i data:, i javascript: e qualunque stringa che non sia un
   URL. Chi chiama riceve null e passa al fallback.
--------------------------------------------------------- */
export function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  let parsed;
  try {
    parsed = new URL(v);
  } catch {
    return null; // relativo o spazzatura
  }
  if (parsed.protocol !== 'https:') return null;
  return parsed.toString();
}

/* ---------------------------------------------------------
   buildPreview()

   Dal documento Firestore ai quattro valori che servono:
   titolo, descrizione, immagine, URL.

   La descrizione è "data · luogo · costo", cioè
   quello che serve sapere guardando un link in chat. Se manca
   tutto si ripiega sulla frase generica del sito — mai una
   descrizione vuota, che alcuni client rendono come uno spazio
   bianco.

   Nota: authorEmail / authorId / authorName non arrivano
   nemmeno qui dentro. La field mask in firebase.js non li
   chiede proprio.
--------------------------------------------------------- */
export function buildPreview(torneo, slug, env) {
  const siteUrl = String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
  const url = `${siteUrl}/?torneo=${encodeURIComponent(slug)}`;

  const nome = troncaTesto(torneo.nome, 110) || 'Torneo';

  /* Data, luogo, disciplina, costo. Ogni pezzo cade da solo se il
     campo manca, quindi un torneo senza costo non produce un " · "
     penzolante in fondo alla riga. */
  const parti = [
    formatData(torneo.data, torneo.dataFine),
    formatLuogo(torneo),
    formatCosto(torneo.costo),
  ].filter(Boolean);
  const descrizione = parti.length
    ? troncaTesto(parti.join(' · '), 200)
    : String(env.FALLBACK_DESCRIPTION || DESCRIZIONE_GENERICA);

  /* Preferisco la locandina grande: il thumb è tarato sui 400px
     per le card di lista e in una preview si vede che è piccolo.
     Se manca il grande il thumb è comunque meglio del fallback. */
  const locandina = safeHttpsUrl(torneo.locandina) || safeHttpsUrl(torneo.locandinaThumb);
  const fallback =
    safeHttpsUrl(env.FALLBACK_IMAGE) || `${siteUrl}/icons/icon512.png`;

  const immagine = locandina || fallback;

  /* og:image:width/height solo sull'immagine di fallback, di cui
     conosciamo le dimensioni perché è un file fisso. Le locandine
     sono verticali e di proporzioni variabili (compressLocandina
     limita il lato lungo a 1600px mantenendo l'aspect ratio):
     dichiarare 1200x630 su una locandina sarebbe una bugia, e i
     crawler che si fidano del valore taglierebbero l'immagine. */
  const dimensioni = locandina
    ? null
    : {
      width: String(env.FALLBACK_IMAGE_WIDTH || '512'),
      height: String(env.FALLBACK_IMAGE_HEIGHT || '512'),
    };

  return {
    title: nome,
    description: descrizione,
    image: immagine,
    imageAlt: locandina ? `Locandina del torneo ${nome}` : String(env.SITE_NAME || 'Tornei Volley FVG'),
    imageSize: dimensioni,
    url,
    siteName: String(env.SITE_NAME || 'Tornei Volley FVG'),
  };
}

/* ---------------------------------------------------------
   renderMetaTags()

   Il blocco che sostituisce i tag social dell'index.html.
   Funzione pura e senza dipendenze dal runtime: è quella che
   i test unitari possono verificare carattere per carattere.
--------------------------------------------------------- */
export function renderMetaTags(p) {
  const t = escapeHtml(p.title);
  const d = escapeHtml(p.description);
  const img = escapeHtml(p.image);
  const alt = escapeHtml(p.imageAlt);
  const url = escapeHtml(p.url);
  const site = escapeHtml(p.siteName);

  const righe = [
    `<meta name="description" content="${d}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${site}">`,
    `<meta property="og:locale" content="it_IT">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:alt" content="${alt}">`,
  ];

  if (p.imageSize) {
    righe.push(`<meta property="og:image:width" content="${escapeHtml(p.imageSize.width)}">`);
    righe.push(`<meta property="og:image:height" content="${escapeHtml(p.imageSize.height)}">`);
  }

  righe.push(
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="twitter:image:alt" content="${alt}">`,
  );

  return `\n    ${righe.join('\n    ')}\n  `;
}

/* ---------------------------------------------------------
   applyPreview()

   Passa l'HTML di origine attraverso HTMLRewriter (streaming,
   incluso nel piano gratuito).

   Strategia: prima RIMUOVO tutti i tag social esistenti, poi
   ne accodo un set completo prima di </head>. Sembra più
   invasivo che riscrivere gli attributi uno per uno, ma è
   l'unico modo per non dipendere da quali tag ci sono
   nell'index.html di oggi: se domani ne aggiungi uno, la
   preview non si ritrova con due og:title in disaccordo.

   Tutto il resto del documento — script, CSS, div#root, service
   worker — passa inalterato.
--------------------------------------------------------- */
export function applyPreview(response, preview) {
  const blocco = renderMetaTags(preview);
  const titolo = escapeHtml(preview.title);

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(titolo, { html: true });
      },
    })
    .on('meta[property^="og:"]', { element(el) { el.remove(); } })
    .on('meta[name^="twitter:"]', { element(el) { el.remove(); } })
    .on('meta[name="description"]', { element(el) { el.remove(); } })
    .on('link[rel="canonical"]', { element(el) { el.remove(); } })
    .on('head', {
      element(el) {
        el.onEndTag((end) => {
          end.before(blocco, { html: true });
        });
      },
    })
    .transform(response);
}
