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
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

import { db, COL_ANNUNCI } from '../firebase';

const annunciRef = collection(db, COL_ANNUNCI);

const TIPI = ['cerca_squadra', 'cerca_giocatore'];
export const MAX_TESTO = 600;

function fromFirestore(snap) {
  /* `responders` resta qui dentro: alla UI serve il numero, non
     l'elenco di chi ha scritto. */
  const { responders, ...d } = snap.data();
  return {
    ...d,
    id: snap.id,
    data: d.data ?? d.createdAt?.toDate?.().toISOString() ?? '',
    /* Utenti unici per costruzione: `responders` è una lista di uid
       riempita con arrayUnion, quindi chi scrive dieci messaggi allo
       stesso annuncio ci compare una volta sola. Vedi addResponder. */
    risposte: Array.isArray(responders) ? responders.length : 0,
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
    // Nasce vuoto: così il conteggio parte da 0 senza casi speciali.
    // (Gli annunci creati prima di questo campo non ce l'hanno: sia
    // fromFirestore sia le regole trattano l'assenza come lista vuota.)
    responders: [],
  });
  return ref_.id;
}

export function deleteAnnuncio(id) {
  return deleteDoc(doc(db, COL_ANNUNCI, id));
}

/* ---------------------------------------------------------
   Conteggio risposte.

   Sull'annuncio non teniamo un contatore ma la lista degli uid di
   chi ha aperto un thread: `arrayUnion` è idempotente, quindi il
   secondo messaggio della stessa persona non gonfia il totale e non
   dobbiamo prima leggere il documento per sapere se c'era già.
   Il numero mostrato è la lunghezza della lista.

   Le regole lasciano aggiungere SOLO il proprio uid e SOLO questo
   campo; la rimozione è dell'admin (cancellazione di un thread).
   Vedi firestore.rules, match /annunci/{id}.
--------------------------------------------------------- */
function annuncioRef(id) {
  return doc(db, COL_ANNUNCI, id);
}

export function addResponder(annuncioId, uid) {
  return updateDoc(annuncioRef(annuncioId), { responders: arrayUnion(uid) });
}

export function removeResponder(annuncioId, uid) {
  return updateDoc(annuncioRef(annuncioId), { responders: arrayRemove(uid) });
}