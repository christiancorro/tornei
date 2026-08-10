import { useCallback, useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------
   Gesti sul pannello di un modale.

   Due direzioni, un gesto solo: ai primi pixel si decide
   l'asse e non si cambia più idea fino al rilascio.

   - Verso il basso: il pannello segue il dito e, se scende
     abbastanza (o abbastanza in fretta), esce dal fondo.
     Vale solo con il contenuto già in cima, altrimenti il
     dito serve a scorrere.
   - In orizzontale: si muove una pista di tre schede —
     precedente, attuale, prossima — larga tre schermate e
     ferma su quella di mezzo. Trascinando a sinistra si va
     avanti, a destra si torna indietro.

   Due scelte tengono il gesto fluido:

   1. Mentre il dito è giù non si passa da React. Ogni
      touchmove scriverebbe uno stato e farebbe ridisegnare
      tre schede intere: a 60fps non ce la fa. Qui il
      trasformo va dritto sul nodo, una volta per frame
      (requestAnimationFrame), e lo stato React si aggiorna
      solo quando il dito si stacca. La transizione CSS che
      riparte da lì interpola dal valore già dipinto, quindi
      il passaggio non si vede.
   2. Il cambio di scheda avviene appena il dito si stacca,
      non a fine animazione: il contenuto slitta di una
      posizione e la pista viene riposizionata di una
      schermata, così a schermo non cambia nulla. Non c'è
      mai un momento "bloccato": un nuovo tocco riparte dal
      punto esatto in cui si trova la pista, letto dalla
      matrice CSS, e si può fermare o invertire a metà.

   La chiusura "classica" (X, backdrop, Esc) resta a
   useModalClose: qui dentro non c'entra.

   Uso:
     const { trackRef, backdropRef, trackStyle, backdropStyle, grabbed, scorri } =
       useSwipeDown(onClose, { scrollRef, onNext, onPrev, canNext, canPrev });
--------------------------------------------------------- */

const SOGLIA = 110;      // px di trascinamento oltre i quali si chiude
const VELOCITA = 0.55;   // px/ms: uno scatto rapido chiude comunque
const USCITA = 220;      // durata dell'uscita, in ms
const RIENTRO = 260;     // durata del rientro quando il gesto non basta
const ATTIVAZIONE = 8;   // px di tolleranza prima di decidere la direzione

const SOGLIA_X = 55;     // px oltre i quali si cambia scheda
const VELOCITA_X = 0.28; // px/ms: basta una sfogliata svelta
const SCORRIMENTO = 190; // durata dell'assestamento laterale

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
  const backdropRef = useRef(null);
  const gesto = useRef(null);
  const dismissRef = useRef(onDismiss);
  const prevRef = useRef(onPrev);
  const nextRef = useRef(onNext);
  // In un ref e non nelle dipendenze: i listener si registrano una
  // volta sola e devono leggere il valore aggiornato a metà gesto.
  const puo = useRef({ prev: canPrev, next: canNext });
  const uscendo = useRef(false); // chiusura partita: ignoro il resto
  const timerSlitta = useRef(null);
  const attesa = useRef(null); // ultimo punto da dipingere
  const frame = useRef(0);

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

  useEffect(() => () => {
    clearTimeout(timerSlitta.current);
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  /* Un solo disegno per frame, anche se i touchmove sono di più
     (su certi schermi arrivano a 120 al secondo). */
  const dipingi = useCallback(() => {
    frame.current = 0;
    const punto = attesa.current;
    const el = trackRef.current;
    if (!punto || !el) return;

    const progresso = Math.min(1, punto.y / (window.innerHeight * 0.5));
    el.style.transition = 'none';
    el.style.transform =
      `translate3d(calc(-100vw + ${punto.x}px), ${punto.y}px, 0) scale(${1 - progresso * 0.04})`;

    const sfondo = backdropRef.current;
    if (sfondo) {
      sfondo.style.transition = 'none';
      sfondo.style.backgroundColor = `rgba(${backdropColor}, ${backdropAlpha * (1 - progresso)})`;
    }
  }, [backdropColor, backdropAlpha]);

  const muovi = useCallback((x, y) => {
    attesa.current = { x, y };
    if (!frame.current) frame.current = requestAnimationFrame(dipingi);
  }, [dipingi]);

  const fermaDisegno = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    attesa.current = null;
  }, []);

  /* Dove si trova *davvero* la pista in questo istante, animazione in
     corso compresa: lo stato React direbbe solo dove sta andando. */
  const offsetVero = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const tr = getComputedStyle(el).transform;
    if (!tr || tr === 'none') return 0;
    try {
      return new DOMMatrixReadOnly(tr).m41 + window.innerWidth;
    } catch (err) {
      return 0;
    }
  }, []);

  const chiudiTrascinando = useCallback((daY) => {
    uscendo.current = true;
    setDismissing(true);
    setDragging(false);
    setOffset(window.innerHeight);
    setTimeout(() => dismissRef.current?.(), USCITA);
  }, []);

  /* Cambio scheda: prima il contenuto, poi la pista viene rimessa dove
     l'occhio la vede già (di qui il +/- una schermata), infine scorre
     fino a zero. È una transizione sola e la si può interrompere. */
  const cambia = useCallback((direzione, partenza = 0) => {
    const vai = direzione > 0 ? nextRef.current : prevRef.current;
    if (!vai) return;

    const larghezza = window.innerWidth;
    setGrabbed(true);
    setDragging(false);
    setSenzaTransizione(true);
    setOffsetX(partenza + direzione * larghezza);
    vai();

    // Due frame: uno perché il riposizionamento venga dipinto, l'altro
    // perché la transizione riaccesa abbia da dove partire.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef?.current) scrollRef.current.scrollTop = 0;
        setSenzaTransizione(false);
        setSlittando(true);
        setOffsetX(0);
        clearTimeout(timerSlitta.current);
        timerSlitta.current = setTimeout(() => setSlittando(false), SCORRIMENTO);
      });
    });
  }, [scrollRef]);

  const scorri = useCallback((direzione) => cambia(direzione, 0), [cambia]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !enabled) return undefined;

    function onStart(e) {
      if (uscendo.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      // Se la pista sta ancora scorrendo la fermo qui, sotto il dito.
      const base = offsetVero();
      setDragging(true);
      setSlittando(false);
      setOffsetX(base);

      gesto.current = {
        base,
        x: base,
        y: 0,
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
      if (!g || uscendo.current) return;
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
        g.x = g.base + (libero ? dx : dx / 4);
        g.y = 0;
      } else {
        g.x = g.base;
        g.y = Math.max(0, dy - ATTIVAZIONE);
      }

      muovi(g.x, g.y);
    }

    function onEnd() {
      const g = gesto.current;
      gesto.current = null;
      if (!g || uscendo.current) return;
      fermaDisegno();

      if (!g.attivo) {
        // Tocco senza trascinamento: se avevo fermato uno scorrimento
        // a metà, lo lascio arrivare a destinazione.
        setDragging(false);
        setOffsetX(0);
        return;
      }

      /* Da qui in poi torna a comandare React. Le transizioni CSS
         partono dal valore già dipinto, quindi non c'è nessun salto
         tra la posizione del dito e quella dello stato. */
      setDragging(false);

      if (g.asse === 'x') {
        const percorso = g.xPrec - g.x0;
        const direzione = percorso < 0 ? 1 : -1; // sinistra = avanti
        const libero = direzione > 0 ? puo.current.next : puo.current.prev;
        const deciso = Math.abs(percorso) > SOGLIA_X || Math.abs(g.vx) > VELOCITA_X;
        if (libero && deciso) cambia(direzione, g.x);
        else {
          setSlittando(true);
          setOffsetX(0); // rientro morbido
          clearTimeout(timerSlitta.current);
          timerSlitta.current = setTimeout(() => setSlittando(false), SCORRIMENTO);
        }
        return;
      }

      const percorso = g.yPrec - g.y0;
      if (percorso > SOGLIA || g.vy > VELOCITA) chiudiTrascinando(g.y);
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
  }, [enabled, chiudiTrascinando, cambia, offsetVero, muovi, fermaDisegno, scrollRef]);

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
        : `transform ${durata}ms cubic-bezier(0.22, 0.9, 0.28, 1)`,
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

  return {
    trackRef,
    backdropRef,
    trackStyle,
    backdropStyle,
    grabbed,
    dragging,
    dismissing,
    scorri,
  };
}

export default useSwipeDown;