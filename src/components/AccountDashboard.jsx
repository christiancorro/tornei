import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  StickyNote,
  MessageCircle,
  Pencil,
  Trash2,
  Plus,
  Clock,
  Check,
  Ban,
  Settings,
  LogOut,
  Info,
  ShieldCheck,
  Lightbulb,
  Send,
  ChevronDown,
  ChevronRight,
  Trophy,
} from 'lucide-react';

import { INK, SAND, SUN, GRASS_DARK, CLAY, CARD_BG, BOARD_A, BOARD_B, NOTE_WHITE, NOTE_YELLOW } from '../theme';
import {
  STATUS_PENDING,
  STATUS_PUBLISHED,
  STATUS_REJECTED,
  STATUS_LABELS,
  ROLE_LABELS,
  isOrganizer,
  isActive,
} from '../roles';
import { timeAgo } from '../utils';
import MessagesPanel from './MessagesPanel';
import AccountSettings from './AccountSettings';
import FeedbackPanel from './FeedbackPanel'
import TournamentCard from './TournamentCard';
import TrofeiPanel from './TrofeiPanel';
import { useFeedback } from './FeedbackProvider';
import { markRichiesteLetteDaUtente } from '../services/richieste';

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
      // shrink-0 + whitespace-nowrap: in una riga con overflow-x-auto
      // il default flex farebbe comprimere i bottoni fino a spezzare il
      // testo. Così mantengono la larghezza naturale e la riga scorre.
      className="px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shrink-0 whitespace-nowrap"
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
  onDeleteConversation,
  onOpenDetail,
  onLogout,
  onDeleted,
  onOpenBacheca,
  onSendFeedback,
  mieRichieste = [],
  pendingOpenConv,
  onConvOpened,
}) {
  const { confirm } = useFeedback();
  const [tab, setTab] = useState('tornei');
  // Conta le richieste con una risposta admin non ancora vista.
  // `lettoDaUtente` undefined (richieste vecchie, pre-feature) è
  // trattato come letto: nessun falso badge per dati legacy.
  const suggerimentiNonLetti = useMemo(
    () => mieRichieste.filter((r) => r.risposto === true && r.lettoDaUtente === false).length,
    [mieRichieste],
  );

  /* I miei tornei vanno mostrati dal più recente al più vecchio per
     data di inserimento. Il service li sottoscrive con
     `orderBy('data', 'asc')` (data del torneo, non di inserimento),
     quindi qui ricopio la lista e la riordino per createdAt desc.
     `createdAt` può arrivare come Timestamp Firestore (ha
     `toMillis`), come Date, come stringa ISO, o mancare del tutto
     su tornei legacy: `toMillis()` di seguito normalizza tutti i
     casi, e i legacy senza campo finiscono in coda (0). */
  const mieiTorneiOrdinati = useMemo(() => {
    const toMillis = (t) => {
      const raw = t.createdAt;
      if (!raw) return 0;
      if (typeof raw.toMillis === 'function') return raw.toMillis();
      const d = raw.toDate?.() ?? new Date(raw);
      const ms = d?.getTime?.();
      return Number.isFinite(ms) ? ms : 0;
    };
    return [...mieiTornei].sort((a, b) => toMillis(b) - toMillis(a));
  }, [mieiTornei]);

  /* Raggruppo i tornei ordinati per anno di inserimento, mantenendo
     l'ordine (più recente in cima grazie a `mieiTorneiOrdinati`).
     Uso una Map così le chiavi conservano l'ordine di prima
     apparizione — con Object.entries l'ordine di iterazione delle
     chiavi numeriche sarebbe deterministico ma crescente, mentre
     qui io voglio esplicitamente decrescente. I tornei senza
     `createdAt` (legacy) finiscono sotto la chiave "Senza data",
     che essendo aggiunta per ultima (perché già in coda a
     mieiTorneiOrdinati) compare in fondo. */
  const mieiTorneiPerAnno = useMemo(() => {
    const groups = new Map();
    mieiTorneiOrdinati.forEach((t) => {
      const raw = t.createdAt;
      let anno = 'Senza data';
      if (raw) {
        const d = raw.toDate?.() ?? new Date(raw);
        const y = d?.getFullYear?.();
        if (Number.isFinite(y)) anno = String(y);
      }
      if (!groups.has(anno)) groups.set(anno, []);
      groups.get(anno).push(t);
    });
    return Array.from(groups.entries()); // [ [anno, tornei[]], ... ]
  }, [mieiTorneiOrdinati]);

  /* Stato di collapse per anno: memorizzo SOLO gli anni collassati,
     così di default (Set vuoto) tutti gli anni sono aperti e non
     devo pre-popolare lo state al primo render con la lista degli
     anni disponibili. */
  const [anniCollassati, setAnniCollassati] = useState(() => new Set());
  const toggleAnno = (anno) => {
    setAnniCollassati((prev) => {
      const next = new Set(prev);
      if (next.has(anno)) next.delete(anno);
      else next.add(anno);
      return next;
    });
  };

  // Quando l'utente apre la tab Suggerimenti, marca tutte come lette.
  // useEffect dipendente da `tab`: scatta al cambio tab, non ad ogni
  // nuova risposta admin (quello lo lascio arrivare mentre lui è dentro
  // e sparirà il badge la prossima volta che rientra).
  useEffect(() => {
    if (tab !== 'suggerimenti') return;
    const daMarkare = mieRichieste
      .filter((r) => r.risposto === true && r.lettoDaUtente === false)
      .map((r) => r.id);
    if (daMarkare.length === 0) return;
    markRichiesteLetteDaUtente(daMarkare).catch((e) =>
      console.warn('[suggerimenti] mark letto fallito:', e),
    );
  }, [tab, mieRichieste]);

  const [messaggiResetSignal, setMessaggiResetSignal] = useState(0);

  function apriMessaggi() {
    if (tab === 'messaggi') {
      setMessaggiResetSignal((n) => n + 1);
    } else {
      setTab('messaggi');
    }
  }

  function handleOpenBacheca() {
    if (typeof onOpenBacheca === 'function') {
      onOpenBacheca();
      return;
    }

    window.location.hash = 'bacheca';
  }

  useEffect(() => {
    if (pendingOpenConv) setTab('messaggi');
  }, [pendingOpenConv]);

  const organizer = isOrganizer(profile);
  const attivo = isActive(profile);

  return (
    <div className="max-w-[65rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        {/* min-w-0 così il nome lungo va in ellipsi invece di spingere
      fuori i pulsanti a destra su mobile. */}
        <h2 className="font-black text-2xl min-w-0 truncate" style={{ color: INK }}>
          Ciao {profile?.displayName?.split(' ')[0] || ''}
        </h2>

        {/* I pulsanti a destra vivono in un sotto-flex con shrink-0:
      così il titolo può ridursi (min-w-0 + truncate) mentre Admin
      e Esci restano affiancati e mai spezzati su due righe. */}
        <div className="flex items-center gap-2 shrink-0">

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold mb-2"
            style={{ backgroundColor: INK, color: SAND }}
          >
            <LogOut size={16} />
            <span className="inline">Esci</span>
          </button>
        </div>
      </div>

      {/* <p className="text-sm mb-5" style={{ color: INK, opacity: 0.6 }}>
        Il tuo ruolo: <strong>{ROLE_LABELS[profile?.role] ?? '—'}</strong>
      </p> */}

      {/* Tab in flex-wrap come nell'AdminDashboard: quando non ci
          stanno tutti su una riga vanno a capo. Prima usavamo
          overflow-x-auto per farli scorrere in orizzontale, ma su
          mobile era faticoso capire che c'erano altri tab nascosti
          a destra; con il wrap li vedi tutti in colpo d'occhio. */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <Tab active={tab === 'tornei'} onClick={() => setTab('tornei')}>
          <CalendarDays size={16} /> Tornei pubblicati
        </Tab>

        <Tab active={tab === 'annunci'} onClick={() => setTab('annunci')}>
          <StickyNote size={16} /> Annunci pubblicati
        </Tab>

        <Tab active={tab === 'messaggi'} onClick={apriMessaggi} badge={unreadTotal}>
          <MessageCircle size={16} /> Messaggi
        </Tab>

        <Tab active={tab === 'trofei'} onClick={() => setTab('trofei')}>
          <Trophy size={16} /> Tornei giocati
        </Tab>

        <Tab active={tab === 'impostazioni'} onClick={() => setTab('impostazioni')}>
          <Settings size={16} /> Impostazioni
        </Tab>

        <Tab
          active={tab === 'suggerimenti'}
          onClick={() => setTab('suggerimenti')}
          badge={suggerimentiNonLetti}
        >
          <Lightbulb size={16} /> Suggerimenti
        </Tab>
      </div>

      <div key={`${tab}-${messaggiResetSignal}`} className="view-swap">
        {tab === 'tornei' && (
          <>
            {attivo && (
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={onNuovoTorneo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: SUN, color: INK }}
                >
                  <Plus size={18} /> {organizer ? 'Pubblica un torneo' : 'Proponi un torneo'}
                </button>
              </div>
            )}

            {!attivo && (
              <div
                className="text-sm rounded-lg px-3 py-2 mb-4"
                style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}
              >
                Il tuo account è bloccato: non puoi pubblicare tornei né annunci.
                Scrivi all&apos;amministratore se pensi si tratti di un errore.
              </div>
            )}

            {attivo && !organizer && (
              <div
                className="text-sm rounded-lg px-3 py-2 mb-4 flex items-start gap-2"
                style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}
              >
                <Info size={18} className="shrink-0 mt-0.5" />
                <span>
                  Il tuo primo torneo deve essere revisionato dall'amministratore per evitare l'intrusione di bot.
                  Una volta approvato diventerai organizzatore e i successivi tornei verranno pubblicati subito.
                </span>
              </div>
            )}

            {mieiTornei.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
                Non hai ancora pubblicato tornei.
              </p>
            ) : (
              /* Ogni "mio torneo" è racchiuso in un contenitore
                 leggermente rientrato con sfondo tenue, così barra
                 di gestione (StatusBadge, Modifica, Elimina) +
                 card (la stessa della lista pubblica) si leggono
                 come UN'unità. La barra sta SOPRA la card, separata
                 da un divisore tratteggiato: la testata dice "cosa
                 stai per fare / stato attuale", la card sotto è il
                 torneo a cui si riferisce. */
              mieiTorneiPerAnno.map(([anno, torneiAnno]) => {
                const chiuso = anniCollassati.has(anno);
                return (
                  <div key={anno} className="mb-6">
                    {/* Intestazione anno: pulsante full-width così è
                        chiaramente cliccabile su mobile. La freccia
                        cambia orientamento in base allo stato. Il
                        contatore ricorda quanti tornei ci sono in
                        quell'anno, utile quando la sezione è chiusa. */}
                    <button
                      type="button"
                      onClick={() => toggleAnno(anno)}
                      aria-expanded={!chiuso}
                      className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-xl text-2xl font-semibold"
                      style={{
                        backgroundColor: 'rgba(34,48,31,0.01)',
                        color: INK,
                        border: '1px solid rgba(34,48,31,0.1)',
                      }}
                    >
                      {chiuso ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <span>{anno}</span>
                      <span className="text-sm font-semibold" style={{ opacity: 0.6 }}>
                        ({torneiAnno.length})
                      </span>
                    </button>

                    {!chiuso && torneiAnno.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-2xl p-3 mb-8"
                        style={{
                          backgroundColor: '#fcfcf8',
                          border: '2px solid rgba(34,48,31,0.08)',
                        }}
                      >
                        <div
                          className="flex items-center gap-2 mb-3 pb-3 flex-wrap"
                          style={{ borderBottom: '1px dashed rgba(34,48,31,0.15)' }}
                        >
                          <StatusBadge status={t.status} />

                          {/* Data di inserimento: `createdAt` arriva come
                        Timestamp Firestore (ha `.toDate()`); gestisco
                        anche Date/stringa nel raro istante fra il
                        salvataggio locale e il round-trip col
                        serverTimestamp. Tornei legacy senza il campo
                        semplicemente non mostrano nulla. */}
                          {t.createdAt && (
                            <span
                              className="inline-flex items-center gap-1 text-sm"
                              style={{ color: INK, opacity: 0.6 }}
                            >
                              <CalendarDays size={12} />
                              Inserito il{' '}
                              {(t.createdAt.toDate?.() ?? new Date(t.createdAt))
                                .toLocaleDateString('it-IT', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                            </span>
                          )}

                          <div className="flex-1" />

                          <button
                            type="button"
                            onClick={() => onEditTorneo(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                            style={{
                              border: '1px solid rgba(34,48,31,0.25)',
                              color: INK,
                              backgroundColor: CARD_BG,
                            }}
                          >
                            <Pencil size={14} /> Modifica
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteTorneo(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                            style={{
                              border: `1px solid ${CLAY}`,
                              color: CLAY,
                              backgroundColor: CARD_BG,
                            }}
                          >
                            <Trash2 size={14} /> Elimina
                          </button>
                        </div>

                        <TournamentCard t={t} delay={0} onOpenDetail={onOpenDetail} />

                        {t.status === STATUS_REJECTED && t.motivoRifiuto && (
                          <p
                            className="text-xs mt-3 px-2 py-1.5 rounded"
                            style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}
                          >
                            Motivo: {t.motivoRifiuto}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'annunci' && (
          <>
            {attivo && (
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={handleOpenBacheca}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: SUN, color: INK }}
                >
                  <Plus size={18} /> Pubblica un annuncio
                </button>
              </div>
            )}

            {!attivo && (
              <div
                className="text-sm rounded-lg px-3 py-2 mb-4"
                style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}
              >
                Il tuo account è bloccato: non puoi pubblicare tornei né annunci.
                Scrivi all&apos;amministratore se pensi si tratti di un errore.
              </div>
            )}

            {mieiAnnunci.length === 0 ? (
              <p className="text-sm text-center py-12" style={{ color: INK, opacity: 0.6 }}>
                Non hai ancora scritto annunci in bacheca.
              </p>
            ) : (
              mieiAnnunci.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border-2 p-4 mb-3"
                  style={{
                    backgroundColor: a.tipo === 'cerca_squadra' ? NOTE_YELLOW : NOTE_WHITE,
                    borderColor: a.tipo === 'cerca_squadra' ? BOARD_A : BOARD_B,
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: a.tipo === 'cerca_squadra' ? BOARD_A : BOARD_B,
                        color: '#fff',
                      }}
                    >
                      {a.tipo === 'cerca_squadra' ? 'Cerco squadra' : 'Cercasi giocatori'}
                    </span>

                    <span className="text-xs" style={{ color: INK, opacity: 0.5 }}>
                      {timeAgo(a.data)}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: INK }}>
                    {a.testo}
                  </p>

                  {/* Elimina allineato a destra: wrap in un flex
                      con justify-end così sta sul lato destro
                      della card senza dover cambiare la larghezza
                      del pulsante. */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        // Conferma richiesta prima dell'eliminazione:
                        // uso `useFeedback().confirm` (dialog stilato
                        // dell'app, non il confirm() nativo). Con
                        // `onConfirm` async il dialog aspetta la
                        // delete e mostra spinner → check prima di
                        // chiudersi, così l'utente sa che è andata.
                        await confirm({
                          title: 'Eliminare questo annuncio?',
                          message:
                            'L\'annuncio verrà rimosso dalla bacheca. Non è recuperabile.',
                          confirmLabel: 'Elimina',
                          savingLabel: 'Eliminazione...',
                          savedLabel: 'Eliminato',
                          onConfirm: async () => {
                            await onDeleteAnnuncio(a.id);
                          },
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{ border: `1px solid ${CLAY}`, color: CLAY, background: CARD_BG }}
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'trofei' && (
          <TrofeiPanel uid={profile?.uid} onOpenDetail={onOpenDetail} />
        )}

        {tab === 'messaggi' && (
          <MessagesPanel
            conversations={conversations}
            profile={profile}
            onDeleteConversation={onDeleteConversation}
            pendingOpenConv={pendingOpenConv}
            onConvOpened={onConvOpened}
          />
        )}

        {tab === 'impostazioni' && (
          <AccountSettings profile={profile} onDeleted={onDeleted} />
        )}

        {tab === 'suggerimenti' && (
          <FeedbackPanel
            onSendFeedback={onSendFeedback}
            mieRichieste={mieRichieste}
            profile={profile}
          />
        )}
      </div>
    </div>
  );
}