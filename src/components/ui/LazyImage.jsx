import React, { useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------
   LazyImage — immagine che entra in scena senza far
   aspettare la card.

   La card intorno si disegna subito con la sua struttura;
   qui dentro riserviamo lo spazio giusto per l'immagine e
   mostriamo uno "skeleton" morbido (una tinta con un lieve
   riflesso che passa). L'immagine vera parte in background
   e, quando è pronta, entra in dissolvenza sopra lo
   skeleton — così la lista è già leggibile e le locandine
   arrivano dopo, senza scatti.

   Due modi di riservare lo spazio:
   • `aspectRatio` fisso (es. "3 / 4") — il contenitore ha
     dimensioni note prima ancora del download. Ideale nelle
     card di lista, dove la forma dev'essere uniforme.
   • Senza `aspectRatio` — l'altezza la decide l'immagine
     quando arriva; lo skeleton copre solo lo slot già
     dimensionato dal chiamante (es. detail con maxHeight).

   `eager` forza il download subito (per le prime card
   sopra la piega o per la scheda in primo piano nel
   dettaglio). `onUnavailable` avvisa il chiamante quando
   non c'è niente da mostrare: la card può nascondere
   l'intero slot.
--------------------------------------------------------- */

/* URL già caricate in questa sessione: se riapriamo la stessa
   card la locandina è già in memoria, quindi partiamo da
   'ready' e saltiamo lo skeleton + il fade. Senza questo, ogni
   apertura del detail rifaceva la dissolvenza anche quando
   l'immagine era servita istantaneamente dalla cache. */
const READY_SRCS = new Set();

function detectStatus(src) {
  if (!src) return 'missing';
  if (READY_SRCS.has(src)) return 'ready';
  /* Extra: se il browser ha già l'immagine in cache di memoria
     (l'utente l'ha vista prima in un'altra scheda o pagina),
     un Image() con quella src risulta subito `complete`. Ci
     evita il fade anche la prima volta che LazyImage la vede. */
  if (typeof Image !== 'undefined') {
    try {
      const probe = new Image();
      probe.src = src;
      if (probe.complete && probe.naturalWidth > 0) {
        READY_SRCS.add(src);
        return 'ready';
      }
    } catch {
      /* niente, ripieghiamo su 'loading' */
    }
  }
  return 'loading';
}

export default function LazyImage({
  src,
  alt,
  className = '',
  imgClassName = '',
  style,
  imgStyle,
  placeholderColor = 'rgba(34,48,31,0.08)',
  aspectRatio,
  eager = false,
  onUnavailable,
  onReady,
}) {
  const [status, setStatus] = useState(() => detectStatus(src)); // 'loading' | 'ready' | 'error' | 'missing'
  const imgRef = useRef(null);
  /* Ricordo la src del primo render: l'effetto sotto non deve
     sovrascrivere lo stato iniziale (che magari è già 'ready'
     grazie alla cache) — solo un vero cambio di src richiede il
     reset a 'loading'. */
  const prevSrcRef = useRef(src);

  useEffect(() => {
    if (prevSrcRef.current === src) return;
    prevSrcRef.current = src;
    setStatus(detectStatus(src));
  }, [src]);

  /* Safety net: se al momento del layout l'img è già `complete`
     (cache che il probe non ha intercettato), promuovi lo stato.
     È no-op se siamo già 'ready'. */
  useEffect(() => {
    if (!src) return;
    const el = imgRef.current;
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      READY_SRCS.add(src);
      setStatus((s) => (s === 'ready' ? s : 'ready'));
      onReady?.();
    }
  }, [src, onReady]);

  /* Avvisa il chiamante quando non c'è niente da mostrare: così
     la card può decidere di nascondere del tutto lo slot poster. */
  useEffect(() => {
    if (status === 'missing' || status === 'error') onUnavailable?.();
  }, [status, onUnavailable]);

  if (!src || status === 'error') return null;

  const hasFixedRatio = Boolean(aspectRatio);
  const wrapperStyle = {
    ...(hasFixedRatio ? { aspectRatio } : null),
    ...style,
  };

  /* Se partiamo già 'ready' (cache) niente transizione: se ne
     accendessimo una, il primo paint la farebbe suonare comunque
     su alcuni browser. Meglio disattivarla proprio quando non
     serve. */
  const skipTransition = status === 'ready' && !imgRef.current;

  return (
    <div
      className={`lazy-image ${status === 'ready' ? 'is-ready' : ''} ${className}`}
      style={wrapperStyle}
    >
      {status !== 'ready' && (
        <div
          className="lazy-image__skeleton"
          style={{ backgroundColor: placeholderColor }}
          aria-hidden="true"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'low'}
        onLoad={() => {
          READY_SRCS.add(src);
          setStatus('ready');
          onReady?.();
        }}
        onError={() => setStatus('error')}
        className={`lazy-image__img ${hasFixedRatio ? 'lazy-image__img--fill' : ''} ${imgClassName}`}
        style={{
          opacity: status === 'ready' ? 1 : 0,
          transition: skipTransition ? 'none' : undefined,
          ...imgStyle,
        }}
      />
    </div>
  );
}