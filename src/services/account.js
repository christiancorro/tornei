/* ---------------------------------------------------------
   Gestione account: nome visualizzato e cancellazione.

   Cancellare un account è un'operazione in due mondi:
   Firestore (i dati) e Auth (l'identità). Vanno fatti in
   quest'ordine — finché l'utente Auth esiste, le regole lo
   riconoscono e può cancellare la propria roba. Al contrario
   resterebbero documenti orfani che nessuno può più toccare.
--------------------------------------------------------- */
import { deleteUser, updateProfile, reauthenticateWithPopup } from 'firebase/auth';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  auth, db, COL_USERS, COL_TORNEI, COL_ANNUNCI, COL_CONVERSAZIONI, SUB_MESSAGGI,
} from '../firebase';
import { googleProvider } from './auth';

export async function updateDisplayName(uid, displayName) {
  const nome = (displayName ?? '').trim();
  if (!nome) throw new Error('Il nome non può essere vuoto.');
  if (nome.length > 60) throw new Error('Il nome è troppo lungo.');

  await updateDoc(doc(db, COL_USERS, uid), { displayName: nome });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: nome }).catch(() => { });
  }
}

/* Firebase pretende un accesso recente prima di cancellare:
   è la difesa contro chi trova un portatile sbloccato. Con il
   solo Google significa riaprire il popup e riconfermare. */
export async function reauthenticate() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessione scaduta. Accedi di nuovo.');
  await reauthenticateWithPopup(user, googleProvider);
}

/* Quanto sto per cancellare — mostrato prima di confermare,
   così nessuno scopre dopo di aver perso i propri tornei. */
export async function accountFootprint(uid) {
  const [tornei, annunci, conversazioni] = await Promise.all([
    getDocs(query(collection(db, COL_TORNEI), where('authorId', '==', uid))),
    getDocs(query(collection(db, COL_ANNUNCI), where('authorId', '==', uid))),
    getDocs(query(collection(db, COL_CONVERSAZIONI), where('participants', 'array-contains', uid))),
  ]);
  return {
    tornei: tornei.size,
    annunci: annunci.size,
    conversazioni: conversazioni.size,
  };
}

async function deleteQuery(q) {
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  // I batch reggono 500 operazioni: per sicurezza li spezzo.
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

export async function deleteAccount(uid) {
  await reauthenticate();

  // 1. Tornei e annunci dell'utente.
  await deleteQuery(query(collection(db, COL_TORNEI), where('authorId', '==', uid)));
  await deleteQuery(query(collection(db, COL_ANNUNCI), where('authorId', '==', uid)));

  // 2. Conversazioni: Firestore non cancella le subcollection a
  //    cascata, quindi ogni thread va svuotato a mano prima.
  const convs = await getDocs(
    query(collection(db, COL_CONVERSAZIONI), where('participants', 'array-contains', uid))
  );
  for (const c of convs.docs) {
    await deleteQuery(collection(db, COL_CONVERSAZIONI, c.id, SUB_MESSAGGI));
    await deleteDoc(c.ref);
  }

  // 3. Il profilo.
  await deleteDoc(doc(db, COL_USERS, uid));

  // 4. L'identità. Per ultima: da qui in poi le regole non
  //    riconoscono più l'utente e nulla sopra sarebbe possibile.
  if (auth.currentUser) await deleteUser(auth.currentUser);
}