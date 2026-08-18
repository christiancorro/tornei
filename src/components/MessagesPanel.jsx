import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Send, MessageCircle, Trash2 } from 'lucide-react';

import {
  INK, SAND, SUN, CARD_BG, GRASS_DARK, CLAY,
  NOTE_YELLOW, NOTE_WHITE, BOARD_A, BOARD_B,
} from '../theme';
import { timeAgo } from '../utils';
import { otherParticipant } from '../services/messages';
import { useMessages } from '../hooks/useMessages';
import { useFeedback } from './FeedbackProvider';

/* Colori dei bubble dei messaggi. Non li metto nel theme perché
   valgono solo dentro la chat: SUN e SAND sono usati in mezza app
   e ridefinirli globalmente cambierebbe pulsanti, avatar, badge. */
const MSG_MINE_BG = '#f1ab39';
const MSG_OTHER_BG = '#fff1de';

/* Bubble di contesto in cima al thread: mostra il testo dell'annuncio
   che ha originato la conversazione, formattato come un messaggio del
   suo autore.
   • Se l'annuncio è mio → bolla a destra (come i miei messaggi).
   • Se sto rispondendo all'annuncio di qualcuno → bolla a sinistra
     (come i messaggi dell'interlocutore).
   In vista admin (readOnly) l'annuncio va a sinistra come tutti i
   messaggi dell'autore dell'annuncio, per coerenza con la regola di
   allineamento del pannello (fromId === startedBy → destra, cioè il
   risponditore; l'autore dell'annuncio non è startedBy, quindi sta a
   sinistra).
   I colori restano quelli della nota della bacheca — è pur sempre
   quel post, non un messaggio privato. */
function AnnuncioBubble({ conv, profile, readOnly }) {
  if (!conv?.annuncioTesto) return null;

  // Preferisco `annuncioAuthorId` esplicito (aggiunto ai nuovi thread)
  // ma le conversazioni vecchie non l'hanno: fallback su "il
  // partecipante che NON ha startedBy la conversazione", perché è
  // sempre l'autore dell'annuncio per costruzione.
  const authorId = conv.annuncioAuthorId
    ?? conv.participants?.find((p) => p !== conv.startedBy);
  const authorName = conv.names?.[authorId] || 'Utente';
  const isMine = !readOnly && profile?.uid === authorId;
  const isSquadra = conv.annuncioTipo === 'cerca_squadra';
  const noteBg = isSquadra ? NOTE_YELLOW : NOTE_WHITE;
  const accent = isSquadra ? BOARD_A : BOARD_B;

  return (
    <div className={isMine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[80%] rounded-2xl px-3 py-2 text-sm border-2"
        style={{
          backgroundColor: noteBg,
          borderColor: accent,
          color: INK,
          // Angolo "smussato" dal lato del mittente, uguale al pattern
          // degli altri messaggi: coerenza visiva col resto della chat.
          borderBottomRightRadius: isMine ? 4 : undefined,
          borderBottomLeftRadius: isMine ? undefined : 4,
        }}
      >
        <div className="text-[10px] font-bold mb-1 uppercase tracking-wide" style={{ color: accent }}>
          {readOnly
            ? `${authorName} · ${isSquadra ? 'Cerco squadra' : 'Cercasi giocatori'}`
            : `${isSquadra ? 'Cerco squadra' : 'Cercasi giocatori'}`}
        </div>
        <div className="whitespace-pre-wrap break-words">{conv.annuncioTesto}</div>
      </div>
    </div>
  );
}

function Thread({ conv, profile, onBack, readOnly, onDelete }) {
  const { confirm, toast } = useFeedback();
  const other = otherParticipant(conv, profile.uid);
  // In sola lettura (moderazione) non azzero i "non letti" altrui:
  // il destinatario non deve credere che l'abbia letto lui.
  const { messages, loading, send } = useMessages(conv.id, readOnly ? null : profile.uid);
  const [testo, setTesto] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Invio messaggio: niente stato "saving"/"saved" sul pulsante. La
  // conferma è già visiva — il nuovo messaggio compare subito in
  // cima all'elenco — quindi uno spinner/check qui è ridondante.
  // In caso di errore mostriamo un toast come per gli altri
  // fallimenti di rete.
  async function handleSend() {
    const clean = testo.trim();
    if (!clean) return;
    const daInviare = clean;
    setTesto(''); // pulisci subito, così si può digitare il prossimo
    try {
      await send(other.uid, daInviare);
    } catch (err) {
      console.error('[invia messaggio]', err);
      // Rimetto il testo dentro così l'utente non lo perde e può
      // ritentare.
      setTesto(daInviare);
      toast('Messaggio non inviato.', 'error');
    }
  }

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: 'rgba(34,48,31,0.15)', backgroundColor: CARD_BG }}>
      {/* L'intera barra è cliccabile per tornare indietro — freccia
          e nome fanno parte di un unico <button> largo, così l'area
          di tocco è generosa (utile su mobile). Il cestino resta
          fuori come pulsante a parte: non si può annidare un
          <button> dentro un altro (HTML non valido, e il click
          verrebbe intercettato dall'esterno). */}
      <div className="flex items-center border-b-2" style={{ borderColor: 'rgba(34,48,31,0.1)' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Torna ai messaggi"
          className="flex items-center gap-2 p-3 flex-1 min-w-0 text-left hover:bg-black/1 transition-colors"
          style={{ color: INK }}
        >
          <ChevronLeft size={20} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-2sm truncate" style={{ color: INK }}>
              {readOnly
                ? Object.values(conv.names ?? {}).filter(Boolean).join('  ↔  ')
                : other.name}
            </p>
            {/* La riga "Su: ..." storica è sparita: adesso il contesto
                dell'annuncio è il primo bubble sotto, con il testo
                intero e la formattazione dei bigliettini di bacheca. */}
          </div>
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={async () => {
              // Il documento della conversazione è uno solo e condiviso:
              // cancellarlo la fa sparire anche all'altra persona. Meglio
              // dirlo, invece di lasciar credere che sia un archivio privato.
              await confirm({
                title: readOnly
                  ? 'Eliminare questa conversazione?'
                  : `Eliminare la conversazione con ${other.name}?`,
                message: readOnly
                  ? 'Verranno rimossi anche tutti i messaggi.'
                  : `Sparirà anche a ${other.name} e non è recuperabile.`,
                confirmLabel: 'Elimina',
                savingLabel: 'Eliminazione...',
                savedLabel: 'Eliminata',
                // Con onConfirm il dialog aspetta il return prima di
                // chiudersi: il pulsante mostra spinner → check e solo
                // dopo si torna alla lista. Se buttassi via `await`
                // qui, `onBack()` verrebbe chiamato subito e la
                // transizione di conferma non si vedrebbe.
                onConfirm: async () => {
                  await onDelete(conv.id);
                },
              });
              // A dialog chiuso torniamo alla lista.
              onBack();
            }}
            className="shrink-0 p-3 rounded-full hover:bg-black/5 transition-colors mr-1"
            style={{ color: CLAY }}
            aria-label="Elimina conversazione"
            title="Elimina conversazione"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '75vh' }}>
        {/* L'annuncio va sopra tutto, anche prima dello spinner di
            loading: dà subito contesto anche mentre i messaggi
            arrivano. Allineato dalla parte del suo autore: a destra
            se l'annuncio è mio, a sinistra se sto rispondendo. */}
        <AnnuncioBubble conv={conv} profile={profile} readOnly={readOnly} />

        {loading && <p className="text-sm text-center py-6" style={{ color: INK, opacity: 0.5 }}>Caricamento...</p>}
        {messages.map((m) => {
          const mine = readOnly ? m.fromId === conv.startedBy : m.fromId === profile.uid;
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: mine ? MSG_MINE_BG : MSG_OTHER_BG,
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
          {/* Niente maxLength: il tetto è nel service (10 000 char) e
            nelle regole. Se davvero l'utente supera quel valore,
            l'errore di invio glielo dice. */}
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            rows={1}
            placeholder="Scrivi un messaggio..."
            className="flex-1 px-3 py-2 rounded-lg border-2 text-sm outline-none resize-none"
            style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!testo.trim()}
            className="p-2.5 rounded-full shrink-0 transition-transform active:scale-95"
            style={{
              backgroundColor: INK,
              color: SAND,
              opacity: testo.trim() ? 1 : 0.4,
            }}
            aria-label="Invia"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* Riga singola nella lista conversazioni.
   • L'intera riga (padding compreso) è cliccabile per aprire il
     thread — prima era cliccabile solo il <button> interno con
     avatar+testo e i click sulla fascia di padding p-3 finivano nel
     vuoto. Uso `role="button"` sul div esterno + `onKeyDown` per
     Enter/Space così resta accessibile; il cestino ferma la
     propagazione così un click su di lui non apre anche il thread.
   • Hover: cambia solo il bordo (più scuro), il fondo resta uguale.
     Uso `useState` perché il borderColor è inline e dipende anche da
     `unread`, quindi non basta un `hover:` di Tailwind. */
function ConversationRow({ conv, profile, readOnly, onDelete, onOpen, confirm }) {
  const [hover, setHover] = useState(false);
  const other = otherParticipant(conv, profile.uid);
  const unread = readOnly ? 0 : (conv.unread?.[profile.uid] ?? 0);
  const label = readOnly
    ? Object.values(conv.names ?? {}).filter(Boolean).join('  ↔  ') || 'Conversazione'
    : other.name;

  function handleDeleteClick(e) {
    // Se non fermassimo la propagazione, il click passerebbe al div
    // esterno e aprirebbe anche il thread — l'utente vedrebbe la
    // conversazione aprirsi mentre si conferma la sua eliminazione.
    e.stopPropagation();
    confirm({
      title: readOnly
        ? 'Eliminare questa conversazione?'
        : `Eliminare la conversazione con ${other.name}?`,
      message: readOnly
        ? 'Verranno rimossi anche tutti i messaggi.'
        : `Sparirà anche a ${other.name} e non è recuperabile.`,
      confirmLabel: 'Elimina',
      savingLabel: 'Eliminazione...',
      savedLabel: 'Eliminata',
      onConfirm: async () => {
        await onDelete(conv.id);
      },
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-full rounded-xl border-2 p-3 mb-2 flex items-center gap-3 transition-colors duration-150 cursor-pointer"
      style={{
        backgroundColor: CARD_BG,
        // Bordo: SUN se ci sono non letti (segnale forte); altrimenti
        // scurisce leggermente sul hover.
        borderColor: unread > 0
          ? SUN
          : hover
            ? 'rgba(34,48,31,0.45)'
            : 'rgba(34,48,31,0.15)',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0"
        style={{ backgroundColor: SAND, color: GRASS_DARK }}
      >
        {readOnly ? <MessageCircle size={16} /> : (other.name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-2sm truncate" style={{ color: INK }}>{label}</p>
          {conv.lastAt?.toDate && (
            <span className="text-xs shrink-0" style={{ color: INK, opacity: 0.45 }}>
              {timeAgo(conv.lastAt.toDate())}
            </span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: INK, opacity: 0.6 }}>{conv.lastMessage}</p>
      </div>

      {unread > 0 && (
        <span className="text-xs font-black px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: SUN, color: INK }}>
          {unread}
        </span>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="shrink-0 p-1.5 rounded-full hover:bg-black/5 transition-colors"
          style={{ color: CLAY }}
          aria-label="Elimina conversazione"
          title="Elimina conversazione"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

/* pendingOpenConv: convId che il parent vuole aprire (per esempio
   dopo aver risposto a un annuncio). Al cambio di valore aprire il
   thread e chiamare onConvOpened così il parent azzera il pending —
   se non lo azzera, riaprire manualmente qualcosa lo farebbe
   riscattare.

   Nota: il reset (chiudi conversazione al re-click del tab Messaggi)
   NON si gestisce più con un prop segnale ma bumping la `key` del
   wrapper in AccountDashboard: quando il wrapper si rimonta,
   MessagesPanel riparte fresh con openId=null. Un tempo c'era qui un
   useEffect con una ref "primoRender" per intercettare il segnale,
   ma la ref persiste nel fiber e in React StrictMode dev veniva
   invalidata dal doppio effect di verifica — la conseguenza era che
   subito dopo aver aperto una conversazione tramite pendingOpenConv,
   l'effect di reset la chiudeva. Meglio non usare ref booleane per
   "salta il primo mount" in generale. */
export default function MessagesPanel({
  conversations, profile, readOnly = false, onDeleteConversation, emptyLabel,
  pendingOpenConv, onConvOpened,
}) {
  const { confirm } = useFeedback();
  const [openId, setOpenId] = useState(null);
  const open = conversations.find((c) => c.id === openId);

  useEffect(() => {
    if (!pendingOpenConv) return;
    setOpenId(pendingOpenConv);
    // Chiamato in fondo per dare tempo a setOpenId di essere consumato
    // nello stesso ciclo: onConvOpened tipicamente azzera il pending
    // nel parent, quindi il prossimo render non ricaduta qui.
    onConvOpened?.();
  }, [pendingOpenConv, onConvOpened]);

  /* Wrapper con `key` che cambia fra la lista e il thread: fa
     ripartire l'animazione `view-swap-in` (fade + slide di 6px in
     220ms, definita in styles.css) sia quando apro una
     conversazione sia quando torno indietro. Non è una vera
     cross-fade — il vecchio contenuto esce di colpo — ma l'entrata
     morbida del nuovo copre lo swap. */
  return (
    <div key={openId || '__list__'} className="view-swap">
      {open ? (
        <Thread
          conv={open}
          profile={profile}
          readOnly={readOnly}
          onDelete={onDeleteConversation}
          onBack={() => setOpenId(null)}
        />
      ) : conversations.length === 0 ? (
        <div className="text-center py-14">
          <MessageCircle size={40} className="mx-auto mb-3" style={{ color: INK, opacity: 0.25 }} />
          <h3 className="font-black text-lg mb-1" style={{ color: INK }}>Nessun messaggio</h3>
          <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
            {emptyLabel ?? 'Rispondi a un annuncio in bacheca per iniziare una conversazione.'}
          </p>
        </div>
      ) : (
        <div>
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conv={c}
              profile={profile}
              readOnly={readOnly}
              onDelete={onDeleteConversation}
              onOpen={() => setOpenId(c.id)}
              confirm={confirm}
            />
          ))}
        </div>
      )}
    </div>
  );
}