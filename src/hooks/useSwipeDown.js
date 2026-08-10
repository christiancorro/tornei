import { useCallback, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------
   Trascina verso il basso per chiudere (stile Google Immagini).

   L'idea: il pannello segue il dito finché il contenuto è in
   cima (scrollTop === 0). Al rilascio decidono due cose —
   quanto è sceso e con che velocità: se una delle due supera
   la soglia il pannello esce dal fondo, altrimenti torna al
   suo posto.

   Il gesto non tocca la chiusura "classica" (X, backdrop,
   Esc): quella resta a useModalClose.

   Uso:
     const { panelRef, panelStyle, backdropStyle, grabbed } = useSwipeDown(onClose);
--------------------------------------------------------- */

const SOGLIA = 110;      // px di trascinamento oltre i quali si chiude
const VELOCITA = 0.55;   // px/ms: uno scatto rapido chiude comunque
const USCITA = 220;      // durata dell'uscita, in ms
const RIENTRO = 260;     // durata del rientro quando il gesto non basta
const ATTIVAZIONE = 8;   // px di tolleranza prima di decidere la direzione

export function useSwipeDown(
  onDismiss,
  { enabled = true, backdropColor = '20, 19, 18', backdropAlpha = 0.93 } = {},
) {
  const panelRef = useRef(null);
  const gesto = useRef(null);
  const dismissRef = useRef(onDismiss);
  const bloccato = useRef(false); // uscita già partita: ignoro altri tocchi

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  // Una volta toccato il pannello, le animazioni CSS restano spente:
  // se le riaccendessi a fine gesto, `modal-pop-in` ripartirebbe da capo.
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const chiudiTrascinando = useCallback(() => {
    bloccato.current = true;
    setDismissing(true);
    setDragging(false);
    setOffset(window.innerHeight);
    setTimeout(() => dismissRef.current?.(), USCITA);
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !enabled) return undefined;

    function onStart(e) {
      if (bloccato.current || e.touches.length !== 1) return;
      // Contenuto già scrollato: il dito serve a scorrere, non a chiudere.
      if (el.scrollTop > 0) return;
      const t = e.touches[0];
      gesto.current = {
        x0: t.clientX,
        y0: t.clientY,
        yPrec: t.clientY,
        tPrec: performance.now(),
        v: 0,
        attivo: false,
      };
    }

    function onMove(e) {
      const g = gesto.current;
      if (!g || bloccato.current) return;
      const t = e.touches[0];
      const dy = t.clientY - g.y0;
      const dx = t.clientX - g.x0;

      if (!g.attivo) {
        if (Math.abs(dy) < ATTIVAZIONE && Math.abs(dx) < ATTIVAZIONE) return;
        // Verso l'alto o in orizzontale: non è affar mio, lascio fare al browser.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          gesto.current = null;
          return;
        }
        g.attivo = true;
        setGrabbed(true);
        setDragging(true);
      }

      // Con listener non passivo posso davvero fermare lo scroll sottostante.
      if (e.cancelable) e.preventDefault();

      const ora = performance.now();
      const dt = ora - g.tPrec;
      if (dt > 0) g.v = (t.clientY - g.yPrec) / dt;
      g.yPrec = t.clientY;
      g.tPrec = ora;

      setOffset(Math.max(0, dy - ATTIVAZIONE));
    }

    function onEnd() {
      const g = gesto.current;
      gesto.current = null;
      if (!g || !g.attivo || bloccato.current) return;
      setDragging(false);
      const percorso = g.yPrec - g.y0;
      if (percorso > SOGLIA || g.v > VELOCITA) chiudiTrascinando();
      else setOffset(0); // rientro morbido
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, chiudiTrascinando]);

  // Quanto è "andato via" il pannello, da 0 a 1: serve a sbiadire lo sfondo.
  const altezza = typeof window === 'undefined' ? 800 : window.innerHeight;
  const progresso = Math.min(1, offset / (altezza * 0.5));

  const panelStyle = {
    transform: `translateY(${offset}px) scale(${1 - progresso * 0.04})`,
    transition: dragging
      ? 'none'
      : `transform ${dismissing ? USCITA : RIENTRO}ms cubic-bezier(0.2, 0.8, 0.3, 1)`,
    willChange: 'transform',
    touchAction: 'pan-y',
    overscrollBehavior: 'contain',
  };

  // Lo sfondo si schiarisce cambiando alpha, non opacity: `opacity` sul
  // contenitore sbiadirebbe anche il pannello, che invece deve restare pieno.
  const backdropStyle = {
    backgroundColor: `rgba(${backdropColor}, ${backdropAlpha * (1 - progresso)})`,
    transition: dragging ? 'none' : `background-color ${dismissing ? USCITA : RIENTRO}ms ease-out`,
  };

  return { panelRef, panelStyle, backdropStyle, grabbed, dragging, dismissing };
}

export default useSwipeDown;
