import React, { useCallback, useEffect, useRef, useState } from 'react';
import LazyImage from './ui/LazyImage';

/* ---------------------------------------------------------
   ZoomableLocandina — pinch/pan direttamente sulla locandina
   dentro il dettaglio del torneo, senza aprire un visore
   a parte.

   Cosa fa:
   • Pinch a due dita sulla locandina: la scala l'img (non il
     wrapper), fino a 4x, con il punto medio delle dita fermo
     sotto di loro — il classico "zoom sotto il dito".
   • Trascinamento a un dito quando siamo zoomati: pan sulla
     porzione visibile, con clamp sui bordi.
   • Doppio tocco / doppio click: toggle tra fit e 2x,
     centrato dove si è toccato.
   • A scala 1 lascia passare il tocco singolo al parent, così
     lo swipe-down-per-chiudere e lo sfoglio laterale
     (useSwipeDown) continuano a funzionare come prima.

   Perché scalare l'img e non il wrapper: il wrapper interno
   di LazyImage ha overflow:hidden e dimensioni fisse pari
   alla locandina in flusso. Trasformando l'img, la porzione
   ingrandita viene ritagliata dallo slot — vediamo davvero
   il dettaglio a più alta risoluzione, non il "vecchio
   pixel-art" scalato di brutto (che è quello che
   accadrebbe transformando il wrapper).

   Perché non serve un "portal" o un modale a parte: il
   parent useSwipeDown ignora già i touchstart con 2 dita,
   e quando siamo zoomati fermiamo noi la propagazione dei
   touch singoli — così il pan non viene interpretato come
   swipe di sfoglio o di chiusura.

   `attivo=false` (card laterale nella pista di 3) disattiva
   i gesti e resetta la scala: quando si torna sulla card
   la locandina è di nuovo a 1x, come appena aperta.
--------------------------------------------------------- */

const SCALA_MIN = 1;
const SCALA_MAX = 4;
const SCALA_DOPPIO_TAP = 2;
const DOPPIO_TAP_MS = 280;
const DURATA_ZOOM = 220;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function distanza(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function medio(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export default function ZoomableLocandina({ attivo = true, className, ...propsLazyImage }) {
  const wrapperRef = useRef(null);
  // L'img vera dentro LazyImage: la becchiamo con querySelector una
  // sola volta a mount. LazyImage non re-monta l'img al cambio di src.
  const imgRef = useRef(null);

  const trasformo = useRef({ s: 1, x: 0, y: 0 });
  const [zoomato, setZoomato] = useState(false);
  const gesto = useRef(null);
  const ultimoTap = useRef(0);
  const frame = useRef(0);
  const attesa = useRef(null);

  /* Zoom solo su mobile / dispositivi touch. Su desktop il puntatore
     non ha modo di fare pinch, e il cursor "zoom-in" avrebbe promesso
     una funzione che non esiste. `pointer: coarse` intercetta touch
     e stylus; il fallback `ontouchstart` copre i browser vecchi. */
  const [supportaTouch, setSupportaTouch] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(pointer: coarse)');
    setSupportaTouch(Boolean(mq?.matches) || 'ontouchstart' in window);
    if (!mq?.addEventListener) return undefined;
    const onChange = (e) => setSupportaTouch(e.matches || 'ontouchstart' in window);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    imgRef.current = wrapperRef.current?.querySelector('img') || null;
  }, []);

  const dipingi = useCallback(() => {
    frame.current = 0;
    const el = imgRef.current;
    if (!el || !attesa.current) return;
    const { s, x, y } = attesa.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  }, []);

  const scriviTrasformo = useCallback((t, { anima = false } = {}) => {
    trasformo.current = t;
    attesa.current = t;
    const el = imgRef.current;
    if (!el) return;
    /* Preservo la transizione di opacity di LazyImage (il fade-in di
       ingresso): la specifico esplicitamente insieme a transform così
       non la spengo quando metto transition:none per il drag. */
    el.style.transition = anima
      ? `transform ${DURATA_ZOOM}ms ${EASING}, opacity 320ms ease-out`
      : `transform 0s, opacity 320ms ease-out`;
    if (!frame.current) frame.current = requestAnimationFrame(dipingi);
  }, [dipingi]);

  /* Clamp del pan: l'img non deve mai lasciare la slot scoperta —
     i suoi bordi non entrano dentro il rettangolo del wrapper. Sotto
     scala 1 non c'è pan (l'img è più piccola dello slot). */
  const clampPan = useCallback(({ s, x, y }) => {
    const el = imgRef.current;
    const wrap = wrapperRef.current;
    if (!el || !wrap) return { s, x, y };
    const rWrap = wrap.getBoundingClientRect();
    const w = el.clientWidth * s;
    const h = el.clientHeight * s;
    const maxX = Math.max(0, (w - rWrap.width) / 2);
    const maxY = Math.max(0, (h - rWrap.height) / 2);
    return { s, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  const doppioTap = useCallback((clientX, clientY) => {
    if (trasformo.current.s > 1.001) {
      scriviTrasformo({ s: 1, x: 0, y: 0 }, { anima: true });
      setZoomato(false);
      return;
    }
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const s = SCALA_DOPPIO_TAP;
    // Per tenere il punto toccato sotto il dito, con trasf. iniziale identity:
    // new_x = -(clientX - cx) * (s - 1).
    const nx = -(clientX - cx) * (s - 1);
    const ny = -(clientY - cy) * (s - 1);
    scriviTrasformo(clampPan({ s, x: nx, y: ny }), { anima: true });
    setZoomato(true);
  }, [scriviTrasformo, clampPan]);

  // Se la card esce dalla vista (attivo=false), resetto lo zoom senza animare.
  useEffect(() => {
    if (attivo) return;
    if (trasformo.current.s === 1 && trasformo.current.x === 0 && trasformo.current.y === 0) return;
    scriviTrasformo({ s: 1, x: 0, y: 0 });
    setZoomato(false);
  }, [attivo, scriviTrasformo]);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap || !attivo || !supportaTouch) return undefined;

    function onStart(e) {
      // Pinch a due dita: prendo io la scena, così useSwipeDown non
      // scambia una pinch che parte "sbilenca" per l'inizio di uno swipe.
      if (e.touches.length === 2) {
        e.stopPropagation();
        ultimoTap.current = 0;
        const [a, b] = [e.touches[0], e.touches[1]];
        gesto.current = {
          tipo: 'pinch',
          d0: distanza(a, b),
          m0: medio(a, b),
          s0: trasformo.current.s,
          x0: trasformo.current.x,
          y0: trasformo.current.y,
        };
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const ora = performance.now();

      // Doppio tap (2 tocchi rapidi allo stesso posto): zoom sul punto.
      if (ora - ultimoTap.current < DOPPIO_TAP_MS) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault(); // sopprime il click sintetico
        ultimoTap.current = 0;
        gesto.current = null;
        doppioTap(t.clientX, t.clientY);
        return;
      }
      ultimoTap.current = ora;

      // Zoomato + un dito: parte il pan e blocco il parent (niente sfoglio).
      if (trasformo.current.s > 1.001) {
        e.stopPropagation();
        gesto.current = {
          tipo: 'pan',
          x0: t.clientX,
          y0: t.clientY,
          tx0: trasformo.current.x,
          ty0: trasformo.current.y,
        };
        return;
      }

      /* Non zoomato + un dito: lascio andare l'evento al parent, così
         swipe-down-per-chiudere e sfoglio laterale continuano a
         funzionare toccando la locandina. */
    }

    function onMove(e) {
      const g = gesto.current;
      if (!g) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (g.tipo === 'pinch' && e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = distanza(a, b);
        const m = medio(a, b);
        const rapporto = d / (g.d0 || 1);
        // Overshoot leggero sotto 1x: dà il rimbalzo a fine gesto.
        const s = clamp(g.s0 * rapporto, SCALA_MIN * 0.7, SCALA_MAX);

        const wrap = wrapperRef.current;
        const r = wrap.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Coordinate del punto medio iniziale nel sistema "immagine".
        const focoX = (g.m0.x - cx - g.x0) / g.s0;
        const focoY = (g.m0.y - cy - g.y0) / g.s0;
        // Nuova traslazione perché il foco resti sotto le dita (ora in m).
        const x = m.x - cx - focoX * s;
        const y = m.y - cy - focoY * s;
        scriviTrasformo({ s, x, y });
        return;
      }

      if (g.tipo === 'pan' && e.touches.length === 1) {
        const t = e.touches[0];
        scriviTrasformo(clampPan({
          s: trasformo.current.s,
          x: g.tx0 + (t.clientX - g.x0),
          y: g.ty0 + (t.clientY - g.y0),
        }));
      }
    }

    function onEnd(e) {
      const g = gesto.current;
      if (!g) return;

      // Fine pinch mentre un dito resta a terra: passo a pan senza salti.
      if (g.tipo === 'pinch' && e.touches.length === 1) {
        const t = e.touches[0];
        gesto.current = {
          tipo: 'pan',
          x0: t.clientX,
          y0: t.clientY,
          tx0: trasformo.current.x,
          ty0: trasformo.current.y,
        };
        return;
      }

      if (e.touches.length > 0) return;
      gesto.current = null;

      // Sotto 1x torna a fit centrato in transizione (rimbalzo).
      if (trasformo.current.s < 1) {
        scriviTrasformo({ s: 1, x: 0, y: 0 }, { anima: true });
        setZoomato(false);
        return;
      }
      // Riallineamento finale del pan sui bordi.
      const clamped = clampPan(trasformo.current);
      if (clamped.x !== trasformo.current.x || clamped.y !== trasformo.current.y) {
        scriviTrasformo(clamped, { anima: true });
      }
      setZoomato(trasformo.current.s > 1.001);
    }

    wrap.addEventListener('touchstart', onStart, { passive: false });
    wrap.addEventListener('touchmove', onMove, { passive: false });
    wrap.addEventListener('touchend', onEnd);
    wrap.addEventListener('touchcancel', onEnd);
    return () => {
      wrap.removeEventListener('touchstart', onStart);
      wrap.removeEventListener('touchmove', onMove);
      wrap.removeEventListener('touchend', onEnd);
      wrap.removeEventListener('touchcancel', onEnd);
    };
  }, [attivo, supportaTouch, scriviTrasformo, clampPan, doppioTap]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <div
      ref={wrapperRef}
      /* La className arriva sul wrapper esterno (di solito "rounded-lg
         shadow"): è quella che tiene border-radius e box-shadow. Il
         wrapper di LazyImage sotto ha `border-radius: inherit` e trova
         il valore qui — se la mettessi anche su LazyImage non
         cambierebbe nulla di visibile ma finirebbe con lo shadow
         raddoppiato. */
      className={className}
      style={{
        /* inline-block: il wrapper si stringe intorno alla locandina, così
           il suo bounding rect coincide con quello dell'img (la mia
           matematica del pinch usa il centro del wrapper come riferimento). */
        display: 'inline-block',
        /* line-height: 0 chiude il classico "descender gap" degli
           inline-block: senza, il line box del wrapper aggiungeva ~4px
           sotto la locandina per riservare lo spazio dei descender del
           font, e quei 4px trasparenti mostravano il bg bianco del
           pannello come una banda bianca in fondo alla locandina. */
        lineHeight: 0,
        /* Su mobile: a scala 1 lascio decidere al browser (utile per lo
           swipe del parent); da zoomati blocco tutto e me la gestisco io.
           Su desktop lo zoom non c'è, quindi comportamento standard. */
        touchAction: supportaTouch && zoomato ? 'none' : 'pan-y',
        /* Il cursor "zoom-in" prometterebbe una funzione che su desktop
           non esiste: lo mostro solo dove il pinch è davvero possibile. */
        cursor: supportaTouch ? (zoomato ? 'grab' : 'zoom-in') : 'default',
      }}
    >
      <LazyImage {...propsLazyImage} />
    </div>
  );
}