import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Info, MapPin, Euro, Globe, Share2, X } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDown } from '../hooks/useSwipeDown';
import { useFeedback } from './FeedbackProvider';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { INK, SAND } from '../theme';
import { STUB_STYLE } from '../constants';
import { getMapsUrl, formatDataRange } from '../utils';
import LazyImage from './ui/LazyImage';

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
  const { trackRef, backdropRef, trackStyle, backdropStyle, panelStyle, grabbed, dismissing, scorri } = useSwipeDown(onClose, {
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
      ref={backdropRef}
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
            /* panelStyle(i) mette la scala solo sulla card uscente:
               la centrale sotto il dito, o il laterale dove è finita
               la scheda dopo un cambio. Le altre restano a piena
               dimensione, così l'entrante non "cresce" mentre arriva. */
            style={{ width: '100vw', ...panelStyle(i) }}
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
const Scheda = memo(function Scheda({ t, attivo, scrollRef, closing, grabbed, onClose }) {
  const [posterOk, setPosterOk] = useState(true);
  const [fileLocandina, setFileLocandina] = useState(null);
  const { toast } = useFeedback();
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const showPoster = Boolean(t.locandina) && posterOk;

  /* La locandina si scarica appena la scheda è in primo piano, non al
     click: Safari concede navigator.share() solo mentre il tocco è
     "fresco", e un await di mezzo glielo fa scadere. Se il download
     non riesce (tipicamente CORS) resta null e si condivide il testo. */
  useEffect(() => {
    if (!attivo || !t.locandina) {
      setFileLocandina(null);
      return undefined;
    }

    let vivo = true;
    const stop = new AbortController();

    (async () => {
      try {
        const risposta = await fetch(t.locandina, { mode: 'cors', signal: stop.signal });
        if (!risposta.ok) return;
        const blob = await risposta.blob();
        if (!vivo || !blob.type.startsWith('image/')) return;
        const estensione = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
        const nome = `${t.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'locandina'}.${estensione}`;
        setFileLocandina(new File([blob], nome, { type: blob.type }));
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('[condividi torneo] locandina non scaricabile', err);
        }
      }
    })();

    return () => {
      vivo = false;
      stop.abort();
    };
  }, [attivo, t.locandina, t.nome]);

  /* Tre tentativi in scaletta, dal più bello al più sicuro:
     1. il menù di sistema (telefoni, e comunque solo in https);
     2. gli appunti via Clipboard API — anche questa vuole https;
     3. la vecchia execCommand('copy'), che funziona pure su http.
     Il passaggio 3 esiste perché in sviluppo il sito gira quasi
     sempre su http://<ip-locale>, dove navigator.share e
     navigator.clipboard non esistono proprio. */
  function copiaAllaVecchia(contenuto) {
    const area = document.createElement('textarea');
    area.value = contenuto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, contenuto.length); // iOS ignora select() da solo
    let fatto = false;
    try {
      fatto = document.execCommand('copy');
    } catch (err) {
      fatto = false;
    }
    document.body.removeChild(area);
    return fatto;
  }

  async function condividi(e) {
    e.stopPropagation();

    const righe = [
      t.nome,
      formatDataRange(t.data, t.dataFine, { giornoEsteso: true }) + (t.ora ? ` · ${t.ora}` : ''),
      t.comune,
    ].filter(Boolean);
    const testo = righe.join('\n');
    const url = window.location.href;
    const contenuto = `${testo}\n${url}`;

    if (navigator.share) {
      /* Non tutti i sistemi accettano i file: canShare() lo dice prima
         di provarci, così non si perde anche la condivisione del testo. */
      const conLocandina = fileLocandina && navigator.canShare?.({ files: [fileLocandina] });
      const dati = { title: t.nome, text: testo, url };
      if (conLocandina) dati.files = [fileLocandina];

      try {
        await navigator.share(dati);
        return;
      } catch (err) {
        // Annullare la condivisione non è un errore: non dico niente.
        if (err?.name === 'AbortError') return;
        console.warn('[condividi torneo] menù di sistema non riuscito', err);
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contenuto);
        toast('Torneo copiato negli appunti.', 'success');
        return;
      }
    } catch (err) {
      console.warn('[condividi torneo] appunti non disponibili', err);
    }

    if (copiaAllaVecchia(contenuto)) {
      toast('Torneo copiato negli appunti.', 'success');
    } else {
      toast('Non riesco a condividere da qui: copia il link dalla barra degli indirizzi.', 'error', 6000);
    }
  }

  return (
    <div
      /* Wrapper esterno: tiene border-radius + overflow:hidden per
         ritagliare gli angoli. Se lo scroll stesse qui, la scrollbar
         (che occupa il bordo destro) romperebbe gli angoli su desktop:
         il div interno sotto è quello scrollabile, così la scrollbar
         resta dentro il ritaglio arrotondato. */
      className={`bg-white rounded-2xl w-full max-w-xl overflow-hidden ${attivo ? 'modal-panel' : ''} ${attivo && closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
      style={{ maxHeight: '90vh' }}
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!attivo}
    >
      <div
        ref={attivo ? scrollRef : null}
        className="overflow-y-auto"
        style={{ maxHeight: '90vh' }}
      >
        <div
          /* z-10: l'header è sticky ma senza z-index i fratelli sotto
             (la locandina, il cui wrapper LazyImage è position:relative)
             gli passano sopra durante lo scroll, coprendo titolo e
             pulsante di chiusura. */
          className="sticky top-0 z-10 bg-white border-b-2 px-5 sm:px-6 pt-6 pb-3 sm:pt-4 flex items-center justify-between gap-3"
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

        <div className="p-5 sm:p-6 space-y-3">
          {showPoster && (
            <div className="w-full flex justify-center mb-4">
              <LazyImage
                src={t.locandina}
                alt={`Locandina di ${t.nome}`}
                /* La scheda attiva è quella che l'utente sta guardando
                   adesso: la sua locandina la vogliamo subito, non a
                   pigrizia. Le due vicine (pre-caricate per lo swipe)
                   possono aspettare finché non è il loro turno. */
                eager={attivo}
                className="rounded-lg shadow"
                placeholderColor={style.bg}
                /* maxHeight sull'img, non sul wrapper: sul wrapper +
                   overflow:hidden l'immagine sarebbe stata tagliata a
                   750px. Sull'img cappa l'altezza mantenendo il rapporto. */
                imgStyle={{ maxHeight: '750px', maxWidth: '100%' }}
                onUnavailable={() => setPosterOk(false)}
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
            <div className="rounded-lg p-3.5 flex items-start gap-2.5 text-base sm:text-lg" style={{ backgroundColor: SAND, color: INK }}>
              <Info size={20} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span className="whitespace-pre-wrap">{t.descrizioneOrganizzatore}</span>
            </div>
          )}

          {(t.instagram || t.facebook || t.sitoWeb) && (
            <div className="flex items-center gap-2 justify-center flex-wrap pt-1">
              {/* Stesso pattern degli altri bottoni (Accedi, selettore
                vista, Condividi): bordo trasparente + opacità 60% a
                riposo, bordo pieno (INK) + opacità 100% sull'hover.
                Prima i link avevano un bordo grigio fisso sempre visibile. */}
              {t.instagram && (
                <a
                  href={t.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={attivo ? 0 : -1}
                  className="inline-flex items-center gap-1.5 cursor-pointer shrink-0
                  rounded-full border-2 border-transparent transition-all
                  px-4 py-2 text-sm sm:text-base font-semibold whitespace-nowrap
                  opacity-60 hover:opacity-100 hover:border-[#282828]"
                  style={{ color: INK }}
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
                  className="inline-flex items-center gap-1.5 cursor-pointer shrink-0
                  rounded-full border-2 border-transparent transition-all
                  px-4 py-2 text-sm sm:text-base font-semibold whitespace-nowrap
                  opacity-60 hover:opacity-100 hover:border-[#282828]"
                  style={{ color: INK }}
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
                  className="inline-flex items-center gap-1.5 cursor-pointer shrink-0
                  rounded-full border-2 border-transparent transition-all
                  px-4 py-2 text-sm sm:text-base font-semibold whitespace-nowrap
                  opacity-60 hover:opacity-100 hover:border-[#282828]"
                  style={{ color: INK }}
                >
                  <Globe size={17} /> Sito web
                </a>
              )}
            </div>
          )}

          {/* Riga di chiusura: la firma di chi organizza da una parte, la
            condivisione dall'altra. C'è sempre, anche senza organizzatore,
            perché il pulsante deve restare raggiungibile. */}
          <div
            className="flex items-center justify-between gap-3 pt-3 border-t"
            style={{ borderColor: 'rgba(34,48,31,0.1)' }}
          >
            <span className="text-sm min-w-0 truncate" style={{ color: INK, opacity: 0.6 }}>
              {t.organizzatore}
            </span>
            <button
              type="button"
              onClick={condividi}
              tabIndex={attivo ? 0 : -1}
              /* Stesso comportamento del bottone "Accedi" nell'header
                 e del selettore vista nella ResultsBar: bordo trasparente
                 + opacità 60% a riposo, bordo pieno (INK) + opacità 100%
                 sull'hover. Sostituisce il precedente hover:bg-gray-100. */
              className="inline-flex items-center gap-1.5 cursor-pointer shrink-0
              rounded-full border-2 border-transparent transition-all
              px-4 py-1.5 text-sm font-semibold whitespace-nowrap
              opacity-60 hover:opacity-100 hover:border-[#282828]"
              style={{ color: INK }}
              aria-label="Condividi"
              title="Condividi"
            >
              <Share2 size={17} /> Condividi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});