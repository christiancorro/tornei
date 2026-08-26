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
