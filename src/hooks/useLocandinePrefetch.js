import { useEffect } from 'react';

/* ---------------------------------------------------------
   useLocandinePrefetch — precarica in background tutte le
   locandine della lista.

   Perché: senza questo hook, ogni locandina viene scaricata
   solo quando la sua card entra nel viewport (loading="lazy"
   di LazyImage) o quando si apre la card detail. Risultato:
   scrolling che rivela immagini "vuote", detail che si apre
   con placeholder + fade.

   Cosa fa: appena i tornei sono in memoria, crea un `Image()`
   fuori-DOM per ogni URL di locandina e ne setta la `src`. Il
   browser scarica, mette in cache, tiene le connessioni pool
   (max ~6 in parallelo per origine — Firebase Storage). Quando
   LazyImage renderizza la stessa src, la trova già in cache:
   `img.complete` è true al mount, `detectStatus` promuove
   direttamente a 'ready' e non parte alcun fade.

   `fetchPriority = 'low'`: queste immagini sono in background,
   non devono competere con eventuali risorse critiche che il
   browser sta caricando (JS, CSS, immagini visibili "eager").

   Costo: banda. Con 50 tornei da ~200 KB fanno ~10 MB. Per un
   sito di tornei con lista contenuta è accettabile; se un giorno
   la lista diventa enorme, aggiungi una soglia (es. prefetch
   solo dei primi N) o un requestIdleCallback per aspettare che
   il browser sia idle prima di partire.
--------------------------------------------------------- */
export function useLocandinePrefetch(tournaments) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!tournaments || tournaments.length === 0) return undefined;

    // Set: se due tornei condividessero la stessa URL (raro ma possibile)
    // non facciamo due download separati.
    const urls = new Set();
    tournaments.forEach((t) => {
      if (t.locandina) urls.add(t.locandina);
    });
    if (urls.size === 0) return undefined;

    /* requestIdleCallback: aspetto che il browser abbia finito le cose
       importanti (primo paint, listener, layout) prima di lanciare i
       download in background. Fallback a setTimeout dove non c'è
       (Safari fino alla 16.4 non lo supportava). */
    const richiedi = window.requestIdleCallback
      || ((cb) => window.setTimeout(cb, 200));
    const cancella = window.cancelIdleCallback
      || window.clearTimeout;

    const images = [];
    const handle = richiedi(() => {
      urls.forEach((url) => {
        const img = new Image();
        img.decoding = 'async';
        // fetchPriority è recente ma safe: browser vecchi lo ignorano.
        img.fetchPriority = 'low';
        img.src = url;
        images.push(img);
      });
    }, { timeout: 2000 });

    return () => {
      cancella(handle);
      /* Non svuoto le src: se il download è a metà lo abortirei
         sprecando la banda già consumata. Meglio lasciar completare —
         una volta in cache resta comunque utile alla prossima visita. */
    };
  }, [tournaments]);
}

export default useLocandinePrefetch;
