import { MESI, MESI_BREVI, GIORNI_BREVI, GIORNI } from './constants';

/* Il luogo del torneo. I tornei nuovi lo salvano in `luogo` (che può
   essere un comune, una frazione, un parco, un impianto...); quelli
   vecchi lo tenevano in `comune`. Fallback così i vecchi continuano a
   mostrarsi e a essere cercabili senza migrazione dei dati. */
export function luogoDi(t) {
  return (t && (t.luogo || t.comune)) || '';
}

export function getMapsUrl(t) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(luogoDi(t))}`;
}

export function emptyTournament() {
  return {
    id: '',
    nome: '',
    disciplina: 'Green Volley',
    formati: [],
    modalita: '',
    data: '',
    dataFine: '',
    // L'ora di inizio non è più chiesta nel form: i tornei nuovi
    // partono con un default alle 09:00 (ora di Roma) nel caso serva
    // a valle. Non viene mostrata da nessuna parte.
    ora: '09:00',
    // `luogo` sostituisce `comune`: può essere un comune ma anche un
    // parco, un impianto, una frazione. `comune` resta a '' solo per
    // compatibilità di lettura con i tornei vecchi.
    luogo: '',
    comune: '',
    costo: '',
    organizzatore: '',
    descrizioneOrganizzatore: '',
    instagram: '',
    facebook: '',
    sitoWeb: '',
    // `locandina` è il file grande mostrato nel dettaglio;
    // `locandinaThumb` è la preview piccola usata nelle card di
    // lista. Le card leggono il thumb con fallback al grande, così
    // i tornei vecchi (senza thumb) continuano a funzionare.
    locandina: '',
    locandinaPath: '',
    locandinaThumb: '',
    locandinaThumbPath: '',
  };
}

export function formatDataBreve(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MESI_BREVI[parseInt(m, 10) - 1]}`;
}

export function timeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diff = Math.floor((now - past) / 1000);

  const minutes = Math.floor(diff / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minuto' : 'minuti'} fa`;
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  if (days < 30) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  if (months < 12) return `${months} ${months === 1 ? 'mese' : 'mesi'} fa`;

  return past.toLocaleDateString('it-IT');
}

/* `giornoEsteso` sceglie fra "Dom" e "Domenica": nelle liste fitte
   serve la sigla, nella scheda del torneo c'è spazio per il nome
   intero. Di default resta la sigla, così le chiamate già in giro
   non cambiano comportamento. */
export function formatDataLunga(iso, { giornoEsteso = false } = {}) {
  if (!iso) return '—';
  const nomiGiorni = giornoEsteso ? GIORNI : GIORNI_BREVI;
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const giorno = nomiGiorni[new Date(y, m - 1, d).getDay()];
  return `${giorno} ${d} ${MESI[m - 1]}`;
}

/* Solo numero del giorno, mese e anno — senza il nome del giorno.
   Es. "6 Agosto 2026". Usata nelle didascalie delle polaroid dei
   trofei, dove il nome del giorno non serve. Con `conAnno: false`
   torna "6 Agosto". */
export function formatGiornoMeseAnno(iso, { conAnno = false } = {}) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return conAnno ? `${d} ${MESI[m - 1]} ${y}` : `${d} ${MESI[m - 1]}`;
}

export function formatDataRange(inizio, fine, { giornoEsteso = false } = {}) {
  if (!inizio) return '—';
  if (!fine || fine === inizio) return formatDataLunga(inizio, { giornoEsteso });
  const nomiGiorni = giornoEsteso ? GIORNI : GIORNI_BREVI;
  const [y1, m1, d1] = inizio.split('-').map((n) => parseInt(n, 10));
  const [y2, m2, d2] = fine.split('-').map((n) => parseInt(n, 10));
  const g1 = nomiGiorni[new Date(y1, m1 - 1, d1).getDay()];
  const g2 = nomiGiorni[new Date(y2, m2 - 1, d2).getDay()];
  if (y1 === y2 && m1 === m2) {
    return `${g1} ${d1} – ${g2} ${d2} ${MESI[m1 - 1]}`;
  }
  return `${g1} ${d1} ${MESI[m1 - 1]} – ${g2} ${d2} ${MESI[m2 - 1]}`;
}

export function formatStubGiorno(inizio, fine) {
  const [y1, m1s, d1s] = inizio.split('-');
  const m1 = parseInt(m1s, 10);
  const d1 = parseInt(d1s, 10);
  if (!fine || fine === inizio) {
    return { giorno: String(d1), mese: MESI_BREVI[m1 - 1], giornoSett: GIORNI_BREVI[dayOfWeek(inizio)] };
  }
  const [y2, m2s, d2s] = fine.split('-');
  const m2 = parseInt(m2s, 10);
  const d2 = parseInt(d2s, 10);
  const sameMonth = m1 === m2;
  return {
    giorno: sameMonth ? `${d1}-${d2}` : `${d1}/${m1}-${d2}/${m2}`,
    mese: sameMonth ? MESI_BREVI[m1 - 1] : '',
    giornoSett: sameMonth
      ? `${GIORNI_BREVI[new Date(y1, m1 - 1, d1).getDay()]}-${GIORNI_BREVI[new Date(y2, m2 - 1, d2).getDay()]}`
      : '',
  };
}

/* Giorno successivo a una data ISO (YYYY-MM-DD), in ISO.
   `new Date` normalizza da solo i riporti di mese/anno (es. il
   giorno dopo il 31 gennaio è il 1 febbraio). */
export function nextDayISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d + 1);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function dayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getDay();
}

export function toggleValue(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function groupByMonth(list, { descending = false } = {}) {
  const groups = {};
  list.forEach((t) => {
    const key = t.data.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  const keys = Object.keys(groups).sort();
  if (descending) keys.reverse();
  return keys.map((key) => {
    const [y, m] = key.split('-');
    /* Con descending: dentro il mese vanno le date più recenti in alto.
       Copio l'array perché il caller potrebbe averlo passato per
       riferimento (in-place sarebbe sorpresa spiacevole). */
    const items = descending ? [...groups[key]].reverse() : groups[key];
    return { key, label: `${MESI[parseInt(m, 10) - 1]} ${y}`, items };
  });
}

/* Data di oggi in formato ISO (YYYY-MM-DD), in ora locale.
   toISOString() darebbe UTC — a mezzanotte italiana sarebbe già
   il giorno dopo per lo standard, e i tornei di oggi verrebbero
   confusi per passati. */
export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* Un torneo è "passato" quando il suo ultimo giorno è precedente a
   oggi. Se dura più giorni conta la dataFine, altrimenti la data
   singola. Un torneo che si sta tenendo *oggi* non è passato:
   nasconderlo mentre sta ancora giocando sarebbe strano. */
export function isPassato(t, todayIso) {
  const ultimoGiorno = t.dataFine || t.data;
  return ultimoGiorno < todayIso;
}

export function splitPassatoFuturo(list, todayIso) {
  const futuri = [];
  const passati = [];
  for (const t of list) {
    if (isPassato(t, todayIso)) passati.push(t);
    else futuri.push(t);
  }
  return { futuri, passati };
}