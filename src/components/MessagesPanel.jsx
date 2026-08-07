import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Send, MessageCircle, Trash2 } from 'lucide-react';

import { INK, SAND, SUN, CARD_BG, GRASS_DARK, CLAY } from '../theme';
import { timeAgo } from '../utils';
import { otherParticipant, MAX_MESSAGGIO } from '../services/messages';
import { useMessages } from '../hooks/useMessages';
import { useFeedback } from './FeedbackProvider';

function Thread({ conv, profile, onBack, readOnly, onDelete }) {
  const { confirm, toast } = useFeedback();
  const other = otherParticipant(conv, profile.uid);
  // In sola lettura (moderazione) non azzero i "non letti" altrui:
  // il destinatario non deve credere che l'abbia letto lui.
  const { messages, loading, send } = useMessages(conv.id, readOnly ? null : profile.uid);
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const clean = testo.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await send(other.uid, clean);
      setTesto('');
    } catch (err) {
      console.error(err);
      toast('Messaggio non inviato.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: 'rgba(34,48,31,0.15)', backgroundColor: CARD_BG }}>
      <div className="flex items-center gap-2 p-3 border-b-2" style={{ borderColor: 'rgba(34,48,31,0.1)', backgroundColor: SAND }}>
        <button type="button" onClick={onBack} style={{ color: INK }} aria-label="Torna ai messaggi">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate" style={{ color: INK }}>
            {readOnly
              ? Object.values(conv.names ?? {}).filter(Boolean).join('  ↔  ')
              : other.name}
          </p>
          <p className="text-xs truncate" style={{ color: INK, opacity: 0.55 }}>
            Su: {conv.annuncioTesto}
          </p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={async () => {
              // Il documento della conversazione è uno solo e condiviso:
              // cancellarlo la fa sparire anche all'altra persona. Meglio
              // dirlo, invece di lasciar credere che sia un archivio privato.
              const ok = await confirm({
                title: readOnly
                  ? 'Eliminare questa conversazione?'
                  : `Eliminare la conversazione con ${other.name}?`,
                message: readOnly
                  ? 'Verranno rimossi anche tutti i messaggi.'
                  : `Sparirà anche a ${other.name} e non è recuperabile.`,
                confirmLabel: 'Elimina',
              });
              if (ok) {
                onDelete(conv.id);
                onBack();
              }
            }}
            className="shrink-0 p-1.5 rounded-full"
            style={{ color: CLAY }}
            aria-label="Elimina conversazione"
            title="Elimina conversazione"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
        {loading && <p className="text-sm text-center py-6" style={{ color: INK, opacity: 0.5 }}>Caricamento...</p>}
        {messages.map((m) => {
          const mine = readOnly ? m.fromId === conv.startedBy : m.fromId === profile.uid;
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: mine ? SUN : SAND,
                  color: INK,
                  borderBottomRightRadius: mine ? 4 : undefined,
                  borderBottomLeftRadius: mine ? undefined : 4,
                }}
              >
                {readOnly && (
                  <div className="text-[10px] font-bold mb-0.5" style={{ opacity: 0.65 }}>
                    {conv.names?.[m.fromId] || 'Utente'}
                  </div>
                )}
                {m.testo}
                <div className="text-[10px] mt-1" style={{ opacity: 0.5 }}>
                  {m.createdAt?.toDate ? timeAgo(m.createdAt.toDate()) : 'invio...'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <div className="p-3 border-t-2 text-xs" style={{ borderColor: 'rgba(34,48,31,0.1)', color: INK, opacity: 0.55 }}>
          Sola lettura: come admin puoi leggere ed eliminare, non scrivere in una
          conversazione altrui.
        </div>
      ) : (
      <div className="flex items-end gap-2 p-3 border-t-2" style={{ borderColor: 'rgba(34,48,31,0.1)' }}>
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={1}
          maxLength={MAX_MESSAGGIO}
          placeholder="Scrivi un messaggio..."
          className="flex-1 px-3 py-2 rounded-lg border-2 text-sm outline-none resize-none"
          style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!testo.trim() || busy}
          className="p-2.5 rounded-full shrink-0"
          style={{ backgroundColor: INK, color: SAND, opacity: testo.trim() && !busy ? 1 : 0.4 }}
          aria-label="Invia"
        >
          <Send size={16} />
        </button>
      </div>
      )}
    </div>
  );
}

export default function MessagesPanel({
  conversations, profile, readOnly = false, onDeleteConversation, emptyLabel,
}) {
  const { confirm } = useFeedback();
  const [openId, setOpenId] = useState(null);
  const open = conversations.find((c) => c.id === openId);

  if (open) {
    return (
      <Thread
        conv={open}
        profile={profile}
        readOnly={readOnly}
        onDelete={onDeleteConversation}
        onBack={() => setOpenId(null)}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-14">
        <MessageCircle size={40} className="mx-auto mb-3" style={{ color: INK, opacity: 0.25 }} />
        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>Nessun messaggio</h3>
        <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
          {emptyLabel ?? 'Rispondi a un annuncio in bacheca per iniziare una conversazione.'}
        </p>
      </div>
    );
  }

  return conversations.map((c) => {
    const other = otherParticipant(c, profile.uid);
    const unread = readOnly ? 0 : (c.unread?.[profile.uid] ?? 0);
    const label = readOnly
      ? Object.values(c.names ?? {}).filter(Boolean).join('  ↔  ') || 'Conversazione'
      : other.name;
    return (
      /* Riga = contenitore, non bottone: dentro c'è il cestino, e un
         <button> annidato in un altro <button> è HTML non valido (il
         click interno risalirebbe comunque al genitore). */
      <div
        key={c.id}
        className="w-full rounded-xl border-2 p-3 mb-2 flex items-center gap-3"
        style={{
          backgroundColor: CARD_BG,
          borderColor: unread > 0 ? SUN : 'rgba(34,48,31,0.15)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpenId(c.id)}
          className="flex-1 min-w-0 text-left flex items-center gap-3"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0"
            style={{ backgroundColor: SAND, color: GRASS_DARK }}
          >
            {readOnly ? <MessageCircle size={16} /> : (other.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm truncate" style={{ color: INK }}>{label}</p>
              {c.lastAt?.toDate && (
                <span className="text-xs shrink-0" style={{ color: INK, opacity: 0.45 }}>
                  {timeAgo(c.lastAt.toDate())}
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: INK, opacity: 0.6 }}>{c.lastMessage}</p>
          </div>
        </button>

        {unread > 0 && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: SUN, color: INK }}>
            {unread}
          </span>
        )}

        {onDeleteConversation && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: readOnly
                  ? 'Eliminare questa conversazione?'
                  : `Eliminare la conversazione con ${other.name}?`,
                message: readOnly
                  ? 'Verranno rimossi anche tutti i messaggi.'
                  : `Sparirà anche a ${other.name} e non è recuperabile.`,
                confirmLabel: 'Elimina',
              });
              if (ok) onDeleteConversation(c.id);
            }}
            className="shrink-0 p-1.5 rounded-full"
            style={{ color: CLAY }}
            aria-label="Elimina conversazione"
            title="Elimina conversazione"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  });
}
