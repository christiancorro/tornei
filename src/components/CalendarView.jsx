import React, { useState } from 'react';
import { INK } from '../theme';
import { STUB_STYLE } from '../constants';

export default function CalendarView({
  tournaments = [],
  onOpenDetail,
}) {
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const parseDate = (value) => {
    if (!value) return null;

    if (value.includes('/')) {
      const [day, month, year] = value.split('/');

      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
    }

    return new Date(value);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDay = new Date(year, month, 1).getDay();

  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const days = Array.from(
    { length: offset + daysInMonth },
    (_, index) =>
      index < offset ? null : index - offset + 1
  );


  const changeMonth = (value) => {
    const date = new Date(year, month + value, 1);

    setMonth(date.getMonth());
    setYear(date.getFullYear());
  };


  const isTournamentActive = (day, tournament) => {
    if (!day) return false;

    const current = new Date(year, month, day);

    const start = parseDate(tournament.data);

    const end = parseDate(
      tournament.dataFine || tournament.data
    );

    if (!start || !end) return false;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return current >= start && current <= end;
  };


  return (
    <div className="max-w-5xl mx-auto sm:px-4 lg:px-4">

      <div
        className="rounded-2xl p-4"
        style={{ color: INK }}
      >

        <div className="flex justify-between items-center mb-5">

          <button
            onClick={() => changeMonth(-1)}
            className="px-3 py-1 rounded-full"
          >
            ←
          </button>


          <h2 className="font-semibold text-2xl capitalize">
            {new Date(year, month).toLocaleDateString(
              'it-IT',
              {
                month: 'long',
                year: 'numeric',
              }
            )}
          </h2>


          <button
            onClick={() => changeMonth(1)}
            className="px-3 py-1 rounded-full"
          >
            →
          </button>

        </div>


        <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-center opacity-60">
          {[
            'Lun',
            'Mar',
            'Mer',
            'Gio',
            'Ven',
            'Sab',
            'Dom',
          ].map((day) => (
            <div key={day}>
              {day}
            </div>
          ))}
        </div>


        <div className="grid grid-cols-7 gap-1">

          {days.map((day, index) => {

            const events = tournaments.filter((tournament) =>
              isTournamentActive(day, tournament)
            );


            return (
              <div
                key={index}
                className="min-h-25 rounded-xl border p-2"
                style={{
                  borderColor:
                    'rgba(34,48,31,0.3)',
                }}
              >

                {day && (
                  <>
                    <div className="text-xs font-regular mb-1">
                      {day}
                    </div>


                    <div className="space-y-1">

                      {events.map((tournament) => {

                        const style =
                          STUB_STYLE[tournament.disciplina] ||
                          STUB_STYLE['Green Volley'];


                        return (
                          <div
                            key={tournament.id}
                            className="rounded-md px-1.5 py-1 text-[7px] line-clamp-4 sm:text-xs font-semibold leading-tight break-words cursor-pointer transition-transform"
                            style={{
                              backgroundColor:
                                tournament.disciplina === 'Beach Volley'
                                  ? '#ffefbb'
                                  : style.tagBg,
                              color:
                                tournament.disciplina === 'Beach Volley'
                                  ? '#a47621'
                                  : style.tagText,
                              minHeight: '25px',
                              maxHeight: '40px',
                            }}
                            title={tournament.nome}
                            onClick={() =>
                              onOpenDetail(tournament)
                            }
                          >
                            {tournament.nome}
                          </div>
                        );

                      })}

                    </div>
                  </>
                )}

              </div>
            );

          })}

        </div>

      </div>

    </div>
  );
}