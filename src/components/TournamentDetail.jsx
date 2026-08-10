import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, MapPin, Euro, Globe, Share2, X } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDown } from '../hooks/useSwipeDown';
import { useFeedback } from './FeedbackProvider';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { INK, SAND } from '../theme';
import { STUB_STYLE } from '../constants';
import { getMapsUrl, formatDataRange } from '../utils';

/* ---------------------------------------------------------
   Tournament detail — opened by tapping a card. The poster
   and the organizer's free-text note live here, with room
   to breathe that the compact card doesn't have.

   Le schede sono tre: precedente, attuale e prossima, in
   fila su una pista larga tre schermate. Trascinando di
   lato si vede arrivare la scheda vicina invece del solo
   sfondo, e a fine gesto la pista si assesta sulla nuova.
--------------------------------------------------------- */
export default function TournamentDetail({ tournament, onClose, lista = [], onNavigate }) {
  const { closing, close } = useModalClose(onClose);
  const scrollRef = useRef(null);

  /* Vicini nella stessa lista da cui si è aperto il dettaglio: così
     si sfoglia nell'ordine che si aveva sotto gli occhi. */
  const indice = lista.findIndex((x) => x.id === tournament.id);
  const precedente = indice > 0 ? lista[indice - 1] : null;
  const prossimo = indice >= 0 && indice < lista.length - 1 ? lista[indice + 1] : null;

  const vaiAl = useCallback((t) => {
    if (t) onNavigate?.(t);
  }, [onNavigate]);

  // Su mobile si chiude trascinando in basso e si sfoglia di lato.
  const { trackRef, trackStyle, backdropStyle, grabbed, dismissing, scorri } = useSwipeDown(onClose, {
    scrollRef,
    onNext: () => vaiAl(prossimo),
    onPrev: () => vaiAl(precedente),
    canNext: Boolean(prossimo),
    canPrev: Boolean(precedente),
  });

  // Su desktop il gesto non c'è: le frecce fanno lo stesso lavoro.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' && prossimo) scorri(1);
      if (e.key === 'ArrowLeft' && precedente) scorri(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prossimo, precedente, scorri]);

  /* Gli slot restano tre anche a inizio e fine lista: se ne togliessi
     uno, la scheda attuale non sarebbe più quella di mezzo e la pista
     si troverebbe spostata di una schermata. */
  const slot = [precedente, tournament, prossimo];

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden modal-backdrop ${closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
      style={backdropStyle}
      onClick={() => !dismissing && close()}
    >
      <div
        ref={trackRef}
        className="absolute inset-0 flex"
        style={{ width: '300vw', ...trackStyle }}
      >
        {slot.map((scheda, i) => (
          <div
            key={scheda ? scheda.id : `vuoto-${i}`}
            className="shrink-0 h-full flex items-center justify-center p-4"
            style={{ width: '100vw' }}
          >
            {scheda && (
              <Scheda
                t={scheda}
                attivo={i === 1}
                scrollRef={scrollRef}
                closing={closing}
                grabbed={grabbed}
                onClose={close}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Una singola scheda. Sta in un componente suo perché ne vivono tre
   alla volta e ognuna si tiene i suoi stati — per esempio la locandina
   rotta, che altrimenti si porterebbe dietro anche sulle altre. */
function Scheda({ t, attivo, scrollRef, closing, grabbed, onClose }) {
  const [posterOk, setPosterOk] = useState(true);
  const { toast } = useFeedback();
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const showPoster = Boolean(t.locandina) && posterOk;

  /* Dove c'è il menù di sistema (praticamente ogni telefono) si apre
     quello, così il torneo finisce dove l'utente vuole. Altrove —
     desktop, browser vecchi — resta la copia negli appunti. */
  async function condividi(e) {
    e.stopPropagation();

    const righe = [
      t.nome,
      formatDataRange(t.data, t.dataFine, { giornoEsteso: true }) + (t.ora ? ` · ${t.ora}` : ''),
      t.comune,
    ].filter(Boolean);
    const testo = righe.join('\n');
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: t.nome, text: testo, url });
        return;
      }
      await navigator.clipboard.writeText(`${testo}\n${url}`);
      toast('Torneo copiato negli appunti.', 'success');
    } catch (err) {
      // Annullare la condivisione non è un errore: non dico niente.
      if (err?.name === 'AbortError') return;
      console.error('[condividi torneo]', err);
      toast('Condivisione non riuscita.', 'error');
    }
  }

  return (
    <div
      ref={attivo ? scrollRef : null}
      className={`bg-white rounded-xl w-full max-w-xl overflow-y-auto ${attivo ? 'modal-panel' : ''} ${attivo && closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
      style={{ maxHeight: '90vh' }}
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!attivo}
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
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={condividi}
            tabIndex={attivo ? 0 : -1}
            className="p-1.5 rounded-full hover:bg-gray-100 "
            style={{ color: INK }}
            aria-label="Condividi"
            title="Condividi"
          >
            <Share2 size={19} />
          </button>
          <button
            type="button"
            onClick={onClose}
            tabIndex={attivo ? 0 : -1}
            className="p-1.5 rounded-full hover:bg-gray-100 "
            style={{ color: INK }}
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {showPoster && (
          <div className="w-full flex justify-center mb-4">
            <img
              src={t.locandina}
              alt={`Locandina di ${t.nome}`}
              onError={() => setPosterOk(false)}
              className="rounded-lg object-contain shadow"
              style={{ maxHeight: '500px', maxWidth: '100%' }}
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
              tabIndex={attivo ? 0 : -1}
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

        {t.descrizioneOrganizzatore && (
          <div className="rounded-lg p-3.5 text-base sm:text-lg whitespace-pre-wrap" style={{ backgroundColor: SAND, color: INK }}>
            {t.descrizioneOrganizzatore}
          </div>
        )}

        {t.organizzatore && (
          <div className="text-sm pt-3 border-t" style={{ color: INK, opacity: 0.6, borderColor: 'rgba(34,48,31,0.1)' }}>
            Organizzatore: {t.organizzatore}
          </div>
        )}

        {(t.instagram || t.facebook || t.sitoWeb) && (
          <div className="flex items-center gap-2 justify-center flex-wrap pt-1">
            {t.instagram && (
              <a
                href={t.instagram}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={attivo ? 0 : -1}
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
                tabIndex={attivo ? 0 : -1}
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
                tabIndex={attivo ? 0 : -1}
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
  );
}