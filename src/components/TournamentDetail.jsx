import React, { useState } from 'react';
import { Calendar, MapPin, Euro, X } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { INK, SAND } from '../theme';
import { STUB_STYLE } from '../constants';
import { getMapsUrl, formatDataRange, formatDataBreve } from '../utils';

/* ---------------------------------------------------------
   Tournament detail — opened by tapping a card. The poster
   and the organizer's free-text note live here, with room
   to breathe that the compact card doesn't have.
--------------------------------------------------------- */
export default function TournamentDetail({ tournament, onClose }) {
  const [posterOk, setPosterOk] = useState(true);
  const t = tournament;
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const posterSrc = t.locandina;
  const showPoster = Boolean(posterSrc) && posterOk;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(22, 20, 15, 0.83)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 bg-white border-b-2 px-4 py-3 flex items-center justify-between gap-3 rounded-t-2xl"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          <h2 className="font-black text-2xl sm:text-3xl" style={{ color: INK }}>
            {t.nome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 shrink-0 "
            style={{ color: INK }}
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {showPoster && (
            <div className="w-full flex justify-center mb-4">
              <img
                src={posterSrc}
                alt={`Locandina di ${t.nome}`}
                onError={() => setPosterOk(false)}
                className="rounded-lg object-contain shadow"
                style={{ maxHeight: '500px', maxWidth: '100%' }}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: style.tagBg, color: style.tagText }}>
              {t.disciplina}
            </span>
            {t.formati.map((f) => (
              <span key={f} className="text-sm font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {f}
              </span>
            ))}
          </div>

          {t.modalita && (
            <p className="text-sm" style={{ color: INK, opacity: 0.75 }}>
              {t.modalita}
            </p>
          )}

          <div className="text-sm space-y-2.5" style={{ color: INK }}>
            <div className="flex items-start gap-2.5">
              <Calendar size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span className="font-semibold">
                {formatDataRange(t.data, t.dataFine)}
                {t.ora && <span className="font-normal"> · {t.ora}</span>}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <a href={getMapsUrl(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:underline"
              >
                {t.luogo}, {t.comune} ({t.provincia})
              </a>
            </div>
            <div className="flex items-start gap-2.5">
              <Euro size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span>{t.costo}</span>
            </div>
          </div>

          <div className="text-xs pt-3 border-t" style={{ color: INK, opacity: 0.55, borderColor: 'rgba(34,48,31,0.1)' }}>
            Iscrizioni entro {formatDataBreve(t.iscrizioniEntro)} · {t.organizzatore}
          </div>

          {t.descrizioneOrganizzatore && (
            <div className="rounded-lg p-3.5 text-sm whitespace-pre-wrap" style={{ backgroundColor: SAND, color: INK }}>
              {t.descrizioneOrganizzatore}
            </div>
          )}

          {(t.instagram || t.facebook) && (
            <div className="flex items-center gap-2 justify-center flex-wrap pt-1">
              {t.instagram && (
                <a
                  href={t.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaInstagram size={15} /> Instagram
                </a>
              )}
              {t.facebook && (
                <a
                  href={t.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaFacebook size={15} /> Facebook
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// 