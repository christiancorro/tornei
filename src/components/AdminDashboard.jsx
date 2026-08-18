import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, Check, X, Users, Clock, Search, MessageCircle, StickyNote, Trash2,
  UserX, Loader2, Lightbulb, Mail, MailOpen,
} from 'lucide-react';

import { INK, SAND, SUN, GRASS_DARK, CLAY, CARD_BG, BOARD_A, BOARD_B, NOTE_YELLOW, NOTE_WHITE } from '../theme';
import {
  ROLE_USER, ROLE_ORGANIZER, ROLE_ADMIN, ROLE_BLOCKED,
  ROLE_LABELS, ROLE_DESCRIPTIONS,
} from '../roles';
import { formatDataLunga, timeAgo } from '../utils';
import { useActionState } from '../hooks/useActionState';
import MessagesPanel from './MessagesPanel';
import RichiestaThread from './RichiestaThread';
import { useFeedback } from './FeedbackProvider';

const ROLE_COLOR = {
  [ROLE_ADMIN]: '#6B4E8E',
  [ROLE_ORGANIZER]: GRASS_DARK,
  [ROLE_USER]: '#7A7A7A',
  [ROLE_BLOCKED]: CLAY,
};

function Tab({ active, onClick, children, badge }) {
  // Hover con useState perché il bordo è inline e dipende anche
  // dallo stato `active`: un `hover:` di Tailwind non basterebbe
  // senza `!important`, e la logica si aggroviglia. Stesso pattern
  // del Tab in AccountDashboard.
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-4 py-2 rounded-full text-2sm font-bold flex items-center gap-2 transition-colors"
      style={{
        backgroundColor: active ? INK : 'transparent',
        color: active ? SAND : INK,
        border: active
          ? 'none'
          : `1px solid ${hover ? 'rgba(34,48,31,0.6)' : 'rgba(34,48,31,0.25)'}`,
      }}
    >
      {children}
      {badge > 0 && (
        <span
          className="text-xs px-1.5 rounded-full font-black"
          style={{ backgroundColor: SUN, color: INK }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* --- Coda di moderazione --- */
function PendingCard({ torneo, onApprove, onReject }) {
  const { toast } = useFeedback();
  const [motivo, setMotivo] = useState('');
  const [showReject, setShowReject] = useState(false);

  const approva = useActionState({
    savedMs: 800,
    onError: () => toast('Approvazione non riuscita.', 'error'),
  });
  const rifiuta = useActionState({
    savedMs: 800,
    onError: () => toast('Rifiuto non riuscito.', 'error'),
  });
  const busy = approva.busy || rifiuta.busy;

  return (
    <div className="rounded-xl border-2 p-4 mb-3" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-black text-base truncate" style={{ color: INK }}>{torneo.nome}</h4>
          <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
            {torneo.disciplina} · {torneo.formati?.join(', ')} · {formatDataLunga(torneo.data)}
          </p>
          <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
            {torneo.comune}
          </p>
        </div>
        {torneo.locandina && (
          <a href={torneo.locandina} target="_blank" rel="noreferrer" className="shrink-0" title="Vedi locandina">
            <img src={torneo.locandinaThumb || torneo.locandina} alt="" className="w-14 h-14 rounded-lg object-cover" />
          </a>
        )}
      </div>

      <div className="text-xs mb-3 px-2 py-1.5 rounded" style={{ backgroundColor: SAND, color: INK }}>
        Proposto da <strong>{torneo.authorName || 'utente'}</strong> · {torneo.authorEmail}
      </div>

      {torneo.descrizioneOrganizzatore && (
        <p className="text-2sm mb-3 whitespace-pre-wrap" style={{ color: INK, opacity: 0.85 }}>
          {torneo.descrizioneOrganizzatore}
        </p>
      )}

      {showReject && (
        <input
          type="text"
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={busy}
          placeholder="Motivo del rifiuto (visibile all'autore)"
          className="w-full mb-3 px-3 py-2 rounded-lg border-2 text-2sm outline-none disabled:opacity-60"
          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => approva.run(() => onApprove(torneo))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-2sm font-bold
                     transition-all duration-200 active:scale-[0.98] disabled:cursor-default"
          style={{
            backgroundColor: GRASS_DARK,
            color: '#fff',
            opacity: busy && !approva.busy ? 0.4 : 1,
          }}
        >
          {approva.saving && <Loader2 size={16} className="animate-spin" />}
          {approva.saved && <Check size={16} />}
          {approva.idle && <Check size={16} />}
          {approva.saving ? 'Approvazione...'
            : approva.saved ? 'Approvato'
              : 'Approva e rendi organizzatore'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => (showReject ? rifiuta.run(() => onReject(torneo, motivo)) : setShowReject(true))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-2sm font-bold
                     transition-all duration-200 active:scale-[0.98] disabled:cursor-default"
          style={{
            border: `2px solid ${rifiuta.saved ? GRASS_DARK : CLAY}`,
            color: rifiuta.saved ? GRASS_DARK : CLAY,
            opacity: busy && !rifiuta.busy ? 0.4 : 1,
          }}
        >
          {rifiuta.saving && <Loader2 size={16} className="animate-spin" />}
          {rifiuta.saved && <Check size={16} />}
          {rifiuta.idle && <X size={16} />}
          {rifiuta.saving ? 'Rifiuto...'
            : rifiuta.saved ? 'Rifiutato'
              : showReject ? 'Conferma rifiuto'
                : 'Rifiuta'}
        </button>
      </div>
    </div>
  );
}

/* --- Riga utente --- */
function UserRow({ utente, isMe, onChangeRole, onDelete, onFootprint }) {
  const { confirm, toast } = useFeedback();
  const [confermaElimina, setConfermaElimina] = useState(false);
  const [footprint, setFootprint] = useState(null);

  const [ruoloInCorso, setRuoloInCorso] = useState(null);
  const cambioRuolo = useActionState({
    savedMs: 600,
    onError: () => toast('Cambio ruolo non riuscito.', 'error'),
    onDone: () => setRuoloInCorso(null),
  });
  const elimina = useActionState({
    savedMs: 700,
    onError: () => toast('Eliminazione non riuscita.', 'error'),
    onDone: () => setConfermaElimina(false),
  });

  async function change(role) {
    if (role === utente.role || cambioRuolo.busy) return;
    if (role === ROLE_ADMIN) {
      const ok = await confirm({
        title: 'Rendere questa persona amministratore?',
        message: `${utente.email} avrà i tuoi stessi poteri: potrà approvare tornei, gestire utenti e leggere i messaggi privati.`,
        confirmLabel: 'Rendi admin',
      });
      if (!ok) return;
    }
    setRuoloInCorso(role);
    cambioRuolo.run(() => onChangeRole(utente.uid, role));
  }

  async function apriElimina() {
    setConfermaElimina(true);
    setFootprint(await onFootprint(utente.uid).catch(() => null));
  }

  function eliminaOra() {
    elimina.run(async () => {
      await onDelete(utente.uid);
      toast('Utente eliminato.', 'success');
    });
  }

  return (
    <div className="rounded-xl border-2 p-3 mb-2" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-bold text-2sm truncate" style={{ color: INK }}>
            {utente.displayName || '(senza nome)'} {isMe && <span className="text-xs font-normal">(tu)</span>}
          </p>
          <p className="text-xs truncate" style={{ color: INK, opacity: 0.6 }}>{utente.email}</p>
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
          style={{ backgroundColor: `${ROLE_COLOR[utente.role]}22`, color: ROLE_COLOR[utente.role] }}
        >
          {ROLE_LABELS[utente.role] ?? utente.role}
        </span>
      </div>

      {isMe ? (
        <p className="text-xs" style={{ color: INK, opacity: 0.5 }}>
          Non puoi cambiare il tuo ruolo né eliminarti da qui.
        </p>
      ) : utente.deleted ? (
        <p className="text-xs" style={{ color: INK, opacity: 0.5 }}>
          Contenuti eliminati. Rimuovi l'account da Firebase Console →
          Authentication, oppure con <code>--delete-user {utente.email}</code>.
        </p>
      ) : confermaElimina ? (
        <div>
          <p className="text-xs mb-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}>
            Verranno eliminati definitivamente{' '}
            <strong>{footprint ? footprint.tornei : '…'} tornei</strong>,{' '}
            <strong>{footprint ? footprint.annunci : '…'} annunci</strong> e{' '}
            <strong>{footprint ? footprint.conversazioni : '…'} conversazioni</strong>.
            L'account non potrà più accedere.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfermaElimina(false)}
              disabled={elimina.busy}
              className="px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-40"
              style={{ border: '1px solid rgba(34,48,31,0.25)', color: INK }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={eliminaOra}
              disabled={elimina.busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                         transition-all duration-200 active:scale-[0.98]"
              style={{
                backgroundColor: elimina.saved ? GRASS_DARK : CLAY,
                color: '#fff',
              }}
            >
              {elimina.saving && <Loader2 size={13} className="animate-spin" />}
              {elimina.saved && <Check size={13} />}
              {elimina.idle && <UserX size={13} />}
              {elimina.saving ? 'Eliminazione...'
                : elimina.saved ? 'Eliminato'
                  : 'Conferma eliminazione'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[ROLE_USER, ROLE_ORGANIZER, ROLE_ADMIN, ROLE_BLOCKED].map((r) => {
            const inCorso = cambioRuolo.saving && ruoloInCorso === r;
            const appenaFatto = cambioRuolo.saved && ruoloInCorso === r;
            const attivo = r === utente.role;
            return (
              <button
                key={r}
                type="button"
                disabled={cambioRuolo.busy || attivo}
                onClick={() => change(r)}
                title={ROLE_DESCRIPTIONS[r]}
                className="px-2.5 py-1 rounded-full text-xs font-semibold
                           transition-all duration-200 active:scale-[0.98]
                           flex items-center gap-1"
                style={{
                  border: `1px solid ${ROLE_COLOR[r]}`,
                  backgroundColor: attivo || appenaFatto ? ROLE_COLOR[r] : 'transparent',
                  color: attivo || appenaFatto ? '#fff' : ROLE_COLOR[r],
                  opacity: cambioRuolo.busy && !inCorso && !appenaFatto ? 0.4 : 1,
                }}
              >
                {inCorso && <Loader2 size={11} className="animate-spin" />}
                {appenaFatto && <Check size={11} />}
                {ROLE_LABELS[r]}
              </button>
            );
          })}

          <span className="w-px h-6 mx-1" style={{ backgroundColor: 'rgba(34,48,31,0.15)' }} />

          <button
            type="button"
            onClick={apriElimina}
            disabled={cambioRuolo.busy}
            title="Elimina utente e tutti i suoi contenuti"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-40"
            style={{ border: `1px solid ${CLAY}`, color: CLAY }}
          >
            <UserX size={13} /> Elimina
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Riga annuncio in bacheca --- */
function AdminAnnuncioRow({ annuncio, onDelete }) {
  const { toast } = useFeedback();
  const elimina = useActionState({
    savedMs: 600,
    onError: () => toast('Eliminazione non riuscita.', 'error'),
  });

  // Colore del bordo in base al tipo di annuncio, come nelle
  // note della bacheca lato utente e nelle card di "I miei
  // annunci" in Account: BOARD_A per "Cerco squadra" (giallo
  // brand), BOARD_B per "Cercasi giocatori" (viola). Così a
  // colpo d'occhio l'admin distingue i due tipi senza dover
  // leggere la label.
  const bordoAnnuncio = annuncio.tipo === 'cerca_squadra' ? BOARD_A : BOARD_B;
  const bgAnnuncio = annuncio.tipo === 'cerca_squadra' ? NOTE_YELLOW : NOTE_WHITE;

  return (
    <div
      className="rounded-xl border-2 p-3 mb-2"
      style={{ backgroundColor: bgAnnuncio, borderColor: bordoAnnuncio }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold" style={{ color: INK, opacity: 0.7 }}>
          {annuncio.authorName || 'utente'} · {annuncio.tipo === 'cerca_squadra' ? 'Cerco squadra' : 'Cercasi giocatori'}
        </span>
        <span className="text-xs shrink-0" style={{ color: INK, opacity: 0.45 }}>
          {timeAgo(annuncio.data)}
        </span>
      </div>
      <p className="text-2sm whitespace-pre-wrap mb-2" style={{ color: INK }}>{annuncio.testo}</p>
      <button
        type="button"
        onClick={() => elimina.run(() => onDelete(annuncio.id))}
        disabled={elimina.busy}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                   transition-all duration-200 active:scale-[0.98]"
        style={{
          border: `1px solid ${elimina.saved ? GRASS_DARK : CLAY}`,
          color: elimina.saved ? GRASS_DARK : CLAY,
        }}
      >
        {elimina.saving && <Loader2 size={13} className="animate-spin" />}
        {elimina.saved && <Check size={13} />}
        {elimina.idle && <Trash2 size={13} />}
        {elimina.saving ? 'Eliminazione...'
          : elimina.saved ? 'Eliminato'
            : 'Elimina'}
      </button>
    </div>
  );
}

/* --- Riga richiesta (con thread di risposte) --- */
function RichiestaRow({ richiesta, profile, onMarkRead, onDelete }) {
  const { toast, confirm } = useFeedback();
  const nonLetta = !richiesta.letto;

  const elimina = useActionState({
    savedMs: 700,
    onError: () => toast('Eliminazione non riuscita.', 'error'),
  });
  const busy = elimina.busy;

  /* "Segna come letta / non letta": fire-and-forget, senza
     useActionState. Prima mostrava lo spinner "Aggiorno…" e poi
     un flash "Fatto ✓" per ~800ms; il feedback era sproporzionato
     per un'azione così banale (un toggle su un booleano che si
     riflette subito nel pill "Nuovo" della card). Ora il click
     parte, l'errore eventuale viene notificato via toast, e basta. */
  async function toggleLetto() {
    try {
      await onMarkRead(richiesta.id, nonLetta);
    } catch (e) {
      console.error('[richiesta] segna come letta', e);
      toast('Aggiornamento non riuscito.', 'error');
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Eliminare questa richiesta?',
      message: 'L\'operazione è irreversibile: il messaggio dell\'utente e tutte le risposte spariranno per sempre.',
      confirmLabel: 'Elimina',
      dangerous: true,
    });
    if (!ok) return;
    elimina.run(() => onDelete(richiesta.id));
  }

  const quando = richiesta.createdAt?.toDate?.() ?? richiesta.createdAt ?? null;

  return (
    <div
      className="rounded-xl border-2 p-4 mb-3"
      style={{
        backgroundColor: nonLetta ? '#FFF8E7' : CARD_BG,
        borderColor: nonLetta ? SUN : 'rgba(34,48,31,0.15)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-black text-base truncate" style={{ color: INK }}>
            {richiesta.authorName || 'Utente anonimo'}
          </h4>
          <p className="text-xs truncate" style={{ color: INK, opacity: 0.6 }}>
            {richiesta.authorEmail || '—'}
            {quando && <> · {timeAgo(quando)}</>}
          </p>
        </div>
        {nonLetta && (
          <span
            className="text-xs font-black px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: SUN, color: INK }}
          >
            Nuovo
          </span>
        )}
      </div>

      <p className="text-2sm whitespace-pre-wrap mb-3" style={{ color: INK }}>
        {richiesta.testo}
      </p>

      {(richiesta.url || richiesta.userAgent) && (
        <p className="text-[11px] mb-3 break-all" style={{ color: INK, opacity: 0.4 }}>
          {richiesta.url}
          {richiesta.userAgent && <> · {richiesta.userAgent}</>}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Bottone "Segna come letta / non letta": nessun
            spinner né stato "Fatto" — vedi toggleLetto sopra. */}
        <button
          type="button"
          onClick={toggleLetto}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                     transition-all duration-200 active:scale-[0.98]"
          style={{
            border: '1px solid rgba(34,48,31,0.25)',
            color: INK,
            opacity: busy ? 0.4 : 1,
          }}
        >
          {nonLetta ? <MailOpen size={13} /> : <Mail size={13} />}
          {nonLetta ? 'Segna come letta' : 'Segna come non letta'}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                     transition-all duration-200 active:scale-[0.98]"
          style={{
            border: `1px solid ${elimina.saved ? GRASS_DARK : CLAY}`,
            color: elimina.saved ? GRASS_DARK : CLAY,
            opacity: busy && !elimina.busy ? 0.4 : 1,
          }}
        >
          {elimina.saving && <Loader2 size={13} className="animate-spin" />}
          {elimina.saved && <Check size={13} />}
          {elimina.idle && <Trash2 size={13} />}
          {elimina.saving ? 'Elimino…'
            : elimina.saved ? 'Eliminata'
              : 'Elimina'}
        </button>
      </div>

      {/* Thread di risposte: si espande al click, il listener parte
          solo alla prima apertura per non tenere N onSnapshot aperti
          quando ci sono molte richieste in elenco. */}
      <RichiestaThread richiesta={richiesta} profile={profile} isAdmin />
    </div>
  );
}

export default function AdminDashboard({
  pending, users, counts, myUid, profile, conversations, annunci,
  richieste = [], onMarkRichiestaRead, onDeleteRichiesta,
  onApprove, onReject, onChangeRole, onDeleteConversation, onDeleteAnnuncio,
  onDeleteUser, onUserFootprint,
}) {
  const [tab, setTab] = useState('coda');
  const [q, setQ] = useState('');

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) => u.email?.toLowerCase().includes(s) || u.displayName?.toLowerCase().includes(s)
    );
  }, [users, q]);

  const richiesteNonLette = useMemo(
    () => richieste.filter((r) => !r.letto).length,
    [richieste],
  );

  return (
    <div className="max-w-[65rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={22} style={{ color: '#6B4E8E' }} />
        <h2 className="font-black text-2xl" style={{ color: INK }}>Dashboard admin</h2>
      </div>
      <p className="text-2sm mb-5" style={{ color: INK, opacity: 0.6 }}>
        {counts[ROLE_ORGANIZER]} organizzatori · {counts[ROLE_USER]} utenti · {counts[ROLE_BLOCKED]} bloccati
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        <Tab active={tab === 'coda'} onClick={() => setTab('coda')} badge={pending.length}>
          <Clock size={16} /> Tornei in sospeso
        </Tab>
        <Tab active={tab === 'utenti'} onClick={() => setTab('utenti')}>
          <Users size={16} /> Utenti
        </Tab>
        <Tab active={tab === 'bacheca'} onClick={() => setTab('bacheca')}>
          <StickyNote size={16} /> Bacheca
        </Tab>
        <Tab active={tab === 'messaggi'} onClick={() => setTab('messaggi')}>
          <MessageCircle size={16} /> Messaggi
        </Tab>
        <Tab
          active={tab === 'richieste'}
          onClick={() => setTab('richieste')}
          badge={richiesteNonLette}
        >
          <Lightbulb size={16} /> Richieste
        </Tab>
      </div>

      <div key={tab} className="view-swap">
        {tab === 'coda' && (
          pending.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="font-black text-lg mb-1" style={{ color: INK }}>Nessun torneo in attesa</h3>
              <p className="text-2sm" style={{ color: INK, opacity: 0.6 }}>
                Le nuove proposte compaiono qui.
              </p>
            </div>
          ) : (
            pending.map((t) => (
              <PendingCard key={t.id} torneo={t} onApprove={onApprove} onReject={onReject} />
            ))
          )
        )}

        {tab === 'utenti' && (
          <>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK, opacity: 0.4 }} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per nome o email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border-2 text-2sm outline-none"
                style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK, backgroundColor: CARD_BG }}
              />
            </div>
            {filteredUsers.map((u) => (
              <UserRow
                key={u.uid}
                utente={u}
                isMe={u.uid === myUid}
                onChangeRole={onChangeRole}
                onDelete={onDeleteUser}
                onFootprint={onUserFootprint}
              />
            ))}
          </>
        )}

        {tab === 'bacheca' && (
          annunci.length === 0 ? (
            <p className="text-2sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
              La bacheca è vuota.
            </p>
          ) : (
            annunci.map((a) => (
              <AdminAnnuncioRow key={a.id} annuncio={a} onDelete={onDeleteAnnuncio} />
            ))
          )
        )}

        {tab === 'messaggi' && (
          <>

            <MessagesPanel
              conversations={conversations}
              profile={profile}
              readOnly
              onDeleteConversation={onDeleteConversation}
              emptyLabel="Nessuna conversazione è ancora stata avviata."
            />
          </>
        )}

        {tab === 'richieste' && (
          richieste.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">💡</div>
              <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
                Nessuna richiesta
              </h3>
              <p className="text-2sm" style={{ color: INK, opacity: 0.6 }}>
                I suggerimenti e le segnalazioni degli utenti compariranno qui.
              </p>
            </div>
          ) : (
            richieste.map((r) => (
              <RichiestaRow
                key={r.id}
                richiesta={r}
                profile={profile}
                onMarkRead={onMarkRichiestaRead}
                onDelete={onDeleteRichiesta}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}