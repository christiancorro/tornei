/* ---------------------------------------------------------
   Messaggi privati.

   Struttura:
     conversazioni/{convId}                → anteprima, partecipanti
     conversazioni/{convId}/messaggi/{id}  → i messaggi

   convId è deterministico: `${annuncioId}__${mittente}`.
   Così se scrivo due volte allo stesso annuncio riapro lo
   stesso thread invece di crearne un altro — niente doppioni
   e nessuna query per cercare la conversazione esistente.
--------------------------------------------------------- */
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

import { db, COL_CONVERSAZIONI, SUB_MESSAGGI } from '../firebase';

export const MAX_MESSAGGIO = 2000;

export function conversationId(annuncioId, senderUid) {
  return `${annuncioId}__${senderUid}`;
}

function convRef(convId) {
  return doc(db, COL_CONVERSAZIONI, convId);
}

function messagesRef(convId) {
  return collection(db, COL_CONVERSAZIONI, convId, SUB_MESSAGGI);
}

/* Le mie conversazioni, ordinate per ultimo messaggio. */
export function subscribeConversations(uid, onData, onError) {
  const q = query(
    collection(db, COL_CONVERSAZIONI),
    where('participants', 'array-contains', uid),
    orderBy('lastAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => onError?.(err)
  );
}

/* Tutte le conversazioni — solo admin. La query non ha il filtro
   array-contains: le regole la accettano perché isAdmin() non
   dipende dal documento, quindi vale per l'intera collection. */
export function subscribeAllConversations(onData, onError, max = 200) {
  const q = query(
    collection(db, COL_CONVERSAZIONI),
    orderBy('lastAt', 'desc'),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => onError?.(err)
  );
}

export function subscribeMessages(convId, onData, onError) {
  const q = query(messagesRef(convId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err) => onError?.(err)
  );
}

/* Primo messaggio a un annuncio: crea (o riusa) il thread. */
export async function replyToAnnuncio(annuncio, sender, testo) {
  const clean = (testo ?? '').trim();
  if (!clean) throw new Error('Il messaggio non può essere vuoto.');
  if (clean.length > MAX_MESSAGGIO) throw new Error('Messaggio troppo lungo.');
  if (!annuncio.authorId) throw new Error('Questo annuncio non ha un autore contattabile.');
  if (annuncio.authorId === sender.uid) throw new Error('È il tuo annuncio.');

  const convId = conversationId(annuncio.id, sender.uid);
  const ref = convRef(convId);
  const existing = await getDoc(ref);

  if (!existing.exists()) {
    await setDoc(ref, {
      annuncioId: annuncio.id,
      annuncioTesto: annuncio.testo.slice(0, 140),
      annuncioTipo: annuncio.tipo,
      participants: [sender.uid, annuncio.authorId],
      names: {
        [sender.uid]: sender.displayName ?? '',
        [annuncio.authorId]: annuncio.authorName ?? '',
      },
      startedBy: sender.uid,
      createdAt: serverTimestamp(),
      lastAt: serverTimestamp(),
      lastMessage: clean.slice(0, 140),
      unread: { [annuncio.authorId]: 0, [sender.uid]: 0 },
    });
  }

  await sendMessage(convId, sender.uid, annuncio.authorId, clean);
  return convId;
}

export async function sendMessage(convId, fromId, toId, testo) {
  const clean = (testo ?? '').trim();
  if (!clean) throw new Error('Il messaggio non può essere vuoto.');

  await addDoc(messagesRef(convId), {
    fromId,
    testo: clean.slice(0, MAX_MESSAGGIO),
    createdAt: serverTimestamp(),
  });

  // L'anteprima è denormalizzata sulla conversazione: la lista
  // thread si legge con una query sola, senza aprire ogni thread.
  await updateDoc(convRef(convId), {
    lastMessage: clean.slice(0, 140),
    lastAt: serverTimestamp(),
    lastFrom: fromId,
    [`unread.${toId}`]: increment(1),
  });
}

export function markAsRead(convId, uid) {
  return updateDoc(convRef(convId), { [`unread.${uid}`]: 0 }).catch(() => {});
}

/* Moderazione: elimina il thread e i suoi messaggi. Firestore non
   cancella le subcollection a cascata, quindi vanno prese a mano. */
export async function deleteConversation(convId) {
  const snap = await getDocs(messagesRef(convId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(convRef(convId));
}

export function otherParticipant(conv, uid) {
  const other = conv.participants?.find((p) => p !== uid);
  return { uid: other, name: conv.names?.[other] || 'Utente' };
}
