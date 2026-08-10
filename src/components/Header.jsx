import React, { useState, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  CircleUserRound,
  ShieldCheck,
} from 'lucide-react';

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
        <div className="max-w-[70rem] mx-auto px-4 sm:px-6 lg:px-9 py-2.5">
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
                tornei<span style={{ color: SUN }}>FVG</span>
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
                <NavTab active={view === 'admin'} onClick={() => setView('admin')}>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={15} />
                    Admin
                    {pendingCount > 0 && (
                      <span
                        className="text-xs px-1.5 rounded-full font-black"
                        style={{ backgroundColor: SUN, color: INK }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </span>
                </NavTab>
              )}
            </div>

            <div className="flex justify-end shrink-0">
              {profile ? (
                <button
                  type="button"
                  onClick={() => setView('account')}
                  title="Il mio profilo"
                  className={`
                    group flex items-center gap-2 cursor-pointer shrink-0
                    rounded-full border-2 border-transparent transition-all
                    py-1 pl-1 pr-1 sm:pl-4
                    ${onAccount
                      ? 'bg-[#282828] text-[#fff8ef]'
                      : 'text-[#282828] hover:border-[#282828]'
                    }
                  `}
                >
                  {/* L'opacità sta sul nome, non sul bottone: gli altri tab
                      sono solo testo, qui sotto c'è una foto e schiarirla la
                      farebbe sembrare non caricata. */}
                  <span
                    className={`text-sm font-semibold hidden sm:inline max-w-32 truncate transition-opacity ${onAccount ? '' : 'opacity-60 group-hover:opacity-100'
                      }`}
                  >
                    {/* {profile.displayName || 'Profilo'} */}
                    Il mio profilo
                  </span>

                  {/* Solo questo bottone diventa scuro quando sei nell'area
                      personale: è lui a fare da tab, non l'header intero. */}
                  <span className="relative shrink-0">
                    <Avatar
                      src={profile.photoURL}
                      name={profile.displayName}
                      size={30}
                    />
                    {unreadTotal > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-black flex items-center justify-center border-2"
                        style={{ backgroundColor: SUN, color: INK, borderColor: onAccount ? INK : SAND }}
                      >
                        {unreadTotal > 9 ? '9+' : unreadTotal}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLoginClick}
                  disabled={!authReady}
                  title="Accedi con Google"
                  className="flex items-center gap-2 cursor-pointer shrink-0
                    rounded-full border-2 border-transparent transition-all
                    px-4 py-1.5 text-[#282828] opacity-60
                    hover:opacity-100 hover:border-[#282828]"
                  style={{ opacity: authReady ? undefined : 0.5 }}
                >
                  <span className="text-sm font-semibold hidden sm:inline">
                    Accedi
                  </span>
                  <CircleUserRound size={22} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div >

      {view === 'tornei' && (
        <>
          {/* SEARCH + FILTERS */}
          <div className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.15)', }}>
            <div className="max-w-[69rem] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
              <div ref={rowRef} className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
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
                <div className="border-2 rounded-xl p-4" style={{ borderColor: 'rgba(34,48,31,0.15)' }}>
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <div className="text-xs font-bold mb-2" style={{ color: INK, opacity: 0.6 }}>
                          DAL
                        </div>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-36 px-2.5 py-2 rounded-lg border-2 text-sm "
                          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold mb-2" style={{ color: INK, opacity: 0.6 }}>
                          AL
                        </div>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-36 px-2.5 py-2 rounded-lg border-2 text-sm "
                          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
                        />
                      </div>
                    </div>
                  </div>
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