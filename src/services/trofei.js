/* ---------------------------------------------------------
   Trofei — tornei a cui un utente dice di aver partecipato.

   Storage: users/{uid}/trofei/{torneoId}
     torneoId       (anche = doc id, così no duplicati)
     nome           snapshot al momento dell'attivazione
     data           idem (ISO YYYY-MM-DD)
     disciplina     idem
     locandinaThumb idem (URL o '')
     preferito      bool
     aggiuntoIl     serverTimestamp

   Perché snapshot invece di leggere il torneo al bisogno:
   - I trofei sono memorie personali. Se in futuro l'organizzatore
     modifica o cancella il torneo, il "trofeo" nella bacheca
     dell'utente resta com'era vissuto.
   - Riduce le letture: nessun fan-out di N getDoc per mostrare N
     trofei — basta lo snapshot della subcollection.
--------------------------------------------------------- */
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
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

/* Sottoscrizione ai trofei di un utente, ordinati per data del
   torneo (più recente prima — così i "vinti l'anno scorso"
   compaiono in cima). Se manca il campo data (torneo vecchio
   che non l'aveva) l'ordering li porta in fondo. */
export function subscribeMyTrofei(uid, onData, onError) {
  const q = query(trofeiRef(uid), orderBy('data', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), torneoId: d.id }))),
    (err) => onError?.(err),
  );
}

/* Aggiunge un torneo ai trofei dell'utente. Ricevo `torneo`
   intero (l'oggetto già in memoria nel client) così faccio lo
   snapshot senza refetch. Uso setDoc con l'ID del torneo così
   riattivare lo stesso torneo idempotente sovrascrive lo
   snapshot invece di duplicare. */
export async function addTrofeo(uid, torneo) {
  if (!uid || !torneo?.id) throw new Error('uid e torneo.id richiesti');
  await setDoc(trofeoRef(uid, torneo.id), {
    nome: torneo.nome ?? '',
    data: torneo.data ?? '',
    disciplina: torneo.disciplina ?? '',
    locandinaThumb: torneo.locandinaThumb ?? torneo.locandina ?? '',
    preferito: false,
    aggiuntoIl: serverTimestamp(),
  });
}

export async function removeTrofeo(uid, torneoId) {
  await deleteDoc(trofeoRef(uid, torneoId));
}

/* Toggle preferito: il chiamante passa il nuovo valore, così se
   in futuro volessi un "svuota tutti i preferiti" batch non
   dovresti riscrivere il servizio. */
export async function setPreferito(uid, torneoId, preferito) {
  await updateDoc(trofeoRef(uid, torneoId), { preferito: !!preferito });
}