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
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
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
  'comune', 'costo', 'organizzatore', 'descrizioneOrganizzatore',
  'instagram', 'facebook', 'sitoWeb',
  // Coordinate geografiche del comune, risolte al momento del
  // salvataggio dal form (utils/geocode.js). Se un torneo ne è
  // sprovvisto (creato prima di questa feature) non compare
  // sulla mappa finché non viene ri-salvato.
  'lat', 'lng',
  // `locandina` è la versione grande (dettaglio), `locandinaThumb`
  // quella piccola usata come preview nelle card di lista. I due
  // *Path servono a cancellarne i file da Storage con il torneo.
  'locandina', 'locandinaPath',
  'locandinaThumb', 'locandinaThumbPath',
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

/* ---------------------------------------------------------
   Slug ID: usato come ID del documento in Firestore per rendere
   l'URL /?torneo=<id> leggibile da umani e migliore in SERP.

   Formato: <nome-slug>-<gg>-<mm>-<aaaa>
     es. "finale-serie-c-15-06-2026"

   Su collisione (stesso nome + stessa data) appendo -2, -3, ...
   La verifica esistenza usa getDoc: perché funzioni per doc
   inesistenti, firestore.rules deve avere `|| resource == null`
   nella allow read di /tornei (vedi firestore.rules.patch.txt).

   Lo slug è immutabile dopo la creazione: se l'utente cambia
   nome o data del torneo, l'URL resta stabile. È una scelta
   deliberata — rinominare doc Firestore vuol dire copy+delete,
   e cambiare URL già indicizzati romperebbe i backlink.
--------------------------------------------------------- */
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    // Rimuovi accenti/diacritici (é → e, ò → o, ecc.).
    // Il range ̀-ͯ copre i combining marks Unicode
    // che NFD stacca dalle lettere accentate.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // Qualsiasi carattere non alfanumerico diventa trattino.
    .replace(/[^a-z0-9]+/g, '-')
    // Trim dei trattini in testa/coda.
    .replace(/^-+|-+$/g, '')
    // Cap sulla lunghezza per non avere ID enormi.
    .slice(0, 80);
}

/* Mesi in italiano abbreviati (3 lettere, minuscole). Coerente con
   MESI_BREVI usato altrove nella UI. Preferisco l'array hard-coded
   a toLocaleDateString('it-IT', {month:'short'}) perché su alcuni
   browser/runtime quest'ultimo stampa un puntino finale (`gen.`)
   o il mese completo — la stringa dell'ID deve essere stabile. */
const MESI_SLUG = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];

function slugTorneo(nome, dataISO) {
  const base = slugify(nome) || 'torneo';
  if (typeof dataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
    const [y, m, d] = dataISO.split('-');
    const mese = MESI_SLUG[parseInt(m, 10) - 1] || m;
    // Rimuovo lo zero iniziale del giorno per un ID più leggibile:
    // "5-giu-2026" invece di "05-giu-2026". Zero-padding lo mantengo
    // solo se hai bisogno di sort alfabetico, che qui non serve.
    const giorno = String(parseInt(d, 10));
    return `${base}-${giorno}-${mese}-${y}`;
  }
  return base;
}

async function slugUnivoco(base) {
  let candidato = base;
  let n = 2;
  // Cap difensivo: nessuna collision-chain dovrebbe mai arrivare a 50,
  // ma se qualcosa va storto ripiego su un suffisso timestamp per non
  // ciclare all'infinito.
  while (n <= 50) {
    let esiste;
    try {
      const snap = await getDoc(doc(db, COL_TORNEI, candidato));
      esiste = snap.exists();
    } catch {
      // permission-denied → assumo "esiste ma non lo posso leggere"
      // (es. torneo pending di un altro utente con lo stesso slug).
      esiste = true;
    }
    if (!esiste) return candidato;
    candidato = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now()}`;
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
  // Costruisco lo slug ID prima della scrittura: la rule create
  // non pone vincoli sull'ID, quindi qualunque stringa che passi
  // la collision-check va bene.
  const base = slugTorneo(t.nome, t.data);
  const id = await slugUnivoco(base);
  await setDoc(doc(db, COL_TORNEI, id), {
    ...toFirestore(t),
    status: statusForNewTournament(profile),
    authorId: profile.uid,
    authorName: profile.displayName ?? '',
    authorEmail: profile.email ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateTournament(id, t) {
  // NB: l'update NON rinomina il doc. Se l'utente cambia nome o
  // data, l'ID (e quindi l'URL) resta quello originario. Ne parlo
  // nel comment block dello slug: scelta deliberata per non
  // rompere URL già indicizzati.
  await updateDoc(doc(db, COL_TORNEI, id), {
    ...toFirestore(t),
    updatedAt: serverTimestamp(),
  });
}

export function saveTournament(t, profile) {
  return t.id ? updateTournament(t.id, t) : createTournament(t, profile);
}

export async function deleteTournament(t) {
  // Cancella prima entrambi i file (main + thumb), poi il documento.
  // Se uno dei file non c'è più (o non c'è mai stato — tornei vecchi
  // senza thumb) il catch tiene buono il flusso.
  if (t.locandinaPath) {
    await deleteObject(ref(storage, t.locandinaPath)).catch(() => { });
  }
  if (t.locandinaThumbPath) {
    await deleteObject(ref(storage, t.locandinaThumbPath)).catch(() => { });
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
   una foto del telefono: 4–8 MB, 4000px di lato. Da qui
   produciamo due file:

   • FULL (~400 KB, max 1600px): quello che si vede nel
     dettaglio, dove c'è spazio per apprezzarla.
   • THUMB (~40 KB, max 400px): l'anteprima nelle card di
     lista. Deve entrare subito, quindi la vogliamo piccola:
     una card che aspetta un JPG da 400 KB non è "immediata".

   Entrambi vanno su Storage e i loro URL/paths finiscono sul
   documento del torneo (`locandina` + `locandinaPath` per il
   grande, `locandinaThumb` + `locandinaThumbPath` per il
   piccolo). Le card leggono il thumb con fallback al full, i
   tornei vecchi senza thumb continuano a funzionare.

   `onProgress` riceve 0–100: senza, su una connessione lenta
   l'utente non sa se sta succedendo qualcosa e ripreme il
   bottone. Il progresso è la media pesata dei due upload.

   NB: i path Storage usano un base random (Date.now() +
   random string), non l'ID del torneo. Questo li rende
   indipendenti dall'ID: se un giorno cambi ID (come nella
   migrazione slug), i file restano dove sono senza spostamenti.
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
  const type = webp ? 'image/webp' : 'image/jpeg';
  const ext = webp ? 'webp' : 'jpg';

  // Le due compressioni girano in parallelo: sono due passate
  // indipendenti sullo stesso file d'ingresso, non c'è motivo di
  // farle in sequenza. Su un telefono lento la seconda comunque
  // condivide la worker: nessun rischio di raddoppio dei tempi.
  const [full, thumb] = await Promise.all([
    imageCompression(file, {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 1600,
      initialQuality: 0.82,
      useWebWorker: true,
      fileType: type,
    }),
    imageCompression(file, {
      // Il thumb sta in una colonnina di ~80px nella card: 400px
      // di lato è già abbondante per il retina. La qualità un po'
      // più bassa (0.7) fa scendere i KB senza artefatti visibili
      // a quella dimensione.
      maxSizeMB: 0.05,
      maxWidthOrHeight: 400,
      initialQuality: 0.7,
      useWebWorker: true,
      fileType: type,
    }),
  ]);

  return {
    full: { blob: full, type, ext, size: full.size },
    thumb: { blob: thumb, type, ext, size: thumb.size },
    originalSize: file.size,
  };
}

/* Un singolo upload verso Storage. Ritorna URL + path e chiama
   onProgress con i bytes trasferiti per pesare il progresso
   combinato dei due file. */
function uploadOne(blob, type, path, onBytes) {
  const task = uploadBytesResumable(ref(storage, path), blob, {
    contentType: type,
    cacheControl: 'public, max-age=31536000', // le locandine non cambiano mai
  });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onBytes?.(snap.bytesTransferred),
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function uploadLocandina(file, onProgress) {
  const c = await compressLocandina(file);
  if (!c) return null;

  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pathFull = `locandine/${base}.${c.full.ext}`;
  const pathThumb = `locandine/${base}-thumb.${c.thumb.ext}`;

  // Progresso combinato: sommo i bytes trasferiti dei due upload
  // e li divido sul totale. Così la barra sale in modo lineare
  // anche se un file finisce prima dell'altro.
  const totali = c.full.size + c.thumb.size;
  let bytesFull = 0;
  let bytesThumb = 0;
  const aggiorna = () => {
    if (!onProgress || !totali) return;
    onProgress(Math.round(((bytesFull + bytesThumb) / totali) * 100));
  };

  const [fullRes, thumbRes] = await Promise.all([
    uploadOne(c.full.blob, c.full.type, pathFull, (b) => { bytesFull = b; aggiorna(); }),
    uploadOne(c.thumb.blob, c.thumb.type, pathThumb, (b) => { bytesThumb = b; aggiorna(); }),
  ]);

  return {
    url: fullRes.url,
    path: fullRes.path,
    thumbUrl: thumbRes.url,
    thumbPath: thumbRes.path,
    size: c.full.size,
    thumbSize: c.thumb.size,
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
      comune: 'Udine',
      costo: '15',
      organizzatore: 'ASD Test',
      descrizioneOrganizzatore: 'Test Storage',
      locandina: uploaded.url,
      locandinaPath: uploaded.path,
      locandinaThumb: uploaded.thumbUrl,
      locandinaThumbPath: uploaded.thumbPath,
    },
    profile
  );
}