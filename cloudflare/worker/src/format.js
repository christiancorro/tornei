/* ---------------------------------------------------------
   Formattazione dei valori che finiscono nella preview.

   Niente Intl / toLocaleDateString: il runtime dei Worker ha
   un ICU ridotto e su alcune build stampa "6 set. 2026" con
   il punto, o addirittura in inglese. Gli array qui sotto sono
   copiati da src/constants.js del frontend, così la stringa
   della preview e quella della card dicono la stessa cosa.
--------------------------------------------------------- */

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/* Maiuscoli: il giorno della settimana apre la descrizione, e in
   apertura di frase ci va la maiuscola. I mesi restano minuscoli,
   come vuole l'italiano. */
const GIORNI = [
  'Domenica', 'Lunedì', 'Martedì', 'Mercoledì',
  'Giovedì', 'Venerdì', 'Sabato',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* Le date dei tornei sono stringhe "YYYY-MM-DD" senza fuso.
   Le interpreto sempre a mezzanotte UTC: così il giorno della
   settimana è deterministico e non cambia a seconda di dove
   gira il Worker (che è ovunque). */
function parseISO(value) {
  if (typeof value !== 'string') return null;
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const anno = Number(y);
  const mese = Number(mo);
  const giorno = Number(d);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const date = new Date(Date.UTC(anno, mese - 1, giorno));
  // Rifiuta il 31 febbraio & co.: Date normalizza in silenzio, quindi
  // controllo che i pezzi siano sopravvissuti al round-trip.
  if (
    date.getUTCFullYear() !== anno ||
    date.getUTCMonth() !== mese - 1 ||
    date.getUTCDate() !== giorno
  ) {
    return null;
  }
  return date;
}

/* ---------------------------------------------------------
   formatData(data, dataFine)

   Un giorno solo          → "Sabato 29 agosto 2026"
   Due giorni, stesso mese → "6 - 7 settembre 2026"
   Mesi diversi            → "30 agosto - 1 settembre 2026"
   Anni diversi            → "30 dicembre 2026 - 1 gennaio 2027"

   L'ora di inizio non compare: in una preview conta il quando
   in senso largo, e "ore 09:00" rubava spazio alla riga senza
   aggiungere granché. Chi apre il link la trova nella card.
--------------------------------------------------------- */
export function formatData(data, dataFine) {
  const inizio = parseISO(data);
  if (!inizio) return '';

  const fine = parseISO(dataFine);
  const gi = inizio.getUTCDate();
  const mi = inizio.getUTCMonth();
  const ai = inizio.getUTCFullYear();

  if (!fine || fine.getTime() <= inizio.getTime()) {
    return `${GIORNI[inizio.getUTCDay()]} ${gi} ${MESI[mi]} ${ai}`;
  }

  const gf = fine.getUTCDate();
  const mf = fine.getUTCMonth();
  const af = fine.getUTCFullYear();

  if (ai !== af) return `${gi} ${MESI[mi]} ${ai} - ${gf} ${MESI[mf]} ${af}`;
  if (mi !== mf) return `${gi} ${MESI[mi]} - ${gf} ${MESI[mf]} ${af}`;
  return `${gi} - ${gf} ${MESI[mi]} ${ai}`;
}

/* `luogo` è il campo nuovo, `comune` quello dei tornei vecchi.
   Stessa precedenza usata da luogoDi() nel frontend. */
export function formatLuogo(torneo) {
  const v = torneo.luogo || torneo.comune || '';
  return typeof v === 'string' ? v.trim() : '';
}

/* ---------------------------------------------------------
   formatCosto(costo)

   Il campo è testo libero: a volte "15", a volte
   "10 (pranzo + maglietta)", a volte "gratuito".

   Metto il simbolo € solo davanti a un valore che inizia con
   una cifra. Così "15" diventa "€ 15" e "10 (pranzo +
   maglietta)" diventa "€ 10 (pranzo + maglietta)", ma
   "gratuito" resta "gratuito" e non "€ gratuito".
--------------------------------------------------------- */
export function formatCosto(costo) {
  const v = String(costo ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  if (/^[€$]/.test(v)) return v;      // simbolo già scritto dall'utente
  if (/^\d/.test(v)) return `€ ${v}`; // "15", "10 (pranzo…)"
  return v;                            // "gratuito", "offerta libera"
}

/* Riduce a una riga sola e taglia su confine di parola. Le
   descrizioni Open Graph oltre i ~200 caratteri vengono
   troncate comunque dai client, meglio farlo noi con i puntini
   al posto giusto. */
export function troncaTesto(testo, max = 200) {
  const pulito = String(testo || '').replace(/\s+/g, ' ').trim();
  if (pulito.length <= max) return pulito;
  const tagliato = pulito.slice(0, max - 1);
  const spazio = tagliato.lastIndexOf(' ');
  return `${(spazio > max * 0.6 ? tagliato.slice(0, spazio) : tagliato).trimEnd()}…`;
}

/* ---------------------------------------------------------
   Fuso di Roma senza Intl.

   Stesso motivo del blocco in cima al file: l'ICU dei Worker non
   è affidabile, e `timeZone: 'Europe/Rome'` è proprio la parte
   che salta per prima. La regola europea però è fissa dal 2002 e
   si calcola in cinque righe: ora legale dall'ultima domenica di
   marzo alle 01:00 UTC all'ultima domenica di ottobre, stessa ora.

   Serve a due cose: sapere che giorno è *in Italia* (a mezzanotte
   e mezza UTC a Roma è già domani, e un torneo di oggi non deve
   sparire dalla lista), e scrivere lo startDate in JSON-LD con
   l'offset giusto — un torneo di giugno alle 9:00 dichiarato in
   UTC diventa un torneo alle 11:00.
--------------------------------------------------------- */

function ultimaDomenica(anno, mese) {
  // Giorno 0 del mese dopo = ultimo giorno di questo mese.
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0));
  return ultimo.getUTCDate() - ultimo.getUTCDay();
}

function eOraLegale(date) {
  const anno = date.getUTCFullYear();
  const inizio = Date.UTC(anno, 2, ultimaDomenica(anno, 2), 1);
  const fine = Date.UTC(anno, 9, ultimaDomenica(anno, 9), 1);
  const t = date.getTime();
  return t >= inizio && t < fine;
}

function due(n) { return String(n).padStart(2, '0'); }

/* "+02:00" d'estate, "+01:00" d'inverno, per la data del torneo
   (non per adesso: un torneo di gennaio letto ad agosto vuole
   comunque +01:00). */
export function offsetRoma(dataISO) {
  const d = parseISO(dataISO);
  if (!d) return '+01:00';
  /* Mezzogiorno, non mezzanotte: il cambio d'ora scatta alle 01:00
     UTC, quindi il 29 marzo a mezzanotte UTC è ancora ora solare
     mentre il torneo, che comincia in mattinata, è già ora legale.
     Ancorare a metà giornata dà l'offset che vale per l'evento. */
  const meta = new Date(d.getTime() + 12 * 3600000);
  return eOraLegale(meta) ? '+02:00' : '+01:00';
}

/* La data di oggi a Roma, in formato YYYY-MM-DD. */
export function oggiRoma(adesso = new Date()) {
  const ore = eOraLegale(adesso) ? 2 : 1;
  const locale = new Date(adesso.getTime() + ore * 3600000);
  return `${locale.getUTCFullYear()}-${due(locale.getUTCMonth() + 1)}-${due(locale.getUTCDate())}`;
}

/* Versione compatta per la colonna "Data" della tabella:
   "sab 29 ago" — o "sab 29 ago - dom 30 ago" per i due giorni.
   L'anno lo mette chi chiama, una volta sola per riga. */
const MESI_BREVI = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function breve(d) {
  return `${GIORNI_BREVI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_BREVI[d.getUTCMonth()]}`;
}

export function formatDataBreve(data, dataFine) {
  const inizio = parseISO(data);
  if (!inizio) return '';
  const fine = parseISO(dataFine);
  const anno = inizio.getUTCFullYear();
  if (!fine || fine.getTime() <= inizio.getTime()) return `${breve(inizio)} ${anno}`;
  return `${breve(inizio)} - ${breve(fine)} ${fine.getUTCFullYear()}`;
}

/* L'anno di una data ISO, per raggruppare o etichettare. */
export function annoDi(dataISO) {
  const d = parseISO(dataISO);
  return d ? d.getUTCFullYear() : null;
}
