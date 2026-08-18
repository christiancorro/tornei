import React, { useState } from 'react';
import { MapPin, Euro } from 'lucide-react';

import { CARD_BG, INK } from '../theme';
import { STUB_STYLE } from '../constants';
import { formatStubGiorno } from '../utils';
import LazyImage from './ui/LazyImage';

/* ---------------------------------------------------------
   Tournament card — styled as a torn event ticket: a date
   stub on the left, perforation, details on the right.

   La card si disegna subito con tutte le info testuali; la
   locandina qui è una *preview*, non la locandina intera:
   usa il file thumb (~40 KB, 400px) prodotto in upload, così
   la card entra in scena subito invece di aspettare i 400 KB
   della versione grande. La versione grande la vede chi apre
   il dettaglio.

   Fallback: sui tornei vecchi salvati prima del thumb, se
   `locandinaThumb` non c'è si ripiega sulla `locandina`
   grande — meglio una preview lenta di nessuna preview.
--------------------------------------------------------- */
export default function TournamentCard({ t, delay, onOpenDetail, eagerImage = false }) {
  const [posterMissing, setPosterMissing] = useState(false);
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const stub = formatStubGiorno(t.data, t.dataFine);
  // Preview: prima il thumb piccolo, poi ripiego sul grande se il
  // torneo è stato salvato prima che i thumb esistessero.
  const previewSrc = t.locandinaThumb || t.locandina;
  // Lo slot poster esiste finché c'è una preview da tentare: se
  // non c'è o è rotta il chiamante di LazyImage (onUnavailable) ce
  // lo dice e nascondiamo del tutto la colonna.
  const hasPoster = Boolean(previewSrc) && !posterMissing;
  const stubSize = stub.giorno.length <= 2 ? 'text-3xl' : stub.giorno.length <= 5 ? 'text-[1.8rem]' : 'text-base';

  return (
    <div
      /* Ancora per la lista sotto: mentre si sfogliano i dettagli la
         pagina si porta su questa card, così alla chiusura è già lì. */
      id={`torneo-${t.id}`}
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
      className="group relative bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.21)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.2)] active:scale-[0.99] active:shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-150 flex overflow-hidden border cursor-pointer"
      style={{
        backgroundColor: CARD_BG,
        borderColor: 'rgba(39, 39, 39, 0.1)',
        animation: 'card-in 0.2s ease-in-out both',
        animationDelay: `${delay}ms`
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center text-center py-3 sm:py-4 shrink-0 overflow-hidden w-20 sm:w-28 lg:w-32 mr-1 sm:mr-8"
        style={{ background: style.bg }}
      >
        <div className="relative text-white px-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>
          {stub.giornoSett && <div className="text-xm font-semibold" style={{ opacity: 1 }}>{stub.giornoSett}</div>}
          <div className={`font-display text-3xl sm:text-4xl leading-none ${stubSize}`}>{stub.giorno}</div>
          {stub.mese && <div className="text-xm font-semibold tracking-widest">{stub.mese}</div>}
        </div>
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, top: -9 }} /> */}
        {/* <span className="absolute rounded-full bg-white" style={{ width: 18, height: 18, right: -9, bottom: -9 }} /> */}
      </div>

      {/* <div className="shrink-0" style={{ width: 0, borderLeft: '2px dashed rgba(34,48,31,0.15)', marginTop: 12, marginBottom: 12 }} /> */}

      <div className="flex-1 p-3 sm:p-3.5 min-w-0 flex flex-col">
        <h3 className="font-black text-2xl sm:text-3xl leading-tight mb-2" style={{ color: INK }}>
          {t.nome}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
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
        {/* {t.modalita && (
          <p className="text-base sm:text-lg text-gray-500 mb-2.5 truncate">{t.modalita}</p>
        )} */}

        {/* Riga info: è quella che si legge di sfuggita scorrendo la
            lista, quindi sta un gradino sotto al titolo e non al
            livello delle note di servizio. La data non c'è: la dice
            già il tagliando colorato qui a sinistra. */}
        <div className="text-base sm:text-lg text-gray-700">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-gray-400 shrink-0" />
            <span className="truncate">
              {t.comune}
            </span>
          </div>
          <div className=" flex items-center gap-2">
            <Euro size={18} className="text-gray-400 shrink-0" />
            <span>{t.costo}</span>
          </div>
        </div>

        {/* Le azioni admin (modifica/elimina) sono state rimosse dalla
            card: la card ora termina con le info e non porta più la
            fascia in fondo. La gestione dei tornei resta disponibile
            dal pannello "I miei tornei" in Account / dall'AdminDashboard. */}
      </div>
      {hasPoster && (
        /* Colonna preview: stretta di proposito. La locandina qui
           è solo un'anteprima — quella "in grande" è nel dettaglio.
           Meno spazio + file più piccolo = card che entra subito. */
        <div className="hidden sm:flex w-21 lg:w-20 shrink-0 py-3 items-center justify-center sm:mr-8 rounded-lg">
          <LazyImage
            src={previewSrc}
            alt={`Locandina di ${t.nome}`}
            /* Niente aspectRatio: la locandina mantiene la sua forma
               originale (verticale, quadrata, orizzontale). Rinuncio
               a riservare lo spazio prima del download in cambio di
               non tagliare mai l'immagine — il fade-in copre lo
               swap quando arriva. */
            eager={eagerImage}
            className="w-full rounded-lg shadow "
            placeholderColor={style.bg}
            onUnavailable={() => setPosterMissing(true)}
          />
        </div>
      )}
    </div>
  );
}