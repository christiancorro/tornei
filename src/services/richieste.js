/* ---------------------------------------------------------
   Richieste service (collection: `richieste`).

   Nome file volutamente neutro (né "feedback" né "suggestions"):
   quelle parole finiscono nelle blocklist degli ad-blocker e
   fanno risultare le POST come net::ERR_BLOCKED_BY_CLIENT.

   Ogni richiesta è un mini-thread: la richiesta iniziale sta nel
   documento, le risposte (admin↔utente) in una sotto-collezione
   `risposte`. Le regole limitano lettura/scrittura ad admin +
   autore della richiesta.

   Flag di stato sul parent (aggiornati nel batch di sendRisposta):
     • letto           → admin ha visto/gestito
     • lettoDaUtente   → utente ha visto l'ultima risposta admin
     • risposto        → sblocca il thread lato utente
--------------------------------------------------------- */
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import { db, COL_RICHIESTE } from '../firebase';

const richiesteRef = collection(db, COL_RICHIESTE);

export const MIN_TESTO = 5;
export const MAX_TESTO = 2000;
export const MAX_RISPOSTA = 10000;

function fromFirestore(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
  };
}

/* ---------------------------------------------------------
   Richieste (documenti principali)
--------------------------------------------------------- */

export function subscribeRichieste(onData, onError) {
  return onSnapshot(
    query(richiesteRef, orderBy('createdAt', 'desc')),
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err),
  );
}

export function subscribeMyRichieste(uid, onData, onError) {
  return onSnapshot(
    query(richiesteRef, where('authorId', '==', uid), orderBy('createdAt', 'desc')),
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err),
  );
}

export async function sendRichiesta({ testo }, profile) {
  const clean = (testo ?? '').trim();
  if (clean.length < MIN_TESTO) {
    throw new Error(`Scrivi almeno ${MIN_TESTO} caratteri.`);
  }
  if (clean.length > MAX_TESTO) {
    throw new Error(`Il testo non può superare i ${MAX_TESTO} caratteri.`);
  }
  if (!profile?.uid) throw new Error('Devi accedere per inviare una richiesta.');

  const ref_ = await addDoc(richiesteRef, {
    testo: clean,
    authorId: profile.uid,
    authorName: profile.displayName ?? '',
    authorEmail: profile.email ?? '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    letto: false,
    createdAt: serverTimestamp(),
  });
  return ref_.id;
}

export function markRichiestaLetta(id, letto = true) {
  return updateDoc(doc(db, COL_RICHIESTE, id), { letto });
}

export function deleteRichiesta(id) {
  return deleteDoc(doc(db, COL_RICHIESTE, id));
}

/* Segna come "lette dall'utente" tutte le richieste passate.
   Chiamato quando l'utente apre la tab Suggerimenti: azzera in
   blocco il badge senza fare N chiamate. */
export async function markRichiesteLetteDaUtente(ids) {
  if (!ids || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(doc(db, COL_RICHIESTE, id), { lettoDaUtente: true });
  });
  await batch.commit();
}

/* ---------------------------------------------------------
   Risposte (sotto-collezione `risposte` di ogni richiesta)
--------------------------------------------------------- */

function risposteRefFor(richiestaId) {
  return collection(db, COL_RICHIESTE, richiestaId, 'risposte');
}

export function subscribeRisposte(richiestaId, onData, onError) {
  return onSnapshot(
    query(risposteRefFor(richiestaId), orderBy('createdAt', 'asc')),
    (snap) => onData(snap.docs.map((s) => ({ id: s.id, ...s.data() }))),
    (err) => onError?.(err),
  );
}

export async function sendRisposta(richiestaId, { testo }, profile, { isAdmin } = {}) {
  const clean = (testo ?? '').trim();
  if (!clean) throw new Error('Il messaggio non può essere vuoto.');
  if (clean.length > MAX_RISPOSTA) throw new Error('Il messaggio è troppo lungo.');
  if (!profile?.uid) throw new Error('Devi accedere per rispondere.');

  const rispostaDoc = doc(risposteRefFor(richiestaId));
  const parentDoc = doc(db, COL_RICHIESTE, richiestaId);

  // Batch: la bolla della risposta e l'aggiornamento dei flag sul
  // parent devono andare insieme. Se una fallisce non voglio uno
  // stato incoerente — es. badge acceso senza risposta scritta.
  const batch = writeBatch(db);

  batch.set(rispostaDoc, {
    testo: clean,
    fromId: profile.uid,
    fromName: profile.displayName ?? '',
    fromRole: isAdmin ? 'admin' : 'user',
    createdAt: serverTimestamp(),
  });

  if (isAdmin) {
    // Rispondere implica aver letto (letto), sblocca il thread
    // all'utente (risposto), e accende il badge di "nuova risposta"
    // sulla sua tab Suggerimenti (lettoDaUtente: false).
    batch.update(parentDoc, {
      risposto: true,
      letto: true,
      lettoDaUtente: false,
    });
  } else {
    // Speculare: quando l'utente scrive, riporto `letto` a false
    // così la richiesta ricompare come "non gestita" nel badge
    // dell'admin. `lettoDaUtente` resta come stava — non è l'utente
    // a segnare se stesso come letto.
    batch.update(parentDoc, { letto: false });
  }

  await batch.commit();
}