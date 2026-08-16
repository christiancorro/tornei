import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import MonthHeader from './ui/MonthHeader';
import TournamentCard from './TournamentCard';
import EmptyState from './EmptyState';
import { INK } from '../theme';

/* ---------------------------------------------------------
   RESULTS — la lista dei tornei, raggruppata per mese.

   I "tornei in programma" (oggi + futuro) stanno sopra come
   prima. I "tornei precedenti" (giorni passati) stanno in
   una sezione a scomparsa in fondo, aperta da un pulsante.
   Motivo: chi apre l'app di solito cerca qualcosa a cui
   iscriversi — i tornei di ieri sono rumore, ma buttarli via
   sarebbe eccessivo (a volte servono per rivederli / rifarli
   / condividerne il ricordo).

   Il taglio è per data, non per mese: il 13 agosto vedi
   ancora tutti i tornei di agosto dal 13 in poi, i tornei
   del 12 sono nella sezione "precedenti".
--------------------------------------------------------- */
export default function TournamentList({
  grouped,
  gruppiPassati = [],
  isAdmin,
  onEdit,
  onDeleteRequest,
  onOpenDetail,
  onResetFilters,
}) {
  const [mostraPassati, setMostraPassati] = useState(false);
  const totalePassati = gruppiPassati.reduce((sum, g) => sum + g.items.length, 0);

  /* Vuoto per davvero: né futuri né passati. Solo in questo caso
     l'EmptyState (con "azzera filtri") ha senso. Se ci sono passati
     ma non futuri, mostro un messaggio più tenue in cima con il
     pulsante subito sotto. */
  if (grouped.length === 0 && totalePassati === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 py-2 sm:py-2">
        <EmptyState onReset={onResetFilters} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 py-2 sm:py-2">
      {grouped.length === 0 && (
        /* Ci sono solo tornei passati che matchano i filtri. Non uso
           EmptyState qui perché quello grida "nessun torneo trovato"
           e proporrebbe di azzerare i filtri — qui invece un torneo
           c'è, sta solo nel passato: il pulsante sotto lo mostra. */
        <div className="text-center py-10 px-4">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-base" style={{ color: INK, opacity: 0.7 }}>
            Nessun torneo in programma.
          </p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.key} className="mb-10">
          <MonthHeader label={group.label} />
          <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4">
            {group.items.map((t, i) => (
              <TournamentCard
                key={t.id}
                t={t}
                delay={i * 60}
                isAdmin={isAdmin}
                onEdit={() => onEdit(t)}
                onDeleteRequest={() => onDeleteRequest(t)}
                onOpenDetail={onOpenDetail}
                /* Le prime del primo gruppo sono sopra la piega: forzarle
                   "eager" fa partire il download subito invece di aspettare
                   che il lazy-loading del browser le scopra visibili. */
                eagerImage={i < 3}
              />
            ))}
          </div>
        </div>
      ))}

      {totalePassati > 0 && (
        <div className="mt-6 mb-10">
          {/* Pulsante ghost coerente con gli altri dell'app (Accedi,
             selettore vista, Condividi): bordo trasparente + opacità
             al 60% a riposo, bordo pieno e opacità 100% al hover. */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMostraPassati((v) => !v)}
              aria-expanded={mostraPassati}
              className="inline-flex items-center gap-1.5 cursor-pointer shrink-0
                rounded-full border-2 border-transparent transition-all
                px-4 py-2 text-sm sm:text-base font-semibold whitespace-nowrap
                opacity-60 hover:opacity-100 hover:border-[#282828]"
              style={{ color: INK }}
            >
              <History size={17} />
              {mostraPassati
                ? 'Nascondi tornei precedenti'
                : `Mostra tornei precedenti (${totalePassati})`}
              {mostraPassati ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {mostraPassati && (
            <div className="mt-8">
              {gruppiPassati.map((group) => (
                <div key={group.key} className="mb-10">
                  <MonthHeader label={group.label} />
                  {/* Un filo di opacità per dire visivamente "questi sono
                     archivio, non azione" — resta comunque leggibile. */}
                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4" style={{ opacity: 0.75 }}>
                    {group.items.map((t, i) => (
                      <TournamentCard
                        key={t.id}
                        t={t}
                        delay={i * 40}
                        isAdmin={isAdmin}
                        onEdit={() => onEdit(t)}
                        onDeleteRequest={() => onDeleteRequest(t)}
                        onOpenDetail={onOpenDetail}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}