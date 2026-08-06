import React, { useState, useMemo, useEffect } from 'react';

import './styles.css';
import { SAND } from './theme';
import { nextViewMode } from './constants';
import { INITIAL_TOURNAMENTS, INITIAL_ANNUNCI } from './data';
import { groupByMonth } from './utils';

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

/* ---------------------------------------------------------
   App
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState('tornei');
  const [viewMode, setViewMode] = useState('lista');
  const [tournaments, setTournaments] = useState(INITIAL_TOURNAMENTS);
  const [search, setSearch] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState([]);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [selectedProvinces, setSelectedProvinces] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formState, setFormState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [annunci, setAnnunci] = useState(INITIAL_ANNUNCI);
  const [nuovoTesto, setNuovoTesto] = useState('');
  const [nuovoTipo, setNuovoTipo] = useState('cerca_squadra');
  const [selectedDurate, setSelectedDurate] = useState([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments
      .filter((t) => {
        const matchesSearch =
          !q ||
          t.nome.toLowerCase().includes(q) ||
          t.comune.toLowerCase().includes(q) ||
          t.luogo.toLowerCase().includes(q) ||
          t.organizzatore.toLowerCase().includes(q);
        const matchesDisciplina = selectedDisciplines.length === 0 || selectedDisciplines.includes(t.disciplina);
        const matchesFormato = selectedFormats.length === 0 || t.formati.some((f) => selectedFormats.includes(f));
        const matchesProvincia = selectedProvinces.length === 0 || selectedProvinces.includes(t.provincia);
        const matchesFrom = !dateFrom || t.data >= dateFrom;
        const matchesTo = !dateTo || t.data <= dateTo;
        const durata =
          !t.dataFine || t.dataFine === t.data ? '1' : '2+';

        const matchesDurata =
          selectedDurate.length === 0 ||
          selectedDurate.includes(durata);
        return matchesSearch && matchesDisciplina && matchesFormato && matchesProvincia && matchesFrom && matchesTo && matchesDurata;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [tournaments, search, selectedDisciplines, selectedFormats, selectedProvinces, selectedDurate, dateFrom, dateTo]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const sortedAnnunci = useMemo(() => [...annunci].sort((a, b) => new Date(b.data) - new Date(a.data)), [annunci]);

  const extraFilterCount = selectedProvinces.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const activeFilterCount = selectedDisciplines.length + selectedFormats.length + selectedDurate.length + extraFilterCount;

  function resetFilters() {
    setSearch('');
    setSelectedDisciplines([]);
    setSelectedFormats([]);
    setSelectedProvinces([]);
    setDateFrom('');
    setDateTo('');
    setSelectedDurate([]);
  }

  function handleCycleViewMode() {
    setViewMode((v) => nextViewMode(v));
  }

  function handleSave(t) {
    setTournaments((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      return exists ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
    setFormState(null);
  }

  function handleDeleteConfirm() {
    setTournaments((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setDeleteTarget(null);
  }


  function handlePubblicaAnnuncio() {
    const testo = nuovoTesto.trim();
    if (!testo) return;

    setAnnunci((prev) => [
      {
        id: `a${Date.now()}`,
        tipo: nuovoTipo,
        testo,
        data: new Date().toISOString(),
        rotazione: (Math.random() * 8 - 4).toFixed(1),
      },
      ...prev,
    ]);

    setNuovoTesto('');
  }

  function handleEliminaAnnuncio(id) {
    setAnnunci((prev) => prev.filter((a) => a.id !== id));
  }

  useEffect(() => {
    document.body.style.overflow = detailTarget ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [detailTarget]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: SAND }}>
      <Header
        view={view}
        setView={setView}
        onLogoClick={() => {
          setView('tornei');
          resetFilters();
        }}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        search={search}
        setSearch={setSearch}
        selectedDisciplines={selectedDisciplines}
        setSelectedDisciplines={setSelectedDisciplines}
        selectedFormats={selectedFormats}
        setSelectedFormats={setSelectedFormats}
        selectedDurate={selectedDurate}
        setSelectedDurate={setSelectedDurate}
        selectedProvinces={selectedProvinces}
        setSelectedProvinces={setSelectedProvinces}
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
          isAdmin={isAdmin}
          onAdd={() => setFormState('new')}
          count={filtered.length}
        />
      )}

      {view === 'tornei' && viewMode === 'lista' && (
        <TournamentList
          grouped={grouped}
          isAdmin={isAdmin}
          onEdit={(t) => setFormState(t)}
          onDeleteRequest={(t) => setDeleteTarget(t)}
          onOpenDetail={setDetailTarget}
          onResetFilters={resetFilters}
        />
      )}

      {false && view === 'tornei' && viewMode === 'mappa' && (
        <MapView tournaments={filtered} />
      )}
      {view === 'tornei' && viewMode === 'calendario' && (
        <CalendarView
          tournaments={filtered}
          onOpenDetail={setDetailTarget}
        />
      )}

      {view === 'bacheca' && (
        <Bacheca
          annunci={sortedAnnunci}
          nuovoTesto={nuovoTesto}
          setNuovoTesto={setNuovoTesto}
          nuovoTipo={nuovoTipo}
          setNuovoTipo={setNuovoTipo}
          onPubblica={handlePubblicaAnnuncio}
          onElimina={handleEliminaAnnuncio}
          isAdmin={isAdmin}
        />
      )}

      <Footer />

      {formState && (
        <TournamentForm initial={formState === 'new' ? null : formState} onSave={handleSave} onCancel={() => setFormState(null)} />
      )}
      {deleteTarget && <DeleteConfirm tournament={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
      {detailTarget && <TournamentDetail tournament={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}