import { useCallback, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------
   Gesti sul pannello di un modale.

   Due direzioni, un gesto solo: ai primi pixel si decide
   l'asse e non si cambia più idea fino al rilascio.

   - Verso il basso: il pannello segue il dito e, se scende
     abbastanza (o abbastanza in fretta), esce dal fondo.
     Vale solo con il contenuto già in cima, altrimenti il
     dito serve a scorrere.
   - In orizzontale: non si muove un pannello solo ma una
     pista di tre schede — precedente, attuale, prossima —
     larga tre schermate e ferma sulla scheda di mezzo. Il
     dito la trascina, quindi durante il gesto si vede già
     la scheda che sta arrivando invece del solo sfondo.
     Trascinando a sinistra si va avanti (le prossime stanno
     a destra), trascinando a destra si torna indietro.

   La chiusura "classica" (X, backdrop, Esc) resta a
   useModalClose: qui dentro non c'entra.

   Uso:
     const { trackRef, trackStyle, backdropStyle, grabbed, scorri } =
       useSwipeDown(onClose, { scrollRef, onNext, onPrev, canNext, canPrev });
--------------------------------------------------------- */

const SOGLIA = 110;      // px di trascinamento oltre i quali si chiude
const VELOCITA = 0.55;   // px/ms: uno scatto rapido chiude comunque
const USCITA = 220;      // durata dell'uscita, in ms
const RIENTRO = 260;     // durata del rientro quando il gesto non basta
const ATTIVAZIONE = 8;   // px di tolleranza prima di decidere la direzione

const SOGLIA_X = 70;     // px oltre i quali si cambia scheda
const VELOCITA_X = 0.4;  // px/ms: anche una sfogliata veloce cambia
const SCORRIMENTO = 240; // durata dello scorrimento laterale

export function useSwipeDown(
  onDismiss,
  {
    enabled = true,
    backdropColor = '20, 19, 18',
    backdropAlpha = 0.93,
    scrollRef,
    onPrev,
    onNext,
    canPrev = false,
    canNext = false,
  } = {},
) {
  const trackRef = useRef(null);
  const gesto = useRef(null);
  const dismissRef = useRef(onDismiss);
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  // In un ref e non nelle dipendenze: i listener si registrano una
  // volta sola e devono leggere il valore aggiornato a metà gesto.
  const puo = useRef({ prev: canPrev, next: canNext });
  const bloccato = useRef(false); // animazione in corso: ignoro altri tocchi

  const [offset, setOffset] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [slittando, setSlittando] = useState(false);
  const [senzaTransizione, setSenzaTransizione] = useState(false);
  // Una volta toccato il pannello, le animazioni CSS restano spente:
  // se le riaccendessi a fine gesto, `modal-pop-in` ripartirebbe da capo.
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    prevRef.current = onPrev;
    nextRef.current = onNext;
  }, [onPrev, onNext]);

  useEffect(() => {
    puo.current = { prev: canPrev, next: canNext };
  }, [canPrev, canNext]);

  const chiudiTrascinando = useCallback(() => {
    bloccato.current = true;
    setDismissing(true);
    setDragging(false);
    setOffset(window.innerHeight);
    setTimeout(() => dismissRef.current?.(), USCITA);
  }, []);

  /* La pista finisce di scorrere di una schermata intera, poi il
     contenuto slitta di una posizione e la pista torna a zero con la
     transizione spenta: la scheda arrivata è già al centro, quindi
     il "riavvolgimento" non si vede. */
  const scorri = useCallback((direzione) => {
    if (bloccato.current) return;
    const vai = direzione > 0 ? nextRef.current : prevRef.current;
    if (!vai) return;

    bloccato.current = true;
    setGrabbed(true);
    setDragging(false);
    setSlittando(true);
    setOffsetX(-direzione * window.innerWidth);

    setTimeout(() => {
      setSenzaTransizione(true);
      setOffsetX(0);
      // La scheda nuova parte dall'inizio, non da dove era rimasta l'altra.
      if (scrollRef?.current) scrollRef.current.scrollTop = 0;
      vai();

      // Due frame: uno perché il salto a zero venga dipinto, l'altro
      // perché la transizione riaccesa non lo animi all'indietro.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSenzaTransizione(false);
          setSlittando(false);
          bloccato.current = false;
        });
      });
    }, SCORRIMENTO);
  }, [scrollRef]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !enabled) return undefined;

    function onStart(e) {
      if (bloccato.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      gesto.current = {
        x0: t.clientX,
        y0: t.clientY,
        xPrec: t.clientX,
        yPrec: t.clientY,
        tPrec: performance.now(),
        vx: 0,
        vy: 0,
        asse: null,
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

        if (Math.abs(dx) > Math.abs(dy)) {
          // Nessun vicino né di qua né di là: lascio fare al browser.
          if (!prevRef.current && !nextRef.current) {
            gesto.current = null;
            return;
          }
          g.asse = 'x';
        } else if (dy > 0 && (scrollRef?.current?.scrollTop ?? 0) === 0) {
          g.asse = 'y';
        } else {
          // Verso l'alto o con il contenuto già scrollato: non è affar mio.
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
      if (dt > 0) {
        g.vy = (t.clientY - g.yPrec) / dt;
        g.vx = (t.clientX - g.xPrec) / dt;
      }
      g.yPrec = t.clientY;
      g.xPrec = t.clientX;
      g.tPrec = ora;

      if (g.asse === 'x') {
        // Verso sinistra tiro avanti la prossima, verso destra la
        // precedente. Se da quella parte non c'è niente la pista cede
        // appena: si capisce che il gesto è arrivato e che è finita.
        const libero = dx < 0 ? puo.current.next : puo.current.prev;
        setOffsetX(libero ? dx : dx / 4);
      } else {
        setOffset(Math.max(0, dy - ATTIVAZIONE));
      }
    }

    function onEnd() {
      const g = gesto.current;
      gesto.current = null;
      if (!g || !g.attivo || bloccato.current) return;
      setDragging(false);

      if (g.asse === 'x') {
        const percorso = g.xPrec - g.x0;
        const direzione = percorso < 0 ? 1 : -1; // sinistra = avanti
        const libero = direzione > 0 ? puo.current.next : puo.current.prev;
        const deciso = Math.abs(percorso) > SOGLIA_X || Math.abs(g.vx) > VELOCITA_X;
        if (libero && deciso) scorri(direzione);
        else setOffsetX(0); // rientro morbido
        return;
      }

      const percorso = g.yPrec - g.y0;
      if (percorso > SOGLIA || g.vy > VELOCITA) chiudiTrascinando();
      else setOffset(0);
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
  }, [enabled, chiudiTrascinando, scorri, scrollRef]);

  // Quanto è "andato via" il pannello, da 0 a 1: serve a sbiadire lo sfondo.
  const altezza = typeof window === 'undefined' ? 800 : window.innerHeight;
  const progresso = Math.min(1, offset / (altezza * 0.5));

  const durata = dismissing ? USCITA : slittando ? SCORRIMENTO : RIENTRO;

  /* La pista è larga tre schermate e sta ferma sulla seconda: da qui
     il -100vw fisso, a cui il dito somma il suo spostamento. */
  const trackStyle = {
    transform: `translate3d(calc(-100vw + ${offsetX}px), ${offset}px, 0) scale(${1 - progresso * 0.04})`,
    transition:
      dragging || senzaTransizione
        ? 'none'
        : `transform ${durata}ms cubic-bezier(0.2, 0.8, 0.3, 1)`,
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

  return { trackRef, trackStyle, backdropStyle, grabbed, dragging, dismissing, scorri };
}

export default useSwipeDown;