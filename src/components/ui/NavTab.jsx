import React from 'react';

/* `onDark` inverte i colori quando la barra ha lo sfondo scuro
   (area personale). Senza, i tab resterebbero neri su nero. */
export default function NavTab({ active, onClick, children, onDark = false }) {
  // shrink-0 + whitespace-nowrap: dentro una riga scrollabile i tab non
  // devono comprimersi né andare a capo, altrimenti invece di scorrere
  // si schiacciano su due righe.
  const base = 'shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold border-2 border-transparent transition-all';

  const variant = onDark
    ? active
      ? 'bg-[#fff8ef] text-[#282828]'
      : 'text-[#fff8ef] opacity-70 hover:opacity-100 hover:border-[#fff8ef]'
    : active
      ? 'bg-[#282828] text-[#fff8ef]'
      : 'text-[#282828] opacity-60 hover:opacity-100 hover:border-[#282828]';

  return (
    <button type="button" onClick={onClick} className={`${base} ${variant}`}>
      {children}
    </button>
  );
}