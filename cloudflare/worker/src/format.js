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

const GIORNI = [
  'domenica', 'lunedì', 'martedì', 'mercoledì',
  'giovedì', 'venerdì', 'sabato',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ORA = /^(\d{1,2}):(\d{2})$/;

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

function normalizzaOra(value) {
  if (typeof value !== 'string') return '';
  const m = ORA.exec(value.trim());
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/* ---------------------------------------------------------
   formatData(data, dataFine, ora)

   Un giorno solo        → "domenica 6 settembre 2026, ore 09:00"
   Due giorni, stesso mese → "6 - 7 settembre 2026"
   Mesi diversi          → "30 agosto - 1 settembre 2026"
   Anni diversi          → "30 dicembre 2026 - 1 gennaio 2027"

   Sul range non stampo l'ora: "dal 6 al 7 settembre, ore 09:00"
   sarebbe ambiguo (l'ora di quale giorno?).
--------------------------------------------------------- */
export function formatData(data, dataFine, ora) {
  const inizio = parseISO(data);
  if (!inizio) return '';

  const fine = parseISO(dataFine);
  const gi = inizio.getUTCDate();
  const mi = inizio.getUTCMonth();
  const ai = inizio.getUTCFullYear();

  if (!fine || fine.getTime() <= inizio.getTime()) {
    const giornoSettimana = GIORNI[inizio.getUTCDay()];
    const base = `${giornoSettimana} ${gi} ${MESI[mi]} ${ai}`;
    const oraOk = normalizzaOra(ora);
    return oraOk ? `${base}, ore ${oraOk}` : base;
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
