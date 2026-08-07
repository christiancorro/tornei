import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, Check, X, Users, Clock, Search, MessageCircle, StickyNote, Trash2,
} from 'lucide-react';

import { INK, SAND, SUN, GRASS_DARK, CLAY, CARD_BG } from '../theme';
import {
  ROLE_USER, ROLE_ORGANIZER, ROLE_ADMIN, ROLE_BLOCKED,
  ROLE_LABELS, ROLE_DESCRIPTIONS,
} from '../roles';
import { formatDataLunga, timeAgo } from '../utils';
import MessagesPanel from './MessagesPanel';
import { createTournament, uploadLocandina } from '../services/tournaments';

const ROLE_COLOR = {
  [ROLE_ADMIN]: '#6B4E8E',
  [ROLE_ORGANIZER]: GRASS_DARK,
  [ROLE_USER]: '#7A7A7A',
  [ROLE_BLOCKED]: CLAY,
};

async function createTestTournament() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#22301F';
  ctx.fillRect(0, 0, 800, 1100);

  ctx.fillStyle = '#F6C344';
  ctx.font = 'bold 70px Arial';
  ctx.fillText('TORNEO', 120, 300);

  ctx.fillText('TEST FVG', 100, 400);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '40px Arial';
  ctx.fillText('Beach Volley', 180, 600);

  ctx.font = '32px Arial';
  ctx.fillText('20 Agosto 2026', 180, 750);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );

  const file = new File(
    [blob],
    'torneo-test.jpg',
    { type: 'image/jpeg' }
  );

  const uploaded = await uploadLocandina(file);

  const torneo = {
    nome: "Torneo Test FVG",
    disciplina: "Beach Volley",
    formati: ["2x2"],
    modalita: "Misto",
    data: "2026-08-20",
    dataFine: "",
    ora: "09:00",
    luogo: "Parco Test",
    comune: "Udine",
    provincia: "UD",
    costo: "15",
    iscrizioniEntro: "2026-08-15",
    organizzatore: "ASD Test",
    descrizioneOrganizzatore: "Torneo creato automaticamente per test Storage.",
    instagram: "",
    facebook: "",
    locandina: uploaded.url,
    locandinaPath: uploaded.path,
  };

  await createTournament(torneo, profile);

  alert("Torneo test creato con immagine Storage");
}

function Tab({ active, onClick, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2"
      style={{
        backgroundColor: active ? INK : 'transparent',
        color: active ? SAND : INK,
        border: active ? 'none' : '1px solid rgba(34,48,31,0.25)',
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
  const [motivo, setMotivo] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    try { await fn(); } catch (err) {
      console.error(err);
      alert('Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border-2 p-4 mb-3" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-black text-base truncate" style={{ color: INK }}>{torneo.nome}</h4>
          <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
            {torneo.disciplina} · {torneo.formati?.join(', ')} · {formatDataLunga(torneo.data)}
          </p>
          <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
            {torneo.luogo}, {torneo.comune} ({torneo.provincia})
          </p>
        </div>
        {torneo.locandina && (
          <a href={torneo.locandina} target="_blank" rel="noreferrer" className="shrink-0" title="Vedi locandina">
            <img src={torneo.locandina} alt="" className="w-14 h-14 rounded-lg object-cover" />
          </a>
        )}
      </div>

      <div className="text-xs mb-3 px-2 py-1.5 rounded" style={{ backgroundColor: SAND, color: INK }}>
        Proposto da <strong>{torneo.authorName || 'utente'}</strong> · {torneo.authorEmail}
      </div>

      {torneo.descrizioneOrganizzatore && (
        <p className="text-sm mb-3 whitespace-pre-wrap" style={{ color: INK, opacity: 0.85 }}>
          {torneo.descrizioneOrganizzatore}
        </p>
      )}

      {showReject && (
        <input
          type="text"
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo del rifiuto (visibile all'autore)"
          className="w-full mb-3 px-3 py-2 rounded-lg border-2 text-sm outline-none"
          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onApprove(torneo))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: GRASS_DARK, color: '#fff', opacity: busy ? 0.6 : 1 }}
        >
          <Check size={16} /> Approva e rendi organizzatore
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => (showReject ? run(() => onReject(torneo, motivo)) : setShowReject(true))}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
          style={{ border: `2px solid ${CLAY}`, color: CLAY, opacity: busy ? 0.6 : 1 }}
        >
          <X size={16} /> {showReject ? 'Conferma rifiuto' : 'Rifiuta'}
        </button>
      </div>
    </div>
  );
}

/* --- Riga utente --- */
function UserRow({ utente, isMe, onChangeRole }) {
  const [busy, setBusy] = useState(false);

  async function change(role) {
    if (role === utente.role) return;
    if (role === ROLE_ADMIN && !confirm(`Rendere ${utente.email} amministratore? Avrà i tuoi stessi poteri.`)) return;
    setBusy(true);
    try { await onChangeRole(utente.uid, role); } catch (err) {
      console.error(err);
      alert('Cambio ruolo non riuscito.');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border-2 p-3 mb-2" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: INK }}>
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
          Non puoi cambiare il tuo ruolo da qui.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[ROLE_USER, ROLE_ORGANIZER, ROLE_ADMIN, ROLE_BLOCKED].map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy || r === utente.role}
              onClick={() => change(r)}
              title={ROLE_DESCRIPTIONS[r]}
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                border: `1px solid ${ROLE_COLOR[r]}`,
                backgroundColor: r === utente.role ? ROLE_COLOR[r] : 'transparent',
                color: r === utente.role ? '#fff' : ROLE_COLOR[r],
                opacity: busy ? 0.5 : 1,
              }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({
  pending, users, counts, myUid, profile, conversations, annunci,
  onApprove, onReject, onChangeRole, onDeleteConversation, onDeleteAnnuncio, onCreateTestTournament,
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={22} style={{ color: '#6B4E8E' }} />
        <h2 className="font-black text-2xl" style={{ color: INK }}>Dashboard admin</h2>

      </div>
      <p className="text-sm mb-5" style={{ color: INK, opacity: 0.6 }}>
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
      </div>

      {tab === 'coda' && (
        pending.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="font-black text-lg mb-1" style={{ color: INK }}>Nessun torneo in attesa</h3>
            <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
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
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border-2 text-sm outline-none"
              style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK, backgroundColor: CARD_BG }}
            />
          </div>
          {filteredUsers.map((u) => (
            <UserRow key={u.uid} utente={u} isMe={u.uid === myUid} onChangeRole={onChangeRole} />
          ))}
        </>
      )}

      {tab === 'bacheca' && (
        annunci.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
            La tua bacheca è vuota.
          </p>
        ) : (
          annunci.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border-2 p-3 mb-2"
              style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold" style={{ color: INK, opacity: 0.7 }}>
                  {a.authorName || 'utente'} · {a.tipo === 'cerca_squadra' ? 'Cerco squadra' : 'Cercasi giocatori'}
                </span>
                <span className="text-xs shrink-0" style={{ color: INK, opacity: 0.45 }}>
                  {timeAgo(a.data)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: INK }}>{a.testo}</p>
              <button
                type="button"
                onClick={() => onDeleteAnnuncio(a.id)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ border: `1px solid ${CLAY}`, color: CLAY }}
              >
                <Trash2 size={13} /> Elimina
              </button>
            </div>
          ))
        )
      )}

      {tab === 'messaggi' && (
        <>
          <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}>
            Vedi tutte le conversazioni private dell'app, in sola lettura. Gli utenti
            sono avvisati che un amministratore può leggerle.
          </p>
          <MessagesPanel
            conversations={conversations}
            profile={profile}
            readOnly
            onDeleteConversation={onDeleteConversation}
            emptyLabel="Nessuna conversazione è ancora stata avviata."
          />
        </>
      )}
    </div>
  );
}
