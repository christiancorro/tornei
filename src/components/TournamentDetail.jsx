import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Check, Info, MapPin, Euro, Globe, Images, Share2, X, Pencil, Trash2 } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useSwipeDown } from '../hooks/useSwipeDown';
import { useFeedback } from './FeedbackProvider';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { INK, SAND, SUN, CLAY } from '../theme';
import { STUB_STYLE } from '../constants';
import { getMapsUrl, formatDataRange, luogoDi } from '../utils';
import { subscribeMyTrofei, addTrofeo, removeTrofeo } from '../services/trofei';
import ZoomableLocandina from './ZoomableLocandina';

/* ---------------------------------------------------------
   Tournament detail — opened by tapping a card. The poster
   and the organizer's free-text note live here, with room
   to breathe that the compact card doesn't have.

   Le schede sono tre: precedente, attuale e prossima, in
   fila su una pista larga tre schermate. Trascinando di
   lato si vede arrivare la scheda vicina invece del solo
   sfondo, e a fine gesto la pista si assesta sulla nuova.

   `uid` (opzionale): se presente c'è un utente loggato, e
   ogni scheda mostra il pulsante per aggiungere/togliere la
   locandina dai tornei giocati (la collezione dei trofei).
--------------------------------------------------------- */
export default function TournamentDetail({ tournament, onClose, lista = [], onNavigate, uid, isAdmin = false, onEdit, onDeleteRequest }) {
  const { closing, close } = useModalClose(onClose);
  const scrollRef = useRef(null);

  /* Modifica / elimina dal dettaglio: apro il form o la conferma di
     eliminazione (che vivono al top-level dell'App) e chiudo la scheda,
     così non restano due modali sovrapposti né una scheda che mostra un
     torneo appena cambiato o cancellato. */
  const handleEdit = useCallback((t) => {
    onEdit?.(t);
    close();
  }, [onEdit, close]);
  const handleDelete = useCallback((t) => {
    onDeleteRequest?.(t);
    close();
  }, [onDeleteRequest, close]);

  /* Insieme degli id dei tornei già in collezione. Una sola
     sottoscrizione qui, condivisa dalle tre schede: così il pulsante
     "giocato" sa da subito se mostrarsi in stato aggiunto o meno.
     Se non c'è utente loggato non ci si abbona proprio. */
  const [collezione, setCollezione] = useState(() => new Set());

  useEffect(() => {
    if (!uid) {
      setCollezione(new Set());
      return undefined;
    }

    const unsub = subscribeMyTrofei(
      uid,
      (lista) => setCollezione(new Set(lista.map((x) => x.torneoId))),
      (err) => console.warn('[detail/trofei] subscribe fallito:', err.message),
    );

    return unsub;
  }, [uid]);

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
            /* p-0 su mobile così la card fullscreen non ha bordi neri
               intorno; sm:p-4 su desktop lascia respirare la sheet
               centrata.
               items-end su mobile: la card è un bottom-sheet, allineata
               al fondo, con la striscia di sfondo scuro sopra dove
               emergono gli angoli arrotondati. sm:items-center torna
               al centro classico su desktop. */
            className="shrink-0 h-full flex items-end sm:items-center justify-center p-0 sm:p-4"
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
                uid={uid}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                inCollezione={collezione.has(scheda.id)}
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
const Scheda = memo(function Scheda({ t, attivo, scrollRef, closing, grabbed, onClose, uid, isAdmin, onEdit, onDelete, inCollezione }) {
  // Modifica/elimina visibili solo al proprietario del torneo o all'admin.
  const canManage = isAdmin || (!!uid && t.authorId === uid);
  const [posterOk, setPosterOk] = useState(true);
  const [salvaBusy, setSalvaBusy] = useState(false);
  const { toast } = useFeedback();
  const style = STUB_STYLE[t.disciplina] || STUB_STYLE['Green Volley'];
  const showPoster = Boolean(t.locandina) && posterOk;

  /* Aggiungi / togli questa locandina dai tornei giocati. È un toggle:
     se non è in collezione la aggiunge, se c'è la rimuove. Il pulsante
     compare solo con un utente loggato (uid presente). `salvaBusy`
     evita doppi tap mentre la scrittura è in volo. */
  async function toggleGiocato(e) {
    e.stopPropagation();
    if (!uid || salvaBusy) return;

    setSalvaBusy(true);
    try {
      if (inCollezione) {
        await removeTrofeo(uid, t.id);
      } else {
        await addTrofeo(uid, t);
      }
      // Nessun toast di conferma: lo stato del pulsante (aggiunto/da
      // aggiungere) è già il feedback. Il toast d'errore resta, così
      // se il salvataggio non riesce l'utente se ne accorge.
    } catch (err) {
      console.warn('[detail/giocato] toggle fallito:', err.message);
      toast('Non riesco a salvare adesso, riprova.', 'error');
    } finally {
      setSalvaBusy(false);
    }
  }

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

    /* URL specifico di questo torneo, costruito qui e non letto da
       window.location: se un altro effetto non ha ancora sincronizzato
       la barra degli indirizzi, il link condiviso è comunque quello
       giusto. Chi lo apre atterra dritto sulla card grazie al deep
       link gestito in app.jsx. */
    const url = (() => {
      const u = new URL(window.location.href);
      u.searchParams.set('torneo', t.id);
      return u.toString();
    })();

    /* Si condivide SOLO l'URL. Nome, data, luogo, costo e locandina li
       mette il Cloudflare Worker nei meta tag Open Graph, quindi
       WhatsApp e Telegram costruiscono da soli l'anteprima ricca a
       partire dal link (vedi docs/social-preview.md).

       Allegare anche il file della locandina sarebbe controproducente:
       i client che ricevono un'immagine la mostrano come allegato e
       smettono di generare la card del link. Un URL nudo fa una figura
       migliore. */
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (err) {
        // Annullare la condivisione non è un errore: non dico niente.
        if (err?.name === 'AbortError') return;
        console.warn('[condividi torneo] menù di sistema non riuscito', err);
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast('Link copiato negli appunti.', 'success');
        return;
      }
    } catch (err) {
      console.warn('[condividi torneo] appunti non disponibili', err);
    }

    if (copiaAllaVecchia(url)) {
      toast('Link copiato negli appunti.', 'success');
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
         resta dentro il ritaglio arrotondato.

         Dimensioni, max-width e border-radius sono ora in
         `.tournament-detail-panel` (styles.css): fullscreen su mobile,
         sheet centrata da 90vh su desktop. */
      className={`bg-white w-full overflow-hidden tournament-detail-panel ${attivo ? 'modal-panel' : ''} ${attivo && closing ? 'is-closing' : ''} ${grabbed ? 'is-grabbed' : ''}`}
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!attivo}
    >
      <div
        ref={attivo ? scrollRef : null}
        className="overflow-y-auto tournament-detail-scroll"
      >
        <div
          /* z-10: l'header è sticky ma senza z-index i fratelli sotto
             (la locandina, il cui wrapper LazyImage è position:relative)
             gli passano sopra durante lo scroll, coprendo titolo e
             pulsante di chiusura.
             Il padding-top è in `.tournament-detail-header` per
             rispettare env(safe-area-inset-top) su iPhone con notch. */
          className="sticky top-0 z-10 bg-white border-b-2 px-5 sm:px-6 pb-3 flex items-center justify-between gap-3 tournament-detail-header"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          {/* Maniglia: dice al dito che il pannello si può trascinare.
             Anche qui il pt vive nel CSS per aggiungere la safe-area. */}
          <div
            className="absolute inset-x-0 top-0 flex justify-center pb-1 sm:hidden tournament-detail-handle"
            aria-hidden="true"
          >
            <span className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(34,48,31,0.2)' }} />
          </div>
          <h2 className="font-black text-2xl sm:text-3xl" style={{ color: INK }}>
            {t.nome}
          </h2>
          <div className="flex items-center gap-4 shrink-0">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onDelete?.(t)}
                  tabIndex={attivo ? 0 : -1}
                  className="p-1.5 rounded-full hover:bg-gray-100"
                  style={{ color: CLAY }}
                  aria-label="Elimina torneo"
                  title="Elimina"
                >
                  <Trash2 size={19} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit?.(t)}
                  tabIndex={attivo ? 0 : -1}
                  className="p-1.5 rounded-full hover:bg-gray-100"
                  style={{ color: INK }}
                  aria-label="Modifica torneo"
                  title="Modifica"
                >
                  <Pencil size={19} />
                </button>

              </>
            )}
            {/* Extra margine a sinistra della X quando ci sono anche i
                pulsanti gestione, così la chiusura resta distanziata. */}
            <button
              type="button"
              onClick={onClose}
              tabIndex={attivo ? 0 : -1}
              className={`p-1.5 rounded-full hover:bg-gray-100 ${canManage ? 'ml-3' : ''}`}
              style={{ color: INK }}
              aria-label="Chiudi"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-3 tournament-detail-content pt-2 sm:pt-4">
          {showPoster && (
            <div className="w-full flex justify-center mb-4">
              {/* Pinch a due dita per zoomare, doppio tap per toggle a 2x,
                 pan a un dito quando zoomati. A scala 1 il tocco singolo
                 passa al parent (useSwipeDown) così swipe-down-per-chiudere
                 e sfoglio laterale continuano a partire anche dalla locandina. */}
              <ZoomableLocandina
                attivo={attivo}
                src={t.locandina}
                alt={`Locandina di ${t.nome}`}
                /* La scheda attiva è quella che l'utente sta guardando
                   adesso: la sua locandina la vogliamo subito, non a
                   pigrizia. Le due vicine (pre-caricate per lo swipe)
                   possono aspettare finché non è il loro turno. */
                eager={attivo}
                className="rounded-xl shadow"
                placeholderColor={style.bg}
                /* maxHeight sull'img, non sul wrapper: sul wrapper +
                   overflow:hidden l'immagine sarebbe stata tagliata a
                   750px. Sull'img cappa l'altezza mantenendo il rapporto. */
                imgStyle={{ maxHeight: '730px', maxWidth: '100%' }}
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
                {luogoDi(t)}
              </a>
            </div>
            <div className="flex items-start gap-2.5">
              <Euro size={20} className="mt-0.5 shrink-0" style={{ opacity: 0.5 }} />
              <span>{t.costo}</span>
            </div>
          </div>

          {t.descrizioneOrganizzatore && (
            <div className="rounded-lg p-3.5 flex items-start gap-2.5 text-base sm:text-lg" style={{ backgroundColor: "#fff4de", color: "#8a5a00" }}>
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

          {/* Aggiungi ai tornei giocati: in fondo, dopo descrizione e link.
             Compare solo con utente loggato. Toggle vero e proprio —
             pieno quando già in collezione, contornato quando da aggiungere. */}
          {uid && (
            <button
              type="button"
              onClick={toggleGiocato}
              disabled={salvaBusy}
              tabIndex={attivo ? 0 : -1}
              aria-pressed={inCollezione}
              className="w-full inline-flex items-center justify-center gap-2 cursor-pointer
              rounded-full border-2 transition-all
              px-4 py-2.5 text-sm sm:text-base font-semibold whitespace-nowrap
              disabled:opacity-60 disabled:cursor-default active:scale-[0.99]"
              style={inCollezione
                ? { backgroundColor: 'rgba(34,48,31,0.06)', borderColor: 'rgba(34,48,31,0.18)', color: INK }
                : { backgroundColor: SUN, borderColor: 'transparent', color: INK }}
            >
              {inCollezione ? <Check size={18} /> : <Images size={18} />}
              {inCollezione ? 'Nei tornei giocati' : 'Aggiungi ai tornei giocati'}
            </button>
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