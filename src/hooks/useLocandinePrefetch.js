import { useEffect } from 'react';

/* ---------------------------------------------------------
   useLocandinePrefetch — precarica in background le
   locandine grandi (quelle del dettaglio).

   Divisione dei compiti:
   • Le CARD di lista mostrano il file `locandinaThumb` (~40 KB):
     è piccolo, arriva subito, non serve prefetch — basta il
     loading normale + `eager` per le prime card sopra la piega.
   • Il DETTAGLIO mostra la `locandina` grande (~400 KB). Qui il
     prefetch conta: appena i tornei arrivano da Firestore (cioè
     all'ingresso nel sito, NON al click sulla card) un `Image()`
     fuori-DOM parte in background a priorità bassa. Quando
     l'utente apre una card il file è già in cache, LazyImage la
     vede `complete` e la mostra senza skeleton né fade.

   Perché parto subito (niente requestIdleCallback):
   con l'idle callback il prefetch poteva slittare di 1–2 s su
   telefoni lenti — troppo per uno che apre subito la prima card.
   `fetchPriority = 'low'` fa già il lavoro di "stai indietro":
   il browser scarica prima gli asset critici (JS, CSS, thumb
   visibili) e in parallelo, sui socket liberi, lavora sulle
   locandine grandi. Il risultato è che quando l'utente ha finito
   di guardare la lista e clicca, il grande è già in cache.

   Costo: banda. Con 50 tornei da ~400 KB fanno ~20 MB. Se un
   giorno la lista diventa enorme, aggiungere una soglia (es.
   prefetch solo dei primi N tornei per data o solo dei prossimi
   X giorni).
--------------------------------------------------------- */
export function useLocandinePrefetch(tournaments) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!tournaments || tournaments.length === 0) return undefined;

    // Set: se due tornei condividessero la stessa URL (raro ma possibile)
    // non facciamo due download separati. Prefetch della SOLA versione
    // grande: la thumb è già gestita dal render normale delle card.
    const urls = new Set();
    tournaments.forEach((t) => {
      if (t.locandina) urls.add(t.locandina);
    });
    if (urls.size === 0) return undefined;

    // Parto subito, non aspetto l'idle callback: il browser gestisce da
    // solo l'ordine grazie a fetchPriority='low'. Se aspettassi l'idle,
    // sui telefoni lenti il prefetch slitterebbe abbastanza da farsi
    // battere dal primo click dell'utente su una card.
    const images = [];
    urls.forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      // fetchPriority è recente ma safe: browser vecchi lo ignorano.
      img.fetchPriority = 'low';
      img.src = url;
      images.push(img);
    });

    return () => {
      /* Non svuoto le src: se il download è a metà lo abortirei
         sprecando la banda già consumata. Meglio lasciar completare —
         una volta in cache resta comunque utile alla prossima visita. */
    };
  }, [tournaments]);
}

export default useLocandinePrefetch;