import React, { useState } from 'react';
import { Calendar, MapPin, Euro, Globe, X } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDown } from '../hooks/useSwipeDown';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { INK, SAND } from '../theme';
import { STUB_STYLE } from '../constants';
import { getMapsUrl, formatDataRange } from '../utils';

/* ---------------------------------------------------------
   Tournament detail — opened by tapping a card. The poster
   and the organizer's free-text note live here, with room
   to breathe that the compact card doesn't have.
--------------------------------------------------------- */
export default function TournamentDetail({ tournament, onClose }) {
  const { closing, close } = useModalClose(onClose);
  // Su mobile si chiude anche trascinando il pannello verso il basso.
  const { panelRef, panelStyle, backdropStyle, grabbed, dismissing } = useSwipeDown(onClose);
  const [posterOk, setPosterOk] = useState(true);
  const t = tournament;
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const posterSrc = t.locandina;
  const showPoster = Boolean(posterSrc) && posterOk;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
      style={backdropStyle}
      onClick={() => !dismissing && close()}
    >
      <div
        ref={panelRef}
        className={`bg-white rounded-xl w-full max-w-xl overflow-y-auto modal-panel ${closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
        style={{ maxHeight: '90vh', ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 bg-white border-b-2 px-4 pt-6 pb-3 sm:pt-3 flex items-center justify-between gap-3 rounded-t-2xl"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          {/* Maniglia: dice al dito che il pannello si può trascinare. */}
          <div
            className="absolute inset-x-0 top-0 flex justify-center pt-2 pb-1 sm:hidden"
            aria-hidden="true"
          >
            <span className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(34,48,31,0.2)' }} />
          </div>
          <h2 className="font-black text-2xl sm:text-3xl" style={{ color: INK }}>
            {t.nome}
          </h2>
          <button
            type="button"
            onClick={close}
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
                style={{ maxHeight: '735px', maxWidth: '100%' }}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: style.tagBg, color: style.tagText }}>
              {t.disciplina}
            </span>
            {t.formati.map((f) => (
              <span key={f} className="text-sm sm:text-base font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {f}
              </span>
            ))}
          </div>

          {t.modalita && (
            <p className="text-base sm:text-lg" style={{ color: INK, opacity: 0.75 }}>
              {t.modalita}
            </p>
          )}

          <div className="text-base sm:text-lg space-y-2.5" style={{ color: INK }}>
            <div className="flex items-start gap-2.5">
              <Calendar size={20} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span className="font-semibold">
                {formatDataRange(t.data, t.dataFine, { giornoEsteso: true })}
                {t.ora && <span className="font-normal"> · {t.ora}</span>}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin size={20} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <a href={getMapsUrl(t)}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:underline"
              >
                {t.comune}
              </a>
            </div>
            <div className="flex items-start gap-2.5">
              <Euro size={20} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span>{t.costo}</span>
            </div>
          </div>

          {t.organizzatore && (
            <div className="text-sm pt-3 border-t" style={{ color: INK, opacity: 0.6, borderColor: 'rgba(34,48,31,0.1)' }}>
              {t.organizzatore}
            </div>
          )}

          {t.descrizioneOrganizzatore && (
            <div className="rounded-lg p-3.5 text-base sm:text-lg whitespace-pre-wrap" style={{ backgroundColor: SAND, color: INK }}>
              {t.descrizioneOrganizzatore}
            </div>
          )}

          {(t.instagram || t.facebook || t.sitoWeb) && (
            <div className="flex items-center gap-2 justify-center flex-wrap pt-1">
              {t.instagram && (
                <a
                  href={t.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm sm:text-base font-semibold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaInstagram size={17} /> Instagram
                </a>
              )}
              {t.facebook && (
                <a
                  href={t.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm sm:text-base font-semibold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <FaFacebook size={17} /> Facebook
                </a>
              )}
              {t.sitoWeb && (
                <a
                  href={t.sitoWeb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm sm:text-base font-semibold "
                  style={{ borderColor: 'rgba(34,48,31,0.2)', color: INK }}
                >
                  <Globe size={17} /> Sito web
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}