import React from 'react';

/* `onDark` inverte i colori quando la barra ha lo sfondo scuro
   (area personale). Senza, i tab resterebbero neri su nero.

   `highlightColor` (opzionale): quando passato, il bordo del tab
   diventa di quel colore invece che trasparente — così un tab che
   ha un badge (es. Admin quando ci sono richieste non lette) si
   distingue dagli altri anche prima di essere attivo. Non viene
   applicato al tab attivo, che ha già il fondo pieno a fare da
   segnale visivo. Al hover il bordo del highlight viene mantenuto,
   niente colore hover che lo sovrascriva. */
export default function NavTab({ active, onClick, children, onDark = false, highlightColor }) {
  // shrink-0 + whitespace-nowrap: dentro una riga scrollabile i tab non
  // devono comprimersi né andare a capo, altrimenti invece di scorrere
  // si schiacciano su due righe.
  const base = 'shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all';

  const evidenziato = Boolean(highlightColor) && !active;

  const variant = onDark
    ? active
      ? 'bg-[#fff8ef] text-[#282828] border-transparent'
      : evidenziato
        ? 'text-[#fff8ef] opacity-100 hover:opacity-100'
        : 'text-[#fff8ef] opacity-70 hover:opacity-100 border-transparent hover:border-[#fff8ef]'
    : active
      ? 'bg-[#282828] text-[#fff8ef] border-transparent'
      : evidenziato
        ? 'text-[#282828] opacity-100 hover:opacity-100'
        : 'text-[#282828] opacity-60 hover:opacity-100 border-transparent hover:border-[#282828]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variant}`}
      style={evidenziato ? { borderColor: highlightColor } : undefined}
    >
      {children}
    </button>
  );
}