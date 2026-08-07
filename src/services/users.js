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
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import {
  db, COL_USERS, COL_TORNEI, COL_ANNUNCI, COL_CONVERSAZIONI, SUB_MESSAGGI,
} from '../firebase';
import { ROLES, ROLE_BLOCKED } from '../roles';

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

/* ---------------------------------------------------------
   Eliminazione di un utente da parte dell'admin.

   Limite da conoscere: dal browser si cancellano i DATI, non
   l'identità. L'account Firebase Auth lo può rimuovere solo
   l'Admin SDK (`node scripts/seed.mjs --delete-user <email>`)
   o l'utente stesso dalle sue impostazioni.

   Per questo il profilo non viene eliminato ma trasformato in
   una "lapide" con role 'blocked' e deleted: true. Cancellando
   il documento, al primo accesso successivo ensureProfile ne
   creerebbe uno nuovo con ruolo 'user' e la persona rientrerebbe
   come se niente fosse.
--------------------------------------------------------- */

async function deleteAll(q) {
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  // I batch reggono 500 operazioni: li spezzo per stare larghi.
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/* Cosa sparirà — mostrato prima di confermare. */
export async function userFootprint(uid) {
  const [tornei, annunci, conversazioni] = await Promise.all([
    getDocs(query(collection(db, COL_TORNEI), where('authorId', '==', uid))),
    getDocs(query(collection(db, COL_ANNUNCI), where('authorId', '==', uid))),
    getDocs(query(collection(db, COL_CONVERSAZIONI), where('participants', 'array-contains', uid))),
  ]);
  return { tornei: tornei.size, annunci: annunci.size, conversazioni: conversazioni.size };
}

export async function deleteUserData(uid, { keepTombstone = true } = {}) {
  await deleteAll(query(collection(db, COL_TORNEI), where('authorId', '==', uid)));
  await deleteAll(query(collection(db, COL_ANNUNCI), where('authorId', '==', uid)));

  // Le subcollection non si cancellano a cascata: ogni thread va
  // svuotato prima di rimuovere il documento che lo contiene.
  const convs = await getDocs(
    query(collection(db, COL_CONVERSAZIONI), where('participants', 'array-contains', uid))
  );
  for (const c of convs.docs) {
    await deleteAll(collection(db, COL_CONVERSAZIONI, c.id, SUB_MESSAGGI));
    await deleteDoc(c.ref);
  }

  if (keepTombstone) {
    await updateDoc(doc(db, COL_USERS, uid), {
      role: ROLE_BLOCKED,
      deleted: true,
      deletedAt: serverTimestamp(),
      photoURL: '',
      displayName: 'Account eliminato',
    });
  } else {
    await deleteDoc(doc(db, COL_USERS, uid));
  }
}