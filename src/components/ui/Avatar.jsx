import React, { useState } from 'react';
import { CircleUserRound } from 'lucide-react';

import { SAND, INK } from '../../theme';

/* Avatar Google con fallback.

   referrerPolicy="no-referrer" è obbligatorio: senza, lh3.googleusercontent.com
   risponde 403 quando l'immagine è richiesta da un dominio diverso, e vedresti
   un riquadro rotto solo in produzione.

   onError copre l'altro caso: gli URL delle foto Google possono cambiare o
   scadere, e un profilo salvato mesi fa può puntare a un'immagine che non
   esiste più. */
export default function Avatar({ src, name, size = 36, className = '' }) {
  const [failed, setFailed] = useState(false);
  const iniziale = (name || '').trim().charAt(0).toUpperCase();

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Utente'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`rounded-full object-cover border-2 shrink-0 ${className}`}
        style={{ width: size, height: size, borderColor: 'rgba(34,48,31,0.2)' }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center border-2 shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: 'rgba(34,48,31,0.2)',
        backgroundColor: SAND,
        color: INK,
      }}
      aria-label={name || 'Utente'}
    >
      {iniziale
        ? <span className="font-black" style={{ fontSize: size * 0.42 }}>{iniziale}</span>
        : <CircleUserRound size={size * 0.62} />}
    </div>
  );
}
