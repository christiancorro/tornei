import React, { useRef, useState } from 'react';
import { INK } from '../theme';
import { STUB_STYLE } from '../constants';

export default function CalendarView({
  tournaments = [],
  onOpenDetail,
}) {
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [direction, setDirection] = useState(0);
  const [animating, setAnimating] = useState(false);

  const touchStartX = useRef(null);

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
    { length: daysInMonth },
    (_, index) => index + 1
  );

  const changeMonth = (value) => {
    if (animating) return;

    setDirection(value);
    setAnimating(true);

    const date = new Date(year, month + value, 1);

    setMonth(date.getMonth());
    setYear(date.getFullYear());
  };

  const handleAnimationEnd = () => {
    setAnimating(false);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    const threshold = 40;

    if (Math.abs(diff) >= threshold) {
      if (diff > 0) {
        changeMonth(1);
      } else {
        changeMonth(-1);
      }
    }

    touchStartX.current = null;
  };

  const isToday = (day) => {
    if (!day) return false;

    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isPastDay = (day) => {
    if (!day) return false;

    const date = new Date(year, month, day);

    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    return date < todayDate;
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
    <div
      className="rounded-2xl p-3 pt-0 overflow-hidden max-w-5xl mx-auto "
      style={{
        color: INK,
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        onAnimationEnd={handleAnimationEnd}
        className={
          animating
            ? direction > 0
              ? 'animate-calendar-next'
              : 'animate-calendar-prev'
            : ''
        }
      >
        <div className="flex justify-between items-center mb-5">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="px-3 py-1 rounded-full text-xl"
            aria-label="Mese precedente"
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
            type="button"
            onClick={() => changeMonth(1)}
            className="px-3 py-1 rounded-full text-xl"
            aria-label="Mese successivo"
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

        <div className="grid grid-cols-7 gap-1 mb-10">
          {days.map((day) => {
            const events = tournaments.filter((tournament) =>
              isTournamentActive(day, tournament)
            );

            return (
              <div
                key={day}
                className={`min-h-20 sm:min-h-30 rounded-xl border p-1 sm:p-2 ${isPastDay(day) ? 'opacity-50' : ''
                  } ${isToday(day) ? 'bg-gray-100' : ''
                  }`}
                style={{
                  borderColor: 'rgba(34,48,31,0.3)',
                  ...(day === 1
                    ? { gridColumnStart: offset + 1 }
                    : {}),
                }}
              >
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
                        className="calendar-event rounded-md px-1.5 py-1 text-[9px] line-clamp-4 sm:text-xs font-semibold leading-tight break-words cursor-pointer"
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
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes calendarNext {
          from {
            transform: translateX(18px);
            opacity: 0.85;
          }

          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes calendarPrev {
          from {
            transform: translateX(-18px);
            opacity: 0.85;
          }

          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-calendar-next {
          animation: calendarNext 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .animate-calendar-prev {
          animation: calendarPrev 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      `}</style>
    </div>
  );
}