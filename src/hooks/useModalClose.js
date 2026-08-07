import { useState, useCallback, useEffect } from 'react';

/* ---------------------------------------------------------
   Chiusura animata di un modale.

   Il problema: se `onClose()` smonta subito il componente,
   non c'è più niente da animare in uscita. Quindi teniamo
   il modale montato, gli mettiamo la classe `is-closing` e
   chiamiamo `onClose` solo quando l'animazione è finita.

   Uso:
     const { closing, close } = useModalClose(onClose);
     <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} onClick={close}>
       <div className={`modal-panel ${closing ? 'is-closing' : ''}`}>
--------------------------------------------------------- */
const DURATA = 180; // deve combaciare con modal-fade-out in styles.css

export function useModalClose(onClose) {
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing((c) => {
      if (c) return c; // doppio click: la chiusura è già partita
      setTimeout(onClose, DURATA);
      return true;
    });
  }, [onClose]);

  // Esc chiude, come ci si aspetta da qualsiasi finestra.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return { closing, close };
}

export default useModalClose;
