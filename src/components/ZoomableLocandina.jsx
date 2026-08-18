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
   • Momentum al rilascio del pan: la locandina continua a
     scorrere con decadimento esponenziale della velocità,
     fermandosi contro i bordi.
   • Doppio tocco / doppio click: toggle tra fit e 2x,
     centrato dove si è toccato.
   • A scala 1 lascia passare il tocco singolo al parent, così
     lo swipe-down-per-chiudere e lo sfoglio laterale
     (useSwipeDown) continuano a funzionare come prima.
--------------------------------------------------------- */

const SCALA_MIN = 1;
const SCALA_MAX = 4;
const SCALA_DOPPIO_TAP = 2;
const DOPPIO_TAP_MS = 280;
const DURATA_ZOOM = 220;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/* Frizione applicata alla velocità ad ogni ms: dopo ~138ms la velocità
   dimezza (0.995^138 ≈ 0.5). Alza a 0.997 per glide più lungo, abbassa
   a 0.990 per uno stop più rapido. */
const FRIZIONE_PER_MS = 0.990;
/* Sotto questa velocità (px/ms) il momentum si ferma. 0.02 ≈ 1.2 px/frame
   a 60fps: sotto è impercettibile. */
const VEL_MIN = 0.02;
/* Cap sulla velocità iniziale: uno swipe furioso non deve partire "a razzo"
   e uscire dai bordi in un frame prima che il clamp la fermi. */
const VEL_MAX = 3;
/* Finestra temporale (ms) da cui prelevare i campioni per stimare la
   velocità al rilascio. Solo la coda del gesto conta: se l'utente si
   ferma prima di rilasciare, la velocità stimata deve essere zero, non
   una media annacquata di tutto lo swipe. */
const VEL_FINESTRA_MS = 100;

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
  const imgRef = useRef(null);

  const trasformo = useRef({ s: 1, x: 0, y: 0 });
  const [zoomato, setZoomato] = useState(false);
  const gesto = useRef(null);
  const ultimoTap = useRef(0);
  const frame = useRef(0);
  const attesa = useRef(null);

  /* Momentum state:
     - campioniVel: gli ultimi ~6 campioni {x, y, t} del dito durante il pan
     - momentumRAF: handle del loop rAF in corso (per cancellarlo)
     - momentumStato: {vx, vy, tLast} della velocità che sta decadendo */
  const campioniVel = useRef([]);
  const momentumRAF = useRef(0);
  const momentumStato = useRef(null);

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
    el.style.transition = anima
      ? `transform ${DURATA_ZOOM}ms ${EASING}, opacity 320ms ease-out`
      : `transform 0s, opacity 320ms ease-out`;
    if (!frame.current) frame.current = requestAnimationFrame(dipingi);
  }, [dipingi]);

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

  /* -------- Momentum ---------- */

  const fermaMomentum = useCallback(() => {
    if (momentumRAF.current) {
      cancelAnimationFrame(momentumRAF.current);
      momentumRAF.current = 0;
    }
    momentumStato.current = null;
  }, []);

  const stepMomentum = useCallback(() => {
    const st = momentumStato.current;
    if (!st) return;
    const now = performance.now();
    const dt = Math.max(1, now - st.tLast);
    st.tLast = now;

    // Decadimento time-based: stesso feel a 60Hz e a 120Hz.
    const decay = Math.pow(FRIZIONE_PER_MS, dt);
    st.vx *= decay;
    st.vy *= decay;

    const nx = trasformo.current.x + st.vx * dt;
    const ny = trasformo.current.y + st.vy * dt;

    // Clamp sui bordi. Se un asse è stato bloccato dal clamp, azzero la
    // velocità su quell'asse — evita che continui a spingere contro il
    // bordo per frame prolungando inutilmente il rAF loop.
    const clamped = clampPan({ s: trasformo.current.s, x: nx, y: ny });
    if (clamped.x !== nx) st.vx = 0;
    if (clamped.y !== ny) st.vy = 0;

    scriviTrasformo(clamped);

    if (Math.abs(st.vx) < VEL_MIN && Math.abs(st.vy) < VEL_MIN) {
      fermaMomentum();
      return;
    }
    momentumRAF.current = requestAnimationFrame(stepMomentum);
  }, [clampPan, scriviTrasformo, fermaMomentum]);

  const avviaMomentum = useCallback((vx, vy) => {
    fermaMomentum();
    // Cap sulla magnitudine, preservando la direzione.
    const mag = Math.hypot(vx, vy);
    if (mag > VEL_MAX) {
      vx = (vx / mag) * VEL_MAX;
      vy = (vy / mag) * VEL_MAX;
    }
    if (Math.abs(vx) < VEL_MIN && Math.abs(vy) < VEL_MIN) return;
    momentumStato.current = { vx, vy, tLast: performance.now() };
    momentumRAF.current = requestAnimationFrame(stepMomentum);
  }, [fermaMomentum, stepMomentum]);

  /* ---------------------------- */

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
    const nx = -(clientX - cx) * (s - 1);
    const ny = -(clientY - cy) * (s - 1);
    scriviTrasformo(clampPan({ s, x: nx, y: ny }), { anima: true });
    setZoomato(true);
  }, [scriviTrasformo, clampPan]);

  useEffect(() => {
    if (attivo) return;
    if (trasformo.current.s === 1 && trasformo.current.x === 0 && trasformo.current.y === 0) return;
    fermaMomentum();
    scriviTrasformo({ s: 1, x: 0, y: 0 });
    setZoomato(false);
  }, [attivo, scriviTrasformo, fermaMomentum]);

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap || !attivo || !supportaTouch) return undefined;

    function onStart(e) {
      // Nuovo tocco = ferma qualunque momentum in corso. Senza questo,
      // touch e rAF loop combatterebbero per la posizione dell'img.
      fermaMomentum();

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

      if (ora - ultimoTap.current < DOPPIO_TAP_MS) {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        ultimoTap.current = 0;
        gesto.current = null;
        doppioTap(t.clientX, t.clientY);
        return;
      }
      ultimoTap.current = ora;

      if (trasformo.current.s > 1.001) {
        e.stopPropagation();
        gesto.current = {
          tipo: 'pan',
          x0: t.clientX,
          y0: t.clientY,
          tx0: trasformo.current.x,
          ty0: trasformo.current.y,
        };
        // Inizializzo la finestra dei campioni con la posizione iniziale.
        campioniVel.current = [{ x: t.clientX, y: t.clientY, t: ora }];
        return;
      }
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
        const s = clamp(g.s0 * rapporto, SCALA_MIN * 0.7, SCALA_MAX);

        const wrap = wrapperRef.current;
        const r = wrap.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const focoX = (g.m0.x - cx - g.x0) / g.s0;
        const focoY = (g.m0.y - cy - g.y0) / g.s0;
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
        // Traccia il campione per stimare la velocità al rilascio.
        // Buffer corto (6 elementi): la finestra utile è ~100ms, e a 60fps
        // sono 6 campioni.
        campioniVel.current.push({ x: t.clientX, y: t.clientY, t: performance.now() });
        if (campioniVel.current.length > 6) campioniVel.current.shift();
      }
    }

    function onEnd(e) {
      const g = gesto.current;
      if (!g) return;

      if (g.tipo === 'pinch' && e.touches.length === 1) {
        const t = e.touches[0];
        gesto.current = {
          tipo: 'pan',
          x0: t.clientX,
          y0: t.clientY,
          tx0: trasformo.current.x,
          ty0: trasformo.current.y,
        };
        campioniVel.current = [{ x: t.clientX, y: t.clientY, t: performance.now() }];
        return;
      }

      if (e.touches.length > 0) return;
      const eraPan = g.tipo === 'pan';
      gesto.current = null;

      if (trasformo.current.s < 1) {
        scriviTrasformo({ s: 1, x: 0, y: 0 }, { anima: true });
        setZoomato(false);
        return;
      }

      // Momentum solo per pan-end. Calcolo la velocità sull'ultima finestra
      // di ~100ms — se l'utente si è fermato prima di rilasciare, la finestra
      // conterrà pochi movimenti e la velocità sarà bassa (giusto così: nessun
      // scatto in avanti dopo che l'ho fermato con le dita).
      if (eraPan) {
        const now = performance.now();
        const recenti = campioniVel.current.filter((s) => now - s.t <= VEL_FINESTRA_MS);
        if (recenti.length >= 2) {
          const first = recenti[0];
          const last = recenti[recenti.length - 1];
          const dt = Math.max(1, last.t - first.t);
          const vx = (last.x - first.x) / dt;
          const vy = (last.y - first.y) / dt;
          avviaMomentum(vx, vy);
        }
        campioniVel.current = [];
      }

      // Se non partisse il momentum (velocità troppo bassa), l'img può
      // essere già leggermente oltre i bordi per via del pan finale:
      // clamp con animazione per il "settle".
      if (!momentumStato.current) {
        const clamped = clampPan(trasformo.current);
        if (clamped.x !== trasformo.current.x || clamped.y !== trasformo.current.y) {
          scriviTrasformo(clamped, { anima: true });
        }
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
  }, [attivo, supportaTouch, scriviTrasformo, clampPan, doppioTap, fermaMomentum, avviaMomentum]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    if (momentumRAF.current) cancelAnimationFrame(momentumRAF.current);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        display: 'inline-block',
        lineHeight: 0,
        touchAction: supportaTouch && zoomato ? 'none' : 'pan-y',
        cursor: supportaTouch ? (zoomato ? 'grab' : 'zoom-in') : 'default',
      }}
    >
      <LazyImage {...propsLazyImage} />
    </div>
  );
}