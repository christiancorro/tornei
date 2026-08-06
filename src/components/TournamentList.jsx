import React from 'react';
import MonthHeader from './ui/MonthHeader';
import TournamentCard from './TournamentCard';
import EmptyState from './EmptyState';

/* ---------------------------------------------------------
   RESULTS — the month-grouped list of tournament cards.
--------------------------------------------------------- */
export default function TournamentList({
  grouped,
  isAdmin,
  onEdit,
  onDeleteRequest,
  onOpenDetail,
  onResetFilters,
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 py-2 sm:py-2">
      {grouped.length === 0 ? (
        <EmptyState onReset={onResetFilters} />
      ) : (
        grouped.map((group) => (
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
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}