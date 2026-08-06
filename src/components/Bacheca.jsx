import React from 'react';
import { Pin, X, CircleUserRound } from 'lucide-react';

import {
  INK,
  SAND,
  BOARD_A,
  BOARD_B,
  CORK,
  CORK_FRAME,
  PIN_COLOR,
  NOTE_YELLOW,
  NOTE_WHITE,
} from '../theme';
import { formatDataBreve, timeAgo } from '../utils';
import Chip from './ui/Chip';

/* ---------------------------------------------------------
   Bacheca — a real notice board, simplified: a cork panel,
   pinned paper notes, one free-text field to post.
--------------------------------------------------------- */
export function BachecaComposer({ testo, setTesto, tipo, setTipo, onSubmit }) {
  const accent = tipo === 'cerca_squadra' ? BOARD_A : BOARD_B;
  // La textarea usa la stessa carta dei bigliettini appesi.
  const noteBg = tipo === 'cerca_squadra' ? NOTE_YELLOW : NOTE_WHITE;
  return (
    <div className="rounded-lg  border-2 p-4 sm:p-5 mb-8 transition-colors"
      style={{
        backgroundColor: noteBg,
        borderColor: accent,
        color: INK,
        '--tw-ring-color': accent,
      }}>
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
        placeholder="Scrivi il tuo annuncio: torneo, ruolo, come contattarti ..."
        rows={4}
        maxLength={400}
        className="w-full rounded-lg border-1 p-3 text-lg outline-none focus:ring-1 resize-none transition-colors"
        style={{
          // borderColor: accent,
          color: INK,
          borderColor: 'rgba(34,48,31,0.18)',
          '--tw-ring-color': 'rgba(34,48,31,0.28)',
        }}
      />
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!testo.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm disabled:opacity-40 "
          style={{ backgroundColor: INK, color: SAND, cursor: testo.trim() ? 'pointer' : 'not-allowed' }}
        >
          <Pin size={18} />
          Attacca l'annuncio
        </button>
      </div>
    </div>
  );
}

export function BachecaNote({ post, onDelete, isAdmin }) {
  const isSquadra = post.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;
  return (
    <div
      className="relative p-4 pt-6 shadow-sm rounded-lg"
      style={{
        backgroundColor: isSquadra ? NOTE_YELLOW : NOTE_WHITE,
        transform: `rotate(${post.rotazione}deg)`,
        // boxShadow: '0 2px 2px rgba(95, 95, 95, 0.20)',
        border: `2px solid ${accent}`,
        // 
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          display: "none",
          width: 16,
          height: 16,
          left: '50%',
          top: -8,
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle at 35% 30%, #E88178, ${PIN_COLOR})`,
          boxShadow: '0 2px 3px rgba(0,0,0,0.4)',
        }}
      />

      <span className="inline-block text-sm font-semibold px-2 py-0.5 rounded mb-3" style={{ backgroundColor: accent, color: '#FFFFFF' }}>
        {isSquadra ? 'Cerco squadra' : 'Cercasi giocatori'}
      </span>
      <p className="text-lg font-regular leading-snug whitespace-pre-wrap break-words" style={{ color: INK }}>
        {post.testo}
      </p>
      <div className="mt-3 text-xs" style={{ color: INK, opacity: 0.45 }}>
        {formatDataBreve(post.data)} · {timeAgo(post.data)}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onDelete(post.id)}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200"
          style={{ color: INK, opacity: 0.45 }}
          aria-label="Rimuovi annuncio"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export default function Bacheca({
  annunci,
  nuovoTesto,
  setNuovoTesto,
  nuovoTipo,
  setNuovoTipo,
  onPubblica,
  onElimina,
  isAdmin,
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-4 mb-6">
      {isAdmin ? (
        <BachecaComposer testo={nuovoTesto} setTesto={setNuovoTesto} tipo={nuovoTipo} setTipo={setNuovoTipo} onSubmit={onPubblica} />
      ) : (
        <div
          className="rounded-lg border-2 p-4 sm:p-5 mb-8 flex items-center gap-3"
          style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.12)' }}
        >
          <CircleUserRound size={22} className="shrink-0" style={{ color: INK, opacity: 0.45 }} />
          <p className="text-sm" style={{ color: INK, opacity: 0.7 }}>
            Effettua il login per scrivere un annuncio.
          </p>
        </div>
      )}

      {annunci.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">📌</div>
          <h3 className="font-black text-xl mb-2" style={{ color: INK }}>
            La bacheca è vuota
          </h3>
          <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
            Non c'è ancora nessun annuncio.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl p-5 sm:p-6 shadow"
          style={{
            backgroundColor: CORK,
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.07) 1px, transparent 1px), radial-gradient(circle at 65% 65%, rgba(0,0,0,0.06) 1.5px, transparent 1.5px), radial-gradient(circle at 85% 15%, rgba(0,0,0,0.05) 1px, transparent 1px), radial-gradient(circle at 40% 85%, rgba(0,0,0,0.05) 1px, transparent 1px)',
            backgroundSize: '26px 26px, 34px 34px, 30px 30px, 22px 22px',
            border: `2px solid ${CORK_FRAME}`,

          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem 1.5rem' }}>
            {annunci.map((post) => (
              <BachecaNote key={post.id} post={post} onDelete={onElimina} isAdmin={isAdmin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}