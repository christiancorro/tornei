import React, { useState, useMemo, useEffect } from 'react';

import './styles.css';
import { SAND, INK } from './theme';
import { nextViewMode } from './constants';
import { groupByMonth } from './utils';
import { canPostAnnuncio, canProposeTournament, canDeleteAnnuncio, isOrganizer } from './roles';

import { useAuth } from './hooks/useAuth';
import { useTournaments, usePendingTournaments, useMyTournaments } from './hooks/useTournaments';
import { useAnnunci, useMyAnnunci } from './hooks/useAnnunci';
import { useUsers } from './hooks/useUsers';
import { useConversations, useAllConversations } from './hooks/useMessages';
import { useFeedback } from './components/FeedbackProvider';

import Header from './components/Header';
import ResultsBar from './components/ResultsBar';
import TournamentList from './components/TournamentList';
import MapView from './components/MapView';
import CalendarView from './components/CalendarView';
import Bacheca from './components/Bacheca';
import Footer from './components/Footer';
import TournamentForm from './components/TournamentForm';
import TournamentDetail from './components/TournamentDetail';
import DeleteConfirm from './components/DeleteConfirm';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import AccountDashboard from './components/AccountDashboard';
import ReplyModal from './components/ReplyModal';

/* ---------------------------------------------------------
   App
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState('tornei');
  const [viewMode, setViewMode] = useState('lista');
  const [search, setSearch] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [formState, setFormState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [nuovoTesto, setNuovoTesto] = useState('');
  const [nuovoTipo, setNuovoTipo] = useState('cerca_squadra');
  const [selectedDurate, setSelectedDurate] = useState([]);

  const { toast } = useFeedback();
  const { user, profile, authReady, isAdmin, signInGoogle, signOut } = useAuth();
  const uid = profile?.uid ?? null;

  const {
    tournaments,
    loading: loadingTornei,
    error: erroreTornei,
    save: saveTournament,
    remove: removeTournament,
  } = useTournaments();

  const { annunci, publish: publishAnnuncio, remove: removeAnnuncio } = useAnnunci();

  /* Questi listener partono solo per chi ne ha diritto: passare
     un flag "enabled" evita una query che le regole rifiuterebbero. */
  const { pending, approve, reject } = usePendingTournaments(isAdmin);
  const { users, counts, changeRole, removeUser, footprint } = useUsers(isAdmin);
  const { mine: mieiTornei } = useMyTournaments(uid);
  const { mine: mieiAnnunci } = useMyAnnunci(uid);
  const { conversations, unreadTotal, reply, remove: removeMyConversation } =
    useConversations(uid);
  const { conversations: tutteConversazioni, remove: removeConversation } =
    useAllConversations(isAdmin);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments
      .filter((t) => {
        const matchesSearch = (() => {
          if (!q) return true;

          const mesi = [
            'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
            'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
          ];

          const date = [t.data, t.dataFine]
            .filter(Boolean)
            .map((d) => mesi[new Date(d).getMonth()]);

          const values = Object.values(t)
            .filter(Boolean)
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .map((value) => String(value).toLowerCase());

          return [...values, ...date].some((value) => value.includes(q));
        })();
        const matchesDisciplina = selectedDisciplines.length === 0 || selectedDisciplines.includes(t.disciplina);
        const matchesFormato = selectedFormats.length === 0 || t.formati.some((f) => selectedFormats.includes(f));
        const matchesFrom = !dateFrom || t.data >= dateFrom;
        const matchesTo = !dateTo || t.data <= dateTo;
        const durata = !t.dataFine || t.dataFine === t.data ? '1' : '2+';
        const matchesDurata = selectedDurate.length === 0 || selectedDurate.includes(durata);

        return matchesSearch && matchesDisciplina && matchesFormato && matchesFrom && matchesTo && matchesDurata;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [tournaments, search, selectedDisciplines, selectedFormats, selectedDurate, dateFrom, dateTo]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  /* Lista su cui scorre il dettaglio: quella che si aveva davanti
     quando si è aperta la scheda, non sempre i tornei pubblici. */
  const listaDettaglio = view === 'account' ? mieiTornei : filtered;
  const sortedAnnunci = useMemo(
    () => [...annunci].sort((a, b) => new Date(b.data) - new Date(a.data)),
    [annunci]
  );

  const extraFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const activeFilterCount = selectedDisciplines.length + selectedFormats.length + selectedDurate.length + extraFilterCount;

  /* Se l'admin mi declassa mentre sono su una vista riservata,
     torno ai tornei invece di restare su una pagina vuota. */
  useEffect(() => {
    if (view === 'admin' && authReady && !isAdmin) setView('tornei');
    if (view === 'account' && authReady && !profile) setView('tornei');
  }, [view, isAdmin, profile, authReady]);

  /* La lista sotto segue il dettaglio: a ogni torneo sfogliato di lato
     si porta sulla card corrispondente, senza animazione perché è
     coperta e nessuno la vede muoversi. Alla chiusura ci si ritrova
     già davanti l'ultimo torneo guardato.

     Funziona anche a scorrimento bloccato: `overflow: hidden` ferma il
     dito, non gli spostamenti fatti da codice. */
  useEffect(() => {
    if (!detailTarget) return;
    const card = document.getElementById(`torneo-${detailTarget.id}`);
    card?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [detailTarget]);

  /* Blocca lo scroll della pagina quando un modale è aperto.

     Il lock va su <html>, non su <body>: siccome in styles.css
     l'html ha già `overflow-y: scroll`, mettere `overflow: hidden`
     sul body non ferma davvero lo scroll e in più rende il body
     un contenitore di scorrimento. La barra dei filtri, che è
     `position: sticky`, si aggancia a quel contenitore e perde il
     "pin" al viewport: sparisce all'apertura del modale e torna
     di colpo alla chiusura. Su <html> la posizione di scorrimento
     resta quella di prima, quindi lo sticky non si muove. */
  useEffect(() => {
    const open = detailTarget || replyTarget || showAuth || formState;
    if (!open) return undefined;

    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    const prevOverscroll = root.style.overscrollBehavior;
    const prevPadding = root.style.paddingRight;

    /* Nascondere l'overflow toglie anche la scrollbar, e la pagina
       sotto si allarga di ~15px: header e filtri si spostano di
       colpo. `scrollbar-gutter: stable` (styles.css) lo evita da
       solo, ma non è supportato ovunque — Safari lo ha solo dalla
       18.2 — quindi qui misuro la larghezza prima e dopo il lock e
       compenso solo se serve davvero. Con il gutter attivo la
       differenza è zero e nessun padding viene aggiunto. */
    const larghezzaPrima = document.body.clientWidth;

    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';

    const scarto = document.body.clientWidth - larghezzaPrima;
    if (scarto > 0) root.style.paddingRight = `${scarto}px`;

    return () => {
      root.style.overflow = prevOverflow;
      root.style.overscrollBehavior = prevOverscroll;
      root.style.paddingRight = prevPadding;
    };
  }, [detailTarget, replyTarget, showAuth, formState]);

  function resetFilters() {
    setSearch('');
    setSelectedDisciplines([]);
    setSelectedFormats([]);
    setDateFrom('');
    setDateTo('');
    setSelectedDurate([]);
  }

  function handleCycleViewMode() {
    setViewMode((v) => nextViewMode(v));
  }

  /* Serve il login prima di qualsiasi azione che scrive. */
  function requireLogin(action) {
    if (!profile) { setShowAuth(true); return; }
    action();
  }

  async function handleSave(t) {
    try {
      await saveTournament(t, profile);
      setFormState(null);
      if (!isOrganizer(profile) && !t.id) {
        toast('Proposta inviata! Un amministratore la controllerà a breve.', 'success', 6000);
        setView('account');
      }
    } catch (err) {
      console.error('[salva torneo]', err);
      toast('Salvataggio non riuscito. Controlla i campi obbligatori.', 'error');
    }
  }

  async function handleDeleteConfirm() {
    try {
      await removeTournament(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      console.error('[elimina torneo]', err);
      toast('Eliminazione non riuscita.', 'error');
    }
  }

  async function handlePubblicaAnnuncio() {
    if (!nuovoTesto.trim()) return;
    try {
      await publishAnnuncio({ tipo: nuovoTipo, testo: nuovoTesto }, profile);
      setNuovoTesto('');
    } catch (err) {
      console.error('[pubblica annuncio]', err);
      toast(err.message || 'Pubblicazione non riuscita.', 'error');
    }
  }

  async function handleEliminaAnnuncio(id) {
    try {
      await removeAnnuncio(id);
    } catch (err) {
      console.error('[elimina annuncio]', err);
      toast('Eliminazione non riuscita.', 'error');
    }
  }

  async function handleReply(annuncio, testo) {
    await reply(annuncio, profile, testo);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: SAND }}>
      <Header
        view={view}
        setView={setView}
        setViewMode={setViewMode}
        onLogoClick={() => {
          setView('tornei');
          setViewMode('lista');
          resetFilters();
        }}
        isAdmin={isAdmin}
        profile={profile}
        authReady={authReady}
        unreadTotal={unreadTotal}
        pendingCount={pending.length}
        onLoginClick={() => setShowAuth(true)}
        onLogout={signOut}
        search={search}
        setSearch={setSearch}
        selectedDisciplines={selectedDisciplines}
        setSelectedDisciplines={setSelectedDisciplines}
        selectedFormats={selectedFormats}
        setSelectedFormats={setSelectedFormats}
        selectedDurate={selectedDurate}
        setSelectedDurate={setSelectedDurate}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        showMoreFilters={showMoreFilters}
        setShowMoreFilters={setShowMoreFilters}
        extraFilterCount={extraFilterCount}
        activeFilterCount={activeFilterCount}
        resetFilters={resetFilters}
      />

      {view === 'tornei' && (
        <ResultsBar
          viewMode={viewMode}
          onCycleViewMode={handleCycleViewMode}
          canAdd={canProposeTournament(profile) || !profile}
          isOrganizer={isOrganizer(profile)}
          onAdd={() => requireLogin(() => setFormState('new'))}
          count={filtered.length}
        />
      )}

      {view === 'tornei' && erroreTornei && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="text-sm font-semibold rounded-lg px-3 py-2" style={{ backgroundColor: '#FBE3DC', color: '#8C3520' }}>
            {erroreTornei}
          </div>
        </div>
      )}

      {view === 'tornei' && loadingTornei && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-sm" style={{ color: INK, opacity: 0.6 }}>
          Caricamento tornei...
        </div>
      )}

      {/* key={viewMode} rimonta il blocco a ogni cambio, così l'animazione riparte */}
      {view === 'tornei' && !loadingTornei && (
        <div key={viewMode} className="view-swap">
          {viewMode === 'lista' && (
            <TournamentList
              grouped={grouped}
              isAdmin={isAdmin}
              onEdit={(t) => setFormState(t)}
              onDeleteRequest={(t) => setDeleteTarget(t)}
              onOpenDetail={setDetailTarget}
              onResetFilters={resetFilters}
            />
          )}

          {false && viewMode === 'mappa' && <MapView tournaments={filtered} />}

          {viewMode === 'calendario' && (
            <CalendarView tournaments={filtered} onOpenDetail={setDetailTarget} />
          )}
        </div>
      )}

      {view === 'bacheca' && (
        <div className="view-swap">
          <Bacheca
            annunci={sortedAnnunci}
            nuovoTesto={nuovoTesto}
            setNuovoTesto={setNuovoTesto}
            nuovoTipo={nuovoTipo}
            setNuovoTipo={setNuovoTipo}
            onPubblica={handlePubblicaAnnuncio}
            onElimina={handleEliminaAnnuncio}
            onRispondi={(a) => requireLogin(() => setReplyTarget(a))}
            profile={profile}
            canPost={canPostAnnuncio(profile)}
            canDelete={(a) => canDeleteAnnuncio(profile, a)}
            onLoginClick={() => setShowAuth(true)}
          />
        </div>
      )}

      {view === 'account' && profile && (
        <div className="view-swap">
          <AccountDashboard
            profile={profile}
            mieiTornei={mieiTornei}
            mieiAnnunci={mieiAnnunci}
            conversations={conversations}
            unreadTotal={unreadTotal}
            onNuovoTorneo={() => setFormState('new')}
            onEditTorneo={(t) => setFormState(t)}
            onDeleteTorneo={(t) => setDeleteTarget(t)}
            onDeleteAnnuncio={handleEliminaAnnuncio}
            onDeleteConversation={removeMyConversation}
            onOpenDetail={setDetailTarget}
            onLogout={signOut}
            onDeleted={() => setView('tornei')}
          />
        </div>
      )}

      {view === 'admin' && isAdmin && (
        <div className="view-swap">
          <AdminDashboard
            pending={pending}
            users={users}
            counts={counts}
            myUid={uid}
            profile={profile}
            conversations={tutteConversazioni}
            annunci={sortedAnnunci}
            onApprove={(t) => approve(t, uid)}
            onReject={(t, motivo) => reject(t, uid, motivo)}
            onChangeRole={changeRole}
            onDeleteConversation={removeConversation}
            onDeleteAnnuncio={handleEliminaAnnuncio}
            onDeleteUser={removeUser}
            onUserFootprint={footprint}
          />
        </div>
      )}

      <Footer />

      {formState && (
        <TournamentForm
          initial={formState === 'new' ? null : formState}
          onSave={handleSave}
          onCancel={() => setFormState(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          tournament={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {detailTarget && (
        <TournamentDetail
          tournament={detailTarget}
          lista={listaDettaglio}
          onNavigate={setDetailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
      {replyTarget && (
        <ReplyModal
          annuncio={replyTarget}
          onSend={handleReply}
          onClose={() => setReplyTarget(null)}
        />
      )}
      {showAuth && (
        <AuthModal onGoogle={signInGoogle} onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}