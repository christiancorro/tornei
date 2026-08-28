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
  'Tornei di green volley, beach volley e pallavolo in Friuli Venezia Giulia e dintorni.';

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
  /* Path, non query: /torneo/<slug>. È l'URL canonico da quando i
     tornei hanno una pagina propria — la scheda evento di Google
     vale solo su pagine dedicate a un evento solo, e un link
     pulito si legge meglio quando è un chatbot a citarlo. Il
     vecchio ?torneo= arriva qui già trasformato dal 301. */
  const url = `${siteUrl}/torneo/${encodeURIComponent(slug)}`;

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
export function applyPreview(response, preview, contenuto) {
  /* `preview` può essere null. Serve per la home: il suo <title>
     e la sua description in index.html sono scritti bene e sono
     pieni delle parole che la gente cerca davvero ("tornei green
     volley Friuli"). Rigenerarli dal nome del sito li peggiora.
     Con preview null la testa non si tocca: si aggiungono solo
     il canonical e il JSON-LD. */
  const blocco = preview ? renderMetaTags(preview) : null;
  const titolo = preview ? escapeHtml(preview.title) : null;

  /* `contenuto` è opzionale: { body, ldTag }, entrambe stringhe
     HTML già pronte. Quando c'è, la stessa passata che sistema i
     meta tag scrive anche dentro #root il testo del torneo e
     accoda il JSON-LD — una passata sola invece di due, perché
     HTMLRewriter è in streaming e incatenarne due vorrebbe dire
     rileggere tutto il documento due volte.

     Le stringhe arrivano già renderizzate da chi chiama, non
     costruite qui: così questo file non deve importare
     contenuto.js, che a sua volta importa escapeHtml da qui. Le
     dipendenze vanno in una direzione sola. */
  const body = contenuto && contenuto.body;
  const ldTag = contenuto && contenuto.ldTag;
  const canonical = contenuto && contenuto.canonical;

  const rw = new HTMLRewriter();

  if (preview) {
    rw.on('title', {
      element(el) {
        el.setInnerContent(titolo, { html: true });
      },
    })
      .on('meta[property^="og:"]', { element(el) { el.remove(); } })
      .on('meta[name^="twitter:"]', { element(el) { el.remove(); } })
      .on('meta[name="description"]', { element(el) { el.remove(); } })
      .on('link[rel="canonical"]', { element(el) { el.remove(); } });
  }

  return rw
    .on('script[type="application/ld+json"]', {
      element(el) {
        /* Via il blocco WebSite statico dell'index.html: quando
           stiamo pubblicando un evento vogliamo il nostro, non
           due blocchi che dicono cose diverse. Senza contenuto
           (preview e basta) resta dov'è. */
        if (ldTag) el.remove();
      },
    })
    .on('head', {
      element(el) {
        el.onEndTag((end) => {
          if (blocco) end.before(blocco, { html: true });
          else if (canonical) {
            end.before(`<link rel="canonical" href="${escapeHtml(canonical)}">`, { html: true });
          }
          if (ldTag) end.before(ldTag, { html: true });
        });
      },
    })
    /* Il corpo. React azzera #root quando monta, quindi questo
       testo è un fallback che l'utente vede per un istante e i
       crawler senza JavaScript vedono come la pagina intera. */
    .on('#root', {
      element(el) {
        if (body) el.setInnerContent(body, { html: true });
      },
    })
    .transform(response);
}
