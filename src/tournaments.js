/* ---------------------------------------------------------
   Tournaments service (collection: `tornei`).

   The field names stay exactly as the UI already uses them
   (nome, disciplina, formati, data, ...), so no component
   needs to learn a new shape. The Firestore document ID
   becomes `id`, replacing the old `t${Date.now()}`.
--------------------------------------------------------- */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { db, storage, COL_TORNEI } from '../firebase';

const tourneysRef = collection(db, COL_TORNEI);

/* Fields we persist. Anything else the form carries around
   (id, temporary UI state) is stripped before writing. */
const FIELDS = [
  'nome',
  'disciplina',
  'formati',
  'modalita',
  'data',
  'dataFine',
  'ora',
  'comune',
  'costo',
  'organizzatore',
  'descrizioneOrganizzatore',
  'instagram',
  'facebook',
  'sitoWeb',
  'locandina',
  'locandinaPath',
];

function toFirestore(t) {
  const out = {};
  FIELDS.forEach((k) => {
    if (t[k] !== undefined) out[k] = t[k];
  });
  out.formati = Array.isArray(out.formati) ? out.formati : [];
  return out;
}

function fromFirestore(snap) {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    formati: d.formati ?? [],
    dataFine: d.dataFine ?? '',
  };
}

/* Live subscription. Returns an unsubscribe function.
   onSnapshot pushes every change to every open browser, so
   two organizers editing at once stay in sync for free. */
export function subscribeTournaments(onData, onError) {
  const q = query(tourneysRef, orderBy('data', 'asc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err)
  );
}

export async function createTournament(t) {
  const ref_ = await addDoc(tourneysRef, {
    ...toFirestore(t),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref_.id;
}

export async function updateTournament(id, t) {
  await updateDoc(doc(db, COL_TORNEI, id), {
    ...toFirestore(t),
    updatedAt: serverTimestamp(),
  });
}

/* One entry point for the form: create if new, update if existing. */
export async function saveTournament(t) {
  if (t.id) {
    await updateTournament(t.id, t);
    return t.id;
  }
  return createTournament(t);
}

export async function deleteTournament(t) {
  if (t.locandinaPath) {
    await deleteObject(ref(storage, t.locandinaPath)).catch(() => {});
  }
  await deleteDoc(doc(db, COL_TORNEI, t.id));
}

/* ---------------------------------------------------------
   Poster upload (Firebase Storage).
   The form keeps working with a plain URL; this is the
   alternative for organizers who have a file, not a link.
--------------------------------------------------------- */
export async function uploadLocandina(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    throw new Error("Il file deve essere un'immagine.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("L'immagine non può superare i 5 MB.");
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `locandine/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return { url, path };
}
