import React, { useEffect, useRef, useState } from 'react';
import { Pin, X, CircleUserRound, MessageCircle } from 'lucide-react';

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
   Motion — the note falls onto the cork, over-rotates on
   impact, then settles into its final tilt. The pin is
   pushed in a beat later, and the drop shadow tightens as
   the paper gets closer to the board.
--------------------------------------------------------- */
const BACHECA_MOTION_CSS = `
@keyframes bacheca-pin-in {
  0% {
    opacity: 0;
    transform: translate3d(0, -80px, 0) rotate(var(--rot)) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
  }
}

@keyframes bacheca-shadow-in {
  0% {
    box-shadow: 0 26px 34px -14px rgba(0, 0, 0, 0.45);
  }
  100% {
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.15);
  }
}

@keyframes bacheca-pin-push {
  0% {
    opacity: 0;
    transform: translate(-50%, -30px) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

@keyframes bacheca-peel-out {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, 100px, 0) rotate(calc(var(--rot) * -2.6)) scale(0.88);
  }
}

@keyframes bacheca-button-press {
  0% {
    transform: translateY(0) rotate(0deg);
  }
  100% {
    transform: translateY(0) rotate(0deg);
  }
}

.bacheca-note {
  will-change: transform;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.15);
}

.bacheca-note--in {
  animation:
    bacheca-pin-in 300ms ease-out both,
    bacheca-shadow-in 400ms ease-out both;
}

.bacheca-note--in .bacheca-pin {
  animation: bacheca-pin-push 400ms ease-out both;
}

.bacheca-note--out {
  animation: bacheca-peel-out 320ms ease-in both;
  pointer-events: none;
}

.bacheca-send-icon--active {
  animation: bacheca-button-press 420ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .bacheca-note--in,
  .bacheca-note--in .bacheca-pin,
  .bacheca-note--out,
  .bacheca-send-icon--active {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;

const ENTER_MS = 620;
const EXIT_MS = 300;

/* ---------------------------------------------------------
   Bacheca — a real notice board, simplified: a cork panel,
   pinned paper notes, one free-text field to post.
--------------------------------------------------------- */
export function BachecaComposer({ testo, setTesto, tipo, setTipo, onSubmit }) {
  const accent = tipo === 'cerca_squadra' ? BOARD_A : BOARD_B;
  // La textarea usa la stessa carta dei bigliettini appesi.
  const noteBg = tipo === 'cerca_squadra' ? NOTE_YELLOW : NOTE_WHITE;
  const [pressed, setPressed] = useState(false);

  const handleSubmit = () => {
    if (!testo.trim()) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 420);
    onSubmit();
  };

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
        placeholder="Scrivi il tuo annuncio: torneo, ruolo, ..."
        rows={5}
        maxLength={400}
        className="w-full rounded-lg border-1 p-3 text-2sm sm:text-2sm outline-none focus:ring-1 resize-none transition-colors"
        style={{
          color: INK,
          borderColor: 'rgba(34,48,31,0.18)',
          '--tw-ring-color': 'rgba(34,48,31,0.28)',
        }}
      />
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!testo.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm disabled:opacity-40 transition-transform active:scale-95"
          style={{ backgroundColor: INK, color: SAND, cursor: testo.trim() ? 'pointer' : 'not-allowed' }}
        >
          <Pin size={18} className={pressed ? 'bacheca-send-icon--active' : undefined} />
          Attacca l'annuncio
        </button>
      </div>
    </div>
  );
}

export function BachecaNote({ post, onDelete, canDelete, canReply, onReply, isNew }) {
  const [removing, setRemoving] = useState(false);
  const isSquadra = post.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;

  const handleDelete = () => {
    if (removing) return;
    setRemoving(true);
    setTimeout(() => onDelete(post.id), EXIT_MS);
  };

  return (
    <div
      className={[
        'bacheca-note relative p-4 pt-6 rounded-lg',
        isNew ? 'bacheca-note--in' : '',
        removing ? 'bacheca-note--out' : '',
      ].join(' ')}
      style={{
        backgroundColor: isSquadra ? NOTE_YELLOW : NOTE_WHITE,
        '--rot': `${post.rotazione ?? 0}deg`,
        transform: 'rotate(var(--rot))',
        border: `2px solid ${accent}`,
      }}
    >
      <span
        className="bacheca-pin absolute rounded-full"
        style={{
          display: 'none',
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
      <p className="text-2sm sm:text-2sm font-regular leading-snug whitespace-pre-wrap break-words" style={{ color: INK }}>
        {post.testo}
      </p>
      <div className="mt-3 text-xs" style={{ color: INK, opacity: 0.45 }}>
        {post.authorName ? `${post.authorName} · ` : ''}{formatDataBreve(post.data)} · {timeAgo(post.data)}
      </div>

      {canReply && (
        <button
          type="button"
          onClick={() => onReply(post)}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ border: `1.5px solid ${accent}`, color: accent }}
        >
          <MessageCircle size={14} /> Rispondi in privato
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
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
  onRispondi,
  profile,
  canPost,
  canDelete,
  onLoginClick,
}) {
  // Track which notes are new so only they play the drop animation.
  const seenRef = useRef(null);
  const [newIds, setNewIds] = useState([]);

  useEffect(() => {
    const ids = annunci.map((a) => a.id);

    // First render: everything already on the board is "old".
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }

    const fresh = ids.filter((id) => !seenRef.current.has(id));
    seenRef.current = new Set(ids);
    if (fresh.length === 0) return;

    setNewIds((prev) => [...prev, ...fresh]);
    const t = setTimeout(() => {
      setNewIds((prev) => prev.filter((id) => !fresh.includes(id)));
    }, ENTER_MS + 60);
    return () => clearTimeout(t);
  }, [annunci]);

  return (
    <div className="max-w-[70rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-4 mb-6">
      <style>{BACHECA_MOTION_CSS}</style>

      {canPost ? (
        <BachecaComposer testo={nuovoTesto} setTesto={setNuovoTesto} tipo={nuovoTipo} setTipo={setNuovoTipo} onSubmit={onPubblica} />
      ) : (
        <div
          className="rounded-lg border-2 p-4 sm:p-5 mb-8 flex items-center gap-3"
          style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.12)' }}
        >
          <CircleUserRound size={22} className="shrink-0" style={{ color: INK, opacity: 0.45 }} />
          <p className="text-sm" style={{ color: INK, opacity: 0.7 }}>
            {profile
              ? 'Il tuo account non può pubblicare annunci.'
              : 'Accedi o registrati per scrivere un annuncio.'}
          </p>
          {!profile && (
            <button
              type="button"
              onClick={onLoginClick}
              className="ml-auto px-3 py-1.5 rounded-full text-sm font-bold shrink-0"
              style={{ backgroundColor: INK, color: SAND }}
            >
              Accedi
            </button>
          )}
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
              <BachecaNote
                key={post.id}
                post={post}
                onDelete={onElimina}
                canDelete={canDelete(post)}
                canReply={Boolean(profile) && post.authorId && post.authorId !== profile.uid}
                onReply={onRispondi}
                isNew={newIds.includes(post.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}