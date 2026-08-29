/* ---------------------------------------------------------
   Il contenuto che leggono i crawler.

   Stessa filosofia di preview.js (una pagina sola, non una
   versione finta per i bot) portata un piano più giù:
   preview.js riscrive la testa del documento, questo file
   riempie il corpo.

   Serve perché i crawler che contano per le risposte AI
   (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) NON
   eseguono JavaScript: scaricano l'HTML e si fermano lì. Con
   #root vuoto quello che leggono è una pagina bianca.

   React azzera il contenuto del container quando monta, quindi
   quello che scriviamo qui vive solo fino al primo render. Il
   sito non cambia di una riga.

   Regola: ogni valore dinamico passa da escapeHtml(). Nessuna
   eccezione, come in preview.js.

   Struttura della pagina lista, una sezione per ogni domanda
   che un motore AI fa al sito:

     h1                          di che cosa parla il sito
     sommario                    quanti tornei, in che periodo
     Tornei di volley in programma   la tabella, una riga per torneo
     Tornei passati              le edizioni già disputate
     Che cos'è Volley FVG        il progetto
     Chi ha sviluppato Volley FVG?   la paternità

   Rispetto alla versione precedente i tornei futuri compaiono
   una volta sola. Prima c'erano un elenco di link e una
   tabella con dentro gli stessi tornei: doppio peso in pagina,
   e per un modello due liste da riconciliare invece di una
   fonte sola. Adesso il link sta nella cella del nome, quindi
   la tabella fa entrambi i lavori.
--------------------------------------------------------- */
import { escapeHtml } from './preview.js';
import {
  formatData,
  formatDataBreve,
  formatLuogo,
  formatCosto,
  offsetRoma,
} from './format.js';

const TITOLO_LISTA =
  'Tornei di green volley, beach volley e pallavolo in Friuli Venezia Giulia';

/* Il testo che prende il posto di un campo vuoto in tabella.
   Prima era un trattino: chi legge "-" non sa dire se il torneo
   è gratuito o se il dato manca, queste due parole sì. */
const COSTO_MANCANTE = 'non indicata';

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

/* "Mels (UD)" produce { nome: 'Mels', prov: 'UD', regione: '...' }.
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

/* "Mels (UD)" in una riga sola, senza regione. */
function luogoBreve(L) {
  return `${L.nome || L.raw}${L.prov ? ` (${L.prov})` : ''}`;
}

/* Luogo per esteso, come lo scriverebbe un modello in risposta. */
function luogoEsteso(L) {
  return L.raw ? `${luogoBreve(L)}, ${L.regione}, Italia` : '';
}

/* formatData() apre con la maiuscola perché nella preview la data
   è l'inizio della frase. Dentro un periodo ("da martedì 1 a
   sabato 12") quella maiuscola è sbagliata: qui la abbasso. */
function minuscola(s) {
  return s ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : s;
}

/* ---------------------------------------------------------
   dividiPassatoFuturo()

   La stessa regola di isPassato() in src/utils.js del sito:
   conta l'ULTIMO giorno, non il primo. Un torneo di tre giorni
   cominciato ieri è ancora in corso, e deve restare fra quelli
   in programma: filtrare su `data` lo faceva sparire proprio
   nel weekend in cui si gioca.

   I passati escono dal più recente: sono quelli che interessano.
--------------------------------------------------------- */
export function dividiPassatoFuturo(tornei, oggiISO) {
  const futuri = [];
  const passati = [];
  for (const t of tornei) {
    const ultimoGiorno = t.dataFine || t.data;
    if (ultimoGiorno < oggiISO) passati.push(t);
    else futuri.push(t);
  }
  passati.reverse();
  return { futuri, passati };
}

export function urlTorneo(slug, env) {
  const base = String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
  return `${base}/torneo/${encodeURIComponent(slug)}`;
}

function baseSito(env) {
  return String(env.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');
}

/* "a, b e c": tre formati incollati con "e" tre volte
   ("2x2 e 3x3 e 4x4") in una risposta parlata suonano male. */
function elenco(voci) {
  const v = (voci || []).filter(Boolean);
  if (v.length < 2) return v.join('');
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
}

/* Singolare e plurale. Un "1 tornei" in cima alla pagina è la
   cosa che fa sembrare generato tutto il resto. */
function plurale(n, uno, molti) {
  return n === 1 ? uno : molti;
}

/* Una frase intera, non un elenco di campi separati da punti.
   È la forma che i modelli citano meglio, ed è anche la prima
   cosa che si legge nella pagina. */
export function fraseTorneo(torneo) {
  const L = scomponiLuogo(torneo);
  const testa = ['Torneo di', torneo.disciplina || 'volley'];
  if (torneo.formati && torneo.formati.length) testa.push(elenco(torneo.formati));
  if (torneo.modalita) testa.push(String(torneo.modalita).toLowerCase());

  let s = testa.join(' ');
  s += ` a ${luogoBreve(L)}, ${L.regione}`;

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

   Il blocco qui sotto è quello che sta in pagina prima che il
   bundle React sia pronto. Senza CSS il browser lo disegnerebbe
   con i suoi default: Times New Roman, link blu sottolineati,
   tabella a sette colonne che esce dallo schermo.

   Con queste poche regole diventa uno stato di caricamento
   intenzionale, negli stessi colori del sito (SAND di sfondo,
   INK per il testo, GRASS_DARK per i link). Il min-height
   copre la viewport, così non si vede il bianco del browser
   sotto.

   Va in fondo a questo file e non nel <head> apposta: sta
   dentro #root, quindi quando React monta se ne va insieme al
   resto. Nessun CSS orfano che sopravvive alla pagina.

   Nota sui crawler: il CSS non li riguarda, leggono l'HTML e
   basta. Impaginare le righe come schede invece che come
   tabella non cambia una virgola di quello che vedono loro,
   che è sempre una <table> con <th> e <td> al posto giusto.

   Nota su visibility:hidden. Così com'è, questo blocco l'utente
   non lo vede mai: occupa lo spazio ma resta invisibile fino a
   quando React lo sostituisce. Se lo vuoi come stato di
   caricamento visibile basta togliere quella riga, il resto
   delle regole è già scritto per quello.
--------------------------------------------------------- */
const STILI_BOOT = `<style>
.vfvg-boot{visibility:hidden;background:#fffefb;color:#282828;min-height:100vh;margin:0;padding:24px 18px 56px;
font:400 15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.vfvg-boot .w{max-width:760px;margin:0 auto}
.vfvg-boot h1{margin:0 0 10px;font-size:21px;line-height:1.28;font-weight:700;letter-spacing:-.015em}
.vfvg-boot h2{margin:26px 0 8px;font-size:15px;line-height:1.3;font-weight:600;letter-spacing:-.01em}
.vfvg-boot p{margin:0 0 14px;font-size:14px;color:#6f6c63}
.vfvg-boot strong{font-weight:600;color:#282828}
.vfvg-boot em{font-style:normal;color:#a3a096}
.vfvg-boot a{color:#488222;text-decoration:none}
.vfvg-boot figure{margin:0 0 16px}
.vfvg-boot img{display:block;width:auto;max-width:min(100%,300px);height:auto;border-radius:6px}
.vfvg-boot ul{margin:0 0 16px;padding:0;list-style:none}
.vfvg-boot li{padding:9px 0;border-bottom:1px solid #efece3;font-size:14px;color:#6f6c63}
.vfvg-boot li strong{margin-right:2px}
.vfvg-boot li a{font-weight:600}
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
   Navigazione principale per favorire i sitelinks.
   Usata all'inizio dei vari blocchi pagina.
--------------------------------------------------------- */
export function navigazionePrincipale(env) {
  const base = String(env?.SITE_URL || 'https://volleyfvg.it').replace(/\/+$/, '');

  return `  <nav aria-label="Navigazione principale" style="margin-bottom: 24px; border-bottom: 1px solid #efece3; padding-bottom: 12px;">
    <ul style="display: flex; gap: 16px; margin: 0; padding: 0; list-style: none;">
      <li><a href="${escapeHtml(base)}/" style="font-weight: 600;">Home</a></li>
      <li><a href="${escapeHtml(base)}/tornei" style="font-weight: 600;">Tornei</a></li>
      <li><a href="${escapeHtml(base)}/bacheca" style="font-weight: 600;">Bacheca</a></li>
    </ul>
  </nav>`;
}

export function bloccoBacheca(annunci, env) {
  const righe = annunci.map(a => {
    const titolo = a.tipo === 'cerca_squadra' ? 'Cerca Squadra' : 'Cerca Giocatore';
    return `        <li style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #efece3;">
      <h3 style="margin: 0 0 4px; font-size: 16px;">${escapeHtml(titolo)}</h3>
      <p style="margin: 0 0 8px; font-size: 14px; color: #6f6c63;">Di <strong>${escapeHtml(a.authorName)}</strong></p>
      <p style="margin: 0;">${escapeHtml(a.testo)}</p>
    </li>`;
  }).join('\n');

  const corpo = annunci.length > 0
    ? `<ul>\n${righe}\n      </ul>`
    : '<p>Nessun annuncio presente al momento.</p>';

  // Qui inseriamo la navigazione all'inizio
  return avvolgi(componi(
    navigazionePrincipale(env),
    '  <article>',
    '    <h1>Bacheca Volley FVG</h1>',
    '    <p>Cerca squadre o giocatori per i tornei di Green Volley e Beach Volley in Friuli Venezia Giulia.</p>',
    '    <section>',
    corpo,
    '    </section>',
    '  </article>'
  ));
}

/* Mette insieme i pezzi di pagina scartando quelli vuoti, così
   una sezione che non ha niente da dire non lascia markup a
   vuoto. */
function componi(...pezzi) {
  return pezzi.filter(Boolean).join('\n');
}

/* ---------------------------------------------------------
   bloccoTorneo(), il corpo della pagina di un torneo.

   Un h1 col nome, la frase completa, poi le voci etichettate.
   Le etichette esplicite ("Luogo:", "Iscrizione:") non sono
   decorazione: sono quello che permette a un modello di dire
   "costa 15 euro" invece di tirare a indovinare quale numero
   nella pagina sia il prezzo.
--------------------------------------------------------- */
export function bloccoTorneo(torneo, slug, env) {
  const L = scomponiLuogo(torneo);

  const voci = [
    ['Data', formatData(torneo.data, torneo.dataFine)],
    ['Orario', torneo.ora],
    ['Luogo', luogoEsteso(L)],
    ['Disciplina', torneo.disciplina],
    ['Formato', (torneo.formati || []).join(', ')],
    ['Modalità', torneo.modalita],
    ['Iscrizione', formatCosto(torneo.costo)],
    ['Organizzatore', torneo.organizzatore],
  ].filter(([, v]) => v);

  const righe = voci
    .map(([k, v]) =>
      `        <li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`
    )
    .join('\n');

  const nota = torneo.descrizioneOrganizzatore
    ? `    <p>${escapeHtml(torneo.descrizioneOrganizzatore)}</p>`
    : '';

  /* -------------------------------------------------------
     Locandina SEO.

     `locandina` è l'immagine grande già caricata su Storage.
     La inseriamo nell'HTML iniziale così:
       1. i crawler che non eseguono JS la vedono;
       2. Google può associare l'immagine al torneo;
       3. l'utente non vede una pagina testuale completamente
          diversa mentre React sta caricando;
       4. il CSS del blocco boot la tiene comunque discreta.

     `alt` contiene il nome del torneo e il luogo: descrittivo,
     non keyword stuffing.
  ------------------------------------------------------- */
  const locandina = torneo.locandina
    ? `    <figure class="vfvg-poster">
      <img
        src="${escapeHtml(torneo.locandina)}"
        alt="${escapeHtml(`${torneo.nome}${L.nome ? ` a ${L.nome}` : ''}${L.prov ? ` (${L.prov})` : ''}`)}"
        width="800"
        height="1100"
        loading="eager"
        decoding="async"
      />
    </figure>`
    : '';

  return avvolgi(componi(
    navigazionePrincipale(env),
    '  <article>',
    `    <h1>${escapeHtml(torneo.nome)}</h1>`,
    locandina,
    `    <p>${escapeHtml(fraseTorneo(torneo))}</p>`,
    componi(
      '    <section>',
      '      <h2>Informazioni sul torneo</h2>',
      '      <ul>',
      righe,
      '      </ul>',
      '    </section>'
    ),
    nota,
    componi(
      '    <p>',
      `      <a href="${escapeHtml(baseSito(env))}/">Tutti i tornei di volley in Friuli Venezia Giulia</a>`,
      '    </p>'
    ),
    '  </article>'
  ));
}

/* ---------------------------------------------------------
   Il sommario di apertura.

   Una frase che risponde subito a "quanti tornei ci sono e
   quando": è la riga che un motore AI riprende per intero.
--------------------------------------------------------- */
function periodoTornei(tornei) {
  if (!tornei.length) return '';
  const dal = minuscola(formatData(tornei[0].data, ''));
  const al = minuscola(formatData(tornei[tornei.length - 1].data, ''));
  if (!dal) return '';
  if (!al || al === dal) return dal;
  return `da ${dal} a ${al}`;
}

function sommarioLista(tornei, passati, aggiornato) {
  const quandoAggiornato = aggiornato
    ? ` <em>Elenco aggiornato ${escapeHtml(aggiornato)}.</em>`
    : '';

  if (!tornei.length && !passati.length) {
    return `    <p>Al momento non ci sono tornei in calendario. L'elenco viene
    aggiornato di continuo: torna a controllare, oppure pubblica il tuo
    torneo.${quandoAggiornato}</p>`;
  }

  const frasi = [];

  if (tornei.length) {
    const periodo = periodoTornei(tornei);
    frasi.push(
      `${plurale(tornei.length, "C'è", 'Ci sono')} ` +
      `<strong>${tornei.length} ${plurale(tornei.length, 'torneo', 'tornei')}</strong> ` +
      `in programma${periodo ? `, ${escapeHtml(periodo)},` : ''} in Friuli Venezia ` +
      'Giulia e dintorni: green volley, beach volley e pallavolo, con data, ' +
      'luogo, provincia, formato e costo di iscrizione.'
    );
  } else {
    frasi.push(
      'Al momento non ci sono tornei futuri in programma. Qui sotto trovi ' +
      'le ultime edizioni già disputate.'
    );
  }

  if (passati.length) {
    frasi.push(
      `In archivio ${plurale(passati.length, "c'è", 'ci sono')} anche ` +
      `<strong>${passati.length} ${plurale(passati.length, 'torneo', 'tornei')}</strong> ` +
      `${plurale(passati.length, 'già giocato', 'già giocati')}.`
    );
  }

  return `    <p>${frasi.join(' ')}${quandoAggiornato}</p>`;
}

/* ---------------------------------------------------------
   Le sezioni della home.

   Ogni sezione si dichiara con un id, un titolo e un corpo.
   L'indice in cima alla pagina si costruisce da questa lista,
   quindi non può andare fuori sincrono con quello che c'e'
   sotto: se una sezione non ha contenuto non esiste, e dall'indice sparisce da sola.
--------------------------------------------------------- */
const ID_IN_PROGRAMMA = 'tornei-in-programma';
const ID_PASSATI = 'tornei-passati';
const ID_PROGETTO = 'che-cose-volley-fvg';
const ID_AUTORE = 'chi-ha-sviluppato-volley-fvg';

function sezione(id, titolo, corpo, conta) {
  return {
    id,
    titolo,
    conta: conta || 0,
    html: componi(
      `    <section id="${id}">`,
      `      <h2>${escapeHtml(titolo)}</h2>`,
      corpo,
      '    </section>'
    ),
  };
}

/* ---------------------------------------------------------
   indiceSezioni(), l'indice per i bot.

   Un crawler non "vede" la pagina: legge un flusso di testo e
   deve capire da solo dove finisce una cosa e dove ne comincia
   un'altra. L'indice glielo dice in poche righe, in cima,
   prima di tutto il resto: quali domande trova qui, quanti
   elementi ci sono in ognuna e con che ancora ci arriva.

   Le ancore non sono decorative. Un motore che cita la pagina
   può linkare #chi-ha-sviluppato-volley-fvg invece della home
   generica, e la citazione porta il lettore sul paragrafo
   giusto. Servono anche a noi: sono URL stabili da mettere nei
   messaggi e nelle risposte.

   Resta un indice vero, non un blocco scritto per i soli bot:
   è lo stesso sommario che un lettore umano usa per saltare
   alla parte che gli interessa.
--------------------------------------------------------- */
function indiceSezioni(sezioni) {
  if (sezioni.length < 2) return '';

  const voci = sezioni.map((s) => {
    const conta = s.conta ? ` (${s.conta})` : '';
    return `        <li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.titolo)}</a>${conta}</li>`;
  }).join('\n');

  return `    <nav aria-label="Indice della pagina">
      <h2>Indice</h2>
      <ul>
${voci}
      </ul>
    </nav>`;
}

function sezioneInProgramma(tornei, env) {
  if (!tornei.length) return null;

  const righe = tornei.map((t) => {
    const L = scomponiLuogo(t);
    const celle = [
      escapeHtml(formatDataBreve(t.data, t.dataFine)),
      `<a href="${escapeHtml(urlTorneo(t.id, env))}">${escapeHtml(t.nome)}</a>`,
      escapeHtml(t.disciplina || ''),
      escapeHtml([(t.formati || []).join(', '), t.modalita].filter(Boolean).join(' ')),
      escapeHtml(luogoBreve(L)),
      escapeHtml(L.regione),
      escapeHtml(formatCosto(t.costo) || COSTO_MANCANTE),
    ];
    return `        <tr>
${celle.map((c) => `          <td>${c}</td>`).join('\n')}
        </tr>`;
  }).join('\n');

  /* Le sette colonne restano quelle di prima perché il CSS del
     blocco boot le impagina per posizione (la prima diventa
     l'occhiello con la data, la seconda il titolo della scheda):
     se cambi ordine o numero, aggiorna le regole nth-child in
     STILI_BOOT. */
  const corpo = `      <p>
        Una riga per torneo, con data, disciplina, formato, luogo, provincia,
        regione e costo di iscrizione. Il nome rimanda alla pagina del singolo
        torneo: <strong>per i dettagli completi è necessario seguire quel
        link</strong>, perché è lì che stanno l'orario di inizio, la
        locandina, i contatti dell'organizzatore e la posizione esatta del
        campo.
      </p>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Torneo</th>
            <th>Disciplina</th>
            <th>Formato</th>
            <th>Luogo</th>
            <th>Regione</th>
            <th>Iscrizione</th>
          </tr>
        </thead>
        <tbody>
${righe}
        </tbody>
      </table>`;

  return sezione(ID_IN_PROGRAMMA, 'Tornei di volley in programma', corpo, tornei.length);
}

function sezionePassati(passati, env) {
  if (!passati.length) return null;

  const voci = passati.map((t) => {
    const L = scomponiLuogo(t);
    const coda = [formatDataBreve(t.data, t.dataFine), luogoBreve(L), L.regione]
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');
    const link =
      `<a href="${escapeHtml(urlTorneo(t.id, env))}">${escapeHtml(t.nome)}</a>`;
    return `        <li>${link}${coda ? `, ${coda}` : ''}</li>`;
  }).join('\n');

  const corpo = `      <p>
        Gli ultimi tornei di volley già disputati in Friuli Venezia Giulia
        e dintorni, dal più recente.
      </p>

      <ul>
${voci}
      </ul>`;

  return sezione(ID_PASSATI, 'Tornei passati', corpo, passati.length);
}


/* ---------------------------------------------------------
   bloccoLista(), la home.

   L'ossatura sta tutta qui: h1, sommario, poi le sezioni in
   ordine di interesse. Le sezioni si sanno spegnere da sole
   quando non hanno contenuto, quindi non c'è più un ramo
   separato per il calendario vuoto.
--------------------------------------------------------- */
/* ---------------------------------------------------------
   bloccoLista(), la home.

   L'ossatura sta tutta qui: h1, sommario, indice, poi le
   sezioni in ordine di interesse. Le sezioni si spengono da
   sole quando non hanno contenuto, quindi non c'è più un
   ramo separato per il calendario vuoto.
--------------------------------------------------------- */
export function bloccoLista(tornei, torneiPassati, env, oggiISO, mostraChiSiamo = true) {
  const aggiornato = formatData(oggiISO, '').toLowerCase();

  const sezioni = [
    sezioneInProgramma(tornei, env),
    sezionePassati(torneiPassati, env),
  ];

  // Aggiungiamo le sezioni del progetto solo se richiesto (es. nella Home)
  if (mostraChiSiamo) {
    sezioni.push(...sezioniChiSiamo());
  }

  const sezioniFiltrate = sezioni.filter(Boolean);

  // Aggiunta navigazionePrincipale come primo elemento
  return avvolgi(componi(
    navigazionePrincipale(env),
    '  <article>',
    `    <h1>${escapeHtml(TITOLO_LISTA)}</h1>`,
    sommarioLista(tornei, torneiPassati, aggiornato),
    indiceSezioni(sezioniFiltrate),
    ...sezioniFiltrate.map((s) => s.html),
    '  </article>'
  ));
}

export function bloccoNonTrovato(env) {
  const home = `${escapeHtml(baseSito(env))}/`;

  return avvolgi(componi(
    navigazionePrincipale(env),
    '  <article>',
    '    <h1>Torneo non trovato</h1>',
    '    <p>',
    '      Questo torneo non esiste, non è più pubblicato oppure non è',
    '      attualmente disponibile.',
    '    </p>',
    '    <p>',
    `      <a href="${home}">Torna ai tornei di volley in Friuli Venezia Giulia</a>`,
    '    </p>',
    '  </article>'
  ));
}

/* ---------------------------------------------------------
   Chi siamo.

   Lo stesso testo sta nel Footer del sito (src/components/
   Footer.jsx): è una scelta, non una duplicazione per sbaglio.
   Quello che iniettiamo qui deve essere l'anticipo di contenuto
   che l'utente vede davvero: se stesse solo qui sarebbe testo
   scritto per i soli crawler, che è esattamente la cosa che
   Google chiama hidden text e punisce. Se cambi uno, cambia
   l'altro.

   Serve anche a due domande che i motori AI fanno spesso e a
   cui il sito da solo non sa rispondere: "che cos'è volleyfvg"
   e "chi l'ha fatto".
--------------------------------------------------------- */
export const DESCRIZIONE_SITO = [
  'Volley FVG è un sito che aggrega tornei amatoriali di green volley, beach volley e pallavolo in Friuli Venezia Giulia (FVG) e nelle regioni vicine. Ogni torneo ha la sua pagina con data, orario, luogo, formato di gioco, costo di iscrizione, locandina e i contatti di chi lo organizza',
  'Pubblicare un torneo è gratuito: la proposta viene controllata prima di comparire nella lista dei tornei. Nella bacheca si può invece cercare una squadra a cui unirsi, oppure cercare giocatori per completare la propria.',
];

export const AUTORE = {
  nome: 'Christian Corrò',
  ruolo: 'Ricercatore',
  ente: 'Università degli Studi di Udine',
  enteUrl: 'https://www.uniud.it/',
  profilo: 'https://dmif.uniud.it/it/didattica/dottorato/iai/dottorandi/christian-corro?set_language=it',
};

/* Una frase sola, senza markup, riusata anche nel JSON-LD:
   description della Person e testo della sezione restano
   allineati per costruzione. */
export const FRASE_AUTORE =
  `Volley FVG è ideato e realizzato da ${AUTORE.nome}, ${AUTORE.ruolo.toLowerCase()} ` +
  `all'${AUTORE.ente}. È un progetto indipendente, nato per raccogliere in un ` +
  'posto solo i tornei che altrimenti restano sparsi fra volantini, storie di ' +
  'Instagram e passaparola.';

export function sezioniChiSiamo() {
  const progetto = DESCRIZIONE_SITO
    .map((t) => `      <p>${escapeHtml(t)}</p>`)
    .join('\n');

  /* Il nome è un link, quindi la frase va ricomposta a pezzi
     invece di essere stampata intera: il testo resta identico
     a FRASE_AUTORE. */
  const autore = componi(
    '      <p>',
    '        Volley FVG è ideato e realizzato da',
    `        <a href="${escapeHtml(AUTORE.profilo)}" target="_blank" rel="noopener noreferrer">${escapeHtml(AUTORE.nome)}</a>,`,
    `        ${escapeHtml(AUTORE.ruolo.toLowerCase())} all'${escapeHtml(AUTORE.ente)}.`,
    '        È un progetto indipendente, nato per raccogliere in un posto solo i',
    '        tornei che altrimenti restano sparsi fra volantini, storie di',
    '        Instagram e passaparola.',
    '      </p>'
  );

  return [
    sezione(ID_PROGETTO, "Che cos'è Volley FVG", progetto),
    sezione(ID_AUTORE, 'Chi ha sviluppato Volley FVG?', autore),
  ];
}

/* Compatibilità: il blocco intero come stringa, se serve
   altrove. */
export function bloccoChiSiamo() {
  return sezioniChiSiamo().map((s) => s.html).join('\n');
}

/* ---------------------------------------------------------
   JSON-LD.

   Da tenere in prospettiva: i test più recenti dicono che i
   modelli NON interpretano lo schema, lo leggono come testo
   qualsiasi. Serve a Google, che con SportsEvent può mostrare
   la scheda evento con data e luogo, e quella richiede una
   pagina per evento: è il motivo per cui i tornei sono passati
   a /torneo/<slug>.
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

/* ---------------------------------------------------------
   L'identità del sito, in JSON-LD.

   Iniettando l'ItemList si porta via il blocco WebSite che sta
   in index.html: applyPreview toglie il ld+json esistente per
   non lasciarne due che si contraddicono. Quindi lo rimetto
   qui dentro, in un @graph, insieme alla Person: così la
   paternità del sito è un'entità dichiarata e non solo una
   frase in fondo alla pagina.
--------------------------------------------------------- */
export function jsonLdSito(tornei, env) {
  const base = baseSito(env);
  const idAutore = `${base}/#christian-corro`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: 'Volley FVG',
        description: DESCRIZIONE_SITO[0],
        inLanguage: 'it-IT',
        author: { '@id': idAutore },
        creator: { '@id': idAutore },
      },
      {
        '@type': 'Person',
        '@id': idAutore,
        name: AUTORE.nome,
        url: AUTORE.profilo,
        description: FRASE_AUTORE,
        jobTitle: AUTORE.ruolo,
        affiliation: {
          '@type': 'CollegeOrUniversity',
          name: AUTORE.ente,
          url: AUTORE.enteUrl,
        },
      },
      { ...jsonLdLista(tornei, env), '@context': undefined },
    ],
  };
}

export function jsonLdLista(tornei, env) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITOLO_LISTA,
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
    [
      voce(`${base}/`, oggiISO, '1.0', 'daily'),
      voce(`${base}/tornei`, oggiISO, '0.9', 'daily'),
      voce(`${base}/bacheca`, oggiISO, '0.9', 'daily'),
      ...righe
    ].join('\n') +
    '\n</urlset>\n';
}

/* ---------------------------------------------------------
   llmsTxt(), l'indice del sito in un file solo.

   sitemap.xml dice a un crawler quali URL esistono, e basta:
   per sapere che cosa c'è dentro deve scaricarli tutti. Questo
   file glielo racconta in una schermata di testo, nel formato
   llms.txt: titolo, una riga di sintesi, poi le sezioni con un
   punto elenco per torneo, link e descrizione sulla stessa
   riga.

   È markdown senza HTML da ripulire, quindi un modello lo legge
   intero anche quando non segue nessun link, e chi invece li
   segue arriva su una pagina che dice le stesse cose. Nessuna
   versione parallela del sito: le frasi sono le stesse che
   stanno in pagina, generate dalle stesse funzioni.

   Da servire su /llms.txt, con la stessa rotta di sitemap.xml
   nel worker, e da dichiarare in robots.txt.
--------------------------------------------------------- */
function vocellmsTxt(torneo, env) {
  /* Le parentesi quadre nel nome romperebbero il link markdown. */
  const nome = String(torneo.nome || '').replace(/[[\]]/g, '');
  return `- [${nome}](${urlTorneo(torneo.id, env)}): ${fraseTorneo(torneo)}`;
}

export function llmsTxt(tornei, torneiPassati, env, oggiISO) {
  const base = baseSito(env);
  const aggiornato = minuscola(formatData(oggiISO, ''));
  const righe = [];

  righe.push('# Volley FVG');
  righe.push('');
  righe.push(`> ${DESCRIZIONE_SITO[0]}`);
  righe.push('');
  if (aggiornato) righe.push(`Elenco aggiornato ${aggiornato}.`);
  righe.push(`Sito: ${base}/`);
  righe.push('');

  righe.push('## Tornei di volley in programma');
  righe.push('');
  if (tornei.length) {
    const periodo = periodoTornei(tornei);
    righe.push(
      `${tornei.length} ${plurale(tornei.length, 'torneo', 'tornei')} ` +
      `in programma${periodo ? `, ${periodo}` : ''}. ` +
      'Ogni voce ha la sua pagina con orario, locandina, contatti ' +
      "dell'organizzatore e posizione del campo."
    );
    righe.push('');
    for (const t of tornei) righe.push(vocellmsTxt(t, env));
  } else {
    righe.push('Al momento non ci sono tornei in programma.');
  }
  righe.push('');

  if (torneiPassati.length) {
    righe.push('## Tornei passati');
    righe.push('');
    righe.push('Edizioni già disputate, dalla più recente.');
    righe.push('');
    for (const t of torneiPassati) righe.push(vocellmsTxt(t, env));
    righe.push('');
  }

  righe.push("## Che cos'è Volley FVG");
  righe.push('');
  for (const p of DESCRIZIONE_SITO) {
    righe.push(p);
    righe.push('');
  }

  righe.push('## Chi ha sviluppato Volley FVG');
  righe.push('');
  righe.push(FRASE_AUTORE);
  righe.push('');
  righe.push(`Profilo: ${AUTORE.profilo}`);
  righe.push('');

  righe.push('## Altro');
  righe.push('');
  righe.push(`- [Home](${base}/): la pagina principale.`);
  righe.push(`- [Tornei](${base}/tornei): pagina dedicata all'elenco dei tornei.`);
  righe.push(`- [Bacheca](${base}/bacheca): annunci per cercare squadre o giocatori.`);
  righe.push(`- [Sitemap](${base}/sitemap.xml): tutti gli URL del sito.`);
  righe.push('');

  return `${righe.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}