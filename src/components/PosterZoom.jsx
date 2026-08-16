import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ---------------------------------------------------------
   PosterZoom — visore a pieno schermo "alla Medium".

   All'apertura la locandina non "appare" al centro: parte
   esattamente dall'ingombro che occupava nella card e si
   allarga con una transizione morbida fino a riempire lo
   schermo, mentre lo sfondo sfuma dietro. Alla chiusura fa
   il percorso inverso e torna nell'incastro della card.

   La tecnica è FLIP: misuriamo il rettangolo di partenza
   (l'elemento originario, passato via `originRef`) e quello
   di arrivo (l'img montata al centro dello schermo).
   Impostiamo un transform invertito che fa "apparire" l'img
   al posto di partenza, poi la lasciamo andare a `identity`
   con una transizione. È lo stesso trucco che usano Medium,
   iOS Foto e la galleria di WhatsApp.

   Gesti supportati sopra al FLIP:
   • pinch a due dita per zoomare fino a 4x, con il punto
     medio delle dita che resta fermo (zoom "sotto le dita").
   • trascinamento a un dito quando siamo zoomati.
   • tap o click ovunque: se siamo a 1x chiude con FLIP
     inverso; se siamo zoomati torna a 1x senza chiudere.
   • rotellina del mouse: chiude (comportamento Medium).
   • Esc e la X in alto a destra: chiudono.

   Vive in un portal su document.body: i touchmove qui
   dentro non arrivano al useSwipeDown della card sotto —
   che altrimenti scambierebbe un pinch per uno sfoglio.
--------------------------------------------------------- */

const SCALA_MIN = 1;
const SCALA_MAX = 4;
const DURATA_FLIP = 320;
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

export default function PosterZoom({ src, alt, onClose, originRef }) {
  const backdropRef = useRef(null);
  const imgRef = useRef(null);

  /* Trasformo corrente (scala + traslazione) applicato all'img rispetto
     alla sua posizione centrata di default. Vive in un ref perché durante
     il gesto scriviamo il transform direttamente sul nodo — a 60/120fps
     non conviene passare da React. Lo stato serve solo alla UI di
     contorno (cursor, opacità dello sfondo). */
  const trasformo = useRef({ s: 1, x: 0, y: 0 });
  const [zoomato, setZoomato] = useState(false);
  const [visibile, setVisibile] = useState(false); // sfondo dentro/fuori
  const gesto = useRef(null);
  const chiusuraInCorso = useRef(false);
  /* Rettangolo naturale dell'img (a scala 1, centrata) misurato al
     FLIP di ingresso: serve per calcolare al volo il FLIP di uscita
     anche se nel frattempo l'utente ha zoomato o pannato. */
  const targetRettRef = useRef(null);
  const frame = useRef(0);
  const attesa = useRef(null);

  const dipingi = useCallback(() => {
    frame.current = 0;
    const el = imgRef.current;
    if (!el || !attesa.current) return;
    const { s, x, y } = attesa.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  }, []);

  const scriviTrasformo = useCallback((t, { anima = false, durata = DURATA_ZOOM } = {}) => {
    trasformo.current = t;
    attesa.current = t;
    const el = imgRef.current;
    if (!el) return;
    el.style.transition = anima ? `transform ${durata}ms ${EASING}` : 'none';
    if (!frame.current) frame.current = requestAnimationFrame(dipingi);
  }, [dipingi]);

  const clampPan = useCallback(({ s, x, y }) => {
    const el = imgRef.current;
    const cont = backdropRef.current;
    if (!el || !cont) return { s, x, y };
    const rCont = cont.getBoundingClientRect();
    const w = el.clientWidth * s;
    const h = el.clientHeight * s;
    const maxX = Math.max(0, (w - rCont.width) / 2);
    const maxY = Math.max(0, (h - rCont.height) / 2);
    return { s, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  /* FLIP di ingresso: parte dall'origine, si assesta al centro. Ci vogliono
     due frame — uno per far dipingere lo stato invertito, l'altro perché
     la transizione riaccesa abbia da dove partire. */
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return undefined;

    let annullato = false;

    function apri() {
      if (annullato) return;
      const originEl = originRef?.current;
      const target = img.getBoundingClientRect();

      // Niente origine (o layout non pronto): salta il FLIP, entra e basta.
      if (!originEl || target.width === 0) {
        setVisibile(true);
        return;
      }

      const origin = originEl.getBoundingClientRect();
      targetRettRef.current = {
        cx: target.left + target.width / 2,
        cy: target.top + target.height / 2,
        w: target.width,
      };

      const s = origin.width / target.width;
      const tx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
      const ty = (origin.top + origin.height / 2) - (target.top + target.height / 2);

      // Stato "F/L invert": l'img sembra ancora nella card.
      img.style.transition = 'none';
      img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
      // Forzo un reflow perché il browser registri lo stato di partenza.
      // eslint-disable-next-line no-unused-expressions
      img.offsetWidth;

      requestAnimationFrame(() => {
        if (annullato) return;
        img.style.transition = `transform ${DURATA_FLIP}ms ${EASING}`;
        img.style.transform = 'translate3d(0, 0, 0) scale(1)';
        trasformo.current = { s: 1, x: 0, y: 0 };
        setVisibile(true);
      });
    }

    if (img.complete && img.naturalWidth > 0) {
      // Immagine già in cache: aspetto un frame per essere sicuro che il
      // layout dell'img (con maxWidth/maxHeight) sia stato calcolato.
      requestAnimationFrame(apri);
    } else {
      img.addEventListener('load', () => requestAnimationFrame(apri), { once: true });
    }

    return () => {
      annullato = true;
    };
  }, [originRef]);

  /* FLIP di uscita: ricalcolo l'origine adesso (la card sotto potrebbe
     essersi spostata mentre il visore era aperto), applico il transform
     di partenza inverso e chiamo onClose dopo la durata dell'animazione. */
  const close = useCallback(() => {
    if (chiusuraInCorso.current) return;
    chiusuraInCorso.current = true;

    const img = imgRef.current;
    const originEl = originRef?.current;
    const target = targetRettRef.current;

    setVisibile(false);

    if (!img || !originEl || !target) {
      // Senza dati per il FLIP inverso: chiusura semplice, in dissolvenza.
      setTimeout(onClose, DURATA_FLIP);
      return;
    }

    const origin = originEl.getBoundingClientRect();
    const s = origin.width / target.w;
    const tx = (origin.left + origin.width / 2) - target.cx;
    const ty = (origin.top + origin.height / 2) - target.cy;

    img.style.transition = `transform ${DURATA_FLIP}ms ${EASING}`;
    img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;

    setTimeout(onClose, DURATA_FLIP);
  }, [onClose, originRef]);

  /* Esc chiude solo il visore, non la card sotto. Capture-phase +
     stopImmediatePropagation così arrivo prima di useModalClose. */
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [close]);

  /* Rotella del mouse = chiudi (comportamento Medium). Un piccolo dead
     zone evita che micro-tremolii del trackpad chiudano per sbaglio. */
  useEffect(() => {
    function onWheel(e) {
      if (Math.abs(e.deltaY) < 5) return;
      close();
    }
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [close]);

  // Blocca lo scroll della pagina sotto mentre il visore è aperto.
  useEffect(() => {
    const prec = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prec; };
  }, []);

  useEffect(() => {
    const cont = backdropRef.current;
    if (!cont) return undefined;

    function onStart(e) {
      if (chiusuraInCorso.current) return;
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        gesto.current = {
          tipo: 'pinch',
          d0: distanza(a, b),
          m0: medio(a, b),
          s0: trasformo.current.s,
          x0: trasformo.current.x,
          y0: trasformo.current.y,
          mosso: false,
        };
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      gesto.current = {
        tipo: 'pan',
        x0: t.clientX,
        y0: t.clientY,
        tx0: trasformo.current.x,
        ty0: trasformo.current.y,
        mosso: false,
      };
    }

    function onMove(e) {
      const g = gesto.current;
      if (!g || chiusuraInCorso.current) return;

      if (g.tipo === 'pinch' && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        g.mosso = true;
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = distanza(a, b);
        const m = medio(a, b);
        const rapporto = d / (g.d0 || 1);
        // Overshoot leggero sotto 1x per il "rimbalzo" a fine gesto.
        const s = clamp(g.s0 * rapporto, SCALA_MIN * 0.7, SCALA_MAX);

        const r = cont.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Punto medio iniziale in coordinate "immagine" (sotto la trasf. iniziale).
        const focoX = (g.m0.x - cx - g.x0) / g.s0;
        const focoY = (g.m0.y - cy - g.y0) / g.s0;
        // Traslazione perché il foco resti sotto le dita (che ora sono in m).
        const x = m.x - cx - focoX * s;
        const y = m.y - cy - focoY * s;
        scriviTrasformo({ s, x, y });
        return;
      }

      if (g.tipo === 'pan' && e.touches.length === 1 && trasformo.current.s > 1.001) {
        if (e.cancelable) e.preventDefault();
        g.mosso = true;
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
          mosso: true, // il pinch è stato un movimento, il tap successivo non conta come tap
        };
        return;
      }

      if (e.touches.length > 0) return;

      const eraMosso = g.mosso;
      gesto.current = null;

      // Sotto 1x torniamo a fit centrato in transizione.
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

      // Tap senza movimento: reset se zoomato, chiudi se a 1x.
      if (!eraMosso) {
        if (trasformo.current.s > 1.001) {
          scriviTrasformo({ s: 1, x: 0, y: 0 }, { anima: true });
          setZoomato(false);
        } else {
          close();
        }
      }
    }

    cont.addEventListener('touchstart', onStart, { passive: false });
    cont.addEventListener('touchmove', onMove, { passive: false });
    cont.addEventListener('touchend', onEnd);
    cont.addEventListener('touchcancel', onEnd);
    return () => {
      cont.removeEventListener('touchstart', onStart);
      cont.removeEventListener('touchmove', onMove);
      cont.removeEventListener('touchend', onEnd);
      cont.removeEventListener('touchcancel', onEnd);
    };
  }, [scriviTrasformo, clampPan, close]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  /* Click (desktop / synthetic da mobile): stessa logica del tap.
     Se il tocco è già stato gestito da touchend, chiusuraInCorso è
     alzato e questa funzione esce subito. */
  const onBackdropClick = useCallback(() => {
    if (chiusuraInCorso.current) return;
    if (zoomato) {
      scriviTrasformo({ s: 1, x: 0, y: 0 }, { anima: true });
      setZoomato(false);
    } else {
      close();
    }
  }, [zoomato, scriviTrasformo, close]);

  const contenuto = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(20, 19, 18, 0.88)',
        opacity: visibile ? 1 : 0,
        transition: `opacity ${DURATA_FLIP}ms ${EASING}`,
        touchAction: 'none',
        cursor: zoomato ? 'zoom-out' : 'zoom-out',
      }}
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); close(); }}
        className="absolute top-3 right-3 p-2 rounded-full text-white z-10"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          touchAction: 'manipulation',
          opacity: visibile ? 1 : 0,
          transition: `opacity ${DURATA_FLIP}ms ${EASING}`,
        }}
        aria-label="Chiudi"
      >
        <X size={22} />
      </button>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="select-none block"
        style={{
          maxWidth: '100vw',
          maxHeight: '100vh',
          transformOrigin: 'center center',
          userSelect: 'none',
          WebkitUserDrag: 'none',
          touchAction: 'none',
          willChange: 'transform',
          cursor: zoomato ? 'zoom-out' : 'zoom-out',
        }}
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(contenuto, document.body);
}