/* ---------------------------------------------------------
   Ruoli e permessi.

   Un solo posto dove è scritto chi può fare cosa, così la UI
   e i servizi non possono divergere. Attenzione: questo file
   decide solo *cosa mostrare*. Chi decide davvero è
   firestore.rules, che ripete le stesse condizioni lato
   server. Nascondere un bottone non protegge niente.
--------------------------------------------------------- */
export const ROLE_USER = 'user';
export const ROLE_ORGANIZER = 'organizer';
export const ROLE_ADMIN = 'admin';
export const ROLE_BLOCKED = 'blocked';

export const ROLES = [ROLE_USER, ROLE_ORGANIZER, ROLE_ADMIN, ROLE_BLOCKED];

export const ROLE_LABELS = {
  [ROLE_USER]: 'Utente',
  [ROLE_ORGANIZER]: 'Organizzatore',
  [ROLE_ADMIN]: 'Admin',
  [ROLE_BLOCKED]: 'Bloccato',
};

export const ROLE_DESCRIPTIONS = {
  [ROLE_USER]: 'Può scrivere annunci e proporre tornei (in attesa di approvazione).',
  [ROLE_ORGANIZER]: 'Pubblica tornei senza approvazione.',
  [ROLE_ADMIN]: 'Accesso completo: approva tornei, gestisce utenti e contenuti.',
  [ROLE_BLOCKED]: 'Non può pubblicare né scrivere messaggi.',
};

/* Stati di un torneo. */
export const STATUS_PENDING = 'pending';
export const STATUS_PUBLISHED = 'published';
export const STATUS_REJECTED = 'rejected';

export const STATUS_LABELS = {
  [STATUS_PENDING]: 'In attesa di approvazione',
  [STATUS_PUBLISHED]: 'Pubblicato',
  [STATUS_REJECTED]: 'Rifiutato',
};

/* --- Permessi derivati --- */
export const isAdmin = (p) => p?.role === ROLE_ADMIN;
export const isBlocked = (p) => p?.role === ROLE_BLOCKED;
export const isOrganizer = (p) => p?.role === ROLE_ORGANIZER || isAdmin(p);

/* Chi è attivo può scrivere qualcosa. Un profilo assente
   significa "non ancora caricato": trattalo come bloccato. */
export const isActive = (p) => Boolean(p) && !isBlocked(p);

/* Un organizzatore pubblica diretto; tutti gli altri finiscono
   in coda di moderazione. */
export const statusForNewTournament = (p) =>
  isOrganizer(p) ? STATUS_PUBLISHED : STATUS_PENDING;

export const canPostAnnuncio = (p) => isActive(p);
export const canProposeTournament = (p) => isActive(p);

export const canDeleteAnnuncio = (p, annuncio) =>
  isAdmin(p) || (isActive(p) && annuncio?.authorId === p?.uid);

export const canEditTournament = (p, torneo) =>
  isAdmin(p) || (isActive(p) && torneo?.authorId === p?.uid);
