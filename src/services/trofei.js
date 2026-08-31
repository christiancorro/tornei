/* ---------------------------------------------------------
   Trofei — tornei a cui un utente dice di aver partecipato.

   Storage: users/{uid}/trofei/{torneoId}
     torneoId       (anche = doc id, così no duplicati)
     preferito      bool
     aggiuntoIl     serverTimestamp

   Approccio relazionale: salviamo solo l'ID. I dettagli 
   (nome, data, locandina) vengono "uniti" lato client 
   leggendoli dalla collection live dei tornei.
--------------------------------------------------------- */
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { db, COL_USERS } from '../firebase';

const SUB_TROFEI = 'trofei';

function trofeiRef(uid) {
  return collection(db, COL_USERS, uid, SUB_TROFEI);
}

function trofeoRef(uid, torneoId) {
  return doc(db, COL_USERS, uid, SUB_TROFEI, torneoId);
}

/* Sottoscrizione ai trofei di un utente. L'ordinamento per data
   verrà applicato dal client dopo aver unito i dati con i tornei live. */
export function subscribeMyTrofei(uid, onData, onError) {
  const q = query(trofeiRef(uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), torneoId: d.id }))),
    (err) => onError?.(err),
  );
}

/* Aggiunge un torneo ai trofei dell'utente salvando solo l'ID. */
export async function addTrofeo(uid, torneo) {
  if (!uid || !torneo?.id) throw new Error('uid e torneo.id richiesti');
  await setDoc(trofeoRef(uid, torneo.id), {
    preferito: false,
    aggiuntoIl: serverTimestamp(),
  });
}

export async function removeTrofeo(uid, torneoId) {
  await deleteDoc(trofeoRef(uid, torneoId));
}

export async function setPreferito(uid, torneoId, preferito) {
  await updateDoc(trofeoRef(uid, torneoId), { preferito: !!preferito });
}