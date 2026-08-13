import { useState, useRef, useEffect, useCallback } from 'react';

/* ---------------------------------------------------------
   useActionState — macchina a stati in tre battute per un
   pulsante che fa await su qualcosa (salva, elimina, invia,
   approva…):

     idle → saving → saved → idle
                        ↳ onDone()

   Perché un hook e non un component ActionButton generico:
   ogni pulsante nell'app ha un suo colore, icona, layout e
   a volte due varianti (con o senza testo). Un component
   generico dovrebbe accettare così tante prop di stile da
   diventare un mattone: il hook gestisce la logica, il
   render lo scrive chi usa.

   Uso tipico:
     const { state, run, busy } = useActionState({
       savedMs: 700,
       onDone: close,      // chiudi il modale dopo la conferma
     });
     <button
       disabled={busy}
       onClick={() => run(async () => { await save(); })}
     >
       {state === 'saving' && 'Salvataggio...'}
       {state === 'saved'  && 'Salvato!'}
       {state === 'idle'   && 'Salva'}
     </button>

   Comportamento:
   • al click passa a 'saving';
   • aspetta il return dell'azione;
   • se ok → 'saved' per `savedMs`, poi chiama `onDone` (per
     esempio la chiusura del modale) e torna a 'idle' se il
     pulsante è ancora montato;
   • se fallisce → torna subito a 'idle'; l'errore viene
     inghiottito qui perché di norma il chiamante mostra già
     un toast dal try/catch al livello superiore. Chi vuole
     reagire passa `onError`.

   `mounted` protegge da setState su un pulsante che nel
   frattempo `onDone` ha smontato (es. chiusura di un modale).
--------------------------------------------------------- */
export function useActionState({ savedMs = 700, onDone, onError } = {}) {
  const [state, setState] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const mounted = useRef(true);
  // stateRef evita di rimettere `state` nelle deps di useCallback:
  // `run` resta stabile fra i render e può essere passato come prop
  // senza far ricreare handler ai figli.
  const stateRef = useRef('idle');
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    // IMPORTANTE: reset a true nel setup, non solo cleanup a false.
    // React 18 in Strict Mode fa mount → unmount → remount sugli
    // effect in dev per verificare le cleanup: se qui mettessimo solo
    // la cleanup (mounted.current = false), dopo il giro iniziale il
    // ref resterebbe a false per sempre, e la guardia `if (!mounted)
    // return` in `run` farebbe uscire subito ogni azione dopo
    // l'await — il pulsante resterebbe bloccato su "Salvataggio...".
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async (fn) => {
    if (stateRef.current !== 'idle') return;
    setState('saving');
    try {
      await fn();
      if (!mounted.current) return;
      setState('saved');
      const finalize = () => {
        // onDone prima del reset: dà la possibilità al chiamante di
        // smontare il pulsante durante lo stato 'saved' (bello a
        // vedersi: la conferma resta visibile finché il modale
        // completa la sua transizione di uscita).
        onDone?.();
        if (mounted.current) setState('idle');
      };
      if (savedMs > 0) setTimeout(finalize, savedMs);
      else finalize();
    } catch (err) {
      if (mounted.current) setState('idle');
      if (onError) onError(err);
      // non rilancio: chi vuole gestire l'errore usi onError, o
      // metta il try/catch dentro `fn`.
    }
  }, [savedMs, onDone, onError]);

  return {
    state,
    run,
    busy: state !== 'idle',
    saving: state === 'saving',
    saved: state === 'saved',
    idle: state === 'idle',
  };
}

export default useActionState;