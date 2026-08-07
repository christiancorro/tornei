/* ---------------------------------------------------------
   Tournaments service (collection: `tornei`).

   Ogni torneo ha uno `status`. Chi non è organizzatore può
   creare solo in 'pending' — lo impongono le regole, non
   questo file. Approvare un torneo promuove anche l'autore
   a organizzatore: da lì in poi pubblica diretto.
--------------------------------------------------------- */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';

import { db, storage, COL_TORNEI, COL_USERS } from '../firebase';
import {
  STATUS_PENDING,
  STATUS_PUBLISHED,
  STATUS_REJECTED,
  ROLE_ORGANIZER,
  statusForNewTournament,
} from '../roles';

const tourneysRef = collection(db, COL_TORNEI);

const FIELDS = [
  'nome', 'disciplina', 'formati', 'modalita', 'data', 'dataFine', 'ora',
  'luogo', 'comune', 'provincia', 'costo', 'iscrizioniEntro', 'organizzatore',
  'descrizioneOrganizzatore', 'instagram', 'facebook', 'locandina', 'locandinaPath',
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
    status: d.status ?? STATUS_PUBLISHED,
  };
}


function listen(q, onData, onError) {
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(fromFirestore)),
    (err) => onError?.(err)
  );
}

/* Il filtro status è obbligatorio, non decorativo: le regole
   rifiutano una query che possa restituire documenti non
   leggibili, quindi senza where() l'intera lettura fallisce. */
export function subscribePublished(onData, onError) {
  return listen(
    query(tourneysRef, where('status', '==', STATUS_PUBLISHED), orderBy('data', 'asc')),
    onData,
    onError
  );
}

export function subscribePending(onData, onError) {
  return listen(
    query(tourneysRef, where('status', '==', STATUS_PENDING), orderBy('createdAt', 'asc')),
    onData,
    onError
  );
}

export function subscribeMine(uid, onData, onError) {
  return listen(
    query(tourneysRef, where('authorId', '==', uid), orderBy('data', 'asc')),
    onData,
    onError
  );
}

export async function createTournament(t, profile) {
  const ref_ = await addDoc(tourneysRef, {
    ...toFirestore(t),
    status: statusForNewTournament(profile),
    authorId: profile.uid,
    authorName: profile.displayName ?? '',
    authorEmail: profile.email ?? '',
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

export function saveTournament(t, profile) {
  return t.id ? updateTournament(t.id, t) : createTournament(t, profile);
}

export async function deleteTournament(t) {
  if (t.locandinaPath) {
    await deleteObject(ref(storage, t.locandinaPath)).catch(() => { });
  }
  await deleteDoc(doc(db, COL_TORNEI, t.id));
}

/* Approva: pubblica il torneo E promuove l'autore. Batch, così
   o succedono entrambe o nessuna delle due — non voglio un
   torneo pubblicato il cui autore è rimasto 'user'. */
export async function approveTournament(torneo, adminUid, promoteAuthor = true) {
  const batch = writeBatch(db);

  batch.update(doc(db, COL_TORNEI, torneo.id), {
    status: STATUS_PUBLISHED,
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    motivoRifiuto: '',
  });

  if (promoteAuthor && torneo.authorId) {
    batch.update(doc(db, COL_USERS, torneo.authorId), {
      role: ROLE_ORGANIZER,
      roleUpdatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function rejectTournament(torneo, adminUid, motivo = '') {
  await updateDoc(doc(db, COL_TORNEI, torneo.id), {
    status: STATUS_REJECTED,
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    motivoRifiuto: motivo.slice(0, 300),
  });
}

/* ---------------------------------------------------------
   Upload locandina (Firebase Storage).
--------------------------------------------------------- */

/* ---------------------------------------------------------
   Upload della locandina.

   Le locandine arrivano quasi sempre da uno screenshot o da
   una foto del telefono: 4–8 MB, 4000px di lato. Nella scheda
   ne vediamo al massimo 800px. Comprimere prima di caricare
   fa risparmiare banda a chi carica, soldi di Storage a te, e
   secondi di attesa a chi guarda.

   `onProgress` riceve 0–100: senza, su una connessione lenta
   l'utente non sa se sta succedendo qualcosa e ripreme il
   bottone.
--------------------------------------------------------- */
export const MAX_LOCANDINA_MB = 20;

/* WebP pesa il 25–35% meno di JPEG a parità di qualità ed è
   supportato ovunque tranne Safari molto vecchio: se il browser
   non sa produrlo, il canvas restituisce un PNG e ripieghiamo. */
function supportsWebP() {
  try {
    const c = document.createElement('canvas');
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export async function compressLocandina(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    throw new Error("Il file deve essere un'immagine (JPG, PNG, WebP).");
  }
  if (file.size > MAX_LOCANDINA_MB * 1024 * 1024) {
    throw new Error(`L'immagine non può superare i ${MAX_LOCANDINA_MB} MB.`);
  }

  const webp = supportsWebP();

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1600,
    initialQuality: 0.82,
    useWebWorker: true, // la compressione non blocca l'interfaccia
    fileType: webp ? 'image/webp' : 'image/jpeg',
  });

  return {
    blob: compressed,
    type: webp ? 'image/webp' : 'image/jpeg',
    ext: webp ? 'webp' : 'jpg',
    originalSize: file.size,
    size: compressed.size,
  };
}

export async function uploadLocandina(file, onProgress) {
  const c = await compressLocandina(file);
  if (!c) return null;

  const path = `locandine/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${c.ext}`;
  const task = uploadBytesResumable(ref(storage, path), c.blob, {
    contentType: c.type,
    cacheControl: 'public, max-age=31536000', // le locandine non cambiano mai
  });

  await new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      resolve
    );
  });

  return {
    url: await getDownloadURL(task.snapshot.ref),
    path,
    size: c.size,
    originalSize: c.originalSize,
  };
}

/* Cancella un file orfano: serve quando si sostituisce la
   locandina prima di salvare il torneo. */
export async function deleteLocandina(path) {
  if (!path) return;
  await deleteObject(ref(storage, path)).catch(() => { });
}

export async function createTestTournament(profile) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#22301F';
  ctx.fillRect(0, 0, 800, 1100);

  ctx.fillStyle = '#F6C344';
  ctx.font = 'bold 70px Arial';
  ctx.fillText('TORNEO', 120, 300);
  ctx.fillText('TEST FVG', 100, 400);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '40px Arial';
  ctx.fillText('Beach Volley', 180, 600);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  );

  const file = new File(
    [blob],
    'torneo-test.jpg',
    { type: 'image/jpeg' }
  );

  const uploaded = await uploadLocandina(file);

  return createTournament(
    {
      nome: 'Torneo Test FVG',
      disciplina: 'Beach Volley',
      formati: ['2x2'],
      modalita: 'Misto',
      data: '2026-08-20',
      dataFine: '',
      ora: '09:00',
      luogo: 'Parco Test',
      comune: 'Udine',
      provincia: 'UD',
      costo: '15',
      iscrizioniEntro: '2026-08-15',
      organizzatore: 'ASD Test',
      descrizioneOrganizzatore: 'Test Storage',
      locandina: uploaded.url,
      locandinaPath: uploaded.path,
    },
    profile
  );
}