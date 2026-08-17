/* ---------------------------------------------------------
   Richieste service (collection: `richieste`).

   Nome file volutamente neutro (né "feedback" né "suggestions"):
   quelle parole finiscono nelle blocklist degli ad-blocker e
   fanno risultare le POST come net::ERR_BLOCKED_BY_CLIENT.

   Solo l'admin legge, aggiorna (per il flag `letto`) e cancella;
   la validazione è qui + nelle regole (le regole restano l'ultima parola).
--------------------------------------------------------- */
import {
  collection, doc, addDoc, deleteDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

import { db, COL_RICHIESTE } from '../firebase';

const richiesteRef = collection(db, COL_RICHIESTE);

export const MIN_TESTO = 5;
export const MAX_TESTO = 2000;

function fromFirestore(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    // Firestore restituisce Timestamp: lo lascio grezzo così chi
    // consuma può decidere se usarlo direttamente o via `.toDate()`.
  };
}

export function subscribeRichieste(onData, onError) {
  return onSnapshot(
    query(richiesteRef, orderBy('createdAt', 'desc')),
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
    // Snapshot dell'ambiente per aiutare a riprodurre eventuali bug.
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    // `letto` è il flag che l'admin ribalta a true quando ha visto
    // il messaggio: così può contare i pending come per i tornei.
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

export function subscribeMyRichieste(uid, onData, onError) {
  return onSnapshot(
    query(richiesteRef, where('authorId', '==', uid), orderBy('createdAt', 'desc')),
    (snap) => onData(snap.docs.map((s) => ({ id: s.id, ...s.data() }))),
    (err) => onError?.(err),
  );
}
