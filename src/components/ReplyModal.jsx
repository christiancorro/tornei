import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

import { INK, SUN, CLAY, NOTE_YELLOW, NOTE_WHITE, BOARD_A, BOARD_B } from '../theme';
import { MAX_MESSAGGIO } from '../services/messages';

/* Risposta privata a un annuncio. Non è una chat pubblica:
   apre (o riapre) un thread visibile solo ai due. */
export default function ReplyModal({ annuncio, onSend, onClose }) {
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isSquadra = annuncio.tipo === 'cerca_squadra';
  const accent = isSquadra ? BOARD_A : BOARD_B;

  async function handleSend() {
    const clean = testo.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSend(annuncio, clean);
      onClose();
    } catch (err) {
      setError(err?.message || 'Invio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(34,48,31,0.5)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
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
          placeholder="Ciao! Sono interessato, gioco in banda e sono libero quel weekend..."
          className="w-full px-3 py-2.5 rounded-lg border-2 text-sm outline-none resize-none mb-1"
          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
        />
        <p className="text-xs mb-3 text-right" style={{ color: INK, opacity: 0.45 }}>
          {testo.length}/{MAX_MESSAGGIO}
        </p>

        {error && <p className="text-sm font-semibold mb-3" style={{ color: CLAY }}>{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold"
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!testo.trim() || busy}
            className="flex-1 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2"
            style={{ backgroundColor: SUN, color: INK, opacity: testo.trim() && !busy ? 1 : 0.6 }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {busy ? 'Invio...' : 'Invia'}
          </button>
        </div>
      </div>
    </div>
  );
}
