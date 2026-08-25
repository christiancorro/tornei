import React, { useState, useMemo, useEffect, useRef } from 'react';

import './styles.css';
import { SAND, INK } from './theme';
import { nextViewMode } from './constants';
import { groupByMonth, splitPassatoFuturo, todayISO } from './utils';
import { canPostAnnuncio, canProposeTournament, canDeleteAnnuncio, isOrganizer } from './roles';

import { useAuth } from './hooks/useAuth';
import { useTournaments, usePendingTournaments, useMyTournaments } from './hooks/useTournaments';
import { useLocandinePrefetch } from './hooks/useLocandinePrefetch';
import { useAnnunci, useMyAnnunci } from './hooks/useAnnunci';
import { useUsers } from './hooks/useUsers';
import { useConversations, useAllConversations } from './hooks/useMessages';
import { useRichieste, useMyRichieste } from './hooks/useRichieste';


import Header from './components/Header';
import Spinner from './components/ui/Spinner';
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
import { useFeedback } from './components/FeedbackProvider';
import { sendRichiesta } from './services/richieste';

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

  /* convId che vogliamo aprire in Account → Messaggi: settato dal
     redirect post-reply, azzerato dal MessagesPanel appena l'apre.
     Tenuto qui e non dentro il pannello perché il redirect parte da
     un'altra vista (Bacheca) e deve sopravvivere al cambio view. */
  const [pendingOpenConv, setPendingOpenConv] = useState(null);
  const [nuovoTesto, setNuovoTesto] = useState('');
  const [nuovoTipo, setNuovoTipo] = useState('cerca_squadra');
  const [selectedDurate, setSelectedDurate] = useState([]);

  const { toast } = useFeedback();
  const { user, profile, authReady, isAdmin, signInGoogle, signOut } = useAuth();
  const { richieste, markRead: handleMarkRichiestaRead, remove: handleDeleteRichiesta, } = useRichieste(isAdmin);
  const uid = profile?.uid ?? null;
  const { mine: mieRichieste } = useMyRichieste(profile?.uid);

  const {
    tournaments,
    loading: loadingTornei,
    error: erroreTornei,
    save: saveTournament,
    remove: removeTournament,
  } = useTournaments();

  /* Prefetch di tutte le locandine subito dopo il caricamento della
     lista, in background e a priorità bassa. Quando l'utente scrolla
     o apre il dettaglio, le immagini sono già in cache: niente
     skeleton, niente fade. */
  useLocandinePrefetch(tournaments);

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

  const suggerimentiNonLetti = useMemo(
    () => mieRichieste.filter((r) => r.risposto === true && r.lettoDaUtente === false).length,
    [mieRichieste],
  );

  const richiesteAdminNonLette = useMemo(
    () => (isAdmin ? richieste.filter((r) => !r.letto).length : 0),
    [isAdmin, richieste],
  );

  const notificheTotali = unreadTotal + suggerimentiNonLetti;

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

          const values = Object.entries(t)
            .filter(([key, value]) => key !== 'descrizioneOrganizzatore' && value)
            .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
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

  /* Splitto in "in programma" (oggi e futuro) e "passati" (ieri e
     indietro). La lista principale mostra solo i primi; i passati
     vivono in una sezione a scomparsa in fondo alla lista, per non
     ingombrare quando l'utente cerca qualcosa a cui iscriversi. */
  const oggi = useMemo(() => todayISO(), []);
  const { futuri, passati } = useMemo(
    () => splitPassatoFuturo(filtered, oggi),
    [filtered, oggi]
  );
  const grouped = useMemo(() => groupByMonth(futuri), [futuri]);
  /* I passati li ordino al contrario: mese più recente in alto,
     giorno più recente in alto dentro il mese. Chi apre "tornei
     precedenti" quasi sempre vuole vedere prima quelli appena finiti. */
  const gruppiPassati = useMemo(
    () => groupByMonth(passati, { descending: true }),
    [passati]
  );

  /* Lista su cui scorre il dettaglio: quella che si aveva davanti
     quando si è aperta la scheda, non sempre i tornei pubblici.
     Sui tornei pubblici uso solo i "futuri": lo swipe laterale nel
     dettaglio non sfoglia mai nel passato, così anche chi apre un
     torneo di oggi non si ritrova per sbaglio in quello di due
     settimane fa (che sta nascosto sotto "tornei precedenti").
     Una card passata aperta dalla sezione a scomparsa finisce fuori
     dalla lista di navigazione: indice = -1 → nessun precedente né
     prossimo, lo swipe fa il "rimbalzo" di useSwipeDown senza cambiare
     scheda, ed è il comportamento giusto per una scheda d'archivio. */
  const listaDettaglio = view === 'account' ? mieiTornei : futuri;
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

  /* Scroll automatico della lista disattivato: prima, ogni volta che
     si sfogliava di lato nel dettaglio, la pagina sotto si portava
     sulla card corrispondente. Ora la lista resta ferma dove l'utente
     l'aveva lasciata. */

  /* ---------------------------------------------------------
     Deep link della card detail: ?torneo=<id>
     - Se apro un torneo, l'URL si aggiorna (per condividerlo).
     - Se atterro su un URL con ?torneo=<id>, la card si apre da
       sola non appena i tornei sono caricati, e la lista sotto
       si porta centrata sulla card corrispondente.
     - Il tasto Indietro del browser chiude la card (grazie al
       popstate).

     Il tid da applicare al mount lo leggo qui, una volta sola,
     con lazy initializer di useState: se lo lasciassi leggere
     agli effect, quello di sync URL girerebbe prima con
     detailTarget=null e cancellerebbe il parametro dalla barra
     degli indirizzi prima ancora di poterlo applicare.
  --------------------------------------------------------- */
  const [tidDaAprire, setTidDaAprire] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('torneo');
  });

  // Aggiorna l'URL quando cambia detailTarget. Finché c'è un deep
  // link ancora da applicare (tidDaAprire), non tocca niente: il
  // parametro nella barra degli indirizzi deve restare lì per essere
  // consumato dall'effect sotto.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (tidDaAprire) return;
    const url = new URL(window.location.href);
    const attualeParam = url.searchParams.get('torneo');
    if (detailTarget) {
      if (attualeParam === detailTarget.id) return;
      url.searchParams.set('torneo', detailTarget.id);
      // pushState solo alla prima apertura (quando non c'era ancora
      // un torneo nell'URL): così il tasto Indietro chiude la card.
      // Sui cambi successivi (swipe da una card all'altra) uso
      // replaceState, così la cronologia non si riempie.
      if (attualeParam) {
        window.history.replaceState({ torneo: detailTarget.id }, '', url);
      } else {
        window.history.pushState({ torneo: detailTarget.id }, '', url);
      }
    } else if (attualeParam) {
      url.searchParams.delete('torneo');
      const nuovoUrl = url.pathname + (url.search || '') + url.hash;
      window.history.replaceState(null, '', nuovoUrl);
    }
  }, [detailTarget, tidDaAprire]);

  // Applica il deep link appena i tornei sono in memoria. Se il torneo
  // non esiste più, il parametro verrà pulito dall'effect sopra al
  // prossimo giro (tidDaAprire torna a null, detailTarget resta null).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loadingTornei || !tidDaAprire) return;
    const trovato = tournaments.find((t) => t.id === tidDaAprire);
    if (trovato) {
      setDetailTarget(trovato);
      /* Scroll alla card corrispondente in lista. Due RAF: uno perché
         React renderizzi la lista, l'altro per essere sicuri che
         l'elemento sia a layout finale. Se la card non esiste nel DOM
         (torneo filtrato via, vista non-lista) è un no-op silenzioso. */
      const tid = tidDaAprire;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const card = document.getElementById(`torneo-${tid}`);
          card?.scrollIntoView({ block: 'center', behavior: 'auto' });
        });
      });
    }
    setTidDaAprire(null); // consumato: da qui in poi l'URL riflette detailTarget
  }, [loadingTornei, tournaments, tidDaAprire]);

  // Tasto Indietro del browser: sincronizza la card con l'URL corrente.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onPop() {
      const params = new URLSearchParams(window.location.search);
      const tid = params.get('torneo');
      if (!tid) {
        setDetailTarget(null);
        return;
      }
      const trovato = tournaments.find((t) => t.id === tid);
      setDetailTarget(trovato || null);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tournaments]);

  /* MapView è pesante da inizializzare: Mapbox GL crea il canvas,
     registra le icone dei pin, scarica lo stile e aggiunge i layer,
     tutto sincrono al mount. Prima la montavamo insieme al resto
     della vista tornei ("warmup in background"), ma quel lavoro
     cadeva nei frame subito dopo il click sul tab Tornei e si
     sentiva come lag.

     Ora la mappa viene PRECARICATA appena si accede al sito (ma non
     durante il primo paint, vedi sotto) e da quel momento in poi
     resta viva per tutta la sessione. Il wrapper è renderizzato al
     top-level dell'App (fuori dal blocco `view === 'tornei'`) e
     nascosto con visibility:hidden quando non serve, così cambiare
     vista non lo smonta e aprire la mappa è istantaneo. */
  const [mapMounted, setMapMounted] = useState(false);

  /* Precarico la mappa appena si accede al sito, ma SENZA introdurre
     lag. Mapbox GL è pesante e sincrono al mount (canvas, stile, layer),
     quindi il warmup deve cadere solo quando il main thread è davvero
     libero. Due accorgimenti:
       1. aspetto che i tornei abbiano finito di caricare, così la mappa
          non compete col primo render della lista;
       2. uso requestIdleCallback SENZA `timeout`: la mappa si scalda
          solo in un vero momento di idle, mai forzata dentro un frame
          occupato (è il `timeout` che, scadendo, causerebbe il jank).
     Se l'utente apre la mappa prima che l'idle l'abbia scaldata, ci
     pensa la rete di sicurezza qui sotto. Una volta montata non viene
     più smontata (mapMounted resta true per tutta la sessione). */
  useEffect(() => {
    if (mapMounted || loadingTornei || typeof window === 'undefined') {
      return undefined;
    }
    const warmup = () => setMapMounted(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warmup);
      return () => window.cancelIdleCallback(id);
    }
    // Safari non ha requestIdleCallback: un timeout dopo il primo paint
    // stabile è il miglior proxy di "thread libero" disponibile.
    const id = window.setTimeout(warmup, 1500);
    return () => window.clearTimeout(id);
  }, [mapMounted, loadingTornei]);

  /* Rete di sicurezza: se l'utente apre la mappa prima che l'idle
     l'abbia già scaldata, la montiamo comunque subito. */
  useEffect(() => {
    if (view === 'tornei' && viewMode === 'mappa' && !mapMounted) {
      setMapMounted(true);
    }
  }, [view, viewMode, mapMounted]);
  const mappaVisibile = view === 'tornei' && viewMode === 'mappa';

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

  /* La chiusura del form (setFormState(null)) la fa il form stesso
     dopo l'animazione "Salvato!" — qui restituiamo solo il risultato
     del salvataggio, rilanciando l'errore così il form può tornare
     in stato "idle" se qualcosa va male.

     Al termine di un CREATE cambiamo anche vista, così l'utente
     atterra dove può vedere l'esito:
     • organizzatore → lista tornei (il suo torneo è già pubblicato e
       comparirà tra gli altri quando l'onSnapshot lo restituirà);
     • utente comune → account, dov'è la sezione "I miei tornei" con
       la card in stato "in attesa".
     Il cambio parte durante lo stato 'saved' del pulsante: il modale
     copre ancora la nuova vista, così il feedback resta visibile fino
     alla chiusura, e appena il modale sparisce la lista è già lì. */
  async function handleSave(t) {
    const isNew = !t.id;
    try {
      await saveTournament(t, profile);
      if (isNew) {
        if (isOrganizer(profile)) {
          setView('tornei');
        } else {
          toast('Proposta inviata! Un amministratore la controllerà a breve.', 'success', 6000);
          setView('account');
        }
      }
    } catch (err) {
      console.error('[salva torneo]', err);
      toast('Salvataggio non riuscito. Controlla i campi obbligatori.', 'error');
      throw err;
    }
  }

  /* La chiusura del modale la fa DeleteConfirm dopo l'animazione
     "Eliminato" (via useActionState). Qui ci limitiamo a rilanciare
     l'errore così il pulsante può tornare in idle e l'utente ritentare. */
  async function handleDeleteConfirm() {
    try {
      await removeTournament(deleteTarget);
    } catch (err) {
      console.error('[elimina torneo]', err);
      toast('Eliminazione non riuscita.', 'error');
      throw err;
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

  async function handleSendFeedback({ testo }) {
    try {
      await sendRichiesta({ testo }, profile);
      toast('Grazie! Il tuo messaggio è stato inviato.', 'success', 5000);
    } catch (err) {
      toast(err.message || 'Invio non riuscito.', 'error');
      throw err;
    }
  }

  /* Restituisce il convId così ReplyModal (via useActionState.onDone)
     può passarlo a openConversazione e portarci sul thread appena
     creato. */
  async function handleReply(annuncio, testo) {
    return reply(annuncio, profile, testo);
  }



  function openConversazione(convId) {
    setPendingOpenConv(convId);
    setView('account');
    // Il MessagesPanel, appena vede pendingOpenConv non-null, apre il
    // thread e chiama onConvOpened → setPendingOpenConv(null). Serve
    // per non riscattarlo se l'utente naviga altrove e torna.
  }

  /* Ponte "Vai in Bacheca con il compositore già aperto": scattato
     dal pulsante "Pubblica un annuncio" in Account → I miei annunci.
     Bacheca vede `pendingOpenCompositore` a true al mount, apre il
     compositore e mette il focus sulla textarea; poi chiama
     onCompositoreOpened → setPendingOpenCompositore(false), così
     tornando in Bacheca dopo non riapre da solo. */
  const [pendingOpenCompositore, setPendingOpenCompositore] = useState(false);
  function apriBachecaConCompositore() {
    setPendingOpenCompositore(true);
    setView('bacheca');
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
        pendingCount={pending.length}
        richiesteAdminNonLette={richiesteAdminNonLette}
        profile={profile}
        authReady={authReady}
        unreadTotal={notificheTotali}
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
          loading={loadingTornei}
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
        <div
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex justify-center"
          style={{ color: INK, opacity: 0.6 }}
        >
          <Spinner size={26} thickness={2.5} label="Caricamento tornei" />
        </div>
      )}

      {/* La LISTA vive dentro il blocco `view === 'tornei'` come
         prima: monta/smonta col cambio vista, è leggera. La MAPPA
         invece è renderizzata più sotto al top-level dell'App: una
         volta montata ci resta, e il cambio vista la nasconde solo
         via CSS. Vedi il blocco `{mapMounted && …}` più giù.

         La lista si rimonta col key={viewMode} così la sua
         animazione di ingresso riparte ad ogni toggle. */}
      {view === 'tornei' && !loadingTornei && viewMode === 'lista' && (
        <div key="lista" className="view-swap">
          <TournamentList
            grouped={grouped}
            gruppiPassati={gruppiPassati}
            isAdmin={isAdmin}
            onEdit={(t) => setFormState(t)}
            onDeleteRequest={(t) => setDeleteTarget(t)}
            onOpenDetail={setDetailTarget}
            onResetFilters={resetFilters}
          />
        </div>
      )}

      {/* Calendario nascosto per ora — il toggle ciclo lista ⇄ mappa
         non ci passa. Lascio il blocco commentato così riattivarlo
         è di nuovo una riga. */}
      {/* {view === 'tornei' && !loadingTornei && viewMode === 'calendario' && (
        <CalendarView tournaments={filtered} onOpenDetail={setDetailTarget} />
      )} */}

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
            pendingOpenCompositore={pendingOpenCompositore}
            onCompositoreOpened={() => setPendingOpenCompositore(false)}
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

            mieRichieste={mieRichieste}
            onSendFeedback={handleSendFeedback}
            mieRichieste={mieRichieste}

            onNuovoTorneo={() => setFormState('new')}
            onEditTorneo={(t) => setFormState(t)}
            onDeleteTorneo={(t) => setDeleteTarget(t)}
            onDeleteAnnuncio={handleEliminaAnnuncio}
            onDeleteConversation={removeMyConversation}
            onOpenDetail={setDetailTarget}
            onLogout={signOut}
            onOpenAdmin={() => setView('admin')}
            onOpenBacheca={apriBachecaConCompositore}
            onDeleted={() => setView('tornei')}
            pendingOpenConv={pendingOpenConv}
            onConvOpened={() => setPendingOpenConv(null)}
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
            richieste={richieste}
            onMarkRichiestaRead={handleMarkRichiestaRead}
            onDeleteRichiesta={handleDeleteRichiesta}
          />
        </div>
      )}

      {/* Wrapper della MAPPA al top-level dell'App: una volta montata
         resta viva anche quando l'utente va su Bacheca/Account/Admin,
         così riaprire Tornei→Mappa è istantaneo (nessun re-init di
         Mapbox GL). Quando non è visibile, esce dal flow con
         position:absolute + visibility:hidden — il container mantiene
         dimensioni reali (necessarie a Mapbox: con display:none o 0x0
         il resize non funziona bene) ma è invisibile e non riceve
         click. La rendiamo solo dopo il primo ingresso in mappa
         (mapMounted === true), altrimenti non occuperebbe nulla ma
         inutilmente aggiungerebbe DOM. */}
      {mapMounted && (
        <div
          className={mappaVisibile ? 'view-swap' : ''}
          style={
            mappaVisibile
              ? undefined
              : {
                position: 'absolute',
                inset: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
              }
          }
          aria-hidden={!mappaVisibile}
        >
          <MapView
            tournaments={filtered}
            onOpenDetail={setDetailTarget}
            active={mappaVisibile}
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
          uid={uid}
          isAdmin={isAdmin}
          onEdit={(t) => setFormState(t)}
          onDeleteRequest={(t) => setDeleteTarget(t)}
        />
      )}
      {replyTarget && (
        <ReplyModal
          annuncio={replyTarget}
          onSend={handleReply}
          onOpenConversazione={openConversazione}
          onClose={() => setReplyTarget(null)}
        />
      )}
      {showAuth && (
        <AuthModal onGoogle={signInGoogle} onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}