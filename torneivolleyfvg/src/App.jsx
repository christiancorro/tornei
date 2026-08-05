import React, { useState, useMemo } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Euro,
  Pin,
  SlidersHorizontal,
  X,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Settings2,
  AlertTriangle,
} from 'lucide-react';

import { FaFacebook, FaInstagram } from "react-icons/fa";

/* ---------------------------------------------------------
   Design tokens — grounded in the subject: sand, grass, sea,
   sun. Kept as plain hex + inline style throughout so nothing
   depends on Tailwind's JIT/arbitrary-value features.
--------------------------------------------------------- */
const SAND = '#fdf5e6';
const CARD_BG = '#fffcf5';
const INK = '#22301F';
const SUN = '#F5A524';
const SEA = '#1C7C8C';
const SEA_DARK = '#145A66';
const GRASS = '#a0f34e';
const GRASS_DARK = '#488222';
const CLAY = '#B8472A';
const CLAY_DARK = '#8C3520';
const SABBIA = '#f0c843';
const SABBIA_DARK = '#c78c20';

// Bacheca (notice board) tokens — kept separate from the discipline
// colors above so a post's color never implies Beach/Green Volley.
const BOARD_A = SUN; // 'Cerco squadra' accent — reuses the primary accent
const BOARD_B = '#6B4E8E'; // 'Cercasi giocatori' accent — a new, distinct hue
const CORK = '#C9A876';
const CORK_FRAME = '#7A5230';
const PIN_COLOR = '#C0392B';
const NOTE_YELLOW = '#F5E6A3';
const NOTE_WHITE = '#FFFDF6';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_BREVI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const DISCIPLINE = ['Green Volley', 'Beach Volley', 'Pallavolo'];
const FORMATI = ['2x2', '3x3', '4x4', '6x6'];
const PROVINCE = ['UD', 'PN', 'GO', 'TS'];
const PROVINCE_LABELS = { UD: 'Udine', PN: 'Pordenone', GO: 'Gorizia', TS: 'Trieste' };

const STUB_STYLE = {
  'Green Volley': { bg: `linear-gradient(155deg, ${GRASS}, ${GRASS_DARK})`, tagBg: '#E7F0DE', tagText: GRASS_DARK },
  'Beach Volley': { bg: `linear-gradient(155deg, ${SABBIA}, ${SABBIA_DARK})`, tagBg: SAND, tagText: SABBIA_DARK },
  'Pallavolo': { bg: `linear-gradient(155deg, ${SEA}, ${SEA_DARK})`, tagBg: '#E0F2F4', tagText: SEA_DARK },
};

const DURATE = [
  { value: '1', label: '1 giorno' },
  { value: '2+', label: '2+ giorni' },
];

/* ---------------------------------------------------------
   Sample data — 5 Green Volley + 2 Beach Volley, all in FVG
--------------------------------------------------------- */
const INITIAL_TOURNAMENTS = [
  {
    id: 't1',
    nome: 'Smash in the Grass',
    disciplina: 'Green Volley',
    formati: ['3x3'],
    modalita: 'Misto, minimo 1 donna in campo',
    data: '2026-08-15',
    dataFine: '',
    ora: '09:00',
    luogo: 'Parco del Cormor',
    comune: 'Udine',
    provincia: 'UD',
    costo: '15',
    iscrizioniEntro: '2026-08-10',
    organizzatore: 'ASD Udine Volley',
    descrizioneOrganizzatore: 'Torneo giunto alla 3ª edizione. Per iscrizioni last-minute o info scrivete a Marco, 338 123 4567.',
    instagram: 'https://instagram.com/udinevolley',
    facebook: 'https://facebook.com/udinevolley',
    locandina: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT410OQY276wgF3Ojd9jIZ_tBBrro03UBHgmWEX5jnoJBetFw54M2C_6ykY&s=10',
  },
  {
    id: 't2',
    nome: 'Ferragosto Green Cup',
    disciplina: 'Green Volley',
    formati: ['4x4'],
    modalita: 'Misto, minimo 2 donne in campo',
    data: '2026-08-16',
    dataFine: '',
    ora: '15:30',
    luogo: 'Campo Sportivo Comunale',
    comune: 'Codroipo',
    provincia: 'UD',
    costo: '€60',
    iscrizioniEntro: '2026-08-12',
    organizzatore: 'Codroipo Sport Events',
    descrizioneOrganizzatore: '',
    instagram: 'https://instagram.com/codroiposport',
    facebook: '',
    locandina: '',
  },
  {
    id: 't3',
    nome: 'Sunset Green Volley',
    disciplina: 'Green Volley',
    formati: ['3x3'],
    modalita: 'Misto, minimo 1 donna in campo',
    data: '2026-08-22',
    dataFine: '',
    ora: '18:00',
    luogo: 'Parco Basaglia',
    comune: 'Gorizia',
    provincia: 'GO',
    costo: '€12 a giocatore',
    iscrizioniEntro: '2026-08-18',
    organizzatore: 'Gorizia Volley Club',
    descrizioneOrganizzatore: '',
    instagram: 'https://instagram.com/goriziavolley',
    facebook: 'https://facebook.com/goriziavolley',
    locandina: '',
  },
  {
    id: 't4',
    nome: 'Lignano Beach Marathon',
    disciplina: 'Beach Volley',
    formati: ['2x2', '3x3', '4x4'],
    modalita: 'Open, senza vincoli di genere — iscriviti a una o più categorie',
    data: '2026-08-29',
    dataFine: '2026-08-30',
    ora: '09:00',
    luogo: 'Spiaggia Lignano Pineta',
    comune: 'Lignano Sabbiadoro',
    provincia: 'UD',
    costo: '€25 a coppia (2x2), €15 a giocatore (3x3/4x4)',
    iscrizioniEntro: '2026-08-24',
    organizzatore: 'Lignano Beach Tour',
    descrizioneOrganizzatore: 'Due giorni no-stop sulla sabbia: sabato 2x2 e 3x3, domenica 4x4. Premi per il vincitore assoluto. Info: Sara, 347 987 6543.',
    instagram: 'https://instagram.com/lignanobeachtour',
    facebook: 'https://facebook.com/lignanobeachtour',
    locandina: '',
  },
  {
    id: 't5',
    nome: 'Grado Sand Battle',
    disciplina: 'Beach Volley',
    formati: ['4x4'],
    modalita: 'Misto, minimo 2 donne in campo',
    data: '2026-09-05',
    dataFine: '',
    ora: '16:00',
    luogo: 'Spiaggia Grado Pineta',
    comune: 'Grado',
    provincia: 'GO',
    costo: '€70 a squadra',
    iscrizioniEntro: '2026-08-30',
    organizzatore: 'Grado Beach Events',
    descrizioneOrganizzatore: '',
    instagram: 'https://instagram.com/gradobeachevents',
    facebook: '',
    locandina: '',
  },
  {
    id: 't6',
    nome: 'Erba Alta Fest',
    disciplina: 'Green Volley',
    formati: ['2x2'],
    modalita: 'Open, senza vincoli di genere',
    data: '2026-09-06',
    dataFine: '',
    ora: '09:30',
    luogo: 'Parco San Valentino',
    comune: 'Pordenone',
    provincia: 'PN',
    costo: '€20 a coppia',
    iscrizioniEntro: '2026-09-01',
    organizzatore: 'ASD Pordenone Volley',
    descrizioneOrganizzatore: '',
    instagram: 'https://instagram.com/pordenonevolley',
    facebook: 'https://facebook.com/pordenonevolley',
    locandina: '',
  },
  {
    id: 't7',
    nome: 'Settembre in Movimento',
    disciplina: 'Green Volley',
    formati: ['6x6'],
    modalita: 'Misto, minimo 2 donne in campo',
    data: '2026-09-12',
    dataFine: '',
    ora: '10:00',
    luogo: 'Bosco Bovedo',
    comune: 'Trieste',
    provincia: 'TS',
    costo: '€90 a squadra',
    iscrizioniEntro: '2026-09-05',
    organizzatore: 'Trieste Volley Community',
    descrizioneOrganizzatore: '',
    instagram: 'https://instagram.com/triestevolley',
    facebook: '',
    locandina: '',
  },
];

const INITIAL_ANNUNCI = [
  {
    id: 'b1',
    tipo: 'cerca_giocatore',
    testo:
      'ASD Udine Volley cerca 2 giocatori per completare il roster del Green Volley di Ferragosto (15/8, Parco del Cormor). Livello amatoriale, si gioca per divertirsi. Scrivete su IG @asdudinevolley.',
    data: '2026-08-04',
    rotazione: -2.5,
  },
  {
    id: 'b2',
    tipo: 'cerca_squadra',
    testo:
      'Ciao! Sono libera per tutto agosto, gioco centrale/opposto da 4 anni, livello amatoriale ma con tanta voglia di giocare 😄 Zona Udine/Pordenone, ma mi muovo. Scrivetemi su IG @giulia.volley',
    data: '2026-08-03',
    rotazione: 3,
  },
  {
    id: 'b3',
    tipo: 'cerca_giocatore',
    testo: 'Squadra mista cerca 2 donne per rispettare il minimo richiesto dal regolamento. Torneo 3x3 a Gorizia il 22/8. Rispondete pure qui sotto o al 333 456 7890.',
    data: '2026-08-02',
    rotazione: -1.5,
  },
  {
    id: 'b4',
    tipo: 'cerca_squadra',
    testo: 'Cerco squadra per il Beach Volley di Lignano (29-30/8). Gioco da qualche stagione, buona ricezione, disponibile tutto il weekend. Contattatemi pure!',
    data: '2026-08-01',
    rotazione: 2,
  },
  {
    id: 'b5',
    tipo: 'cerca_giocatore',
    testo: 'Cerchiamo un quarto giocatore per il 2x2 di Pordenone (6/9), livello base+. Chi si aggiunge? Scrivete in DM.',
    data: '2026-07-30',
    rotazione: -3.5,
  },
];

function getMapsUrl(t) {
  const query = `${t.luogo}, ${t.comune}, ${t.provincia}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function emptyTournament() {
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

function formatDataBreve(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MESI_BREVI[parseInt(m, 10) - 1]}`;
}

function formatDataLunga(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const giorno = GIORNI_BREVI[new Date(y, m - 1, d).getDay()];
  return `${giorno} ${d} ${MESI[m - 1]}`;
}

function formatDataRange(inizio, fine) {
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

function formatStubGiorno(inizio, fine) {
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

function dayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getDay();
}

function toggleValue(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function groupByMonth(list) {
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

function Chip({ active, onClick, children, color }) {
  const c = color || INK;
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-xs font-bold border-2 border-transparent transition-colors whitespace-nowrap shrink-0 "
      style={{
        borderColor: active ? c : 'rgba(34,48,31,0.25)',
        backgroundColor: active ? c : 'transparent',
        color: active ? '#FFFFFF' : INK,
      }}
    >
      {children}
    </button>
  );
}

function NavTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-sm font-bold transition-colors "
      style={{
        backgroundColor: active ? INK : 'transparent',
        color: active ? SAND : INK,
        opacity: active ? 1 : 0.55,
      }}
    >
      {children}
    </button>
  );
}

function MonthHeader({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-black text-xl sm:text-2xl uppercase tracking-wide" style={{ color: INK }}>
        {label}
      </h2>
      <div className="flex-1 h-0" style={{ borderTop: '2px dashed rgba(34,48,31,0.15)' }} />
    </div>
  );
}

/* ---------------------------------------------------------
   Tournament card — styled as a torn event ticket: a date
   stub on the left, perforation, details on the right.
--------------------------------------------------------- */
function TournamentCard({ t, delay, isAdmin, onEdit, onDeleteRequest, onOpenDetail }) {
  const [imgOk, setImgOk] = useState(true);
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const stub = formatStubGiorno(t.data, t.dataFine);
  const hasPoster = Boolean(t.locandina) && imgOk;
  const stubSize = stub.giorno.length <= 2 ? 'text-3xl' : stub.giorno.length <= 5 ? 'text-[1.8rem]' : 'text-base';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(t)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(t);
        }
      }}
      aria-label={`Vedi dettagli di ${t.nome}`}
      className="group relative bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300 flex overflow-hidden border cursor-pointer "
      style={{
        backgroundColor: CARD_BG,
        borderColor: 'rgba(34,48,31,0.1)',
        animation: 'card-in 0.3s ease both',
        animationDelay: `${delay}ms`
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center text-center py-4 sm:py-6 shrink-0 overflow-hidden w-20 sm:w-28 lg:w-32 sm:mr-8"
        style={{ background: style.bg }}
      >
        <div className="relative text-white px-1">
          {stub.giornoSett && <div className="text-xm font-bold" style={{ opacity: 1 }}>{stub.giornoSett}</div>}
          <div className={`font-display text-4xl sm:text-4xl leading-none ${stubSize}`}>{stub.giorno}</div>
          {stub.mese && <div className="text-xm font-bold tracking-widest">{stub.mese}</div>}
        </div>
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, top: -9 }} /> */}
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, bottom: -9 }} /> */}
      </div>

      {/* <div className="shrink-0" style={{ width: 0, borderLeft: '2px dashed rgba(34,48,31,0.15)', marginTop: 12, marginBottom: 12 }} /> */}

      <div className="flex-1 p-3.5 min-w-0 flex flex-col">
        <h3 className="font-black text-2xl sm:text-3xl leading-tight mb-3" style={{ color: INK }}>
          {t.nome}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span
            className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: style.tagBg, color: style.tagText }}
          >
            {t.disciplina}
          </span>

          {t.formati.map((f) => (
            <span
              key={f}
              className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600"
            >
              {f}
            </span>
          ))}
        </div>
        {t.modalita && <p className="text-xs sm:text-sm text-gray-500 mb-4">{t.modalita}</p>}

        <div className="text-xs sm:text-sm text-gray-600 space-y-2 mb-6">

          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <span>
              {formatDataRange(t.data, t.dataFine)}
              {t.ora && <span className="font-normal text-gray-600"> · {t.ora}</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">
              {t.luogo}, {t.comune} ({t.provincia})
            </span>
          </div>
          <div className=" flex items-center gap-1.5">
            <Euro size={16} className="text-gray-400 shrink-0" />
            <span>{t.costo}</span>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-gray-400">{t.organizzatore}</div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 "
                aria-label={`Modifica ${t.nome}`}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest();
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-rose-600 "
                aria-label={`Elimina ${t.nome}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
      {hasPoster && (
        <div className="w-44 shrink-0 p-2 flex items-center justify-center sm:mr-6">
          <img
            src={t.locandina}
            alt={`Locandina di ${t.nome}`}
            onError={() => setImgOk(false)}
            className="w-full rounded-lg object-cover"
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Admin form (add / edit) — no backend yet, so this writes
   straight into local state.
--------------------------------------------------------- */
/* ---------------------------------------------------------
   Tournament detail — opened by tapping a card. The poster
   and the organizer's free-text note live here, with room
   to breathe that the compact card doesn't have.
--------------------------------------------------------- */
function TournamentDetail({ tournament, onClose }) {
  const [posterOk, setPosterOk] = useState(true);
  const t = tournament;
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const posterSrc = t.locandina;
  const showPoster = Boolean(posterSrc) && posterOk;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(34,48,31,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-lg overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 bg-white border-b-2 px-6 py-4 flex items-center justify-between gap-3 rounded-t-2xl"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          <h2 className="font-black text-lg" style={{ color: INK }}>
            {t.nome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 shrink-0 "
            style={{ color: INK }}
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {showPoster && (
            <img
              src={posterSrc}
              alt={`Locandina di ${t.nome}`}
              onError={() => setPosterOk(false)}
              className="w-full rounded-lg object-cover"
              style={{ maxHeight: '340px' }}
            />
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: style.tagBg, color: style.tagText }}>
              {t.disciplina}
            </span>
            {t.formati.map((f) => (
              <span key={f} className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {f}
              </span>
            ))}
          </div>

          {t.modalita && (
            <p className="text-sm" style={{ color: INK, opacity: 0.75 }}>
              {t.modalita}
            </p>
          )}

          <div className="text-sm space-y-2.5" style={{ color: INK }}>
            <div className="flex items-start gap-2.5">
              <Calendar size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span className="font-semibold">
                {formatDataRange(t.data, t.dataFine)}
                {t.ora && <span className="font-normal"> · {t.ora}</span>}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <a href={getMapsUrl(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:underline"
              >
                {t.luogo}, {t.comune} ({t.provincia})
              </a>
            </div>
            <div className="flex items-start gap-2.5">
              <Euro size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span>{t.costo}</span>
            </div>
          </div>

          <div className="text-xs pt-3 border-t" style={{ color: INK, opacity: 0.55, borderColor: 'rgba(34,48,31,0.1)' }}>
            Iscrizioni entro {formatDataBreve(t.iscrizioniEntro)} · {t.organizzatore}
          </div>

          {t.descrizioneOrganizzatore && (
            <div className="rounded-lg p-3.5 text-sm whitespace-pre-wrap" style={{ backgroundColor: SAND, color: INK }}>
              {t.descrizioneOrganizzatore}
            </div>
          )}

          {(t.instagram || t.facebook) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {t.instagram && (
                <a
                  href={t.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-bold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaInstagram size={15} /> Instagram
                </a>
              )}
              {t.facebook && (
                <a
                  href={t.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-bold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaFacebook size={15} /> Facebook
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || emptyTournament());

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const id = form.id || `t${Date.now()}`;
    onSave({ ...form, id });
  }

  const inputClass = 'w-full px-3.5 py-2.5 rounded-lg border-2 outline-none text-sm focus:ring-2 focus:ring-amber-500';
  const inputStyle = { borderColor: 'rgba(34,48,31,0.25)', color: INK };
  const labelClass = 'text-xs font-bold mb-1 block';
  const labelStyle = { color: INK, opacity: 0.6 };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(34,48,31,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 bg-white border-b-2 px-6 py-4 flex items-center justify-between rounded-t-2xl"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          <h2 className="font-black text-lg" style={{ color: INK }}>
            {initial ? 'Modifica torneo' : 'Nuovo torneo'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-gray-100 "
            style={{ color: INK }}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>
              Nome torneo
            </label>
            <input
              required
              className={inputClass}
              style={inputStyle}
              value={form.nome}
              onChange={(e) => update('nome', e.target.value)}
              placeholder="Es. Smash in the Grass"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Disciplina
            </label>
            <select className={inputClass} style={inputStyle} value={form.disciplina} onChange={(e) => update('disciplina', e.target.value)}>
              {DISCIPLINE.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Formati (uno o più — es. 2x2 e 4x4 insieme)
            </label>
            <div className="flex flex-wrap gap-2">
              {FORMATI.map((f) => (
                <Chip
                  key={f}
                  active={form.formati.includes(f)}
                  onClick={() => {
                    update('formati', toggleValue(form.formati, f));
                  }}
                >
                  {f}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Modalità di gioco
            </label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.modalita}
              onChange={(e) => update('modalita', e.target.value)}
              placeholder="Es. Misto, minimo 1 donna in campo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Data
              </label>
              <input required type="date" className={inputClass} style={inputStyle} value={form.data} onChange={(e) => update('data', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Data fine (se su più giorni)
              </label>
              <input
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.dataFine}
                onChange={(e) => update('dataFine', e.target.value)}
                min={form.data || undefined}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Ora
            </label>
            <input type="time" className={inputClass} style={inputStyle} value={form.ora} onChange={(e) => update('ora', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Luogo
              </label>
              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.luogo}
                onChange={(e) => update('luogo', e.target.value)}
                placeholder="Es. Parco del Cormor"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Comune
              </label>
              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.comune}
                onChange={(e) => update('comune', e.target.value)}
                placeholder="Es. Udine"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Provincia
              </label>
              <select className={inputClass} style={inputStyle} value={form.provincia} onChange={(e) => update('provincia', e.target.value)}>
                {PROVINCE.map((p) => (
                  <option key={p} value={p}>
                    {PROVINCE_LABELS[p]} ({p})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Costo
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.costo}
                onChange={(e) => update('costo', e.target.value)}
                placeholder="Es: 15 (pasti e maglietta)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Iscrizioni entro
              </label>
              <input
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.iscrizioniEntro}
                onChange={(e) => update('iscrizioniEntro', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Organizzatore
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.organizzatore}
                onChange={(e) => update('organizzatore', e.target.value)}
                placeholder="Es. ASD Udine Volley"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Descrizione organizzatore (opzionale, testo libero)
            </label>
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              value={form.descrizioneOrganizzatore}
              onChange={(e) => update('descrizioneOrganizzatore', e.target.value)}
              placeholder="Spazio libero: recapito telefonico, regole particolari, altre info per chi si iscrive..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Instagram (opzionale)
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.instagram}
                onChange={(e) => update('instagram', e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Facebook (opzionale)
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.facebook}
                onChange={(e) => update('facebook', e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Locandina (URL, opzionale)
            </label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.locandina}
              onChange={(e) => update('locandina', e.target.value)}
              placeholder="Mostrata nella scheda dettagliata del torneo"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border-2 font-bold "
              style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg font-bold text-white shadow-sm  focus:ring-offset-2"
              style={{ backgroundColor: SUN }}
            >
              Salva torneo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ tournament, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(34,48,31,0.5)' }}
      onClick={onCancel}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FBE3DC', color: CLAY_DARK }}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
          Eliminare il torneo?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          <span className="font-bold" style={{ color: INK }}>
            {tournament.nome}
          </span>{' '}
          verrà rimosso dalla lista. Non si può annullare.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold "
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg font-bold text-white  focus:ring-offset-2"
            style={{ backgroundColor: CLAY }}
          >
            Elimina torneo
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-4">🏐</div>
      <h3 className="font-black text-xl mb-2" style={{ color: INK }}>
        Nessun torneo da queste parti
      </h3>
      <p className="text-sm mb-6" style={{ color: INK, opacity: 0.6 }}>
        Prova ad allargare la ricerca o azzera i filtri.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="px-5 py-2.5 rounded-full text-white font-bold  focus:ring-offset-2"
        style={{ backgroundColor: INK }}
      >
        Azzera filtri
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Bacheca — a real notice board, simplified: a cork panel,
   pinned paper notes, one free-text field to post.
--------------------------------------------------------- */
function BachecaComposer({ testo, setTesto, tipo, setTipo, onSubmit }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border-2 p-4 sm:p-5 mb-8" style={{ borderColor: 'rgba(34,48,31,0.12)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Chip active={tipo === 'cerca_squadra'} onClick={() => setTipo('cerca_squadra')} color={BOARD_A}>
          Cerco squadra
        </Chip>
        <Chip active={tipo === 'cerca_giocatore'} onClick={() => setTipo('cerca_giocatore')} color={BOARD_B}>
          Cercasi giocatori
        </Chip>
      </div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Scrivi il tuo annuncio: torneo, disponibilità, come contattarti..."
        rows={3}
        maxLength={400}
        className="w-full rounded-lg border-2 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        style={{ borderColor: 'rgba(34,48,31,0.18)', color: INK }}
      />
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!testo.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm disabled:opacity-40 "
          style={{ backgroundColor: INK, color: SAND, cursor: testo.trim() ? 'pointer' : 'not-allowed' }}
        >
          <Pin size={14} />
          Attacca l'annuncio
        </button>
      </div>
    </div>
  );
}

function BachecaNote({ post, onDelete }) {
  const isSquadra = post.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;
  return (
    <div
      className="relative p-4 pt-6"
      style={{
        backgroundColor: isSquadra ? NOTE_YELLOW : NOTE_WHITE,
        transform: `rotate(${post.rotazione}deg)`,
        boxShadow: '0 6px 14px rgba(34,48,31,0.28)',
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: 16,
          height: 16,
          left: '50%',
          top: -8,
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle at 35% 30%, #E88178, ${PIN_COLOR})`,
          boxShadow: '0 2px 3px rgba(0,0,0,0.4)',
        }}
      />
      {!isSquadra && (
        <span className="absolute left-4 right-4" style={{ top: 24, height: 2, backgroundColor: 'rgba(192,57,43,0.35)' }} />
      )}
      <span className="inline-block text-xs font-bold px-2 py-0.5 rounded mb-2" style={{ backgroundColor: accent, color: '#FFFFFF' }}>
        {isSquadra ? 'Cerco squadra' : 'Cercasi giocatori'}
      </span>
      <p className="text-sm leading-snug whitespace-pre-wrap break-words" style={{ color: INK }}>
        {post.testo}
      </p>
      <div className="mt-3 text-xs" style={{ color: INK, opacity: 0.45 }}>
        {formatDataBreve(post.data)}
      </div>
      <button
        type="button"
        onClick={() => onDelete(post.id)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 "
        style={{ color: INK, opacity: 0.45 }}
        aria-label="Rimuovi annuncio"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   App
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState('tornei');
  const [tournaments, setTournaments] = useState(INITIAL_TOURNAMENTS);
  const [search, setSearch] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [selectedProvinces, setSelectedProvinces] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formState, setFormState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [annunci, setAnnunci] = useState(INITIAL_ANNUNCI);
  const [nuovoTesto, setNuovoTesto] = useState('');
  const [nuovoTipo, setNuovoTipo] = useState('cerca_squadra');
  const [selectedDurate, setSelectedDurate] = useState([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments
      .filter((t) => {
        const matchesSearch =
          !q ||
          t.nome.toLowerCase().includes(q) ||
          t.comune.toLowerCase().includes(q) ||
          t.luogo.toLowerCase().includes(q) ||
          t.organizzatore.toLowerCase().includes(q);
        const matchesDisciplina = selectedDisciplines.length === 0 || selectedDisciplines.includes(t.disciplina);
        const matchesFormato = selectedFormats.length === 0 || t.formati.some((f) => selectedFormats.includes(f));
        const matchesProvincia = selectedProvinces.length === 0 || selectedProvinces.includes(t.provincia);
        const matchesFrom = !dateFrom || t.data >= dateFrom;
        const matchesTo = !dateTo || t.data <= dateTo;
        const durata =
          !t.dataFine || t.dataFine === t.data ? '1' : '2+';

        const matchesDurata =
          selectedDurate.length === 0 ||
          selectedDurate.includes(durata);
        return matchesSearch && matchesDisciplina && matchesFormato && matchesProvincia && matchesFrom && matchesTo && matchesDurata;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [tournaments, search, selectedDisciplines, selectedFormats, selectedProvinces, selectedDurate, dateFrom, dateTo]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const sortedAnnunci = useMemo(() => [...annunci].sort((a, b) => b.data.localeCompare(a.data)), [annunci]);

  const extraFilterCount = selectedProvinces.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const activeFilterCount = selectedDisciplines.length + selectedFormats.length + selectedDurate.length + extraFilterCount;

  function resetFilters() {
    setSearch('');
    setSelectedDisciplines([]);
    setSelectedFormats([]);
    setSelectedProvinces([]);
    setDateFrom('');
    setDateTo('');
    setSelectedDurate([]);
  }

  function handleSave(t) {
    setTournaments((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      return exists ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
    setFormState(null);
  }

  function handleDeleteConfirm() {
    setTournaments((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function handlePubblicaAnnuncio() {
    const testo = nuovoTesto.trim();
    if (!testo) return;
    setAnnunci((prev) => [
      {
        id: `a${Date.now()}`,
        tipo: nuovoTipo,
        testo,
        data: new Date().toISOString().slice(0, 10),
        rotazione: (Math.random() * 8 - 4).toFixed(1),
      },
      ...prev,
    ]);
    setNuovoTesto('');
  }

  function handleEliminaAnnuncio(id) {
    setAnnunci((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: SAND }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        .font-display { font-family: 'Anton', 'Arial Narrow', sans-serif; }
        @keyframes card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* NAV + HEADER */}
      <div className="border-b-2 mb-2" style={{ borderColor: 'rgba(34,48,31,0.12)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-9 flex items-center justify-between gap-4 py-2.5">

          <button
            type="button"
            onClick={() => {
              setView('tornei');
              resetFilters();
            }}
            className="font-display text-3xl sm:text-5xl leading-none shrink-0 rounded"
            style={{ color: INK }}
          >
            tornei<span style={{ color: SUN }}>FVG</span>
          </button>

          <div className="flex items-center gap-1.5">
            <NavTab active={view === 'tornei'} onClick={() => setView('tornei')}>
              Tornei
            </NavTab>
            <NavTab active={view === 'bacheca'} onClick={() => setView('bacheca')}>
              Bacheca
            </NavTab>
          </div>

          {view === 'tornei' && (
            <label
              className="flex items-center gap-2 border-2 rounded-full pl-3 pr-1.5 py-1.5 cursor-pointer shrink-0"
              style={{ borderColor: INK }}
            >
              <Settings2 size={14} style={{ color: INK }} />
              <span className="text-xs font-bold hidden sm:inline" style={{ color: INK }}>
                Organizzatore
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={isAdmin}
                onClick={() => setIsAdmin((v) => !v)}
                className="w-9 h-5 rounded-full relative transition-colors "
                style={{ backgroundColor: isAdmin ? SUN : '#D8D0BC' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: isAdmin ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </label>
          )}

        </div>
      </div>



      {view === 'tornei' && (
        <>
          {isAdmin && (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-xs font-semibold rounded-lg px-3 py-2 mb-1" style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}>
                Modalità organizzatore attiva: puoi aggiungere, modificare ed eliminare i tornei.
              </div>
            </div>
          )}

          {/* SEARCH + FILTERS */}
          <div className="sticky top-0 z-20 " style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.15)' }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: INK, opacity: 0.45 }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca per nome, città o organizzatore..."
                  className="w-full pl-11 pr-4 py-3 rounded-full border-1 outline-none text-sm font-medium focus:ring-1 focus:ring-grey-300"
                  style={{
                    borderColor: INK,
                    color: INK,
                    backgroundColor: SAND,
                  }}
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-2">
                {DISCIPLINE.map((d) => (
                  <Chip
                    key={d}
                    active={selectedDisciplines.includes(d)}
                    onClick={() => setSelectedDisciplines((prev) => toggleValue(prev, d))}
                    color={d === 'Beach Volley' ? SABBIA_DARK : d === 'Green Volley' ? GRASS_DARK : SEA_DARK}
                  >
                    {d}
                  </Chip>
                ))}
                <span className="h-5 shrink-0 mr-2 ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
                {FORMATI.map((f) => (
                  <Chip key={f} active={selectedFormats.includes(f)} onClick={() => setSelectedFormats((prev) => toggleValue(prev, f))}>
                    {f}
                  </Chip>
                ))}
                <span
                  className="h-5 shrink-0 mr-2 ml-2"
                  style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }}
                />

                {DURATE.map((d) => (
                  <Chip
                    key={d.value}
                    active={selectedDurate.includes(d.value)}
                    onClick={() => setSelectedDurate((prev) => toggleValue(prev, d.value))}
                  >
                    {d.label}
                  </Chip>
                ))}

                <span className="h-5 shrink-0 mr-2 ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
                <button
                  type="button"
                  onClick={() => setShowMoreFilters((v) => !v)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border-2 whitespace-nowrap shrink-0 "
                  style={{
                    borderColor: showMoreFilters ? INK : 'rgba(34,48,31,0.25)',
                    backgroundColor: showMoreFilters ? INK : 'transparent',
                    color: showMoreFilters ? '#FFFFFF' : INK,
                  }}
                >
                  <SlidersHorizontal size={13} />
                  Altri filtri
                  {extraFilterCount > 0 && <span>({extraFilterCount})</span>}
                  <ChevronDown size={13} style={{ transform: showMoreFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-bold px-2 shrink-0  rounded shrink-0"
                    style={{ color: INK, opacity: 0.5 }}
                  >
                    <X size={13} /> Azzera
                  </button>
                )}
              </div>

              {showMoreFilters && (
                <div className="bg-white border-2 rounded-xl p-4 space-y-4" style={{ borderColor: 'rgba(34,48,31,0.15)' }}>
                  <div>
                    <div className="text-xs font-bold mb-2" style={{ color: INK, opacity: 0.6 }}>
                      PROVINCIA
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PROVINCE.map((p) => (
                        <Chip key={p} active={selectedProvinces.includes(p)} onClick={() => setSelectedProvinces((prev) => toggleValue(prev, p))}>
                          {PROVINCE_LABELS[p]}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    <div>
                      <div className="text-xs font-bold mb-1.5" style={{ color: INK, opacity: 0.6 }}>
                        DAL
                      </div>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border-2 text-sm "
                        style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-1.5" style={{ color: INK, opacity: 0.6 }}>
                        AL
                      </div>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border-2 text-sm "
                        style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RESULTS */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-6 py-2 sm:py-2">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold" style={{ color: INK, opacity: 0.6 }}>
                {filtered.length} {filtered.length === 1 ? 'torneo trovato' : 'tornei trovati'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setFormState('new')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-bold shadow-sm  focus:ring-offset-2"
                  style={{ backgroundColor: SUN }}
                >
                  <Plus size={16} /> Aggiungi torneo
                </button>
              )}
            </div>

            {grouped.length === 0 ? (
              <EmptyState onReset={resetFilters} />
            ) : (
              grouped.map((group) => (
                <div key={group.key} className="mb-10">
                  <MonthHeader label={group.label} />
                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4">
                    {group.items.map((t, i) => (
                      <TournamentCard
                        key={t.id}
                        t={t}
                        delay={i * 60}
                        isAdmin={isAdmin}
                        onEdit={() => setFormState(t)}
                        onDeleteRequest={() => setDeleteTarget(t)}
                        onOpenDetail={setDetailTarget}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {view === 'bacheca' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <BachecaComposer testo={nuovoTesto} setTesto={setNuovoTesto} tipo={nuovoTipo} setTipo={setNuovoTipo} onSubmit={handlePubblicaAnnuncio} />

          {sortedAnnunci.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-5xl mb-4">📌</div>
              <h3 className="font-black text-xl mb-2" style={{ color: INK }}>
                La bacheca è vuota
              </h3>
              <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
                Attacca il primo annuncio qui sopra.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl p-5 sm:p-9"
              style={{
                backgroundColor: CORK,
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.07) 1px, transparent 1px), radial-gradient(circle at 65% 65%, rgba(0,0,0,0.06) 1.5px, transparent 1.5px), radial-gradient(circle at 85% 15%, rgba(0,0,0,0.05) 1px, transparent 1px), radial-gradient(circle at 40% 85%, rgba(0,0,0,0.05) 1px, transparent 1px)',
                backgroundSize: '26px 26px, 34px 34px, 30px 30px, 22px 22px',
                border: `10px solid ${CORK_FRAME}`,
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.25), 0 8px 20px rgba(34,48,31,0.2)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2rem 1.5rem' }}>
                {sortedAnnunci.map((post) => (
                  <BachecaNote key={post.id} post={post} onDelete={handleEliminaAnnuncio} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center text-xs pb-8 px-4" style={{ color: INK, opacity: 0.4 }}>
        Prototipo front-end con dati di esempio — le modifiche non vengono salvate.
      </div>

      {formState && (
        <TournamentForm initial={formState === 'new' ? null : formState} onSave={handleSave} onCancel={() => setFormState(null)} />
      )}
      {deleteTarget && <DeleteConfirm tournament={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
      {detailTarget && <TournamentDetail tournament={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}