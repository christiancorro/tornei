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

   Stile "preview app iOS/Android": la sola card che sta
   uscendo si rimpicciolisce mentre si allontana; quella che
   entra resta a dimensione piena. Per farlo la scala non
   sta sul track (che scalerebbe tutte e tre insieme) ma
   sullo slot uscente, e cambia identità quando cambia scheda
   (mentre il dito è giù è il centrale, dopo il cambio è il
   laterale in cui è finita la vecchia scheda).

   Due scelte tengono il gesto fluido:

   1. Mentre il dito è giù non si passa da React. Ogni
      touchmove scriverebbe uno stato e farebbe ridisegnare
      tre schede intere: a 60fps non ce la fa. Qui il
      trasformo va dritto sul nodo, una volta per frame
      (requestAnimationFrame), e lo stato React si aggiorna
      solo quando il dito si stacca.
   2. Il cambio di scheda avviene appena il dito si stacca:
      la pista viene riposizionata di una schermata e la
      scheda uscente compare al lato "giusto" con la stessa
      scala che aveva sotto il dito — nessun salto visivo.

   La chiusura "classica" (X, backdrop, Esc) resta a
   useModalClose: qui dentro non c'entra.

   Uso:
     const { trackRef, backdropRef, trackStyle, backdropStyle,
             panelStyle, grabbed, scorri } =
       useSwipeDown(onClose, { scrollRef, onNext, onPrev, canNext, canPrev });
--------------------------------------------------------- */

const SOGLIA = 110;      // px di trascinamento oltre i quali si chiude
const VELOCITA = 0.55;   // px/ms: uno scatto rapido chiude comunque
const USCITA = 320;      // durata dell'uscita, in ms
const RIENTRO = 460;     // durata del rientro quando il gesto non basta
const ATTIVAZIONE = 1;   // px di tolleranza prima di decidere la direzione

const SOGLIA_X = 64;     // px oltre i quali si cambia scheda
const VELOCITA_X = 0.58; // px/ms: basta una sfogliata svelta
const SCORRIMENTO = 520; // durata dell'assestamento laterale (più morbida)
/* Spazio scuro dello sfondo che compare tra due card durante lo
   swipe laterale. A riposo la card è al centro dello schermo e il
   gap sta tutto fuori dai bordi del viewport (invisibile); appena
   il dito trascina, la card vicina spunta lasciando questo spazio
   tra sé e quella in uscita. */
const SPAZIO_TRA_CARD = 64;
/* Curva "soft-out": parte decisa, rallenta a lungo. Su iOS è
   quella che dà la sensazione di "scivolamento" sotto al dito
   anche dopo il rilascio. */
const EASING_SLIDE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/* Riduzione di scala massima applicata alla card uscente:
   ~5% dà chiaramente l'idea di profondità (come nel selettore
   app) senza sembrare che si sia rotto qualcosa. */
const SCALA_MAX = 0.0;

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
  /* Direzione dell'ultimo cambio scheda (+1 = next, -1 = prev, 0 = idle).
     Serve a sapere in che slot laterale è finita la scheda "uscente"
     dopo il rimescolamento dei dati, così solo lei continua ad avere
     la scala ridotta durante l'assestamento. */
  const [direzioneSlittamento, setDirezioneSlittamento] = useState(0);
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
     (su certi schermi arrivano a 120 al secondo). Qui separiamo
     due scale:
     - verticale (dismiss): sta sul track. Solo il centrale è in
       vista, quindi scalare tutto va bene.
     - orizzontale (sfoglio): sta sullo slot centrale. Le due
       schede vicine, che stanno per entrare, restano a scala 1. */
  const dipingi = useCallback(() => {
    frame.current = 0;
    const punto = attesa.current;
    const el = trackRef.current;
    if (!punto || !el) return;

    const larghezza = window.innerWidth;
    const progressoY = Math.min(1, punto.y / (window.innerHeight * 0.5));
    const progressoX = Math.min(1, Math.abs(punto.x) / (larghezza * 0.5));

    el.style.transition = 'none';
    /* Base della traslazione: -100vw sposta il track di una schermata a
       sinistra così lo slot centrale (l'unico visibile a riposo) sta al
       centro. -SPAZIO_TRA_CARD compensa il gap che il layout flex mette
       tra gli slot: senza, lo slot centrale finirebbe spostato di un gap
       a destra. */
    el.style.transform =
      `translate3d(calc(-100vw - ${SPAZIO_TRA_CARD}px + ${punto.x}px), ${punto.y}px, 0) scale(${1 - progressoY * SCALA_MAX})`;

    // Slot centrale (l'uscente durante il drag orizzontale).
    const centrale = el.children[1];
    if (centrale) {
      centrale.style.transition = 'none';
      // centrale.style.transform = `scale(${1 - progressoX * SCALA_MAX})`;
    }

    const sfondo = backdropRef.current;
    if (sfondo) {
      sfondo.style.transition = 'none';
      sfondo.style.backgroundColor = `rgba(${backdropColor}, ${backdropAlpha * (1 - progressoY)})`;
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
      /* m41 è la componente tx del transform. La base è -100vw - SPAZIO,
         quindi per ottenere il solo offsetX "extra" del drag sommo
         window.innerWidth + SPAZIO. */
      return new DOMMatrixReadOnly(tr).m41 + window.innerWidth + SPAZIO_TRA_CARD;
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
     fino a zero. È una transizione sola e la si può interrompere.

     `direzioneSlittamento` va scritto qui: da questo momento in poi
     lo slot "uscente" non è più il centrale ma quello laterale in
     cui è finita la vecchia scheda dopo il rimescolamento. */
  const cambia = useCallback((direzione, partenza = 0) => {
    const vai = direzione > 0 ? nextRef.current : prevRef.current;
    if (!vai) return;

    const larghezza = window.innerWidth;
    setGrabbed(true);
    setDragging(false);
    setSenzaTransizione(true);
    /* Il salto da fare per portare la scheda entrante al centro è di
       una schermata + un gap: senza il SPAZIO_TRA_CARD si vedrebbe uno
       scatto di un gap alla fine dello sfoglio. */
    setOffsetX(partenza + direzione * (larghezza + SPAZIO_TRA_CARD));
    setDirezioneSlittamento(direzione);
    vai();

    // Due frame: uno perché il riposizionamento venga dipinto, l'altro
    // perché la transizione riaccesa abbia da dove partire.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSenzaTransizione(false);
        setSlittando(true);
        setOffsetX(0);
        clearTimeout(timerSlitta.current);
        timerSlitta.current = setTimeout(() => {
          setSlittando(false);
          setDirezioneSlittamento(0);
        }, SCORRIMENTO);
      });
    });
  }, []);

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
      // Nuovo tocco: dimentico lo slittamento vecchio, il centrale
      // torna a essere l'unico "uscente" possibile.
      setDirezioneSlittamento(0);
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

      if (percorso > SOGLIA || g.vy > VELOCITA) {
        chiudiTrascinando(g.y);
      } else {
        // Durante il drag il transform è stato scritto direttamente sul DOM.
        // Prima allineo React alla posizione effettiva, poi torno a zero
        // lasciando che la transizione CSS animi il rientro.
        setOffset(g.y);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOffset(0);
          });
        });
      }
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
  const progressoY = Math.min(1, offset / (altezza * 0.5));

  const durata = dismissing ? USCITA : slittando ? SCORRIMENTO : RIENTRO;

  /* La pista è larga tre schermate e sta ferma sulla seconda: da qui
     il -100vw fisso, a cui il dito somma il suo spostamento. La scala
     orizzontale non sta più qui — ora vive sul singolo slot.
     `gap` mette una fascia di sfondo scuro tra due card durante lo
     sfoglio; il -SPAZIO_TRA_CARD nel translate compensa il fatto che
     il gap sposta lo slot centrale a destra di un gap. */
  const trackStyle = {
    transform: `translate3d(calc(-100vw - ${SPAZIO_TRA_CARD}px + ${offsetX}px), ${offset}px, 0)`,
    transition:
      dragging || senzaTransizione
        ? 'none'
        : `transform ${durata}ms ${EASING_SLIDE}`,
    willChange: 'transform',
    touchAction: 'pan-y',
    overscrollBehavior: 'contain',
    gap: `${SPAZIO_TRA_CARD}px`,
  };

  /* Stile del singolo slot (0=precedente, 1=attuale, 2=prossimo).
     Regola: solo la card "uscente" scala; le altre restano a piena
     dimensione, così l'entrante non "cresce" mentre arriva al centro.
     - Durante il drag l'uscente è il centrale (relativo 0).
     - Dopo cambia() l'uscente è il laterale in cui è finita la
       vecchia scheda: -1 se stiamo andando avanti, +1 se indietro. */
  const panelStyle = useCallback((slotIndex) => {
    const relativo = slotIndex - 1; // -1, 0, +1

    let uscenteRelativo = null;
    if (dragging) {
      uscenteRelativo = 0;
    } else if (direzioneSlittamento !== 0) {
      uscenteRelativo = direzioneSlittamento > 0 ? -1 : 1;
    }

    const transitionValue =
      dragging || senzaTransizione
        ? 'none'
        : `transform ${SCORRIMENTO}ms ${EASING_SLIDE}`;

    if (relativo === uscenteRelativo) {
      /* Scala calcolata dalla distanza dello slot dal centro dello
         schermo: allontanarsi = rimpicciolire (fino a SCALA_MAX). Al
         momento dello snap post-cambia questo valore coincide con
         quello dipinto durante il drag, quindi non c'è salto.
         La distanza tra i centri di due slot vicini è larghezza + gap,
         non solo larghezza — senza SPAZIO_TRA_CARD la scala si
         azzererebbe un po' prima del tempo. */
      const larghezza = typeof window === 'undefined' ? 1200 : window.innerWidth;
      const posizione = relativo * (larghezza + SPAZIO_TRA_CARD) + offsetX;
      const distanza = Math.abs(posizione);
      const progresso = Math.min(1, distanza / (larghezza * 0.5));
      return {
        // transform: `scale(${1 - progresso * SCALA_MAX})`,
        transition: transitionValue,
        willChange: 'transform',
      };
    }

    /* Non uscente: scala esplicita a 1 così, se il DOM node aveva un
       transform precedente (dipingi durante drag), la transizione la
       riporta morbidamente a piena dimensione. */
    return {
      // transform: 'scale(1)',
      transition: transitionValue,
    };
  }, [dragging, direzioneSlittamento, offsetX, senzaTransizione]);

  // Lo sfondo si schiarisce cambiando alpha, non opacity: `opacity` sul
  // contenitore sbiadirebbe anche il pannello, che invece deve restare pieno.
  const backdropStyle = {
    backgroundColor: `rgba(${backdropColor}, ${backdropAlpha * (1 - progressoY)})`,
    transition: dragging ? 'none' : `background-color ${dismissing ? USCITA : RIENTRO}ms ease-out`,
  };

  return {
    trackRef,
    backdropRef,
    trackStyle,
    panelStyle,
    backdropStyle,
    grabbed,
    dragging,
    dismissing,
    scorri,
  };
}

export default useSwipeDown;