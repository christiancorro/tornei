import React from 'react';

import { INK } from '../../theme';

/* ---------------------------------------------------------
   Spinner — cerchietto rotante per gli stati di caricamento.

   Un anello con un arco più marcato che gira: è il segnale
   più leggibile di "sto lavorando" e non pretende attenzione.
   Il colore eredita da `color` (default INK), lo spessore e
   la dimensione sono parametrici così può stare in una card
   come in una pagina intera.
--------------------------------------------------------- */
export default function Spinner({ size = 15, thickness = 3, color = INK, label = 'Caricamento in corso' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        borderColor: 'currentColor',
        // L'arco "attivo" prende il colore pieno, il resto del cerchio
        // resta appena accennato: così si legge subito il movimento.
        borderTopColor: 'transparent',
        color,
      }}
    />
  );
}
