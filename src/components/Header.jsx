import React, { useState, useRef } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, ShieldCheck } from 'lucide-react';

import { INK, SAND, SUN } from '../theme';
import {
  DISCIPLINE,
  DISCIPLINE_COLORS,
  FORMATI,
  DURATE,
} from '../constants';
import { toggleValue } from '../utils';
import Chip from './ui/Chip';
import NavTab from './ui/NavTab';
import Avatar from './ui/Avatar';
import DateRangeSlider from './ui/DateRangeSlider';

export default function Header({
  view,
  setView,
  setViewMode,
  onLogoClick,
  isAdmin,
  profile,
  authReady,
  unreadTotal,
  pendingCount,
  richiesteAdminNonLette = 0,
  onLoginClick,
  onLogout,
  search,
  setSearch,
  selectedDisciplines,
  setSelectedDisciplines,
  selectedFormats,
  setSelectedFormats,
  selectedDurate,
  setSelectedDurate,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  rangeMinIso,
  rangeMaxIso,
  dateFromDefault,
  dateToDefault,
  dateTornei = [],
  oggi,
  showMoreFilters,
  setShowMoreFilters,
  extraFilterCount,
  activeFilterCount,
  resetFilters,
}) {
  const onAccount = view === 'account';

  const [moreHover, setMoreHover] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const rowRef = useRef(null);

  // Il focus su un campo dentro una riga scrollabile fa scorrere la riga
  // per "rivelarlo": preventScroll + reset tengono l'icona ferma a sinistra.
  function focusSearch() {
    searchRef.current?.focus({ preventScroll: true });
    if (rowRef.current) rowRef.current.scrollLeft = 0;
  }

  function toggleSearch() {
    if (searchOpen) {
      // Con del testo dentro il campo resta aperto: chiuderlo lo nasconderebbe.
      if (search) focusSearch();
      else setSearchOpen(false);
      return;
    }
    setSearchOpen(true);
    requestAnimationFrame(focusSearch);
  }

  return (
    <>
      {/* NAV + HEADER */}
      <div style={{ borderColor: 'rgba(34,48,31,0.12)' }}>
        <div className="max-w-[70rem] mx-auto px-4 sm:px-6 lg:px-9 py-2.5 ">
          {/* Mobile: il logo occupa solo lo spazio che gli serve e i tab
                si centrano in quello che resta, quindi scivolano a destra.
                Da sm in su torna la griglia a 3 colonne uguali. */}
          <div className="flex items-center justify-between gap-2 sm:grid sm:grid-cols-3">
            <div className="shrink-0">
              <button
                type="button"
                onClick={onLogoClick}
                className="font-display text-xl sm:text-4xl leading-none shrink-0 rounded"
                style={{ color: INK }}
              >
                volley<span style={{ color: SUN }}>FVG</span>
              </button>
            </div>

            {/* min-w-0 è la chiave: senza, un figlio flex non scende mai
                sotto la larghezza del suo contenuto e overflow-x-auto non
                ha niente da scrollare. Su mobile i tab partono da sinistra
                e scorrono; da sm in su tornano centrati. */}
            <div className="flex min-w-0 items-center justify-start sm:justify-center gap-0.5 sm:gap-3 overflow-x-auto no-scrollbar">
              <NavTab
                active={view === 'tornei'}
                onClick={() => {
                  if (view === 'tornei') {
                    setViewMode('lista');
                  }
                  setView('tornei');
                }}
              >
                Tornei
              </NavTab>

              <NavTab active={view === 'bacheca'} onClick={() => setView('bacheca')}>
                Bacheca
              </NavTab>

              {isAdmin && (
                /* Quando ci sono cose da controllare (pending o
                   richieste non lette) evidenzio il tab Admin con
                   un bordo dello stesso colore del badge (SUN), così
                   il richiamo visivo non si limita al pallino con il
                   numero: tutto il tab "si accende". Quando il conteggio
                   è zero il tab torna al comportamento standard. */
                <NavTab
                  active={view === 'admin'}
                  onClick={() => setView('admin')}
                  highlightColor={
                    (pendingCount + richiesteAdminNonLette) > 0 ? SUN : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={15} />
                    Admin
                    {(pendingCount + richiesteAdminNonLette) > 0 && (
                      <span
                        className="text-xs px-1.5 rounded-full font-black"
                        style={{ backgroundColor: SUN, color: INK }}
                      >
                        {pendingCount + richiesteAdminNonLette}
                      </span>
                    )}
                  </span>
                </NavTab>
              )}

            </div>

            {/* Un solo pulsante che assume due stati (loggato / non
                loggato) invece di due componenti diversi. Prima:
                "Accedi" e "Il mio profilo" avevano padding e icone di
                dimensioni differenti, così al momento del login il
                container cambiava larghezza e spostava lateralmente
                nav e logo su mobile — l'effetto "salto" al login.

                Adesso struttura identica in entrambi gli stati:
                • stesso padding;
                • stesso cerchio icona da 30px (via Avatar, che ha una
                  fallback CircleUserRound quando manca la foto).

                Il testo, se presente, ha larghezza naturale — nessun
                riservo di spazio dentro il pulsante, altrimenti
                "Accedi" avrebbe un vuoto imbarazzante alla sua destra.
                Va bene comunque perché:
                • su mobile il testo è `hidden sm:inline`, quindi
                  entrambi gli stati mostrano solo il cerchio da 30px:
                  il pulsante ha la stessa larghezza in "Accedi" e "Il
                  mio profilo" — nulla si sposta;
                • su desktop l'header è `sm:grid sm:grid-cols-3`, le
                  tre colonne sono di larghezza fissa (1/3 ciascuna).
                  Il pulsante account si allunga verso sinistra
                  restando ancorato al bordo destro della sua colonna,
                  ma nav e logo — che stanno nelle altre due colonne —
                  non si spostano.

                Al caricamento della foto, Avatar tiene già lo spazio
                riservato e ha un fondo neutro, quindi non si vede
                lampeggiare da vuoto a immagine. */}
            <div className="flex justify-end shrink-0">
              <button
                type="button"
                onClick={profile ? () => setView('account') : onLoginClick}
                disabled={!profile && !authReady}
                title={profile ? 'Il mio profilo' : 'Accedi con Google'}
                className={`
                  group flex items-center gap-2 cursor-pointer shrink-0
                  rounded-full border-2 border-transparent transition-all
                  py-1 pl-1 pr-1 sm:pl-4
                  ${profile && onAccount
                    ? 'bg-[#282828] text-[#fff8ef]'
                    : 'text-[#282828] hover:border-[#282828]'
                  }
                `}
                style={{ opacity: !profile && !authReady ? 0.5 : undefined }}
              >
                {/* L'opacità sta sul nome, non sul bottone: gli altri
                    tab sono solo testo, qui sotto c'è una foto e
                    schiarirla la farebbe sembrare non caricata. */}
                <span
                  className={`text-sm font-semibold hidden sm:inline truncate max-w-32 transition-opacity ${profile && onAccount ? '' : 'opacity-60 group-hover:opacity-100'}`}
                >
                  {profile ? 'Il mio profilo' : 'Accedi'}
                </span>

                {/* Cerchio icona identico nei due stati: Avatar con
                    src usa la foto, senza src disegna un
                    CircleUserRound nello stesso cerchio da 30px. */}
                <span className="relative shrink-0">
                  <Avatar
                    src={profile?.photoURL}
                    name={profile?.displayName}
                    size={30}
                  />
                  {profile && unreadTotal > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-black flex items-center justify-center border-2"
                      style={{ backgroundColor: SUN, color: INK, borderColor: onAccount ? INK : SAND }}
                    >
                      {unreadTotal > 9 ? '9+' : unreadTotal}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div >

      {view === 'tornei' && (
        <>
          {/* SEARCH + FILTERS */}
          <div className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.15)', }}>
            <div className="max-w-[69rem] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-3">
              <div ref={rowRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {/* Ricerca a scomparsa: da icona a campo, spingendo i filtri a destra */}
                <div
                  className="flex items-center h-9 rounded-full border-2 shrink-0 overflow-hidden transition-all duration-300"
                  style={{
                    borderColor: searchOpen || search ? INK : 'rgba(34,48,31,0.25)',
                    width: searchOpen || search ? '15rem' : '2.25rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={toggleSearch}
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{ color: INK }}
                    aria-label="Cerca"
                    aria-expanded={searchOpen}
                  >
                    <Search size={16} />
                  </button>
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => { if (!search) setSearchOpen(false); }}
                    placeholder="Cerca per nome, città, ..."
                    tabIndex={searchOpen ? 0 : -1}
                    className="flex-1 min-w-0 pr-2 bg-transparent outline-none text-sm font-medium"
                    style={{ color: INK }}
                  />
                  {/* La X è sempre nel DOM e tiene sempre il suo posto: così
                      compare e sparisce in dissolvenza senza spostare il testo. */}
                  <button
                    type="button"
                    /* Il mousedown toglierebbe il focus al campo e onBlur
                       richiuderebbe la barra prima ancora del click: lo
                       blocco e rimetto il cursore dentro dopo aver pulito. */
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearch('');
                      focusSearch();
                    }}
                    tabIndex={search ? 0 : -1}
                    aria-hidden={!search}
                    className="w-7 h-7 mr-1 flex items-center justify-center shrink-0 rounded-full hover:bg-black/5 transition-opacity duration-200"
                    style={{
                      color: INK,
                      opacity: search ? 0.55 : 0,
                      pointerEvents: search ? 'auto' : 'none',
                    }}
                    aria-label="Cancella la ricerca"
                    title="Cancella"
                  >
                    <X size={15} />
                  </button>
                </div>

                <span className="h-5 shrink-0 mr-1 ml-1 sm:mr-2 sm:ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />

                {DISCIPLINE.map((d) => (
                  <Chip
                    key={d}
                    active={selectedDisciplines.includes(d)}
                    onClick={() => setSelectedDisciplines((prev) => toggleValue(prev, d))}
                    color={DISCIPLINE_COLORS[d]}
                  >
                    {d}
                  </Chip>
                ))}
                <span className="h-5 shrink-0 mr-1 ml-1 sm:mr-2 sm:ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
                {FORMATI.map((f) => (
                  <Chip key={f} active={selectedFormats.includes(f)} onClick={() => setSelectedFormats((prev) => toggleValue(prev, f))}>
                    {f}
                  </Chip>
                ))}
                <span
                  className="h-5 shrink-0 mr-1 ml-1 sm:mr-2 sm:ml-2"
                  style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }}
                />

                {DURATE.map((d) => (
                  <Chip
                    key={d.value}
                    active={selectedDurate.includes(d.value)}
                    onClick={() => setSelectedDurate((prev) => toggleValue(prev, d.value))}
                  >
                    {d.label}
                  </Chip>
                ))}

                <span className="h-5 shrink-0 mr-1 ml-1 sm:mr-2 sm:ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
                <button
                  type="button"
                  onClick={() => setShowMoreFilters((v) => !v)}
                  onMouseEnter={() => setMoreHover(true)}
                  onMouseLeave={() => setMoreHover(false)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 whitespace-nowrap shrink-0 "
                  style={{
                    borderColor: showMoreFilters || moreHover ? INK : 'rgba(34,48,31,0.25)',
                    backgroundColor: showMoreFilters ? INK : 'transparent',
                    color: showMoreFilters ? '#FFFFFF' : INK,
                  }}
                >
                  <SlidersHorizontal size={13} />
                  Altri filtri
                  <ChevronDown size={13} style={{ transform: showMoreFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-semibold px-2 shrink-0 rounded shrink-0"
                    style={{ color: INK, opacity: 0.5 }}
                  >
                    <X size={13} /> Azzera
                  </button>
                )}
              </div>

              {showMoreFilters && (
                /* Il periodo: un solo slider a due maniglie al posto
                   dei due calendari "DAL / AL". Su un calendario si
                   sceglie una data alla volta e non si vede dove
                   cadono i tornei; qui l'intervallo è una cosa sola e
                   i puntini sulla pista dicono subito dove sono.

                   `dateFrom`/`dateTo` vuoti = slider mai toccato:
                   passo i valori di riposo (da oggi al torneo più
                   lontano) così le maniglie partono al posto giusto
                   senza che questo conti come filtro attivo. */
                <div className="border-2 rounded-3xl px-1 py-2 sm:px-3" style={{ borderColor: 'rgba(34,48,31,0.15)' }}>
                  <DateRangeSlider
                    minIso={rangeMinIso}
                    maxIso={rangeMaxIso}
                    fromIso={dateFrom || dateFromDefault}
                    toIso={dateTo || dateToDefault}
                    onChange={(da, a) => {
                      setDateFrom(da);
                      setDateTo(a);
                    }}
                    todayIso={oggi}
                    dates={dateTornei}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )
      }
    </>
  );
}