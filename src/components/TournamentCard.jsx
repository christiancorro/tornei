import React, { useState } from 'react';
import { Calendar, MapPin, Euro, Pencil, Trash2 } from 'lucide-react';

import { CARD_BG, INK } from '../theme';
import { STUB_STYLE } from '../constants';
import { formatStubGiorno, formatDataRange } from '../utils';

/* ---------------------------------------------------------
   Tournament card — styled as a torn event ticket: a date
   stub on the left, perforation, details on the right.
--------------------------------------------------------- */
export default function TournamentCard({ t, delay, isAdmin, onEdit, onDeleteRequest, onOpenDetail }) {
  const [imgOk, setImgOk] = useState(true);
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const stub = formatStubGiorno(t.data, t.dataFine);
  const hasPoster = Boolean(t.locandina) && imgOk;
  const stubSize = stub.giorno.length <= 2 ? 'text-3xl' : stub.giorno.length <= 5 ? 'text-[1.8rem]' : 'text-base';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(t)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(t);
        }
      }}
      aria-label={`Vedi dettagli di ${t.nome}`}
      className="group relative bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300 flex overflow-hidden border cursor-pointer "
      style={{
        backgroundColor: CARD_BG,
        borderColor: 'rgba(34,48,31,0.1)',
        animation: 'card-in 0.2s ease-in-out both',
        animationDelay: `${delay}ms`
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center text-center py-4 sm:py-6 shrink-0 overflow-hidden w-20 sm:w-28 lg:w-32 sm:mr-8"
        style={{ background: style.bg }}
      >
        <div className="relative text-white px-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>
          {stub.giornoSett && <div className="text-xm font-semibold" style={{ opacity: 1 }}>{stub.giornoSett}</div>}
          <div className={`font-display text-4xl sm:text-4xl leading-none ${stubSize}`}>{stub.giorno}</div>
          {stub.mese && <div className="text-xm font-semibold tracking-widest">{stub.mese}</div>}
        </div>
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, top: -9 }} /> */}
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, bottom: -9 }} /> */}
      </div>

      {/* <div className="shrink-0" style={{ width: 0, borderLeft: '2px dashed rgba(34,48,31,0.15)', marginTop: 12, marginBottom: 12 }} /> */}

      <div className="flex-1 p-3.5 min-w-0 flex flex-col">
        <h3 className="font-black text-2xl sm:text-3xl leading-tight mb-3" style={{ color: INK }}>
          {t.nome}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span
            className="text-sm sm:text-sm font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: style.tagBg, color: style.tagText }}
          >
            {t.disciplina}
          </span>

          {t.formati.map((f) => (
            <span
              key={f}
              className="text-xs sm:text-sm font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800"
            >
              {f}
            </span>
          ))}
        </div>
        {t.modalita && <p className="text-sm sm:text-sm text-gray-500 mb-4">{t.modalita}</p>}

        <div className="text-sm sm:text-sm text-gray-600 space-y-2 mb-6">

          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <span>
              {formatDataRange(t.data, t.dataFine)}
              {t.ora && <span className="font-normal text-gray-600"> · {t.ora}</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">
              {t.luogo}, {t.comune} ({t.provincia})
            </span>
          </div>
          <div className=" flex items-center gap-1.5">
            <Euro size={16} className="text-gray-400 shrink-0" />
            <span>{t.costo}</span>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-gray-400">{t.organizzatore}</div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 "
                aria-label={`Modifica ${t.nome}`}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest();
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-rose-600 "
                aria-label={`Elimina ${t.nome}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
      {hasPoster && (
        <div className="hidden sm:flex w-45 shrink-0 p-2 items-center justify-center sm:mr-6">
          <img
            src={t.locandina}
            alt={`Locandina di ${t.nome}`}
            onError={() => setImgOk(false)}
            className="w-full rounded-lg object-cover shadow"
          />
        </div>
      )}
    </div>
  );
}
