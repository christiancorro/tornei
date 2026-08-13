import React, { useState } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

import { INK, SUN, CLAY, GRASS_DARK, NOTE_YELLOW, NOTE_WHITE, BOARD_A, BOARD_B } from '../theme';
import { MAX_MESSAGGIO } from '../services/messages';

/* Risposta privata a un annuncio. Non è una chat pubblica:
   apre (o riapre) un thread visibile solo ai due.

   Il pulsante Invia passa da idle → saving → saved prima
   che il modale si chiuda: lo stato 'saved' dà la conferma
   che il messaggio è partito, così non ci si chiede se il
   click abbia fatto qualcosa. */
export default function ReplyModal({ annuncio, onSend, onClose }) {
  const { closing, close } = useModalClose(onClose);
  const [testo, setTesto] = useState('');
  const [error, setError] = useState('');
  const { state, run, busy } = useActionState({
    savedMs: 700,
    onDone: close,
    onError: (err) => setError(err?.message || 'Invio non riuscito.'),
  });

  const isSquadra = annuncio.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;

  function handleSend() {
    const clean = testo.trim();
    if (!clean || busy) return;
    setError('');
    run(() => onSend(annuncio, clean));
  }

  function chiudiSePossibile() {
    if (!busy) close();
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={chiudiSePossibile}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-md p-6 modal-panel ${closing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
          Rispondi a {annuncio.authorName || "l'autore"}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Il messaggio non è pubblico: lo vedete tu e chi ha scritto l'annuncio. Sii educato.
        </p>

        <div
          className="rounded-lg p-3 mb-4 text-sm whitespace-pre-wrap"
          style={{
            backgroundColor: isSquadra ? NOTE_YELLOW : NOTE_WHITE,
            border: `2px solid ${accent}`,
            color: INK,
          }}
        >
          {annuncio.testo}
        </div>

        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          rows={4}
          maxLength={MAX_MESSAGGIO}
          autoFocus
          disabled={busy}
          placeholder="Ciao! Sono interessato, gioco in banda e sono libero quel weekend..."
          className="w-full px-3 py-2.5 rounded-lg border-2 text-sm outline-none resize-none mb-1 disabled:opacity-60"
          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
        />
        <p className="text-xs mb-3 text-right" style={{ color: INK, opacity: 0.45 }}>
          {testo.length}/{MAX_MESSAGGIO}
        </p>

        {error && <p className="text-sm font-semibold mb-3" style={{ color: CLAY }}>{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={chiudiSePossibile}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold disabled:opacity-40"
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!testo.trim() || busy}
            className="flex-1 py-2.5 rounded-lg font-bold transition-all duration-200
                       flex items-center justify-center gap-2
                       active:scale-[0.98] disabled:cursor-default"
            style={{
              // Idle: giallo del brand; saved: verde di conferma.
              backgroundColor: state === 'saved' ? GRASS_DARK : SUN,
              color: state === 'saved' ? '#fff' : INK,
              opacity: (!testo.trim() && state === 'idle') ? 0.6 : 1,
            }}
          >
            {state === 'saving' && (
              <>
                <Loader2 size={16} className="animate-spin" />
                Invio...
              </>
            )}
            {state === 'saved' && (
              <>
                <Check size={16} />
                Inviato
              </>
            )}
            {state === 'idle' && (
              <>
                <Send size={16} />
                Invia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
