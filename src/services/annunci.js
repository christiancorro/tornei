/* ---------------------------------------------------------
   Bacheca service (collection: `annunci`).

   Chiunque sia loggato pubblica. La cancellazione è del
   proprietario o dell'admin: la condizione è nelle regole,
   qui c'è solo la chiamata.
--------------------------------------------------------- */
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

import { db, COL_ANNUNCI } from '../firebase';

const annunciRef = collection(db, COL_ANNUNCI);

const TIPI = ['cerca_squadra', 'cerca_giocatore'];
export const MAX_TESTO = 600;

function fromFirestore(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    data: d.data ?? d.createdAt?.toDate?.().toISOString() ?? '',
  };
}

function listen(q, onData, onError) {
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err)
  );
}

export function subscribeAnnunci(onData, onError, max = 100) {
  return listen(query(annunciRef, orderBy('createdAt', 'desc'), limit(max)), onData, onError);
}

export function subscribeMyAnnunci(uid, onData, onError) {
  return listen(
    query(annunciRef, where('authorId', '==', uid), orderBy('createdAt', 'desc')),
    onData,
    onError
  );
}

export async function createAnnuncio({ tipo, testo }, profile) {
  const clean = (testo ?? '').trim();
  if (!clean) throw new Error('Il testo non può essere vuoto.');
  if (clean.length > MAX_TESTO) {
    throw new Error(`Il testo non può superare i ${MAX_TESTO} caratteri.`);
  }
  if (!TIPI.includes(tipo)) throw new Error('Tipo di annuncio non valido.');
  if (!profile?.uid) throw new Error('Devi accedere per pubblicare.');

  const ref_ = await addDoc(annunciRef, {
    tipo,
    testo: clean,
    authorId: profile.uid,
    authorName: profile.displayName ?? '',
    data: new Date().toISOString(),
    rotazione: Number((Math.random() * 8 - 4).toFixed(1)),
    createdAt: serverTimestamp(),
  });
  return ref_.id;
}

export function deleteAnnuncio(id) {
  return deleteDoc(doc(db, COL_ANNUNCI, id));
}
