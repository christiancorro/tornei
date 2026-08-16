import {
  SAND,
  SEA,
  SEA_DARK,
  GRASS,
  GRASS_DARK,
  SABBIA,
  SABBIA_DARK,
} from './theme';

export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const MESI_BREVI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
export const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export const DISCIPLINE = ['Green Volley', 'Beach Volley', 'Pallavolo'];
export const FORMATI = ['2x2', '3x3', '4x4', '6x6'];

/* Un colore per disciplina, condiviso dai filtri e dal form:
   così il chip verde significa "Green Volley" ovunque. */
export const DISCIPLINE_COLORS = {
  'Green Volley': GRASS_DARK,
  'Beach Volley': SABBIA_DARK,
  'Pallavolo': SEA_DARK,
};

export const STUB_STYLE = {
  'Green Volley': { bg: `linear-gradient(155deg, ${GRASS}, ${GRASS_DARK})`, tagBg: '#E7F0DE', tagText: GRASS_DARK },
  'Beach Volley': { bg: `linear-gradient(155deg, ${SABBIA}, ${SABBIA_DARK})`, tagBg: SAND, tagText: SABBIA_DARK },
  'Pallavolo': { bg: `linear-gradient(155deg, ${SEA}, ${SEA_DARK})`, tagBg: '#E0F2F4', tagText: SEA_DARK },
};

export const DURATE = [
  { value: '1', label: '1 giorno' },
  { value: '2+', label: '2+ giorni' },
];

/* ---------------------------------------------------------
   View modes for the tournament section. The toggle in the
   results bar cycles through them in this order.
--------------------------------------------------------- */
export const VIEW_MODES = ['lista', 'mappa', 'calendario'];
export const VIEW_MODE_LABELS = {
  lista: 'Lista',
  mappa: 'Mappa',
  calendario: 'Calendario',
};

// export function nextViewMode(current) {
//   const i = VIEW_MODES.indexOf(current);
//   return VIEW_MODES[(i + 1) % VIEW_MODES.length];
// }

export function nextViewMode(mode) {
  if (mode === 'lista') return 'mappa';
  return 'lista';
}