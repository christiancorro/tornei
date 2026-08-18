import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

import { INK, SUN, CLAY } from '../theme';
import { timeAgo } from '../utils';
import { useRisposte } from '../hooks/useRichieste';
import { sendRisposta } from '../services/richieste';

/* ---------------------------------------------------------
   Thread di risposte a una singola richiesta.

   Usato identico da:
   • FeedbackPanel (lato utente)  → isAdmin=false
   • RichiestaRow  (lato admin)   → isAdmin=true

   Il listener parte solo quando il thread è aperto: se ho 30
   richieste in dashboard non voglio 30 onSnapshot simultanei.

   Props:
   • defaultOpen  → stato iniziale del thread (default: false)
   • onOpenChange → notifica il padre di ogni cambio aperto/chiuso;
                    lato utente serve per accoppiare l'evidenziazione
                    "Nuova risposta" allo stato chiuso del thread.
--------------------------------------------------------- */
export default function RichiestaThread({
  richiesta,
  profile,
  isAdmin,
  defaultOpen = false,
  onOpenChange,
}) {
  const [aperto, setAperto] = useState(defaultOpen);
  const [testo, setTesto] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const { risposte } = useRisposte(richiesta.id, aperto);

  function toggleAperto() {
    const next = !aperto;
    setAperto(next);
    onOpenChange?.(next);
  }

  // Quando il thread si apre (o arriva una nuova risposta mentre è
  // già aperto), porto in vista il fondo — che contiene l'ultima
  // bolla e la textarea — e metto il focus nel campo di risposta.
  //
  // requestAnimationFrame: quando `aperto` passa a true il DOM del
  // thread è appena stato mostrato ma non ancora misurato. Senza
  // aspettare un frame, scrollIntoView usa la posizione "collassata"
  // e non porta niente in vista.
  //
  // `preventScroll: true` sul focus evita che il browser tenti un
  // suo scroll aggiuntivo — lo stiamo già facendo in modo controllato
  // con scrollIntoView e non vogliamo saltoni doppi.
  useEffect(() => {
    if (!aperto) return;
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textareaRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [aperto, risposte.length]);

  /* Al focus della textarea su mobile la tastiera copre il fondo
     dello schermo: se il thread era già visibile in cima, la
     barra input+Invia può finire dietro la tastiera e l'utente
     non trova più il pulsante.

     Porto in vista bottomRef (ancora sotto input+Invia) subito e
     poi di nuovo dopo che la viewport si è assestata. Su iOS
     Safari la viewport si accorcia in due tempi (barra URL +
     tastiera) — uso visualViewport quando c'è per beccare
     l'ultimo cambio invece di sperare in un delay a caso. */
  function handleFocusTextarea() {
    const portaInVista = () =>
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    // Primo giro subito, per il caso desktop / senza tastiera.
    portaInVista();

    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      const onResize = () => {
        portaInVista();
        vv.removeEventListener('resize', onResize);
      };
      vv.addEventListener('resize', onResize);
      // Fallback: se la tastiera non genera un resize (browser
      // vecchi, tastiera che si apre senza cambiare l'altezza) ci
      // limitiamo comunque a un secondo tentativo dopo ~350ms.
      setTimeout(() => {
        vv.removeEventListener('resize', onResize);
        portaInVista();
      }, 400);
    } else {
      setTimeout(portaInVista, 350);
    }
  }

  async function invia() {
    const clean = testo.trim();
    if (!clean || sending) return;
    setSending(true); setErr('');
    try {
      await sendRisposta(richiesta.id, { testo: clean }, profile, { isAdmin });
      setTesto('');
    } catch (e) {
      setErr(e.message || 'Invio non riuscito.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggleAperto}
        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded"
        style={{ color: INK, opacity: 0.7 }}
      >
        {aperto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {aperto ? 'Chiudi' : 'Rispondi'}
      </button>

      {aperto && (
        <div className="mt-2 space-y-2">
          {/* Prima qui c'era un indicatore "Carico…" con spinner
              mostrato mentre useRisposte scaricava le risposte al
              primo apri del thread. È stato tolto per non aggiungere
              rumore visivo al click su "Rispondi": le risposte
              compaiono direttamente appena sono disponibili. */}

          {/* Bolle in stile chat: admin a sinistra (viola chiaro),
              utente a destra (giallo brand). Il colore comunica il
              ruolo senza dover leggere il nome. */}
          {risposte.map((r) => {
            const daAdmin = r.fromRole === 'admin';
            const quando = r.createdAt?.toDate?.() ?? r.createdAt ?? new Date();
            return (
              <div
                key={r.id}
                className="flex"
                style={{ justifyContent: daAdmin ? 'flex-start' : 'flex-end' }}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2"
                  style={{
                    backgroundColor: daAdmin ? '#EDE4F2' : SUN,
                    color: INK,
                  }}
                >
                  <div className="text-[11px] font-bold mb-0.5" style={{ opacity: 0.65 }}>
                    {daAdmin ? 'Admin' : (r.fromName || 'Utente')}
                    {' · '}
                    {timeAgo(quando)}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">{r.testo}</div>
                </div>
              </div>
            );
          })}

          {/* Form di invio: textarea + pulsante.
              Enter da solo va a capo, Ctrl/Cmd+Enter invia (pattern chat).
              Su mobile la textarea sta in piena larghezza e il
              pulsante Invia scende sotto a destra: prima erano
              affiancati con `flex items-end` e la textarea si
              schiacciava tanto che il testo digitato quasi non
              c'entrava. Su desktop (sm:) torna la disposizione a
              riga come prima. */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-1">
            <textarea
              ref={textareaRef}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              onFocus={handleFocusTextarea}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault(); invia();
                }
              }}
              rows={2}
              maxLength={10000}
              disabled={sending}
              placeholder={isAdmin ? "Rispondi all'utente…" : "Rispondi all'admin…"}
              className="w-full sm:flex-1 px-3 py-2 rounded-lg border-2 text-sm resize-y outline-none"
              style={{
                borderColor: 'rgba(34,48,31,0.25)',
                color: INK,
                backgroundColor: '#fff',
                opacity: sending ? 0.6 : 1,
              }}
            />
            <button
              type="button"
              onClick={invia}
              disabled={!testo.trim() || sending}
              className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold shrink-0"
              style={{
                backgroundColor: SUN,
                color: INK,
                opacity: !testo.trim() || sending ? 0.5 : 1,
                cursor: !testo.trim() || sending ? 'not-allowed' : 'pointer',
              }}
              title="Ctrl/Cmd + Enter"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {/* Su mobile mostro anche l'etichetta "Invia" così è
                  chiarissimo cosa fa il pulsante quando è sceso sotto
                  la textarea; su desktop resta solo l'icona come prima. */}
              <span className="sm:hidden">Invia</span>
            </button>
          </div>

          {err && <p className="text-xs" style={{ color: CLAY }}>{err}</p>}

          {/* Ancora per lo scrollIntoView: sta in fondo al contenuto
              espanso, così portarlo in vista significa mostrare
              simultaneamente ultima bolla e textarea. */}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}