import React, { useEffect, useRef, useState } from 'react';
import { Pin, X, CircleUserRound, MessageCircle, Plus } from 'lucide-react';

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
  CLAY,
} from '../theme';
import { formatDataBreve, timeAgo } from '../utils';
import Chip from './ui/Chip';
import { useFeedback } from './FeedbackProvider';

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

.bacheca-composer-shell {
  overflow: hidden;
  transform-origin: top center;
}

.bacheca-composer-shell--closed {
  cursor: pointer;
}

.bacheca-composer-header {
  min-height: 36px;
}

.bacheca-composer-body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 320ms cubic-bezier(0.2, 0.9, 0.2, 1),
    opacity 220ms ease;
  pointer-events: none;
}

.bacheca-composer-body > div {
  min-height: 0;
  overflow: hidden;
}

.bacheca-composer-shell--open .bacheca-composer-body {
  grid-template-rows: 1fr;
  opacity: 1;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .bacheca-note--in,
  .bacheca-note--in .bacheca-pin,
  .bacheca-note--out,
  .bacheca-send-icon--active {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }

  .bacheca-composer-body,
  .bacheca-composer-shell {
    transition-duration: 1ms !important;
  }
}

/* ---- Scheletro del caricamento -------------------------------
   La bacheca arriva da Firestore, e per un attimo non c'è niente da
   appendere. Mostrare "la bacheca è vuota" in quel momento è una
   bugia che dura mezzo secondo — e a chi ha la connessione lenta
   sembra vera. Meglio far vedere subito la forma di quello che sta
   arrivando: la plancia di sughero con sopra dei foglietti ancora
   in bianco. */
.bacheca-skel {
  animation: bacheca-skel-pulse 1.5s ease-in-out infinite;
}

.bacheca-skel-riga {
  display: block;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.13);
}

@keyframes bacheca-skel-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.95; }
}

@media (prefers-reduced-motion: reduce) {
  .bacheca-skel { animation: none; }
}
`;

const ENTER_MS = 620;
const EXIT_MS = 300;

/* ---------------------------------------------------------
   Bacheca — a real notice board, simplified: a cork panel,
   pinned paper notes, one free-text field to post.
--------------------------------------------------------- */
export function BachecaComposer({
  testo,
  setTesto,
  tipo,
  setTipo,
  onSubmit,
  open,
  onOpen,
  onCancel,
}) {
  const accent = tipo === 'cerca_squadra' ? BOARD_A : BOARD_B;
  const noteBg = tipo === 'cerca_squadra' ? NOTE_YELLOW : NOTE_WHITE;

  /* Ref sulla textarea: serve per portare il focus quando il
     compositore si apre da un'altra vista (es. Account → I miei
     annunci → "Pubblica un annuncio"). Il focus manuale al click
     non serve — il tap chiude il caret dove l'utente ha toccato —
     ma per l'apertura programmatica sì. */
  const textareaRef = useRef(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Due rAF per essere sicuri che la grid transition abbia
      // "rivelato" la textarea: senza, il focus casca su un
      // elemento con altezza 0 e la tastiera mobile non compare.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // textareaRef.current?.focus();
        });
      });
    }
    wasOpen.current = open;
  }, [open]);

  /* "Attacca l'annuncio": fire-and-forget, senza useActionState.
     Niente spinner né flash "Attaccato ✓" in-button. Il
     compositore NON si chiude al submit — l'utente lo chiude
     esplicitamente con la X in alto o con "Annulla" quando ha
     finito. La conferma visiva che l'annuncio è stato pubblicato
     è la nota che cade sulla bacheca (animazione bacheca-pin-in),
     visibile scorrendo appena sotto. */
  function handleSubmit() {
    if (!testo.trim()) return;
    onSubmit();
  }

  function handleShellClick() {
    if (!open) {
      onOpen();
    }
  }

  function handleShellKeyDown(e) {
    if (!open && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      role={!open ? 'button' : undefined}
      tabIndex={!open ? 0 : undefined}
      onClick={handleShellClick}
      onKeyDown={handleShellKeyDown}
      className={[
        'bacheca-composer-shell rounded-2xl border-2 p-4 sm:p-5 mb-6 transition-colors duration-300',
        open ? 'bacheca-composer-shell--open' : 'bacheca-composer-shell--closed',
      ].join(' ')}
      style={{
        backgroundColor: open ? noteBg : '#fcfaf8',
        borderColor: open ? accent : 'rgba(34,48,31,0.12)',
        color: INK,
        '--tw-ring-color': open ? accent : 'rgba(34,48,31,0.18)',
      }}
    >
      <div
        className="bacheca-composer-header flex items-center justify-between gap-3 cursor-pointer"
        onClick={open ? onCancel : onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open ? onCancel() : onOpen();
          }
        }}
      >
        <div className="min-w-0">
          <h3 className="font-semibold text-lg leading-none" style={{ color: INK }}>
            Pubblica un annuncio
          </h3>
        </div>

        {open ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 shrink-0"
            style={{ color: INK, opacity: 0.55 }}
            aria-label="Chiudi compositore"
          >
            <X size={18} />
          </button>
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: INK,
              color: SAND,
            }}
          >
            <Plus size={20} />
          </div>
        )}
      </div>

      <div className="bacheca-composer-body" aria-hidden={!open}>
        <div>
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Chip active={tipo === 'cerca_squadra'} onClick={() => setTipo('cerca_squadra')} color={BOARD_A}>
                Cerco squadra
              </Chip>
              <Chip active={tipo === 'cerca_giocatore'} onClick={() => setTipo('cerca_giocatore')} color={BOARD_B}>
                Cercasi giocatori
              </Chip>
            </div>

            <textarea
              ref={textareaRef}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Scrivi il tuo annuncio: torneo, ruolo, ..."
              rows={5}
              maxLength={400}
              className="w-full rounded-lg border-2 p-3 text-2sm sm:text-2sm outline-none border-black/20 focus:border-gray-600 resize-none transition-colors"
              style={{
                color: INK,
                // borderColor: 'rgba(34,48,31,0.18)',
                // '--tw-ring-color': 'rgba(34,48,31,0.28)',
              }}
            />

            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-full font-semibold text-sm transition-transform active:scale-95"
                style={{
                  color: INK,
                  backgroundColor: 'rgba(34,48,31,0.08)',
                }}
              >
                Annulla
              </button>

              {/* Nessun feedback in-button (spinner o "Attaccato ✓"):
                  vedi handleSubmit sopra. Il bottone resta sempre
                  con la stessa label e icona; è disabilitato solo
                  quando la textarea è vuota. */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!testo.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm
                           disabled:opacity-40 transition-all duration-200 active:scale-95"
                style={{
                  backgroundColor: INK,
                  color: SAND,
                  cursor: testo.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Pin size={18} />
                Attacca l&apos;annuncio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BachecaNote({ post, onDelete, canDelete, canReply, onReply, isNew }) {
  const [removing, setRemoving] = useState(false);
  const isSquadra = post.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;
  const { confirm } = useFeedback();

  /* Cancellazione con conferma (modalità "legacy" di useFeedback,
     senza onConfirm): il dialog restituisce true/false e si chiude
     subito al click. Nessuno spinner né "Eliminato ✓" dentro il
     bottone del dialog — l'utente clicca Elimina, il dialog sparisce
     e la nota parte con l'animazione peel-out. Il feedback visivo di
     avvenuta cancellazione è proprio quella animazione + la nota
     che scompare dalla bacheca. */
  const handleDelete = async () => {
    if (removing) return;
    const ok = await confirm({
      title: 'Eliminare questo annuncio?',
      message:
        "L'annuncio verrà rimosso dalla bacheca. Non è recuperabile.",
      confirmLabel: 'Elimina',
    });
    if (!ok) return;
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

      {/* Elimina annuncio: visibile solo se `canDelete(post)` ha
          detto "sì" (in pratica: admin o autore dell'annuncio —
          la logica sta in app.jsx, questo componente si fida).
          La conferma è dentro handleDelete, gestita da useFeedback:
          l'utente non può eliminare "per sbaglio" con un tap. */}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5"
          style={{ color: INK, opacity: 0.75 }}
          aria-label="Elimina annuncio"
          title="Elimina annuncio"
        >
          <X size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* Lo sfondo della plancia sta qui perché lo usano in due: la
   bacheca vera e il suo scheletro. Se restasse inline in un posto
   solo, il caricamento e il contenuto finirebbero su due sfondi
   diversi e nel passaggio si vedrebbe il cambio. */
const STILE_PLANCIA = {
  backgroundColor: CORK,
  backgroundImage:
    'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.07) 1px, transparent 1px), radial-gradient(circle at 65% 65%, rgba(0,0,0,0.06) 1.5px, transparent 1.5px), radial-gradient(circle at 85% 15%, rgba(0,0,0,0.05) 1px, transparent 1px), radial-gradient(circle at 40% 85%, rgba(0,0,0,0.05) 1px, transparent 1px)',
  backgroundSize: '26px 26px, 34px 34px, 30px 30px, 22px 22px',
  border: `2px solid ${CORK_FRAME}`,
};

const GRIGLIA_NOTE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '2rem 1.5rem',
};

/* Foglietti finti, con le stesse misure e la stessa inclinazione di
   quelli veri: quando i dati arrivano il contenuto prende il posto
   del segnaposto invece di far saltare la pagina.

   Le inclinazioni sono una lista fissa e non numeri a caso: presi a
   caso cambierebbero ad ogni render e lo scheletro tremolerebbe. */
const INCLINAZIONI = [-2.4, 1.8, -1.2, 2.6, -3, 1.1];

function SchelettroBacheca({ quanti = 6 }) {
  return (
    <div className="rounded-2xl p-5 sm:p-6 shadow" style={STILE_PLANCIA} aria-hidden="true">
      <div style={GRIGLIA_NOTE}>
        {Array.from({ length: quanti }).map((_, i) => (
          <div
            key={i}
            className="bacheca-skel relative p-4 pt-6 rounded-lg"
            style={{
              backgroundColor: i % 2 === 0 ? NOTE_YELLOW : NOTE_WHITE,
              transform: `rotate(${INCLINAZIONI[i % INCLINAZIONI.length]}deg)`,
              border: '2px solid rgba(34,48,31,0.10)',
              animationDelay: `${i * 90}ms`,
            }}
          >
            <span className="bacheca-skel-riga mb-3" style={{ width: 108, height: 20, borderRadius: 4 }} />
            <span className="bacheca-skel-riga" style={{ width: '100%', height: 11, marginBottom: 7 }} />
            <span className="bacheca-skel-riga" style={{ width: '88%', height: 11, marginBottom: 7 }} />
            <span className="bacheca-skel-riga" style={{ width: '54%', height: 11 }} />
            <span className="bacheca-skel-riga mt-4" style={{ width: 74, height: 9 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Bacheca({
  annunci,
  loading = false,
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
  pendingOpenCompositore = false,
  onCompositoreOpened,
}) {
  // Track which notes are new so only they play the drop animation.
  const seenRef = useRef(null);
  const [newIds, setNewIds] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);

  /* Apertura programmatica del compositore da un'altra vista
     (Account → "Pubblica un annuncio"). Guardato da canPost così se
     l'utente non può pubblicare non forziamo l'apertura di un
     compositore che nemmeno viene renderizzato. Consumiamo subito
     il segnale chiamando onCompositoreOpened, per evitare che
     un rimount della Bacheca (tornandoci in un secondo momento)
     lo riapra da solo. */
  useEffect(() => {
    if (!pendingOpenCompositore || !canPost) return;
    setComposerOpen(true);
    onCompositoreOpened?.();
  }, [pendingOpenCompositore, canPost, onCompositoreOpened]);

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

  function handleCancelComposer() {
    setComposerOpen(false);
    setNuovoTesto('');
  }

  return (
    <div className="max-w-[70rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-4 mb-6">
      <style>{BACHECA_MOTION_CSS}</style>

      {canPost ? (
        <BachecaComposer
          testo={nuovoTesto}
          setTesto={setNuovoTesto}
          tipo={nuovoTipo}
          setTipo={setNuovoTipo}
          onSubmit={onPubblica}
          open={composerOpen}
          onOpen={() => setComposerOpen(true)}
          onCancel={handleCancelComposer}
        />
      ) : (
        <div
          className="rounded-lg border-2 p-4 sm:p-5 mb-8 flex items-center gap-3"
          style={{ backgroundColor: '#fcfaf8', borderColor: 'rgba(34,48,31,0.12)' }}
        >
          <CircleUserRound size={22} className="shrink-0" style={{ color: INK, opacity: 0.45 }} />
          <p className="text-sm" style={{ color: INK, opacity: 0.7 }}>
            {profile
              ? 'Il tuo account non può pubblicare annunci.'
              : 'Accedi per scrivere o rispondere a un annuncio e per proporre nuovi tornei.'}
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

      {loading ? (
        <SchelettroBacheca />
      ) : annunci.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">📌</div>
          <h3 className="font-black text-xl mb-2" style={{ color: INK }}>
            La bacheca è vuota
          </h3>
          <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
            Non c&apos;è ancora nessun annuncio.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl p-5 sm:p-6 shadow" style={STILE_PLANCIA}>
          <div style={GRIGLIA_NOTE}>
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