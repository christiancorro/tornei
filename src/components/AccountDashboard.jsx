import React, { useState } from 'react';
import {
  CalendarDays, StickyNote, MessageCircle, Pencil, Trash2, Plus, Clock, Check, Ban, Settings, LogOut,
} from 'lucide-react';

import { INK, SAND, SUN, GRASS_DARK, CLAY, CARD_BG, BOARD_A, BOARD_B } from '../theme';
import {
  STATUS_PENDING, STATUS_PUBLISHED, STATUS_REJECTED, STATUS_LABELS,
  ROLE_LABELS, isOrganizer, isActive,
} from '../roles';
import { formatDataLunga, timeAgo } from '../utils';
import MessagesPanel from './MessagesPanel';
import AccountSettings from './AccountSettings';

const STATUS_STYLE = {
  [STATUS_PENDING]: { bg: '#FFF4DE', fg: '#8A5A00', Icon: Clock },
  [STATUS_PUBLISHED]: { bg: '#E7F0DE', fg: GRASS_DARK, Icon: Check },
  [STATUS_REJECTED]: { bg: '#FBE3DC', fg: '#8C3520', Icon: Ban },
};

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
        <span className="text-xs px-1.5 rounded-full font-black" style={{ backgroundColor: SUN, color: INK }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE[STATUS_PUBLISHED];
  const { Icon } = s;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full shrink-0"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <Icon size={13} /> {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function AccountDashboard({
  profile,
  mieiTornei,
  mieiAnnunci,
  conversations,
  unreadTotal,
  onNuovoTorneo,
  onEditTorneo,
  onDeleteTorneo,
  onDeleteAnnuncio,
  onOpenDetail,
  onLogout,
  onDeleted,
}) {
  const [tab, setTab] = useState('tornei');
  const organizer = isOrganizer(profile);
  const attivo = isActive(profile);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-black text-2xl" style={{ color: INK }}>
          Ciao {profile?.displayName?.split(' ')[0] || ''}
        </h2>

        {/* Uscire deve costare un tocco, non un giro nelle impostazioni. */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold shrink-0 border"
          style={{ backgroundColor: SAND, color: INK }}
        >
          <LogOut size={16} /> Esci
        </button>
      </div>

      <p className="text-sm mb-5" style={{ color: INK, opacity: 0.6 }}>
        Il tuo ruolo: <strong>{ROLE_LABELS[profile?.role] ?? '—'}</strong>
        {attivo && !organizer && ' · proponi un torneo per diventare organizzatore'}
      </p>

      <div className="flex gap-2 sm:gap-4 mb-5 flex-wrap">
        <Tab active={tab === 'tornei'} onClick={() => setTab('tornei')}>
          <CalendarDays size={16} /> I miei tornei
        </Tab>
        <Tab active={tab === 'annunci'} onClick={() => setTab('annunci')}>
          <StickyNote size={16} /> I miei annunci
        </Tab>
        <Tab active={tab === 'messaggi'} onClick={() => setTab('messaggi')} badge={unreadTotal}>
          <MessageCircle size={16} /> Messaggi
        </Tab>
        <Tab active={tab === 'impostazioni'} onClick={() => setTab('impostazioni')}>
          <Settings size={16} /> Impostazioni
        </Tab>
      </div>

      {tab === 'tornei' && (
        <>
          {attivo && (
            <button
              type="button"
              onClick={onNuovoTorneo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold mb-4"
              style={{ backgroundColor: SUN, color: INK }}
            >
              <Plus size={18} /> {organizer ? 'Pubblica un torneo' : 'Proponi un torneo'}
            </button>
          )}

          {!attivo && (
            <div className="text-xs rounded-lg px-3 py-2 mb-4" style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}>
              Il tuo account è bloccato: non puoi pubblicare tornei né annunci.
              Scrivi all'amministratore se pensi si tratti di un errore.
            </div>
          )}

          {attivo && !organizer && (
            <div className="text-xs rounded-lg px-3 py-2 mb-4" style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}>
              Il tuo primo torneo passa dalla revisione dell'admin. Una volta approvato
              diventi organizzatore e i successivi si pubblicano subito.
            </div>
          )}

          {mieiTornei.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
              Non hai ancora pubblicato tornei.
            </p>
          ) : (
            mieiTornei.map((t) => (
              <div key={t.id} className="rounded-xl border-2 p-4 mb-3" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <button type="button" onClick={() => onOpenDetail(t)} className="text-left min-w-0">
                    <h4 className="font-black text-base truncate" style={{ color: INK }}>{t.nome}</h4>
                    <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
                      {formatDataLunga(t.data)} · {t.comune} ({t.provincia})
                    </p>
                  </button>
                  <StatusBadge status={t.status} />
                </div>

                {t.status === STATUS_REJECTED && t.motivoRifiuto && (
                  <p className="text-xs mb-2 px-2 py-1.5 rounded" style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}>
                    Motivo: {t.motivoRifiuto}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEditTorneo(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ border: '1px solid rgba(34,48,31,0.25)', color: INK }}
                  >
                    <Pencil size={14} /> Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTorneo(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ border: `1px solid ${CLAY}`, color: CLAY }}
                  >
                    <Trash2 size={14} /> Elimina
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'annunci' && (
        mieiAnnunci.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
            Non hai ancora scritto annunci in bacheca.
          </p>
        ) : (
          mieiAnnunci.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border-2 p-4 mb-3"
              style={{
                backgroundColor: CARD_BG,
                borderColor: a.tipo === 'cerca_squadra' ? BOARD_A : BOARD_B,
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: a.tipo === 'cerca_squadra' ? BOARD_A : BOARD_B, color: '#fff' }}
                >
                  {a.tipo === 'cerca_squadra' ? 'Cerco squadra' : 'Cercasi giocatori'}
                </span>
                <span className="text-xs" style={{ color: INK, opacity: 0.5 }}>{timeAgo(a.data)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: INK }}>{a.testo}</p>
              <button
                type="button"
                onClick={() => onDeleteAnnuncio(a.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ border: `1px solid ${CLAY}`, color: CLAY }}
              >
                <Trash2 size={14} /> Elimina
              </button>
            </div>
          ))
        )
      )}

      {tab === 'messaggi' && (
        <MessagesPanel conversations={conversations} profile={profile} />
      )}

      {tab === 'impostazioni' && (
        <AccountSettings profile={profile} onDeleted={onDeleted} />
      )}
    </div>
  );
}