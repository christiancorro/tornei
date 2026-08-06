import { MESI, MESI_BREVI, GIORNI_BREVI } from './constants';

export function getMapsUrl(t) {
  const query = `${t.luogo}, ${t.comune}, ${t.provincia}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    ora: '',
    luogo: '',
    comune: '',
    provincia: 'UD',
    costo: '',
    iscrizioniEntro: '',
    organizzatore: '',
    descrizioneOrganizzatore: '',
    instagram: '',
    facebook: '',
    locandina: '',
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

export function formatDataLunga(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const giorno = GIORNI_BREVI[new Date(y, m - 1, d).getDay()];
  return `${giorno} ${d} ${MESI[m - 1]}`;
}

export function formatDataRange(inizio, fine) {
  if (!inizio) return '—';
  if (!fine || fine === inizio) return formatDataLunga(inizio);
  const [y1, m1, d1] = inizio.split('-').map((n) => parseInt(n, 10));
  const [y2, m2, d2] = fine.split('-').map((n) => parseInt(n, 10));
  const g1 = GIORNI_BREVI[new Date(y1, m1 - 1, d1).getDay()];
  const g2 = GIORNI_BREVI[new Date(y2, m2 - 1, d2).getDay()];
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

export function dayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getDay();
}

export function toggleValue(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function groupByMonth(list) {
  const groups = {};
  list.forEach((t) => {
    const key = t.data.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.keys(groups)
    .sort()
    .map((key) => {
      const [y, m] = key.split('-');
      return { key, label: `${MESI[parseInt(m, 10) - 1]} ${y}`, items: groups[key] };
    });
}
