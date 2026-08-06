import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  CircleUserRound,
} from 'lucide-react';

import { INK, SAND, SUN, SABBIA_DARK, GRASS_DARK, SEA_DARK } from '../theme';
import {
  DISCIPLINE,
  FORMATI,
  DURATE,
  PROVINCE,
  PROVINCE_LABELS,
} from '../constants';
import { toggleValue } from '../utils';
import Chip from './ui/Chip';
import NavTab from './ui/NavTab';

export default function Header({
  view,
  setView,
  onLogoClick,
  isAdmin,
  setIsAdmin,
  search,
  setSearch,
  selectedDisciplines,
  setSelectedDisciplines,
  selectedFormats,
  setSelectedFormats,
  selectedDurate,
  setSelectedDurate,
  selectedProvinces,
  setSelectedProvinces,
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
  const [moreHover, setMoreHover] = useState(false);

  return (
    <>
      {/* NAV + HEADER */}
      <div style={{ borderColor: 'rgba(34,48,31,0.12)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-9 py-2.5">
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

            <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-3">
              <NavTab active={view === 'tornei'} onClick={() => setView('tornei')}>
                Tornei
              </NavTab>
              <NavTab active={view === 'bacheca'} onClick={() => setView('bacheca')}>
                Bacheca
              </NavTab>
            </div>

            <div className="flex justify-end shrink-0">
              <label
                className="flex items-center gap-2 cursor-pointer shrink-0"
                style={{ color: INK }}
              >
                <span className="text-sm font-semibold hidden sm:inline">
                  Login
                </span>

                <CircleUserRound size={22} />

                <button
                  type="button"
                  role="switch"
                  aria-checked={isAdmin}
                  onClick={() => setIsAdmin((v) => !v)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {view === 'tornei' && (
        <>
          {/* {isAdmin && (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-xs font-semibold rounded-lg px-3 py-2 mb-1" style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}>
                Modalità organizzatore attiva: puoi aggiungere, modificare ed eliminare i tornei.
              </div>
            </div>
          )} */}

          {/* SEARCH + FILTERS */}
          <div className="sticky top-0 z-20 shadow-xs" style={{ backgroundColor: SAND, borderColor: 'rgba(34,48,31,0.15)', }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3">
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  size={18}
                  style={{ color: INK, opacity: 0.45 }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca per nome, città, ..."
                  className="w-full pl-11 pr-4 py-2 rounded-full border-1 outline-none text-sm font-medium focus:ring-2"
                  style={{
                    borderColor: "#28282834",
                    color: INK,
                    backgroundColor: SAND,
                    '--tw-ring-color': SUN,
                  }}
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
                {DISCIPLINE.map((d) => (
                  <Chip
                    key={d}
                    active={selectedDisciplines.includes(d)}
                    onClick={() => setSelectedDisciplines((prev) => toggleValue(prev, d))}
                    color={d === 'Beach Volley' ? SABBIA_DARK : d === 'Green Volley' ? GRASS_DARK : SEA_DARK}
                  >
                    {d}
                  </Chip>
                ))}
                <span className="h-5 shrink-0 mr-2 ml-2" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
                {FORMATI.map((f) => (
                  <Chip key={f} active={selectedFormats.includes(f)} onClick={() => setSelectedFormats((prev) => toggleValue(prev, f))}>
                    {f}
                  </Chip>
                ))}
                <span
                  className="h-5 shrink-0 mr-2 ml-2"
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

                <span className="h-5 shrink-0 mr-1 ml-1" style={{ width: 2, backgroundColor: 'rgba(34,48,31,0.15)' }} />
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
                  {/* {extraFilterCount > 0 && <span>({extraFilterCount})</span>} */}
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
                    <div>
                      <div className="text-xs font-bold mb-2" style={{ color: INK, opacity: 0.6 }}>
                        PROVINCIA
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PROVINCE.map((p) => (
                          <Chip key={p} active={selectedProvinces.includes(p)} onClick={() => setSelectedProvinces((prev) => toggleValue(prev, p))}>
                            {PROVINCE_LABELS[p]}
                          </Chip>
                        ))}
                      </div>
                    </div>
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
      )}
    </>
  );
}