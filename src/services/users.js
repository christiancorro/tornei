/* ---------------------------------------------------------
   Users service — usato dalla dashboard admin.

   Solo le regole decidono chi può cambiare un ruolo: qui
   c'è la comodità, non la sicurezza. Una setRole() chiamata
   da un non-admin fallisce con permission-denied.
--------------------------------------------------------- */
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { db, COL_USERS } from '../firebase';
import { ROLES } from '../roles';

const usersRef = collection(db, COL_USERS);

function fromFirestore(snap) {
  return { ...snap.data(), uid: snap.id };
}

/* Profilo dell'utente loggato, in tempo reale: se l'admin lo
   promuove a organizzatore mentre ha la pagina aperta, la UI
   cambia senza che debba rifare il login. */
export function subscribeProfile(uid, onData, onError) {
  return onSnapshot(
    doc(db, COL_USERS, uid),
    (snap) => onData(snap.exists() ? fromFirestore(snap) : null),
    (err) => onError?.(err)
  );
}

export function subscribeUsers(onData, onError) {
  const q = query(usersRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err)
  );
}

export function getProfile(uid) {
  return getDoc(doc(db, COL_USERS, uid)).then((s) =>
    s.exists() ? fromFirestore(s) : null
  );
}

export async function setRole(uid, role) {
  if (!ROLES.includes(role)) throw new Error('Ruolo non valido.');
  await updateDoc(doc(db, COL_USERS, uid), {
    role,
    roleUpdatedAt: serverTimestamp(),
  });
}
