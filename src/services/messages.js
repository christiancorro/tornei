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
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from 'firebase/firestore';

import { db, COL_CONVERSAZIONI, SUB_MESSAGGI } from '../firebase';
import { addResponder, removeResponder } from './annunci';

/* Tetto alto perché non vogliamo limitare l'utente nella scrittura,
   ma un tappo serve comunque: un documento Firestore non può superare
   1 MB e senza soglia un incolla accidentale (o malevolo) potrebbe
   riempirlo. 10 000 caratteri sono ~10 KB, non un problema.
   Le regole Firestore hanno lo stesso valore per coerenza; se
   modifichi qui, aggiornale anche in firestore.rules. */
export const MAX_MESSAGGIO = 10000;

export function conversationId(annuncioId, senderUid) {
  return `${annuncioId}__${senderUid}`;
}

/* L'inverso di conversationId. Serve alla cancellazione, che ha in
   mano solo l'id del thread e deve sapere a quale annuncio e a quale
   utente si riferisce senza rileggere niente.
   Lo split è sul PRIMO `__`: l'id di un annuncio è generato da
   Firestore (solo lettere e cifre), quindi il doppio underscore non
   può che essere il separatore. */
export function parseConversationId(convId) {
  const i = (convId ?? '').indexOf('__');
  if (i < 0) return { annuncioId: '', senderUid: '' };
  return { annuncioId: convId.slice(0, i), senderUid: convId.slice(i + 2) };
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

  /* Niente getDoc prima di creare: leggere un documento che non
     esiste fa fallire le regole (`resource` è null, quindi
     `resource.data.participants` esplode) e l'errore arriva come
     "Missing or insufficient permissions". Capitava riscrivendo a
     qualcuno dopo aver cancellato la conversazione precedente.

     setDoc con merge copre entrambi i casi: crea se manca, aggiorna
     l'anteprima se c'è già.

     `annuncioTesto` teniamo il testo INTERO (max 600 char, cappa
     lato regole degli annunci) e non uno snippet: viene mostrato
     come primo bubble nel thread per dare contesto — troncare
     rovinerebbe la lettura. La lista conversazioni usa comunque
     `lastMessage`, non questo campo, quindi non c'è impatto lì. */
  await setDoc(convRef(convId), {
    annuncioId: annuncio.id,
    annuncioTesto: annuncio.testo,
    annuncioTipo: annuncio.tipo,
    annuncioAuthorId: annuncio.authorId,
    participants: [sender.uid, annuncio.authorId],
    names: {
      [sender.uid]: sender.displayName ?? '',
      [annuncio.authorId]: annuncio.authorName ?? '',
    },
    startedBy: sender.uid,
    lastAt: serverTimestamp(),
    lastMessage: clean.slice(0, 140),
  }, { merge: true });

  // Il conteggio sulla nota lo aggiorna sendMessage, qui sotto:
  // vale anche per i thread aperti prima che il campo esistesse.

  // `unread` non sta qui di proposito: con merge lo azzererebbe a
  // ogni nuovo messaggio. Ci pensa increment() in sendMessage, che
  // funziona anche su un campo che non esiste ancora.
  await sendMessage(convId, sender.uid, annuncio.authorId, clean);
  return convId;
}

/* ---------------------------------------------------------
   Il conteggio "n risposte" sull'annuncio.

   Sta qui e non in replyToAnnuncio di proposito: un thread aperto
   PRIMA che il campo esistesse non passa più da replyToAnnuncio,
   e senza questo resterebbe fuori dal conteggio per sempre. Messo
   su sendMessage invece si ripara da solo — al primo messaggio
   successivo di chi l'ha aperto l'uid rientra al suo posto.

   Conta solo chi ha aperto il thread (`fromId === senderUid`): le
   risposte dell'autore dell'annuncio non sono "risposte ricevute".

   La Set evita di rimandare la stessa write a ogni messaggio: il
   server la ignorerebbe comunque (arrayUnion su un uid già dentro
   non cambia niente) ma la pagheremmo lo stesso. Si popola solo
   dopo un successo, così un errore viene ritentato.
--------------------------------------------------------- */
const responderSincronizzati = new Set();

function syncResponder(convId, fromId) {
  const { annuncioId, senderUid } = parseConversationId(convId);
  if (!annuncioId || fromId !== senderUid) return;
  if (responderSincronizzati.has(convId)) return;

  addResponder(annuncioId, fromId)
    .then(() => responderSincronizzati.add(convId))
    .catch((err) => {
      /* Non rilanciamo: il messaggio è già partito e una risposta che
         sembra fallita è peggio di un conteggio indietro di uno. Ma
         il silenzio totale nasconde il caso più comune — le regole
         non ancora deployate — quindi almeno lo scriviamo. */
      console.warn(
        '[bacheca] conteggio risposte non aggiornato per',
        annuncioId,
        '—',
        err?.code || err?.message || err
      );
    });
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

  // Fire-and-forget: non blocca l'invio. Vedi syncResponder sopra.
  syncResponder(convId, fromId);
}

export function markAsRead(convId, uid) {
  return updateDoc(convRef(convId), { [`unread.${uid}`]: 0 }).catch(() => { });
}

/* Moderazione: elimina il thread e i suoi messaggi. Firestore non
   cancella le subcollection a cascata, quindi vanno prese a mano. */
export async function deleteConversation(convId) {
  const snap = await getDocs(messagesRef(convId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(convRef(convId));

  /* Sparito il thread, sparisce anche la risposta: togliamo l'uid di
     chi aveva scritto dal conteggio della nota. Se l'annuncio non
     c'è più (cancellato prima del thread) l'update fallisce, ed è
     giusto che passi liscio — non c'è più niente da aggiornare. */
  const { annuncioId, senderUid } = parseConversationId(convId);
  if (annuncioId && senderUid) {
    await removeResponder(annuncioId, senderUid).catch(() => { });
  }
}

export function otherParticipant(conv, uid) {
  const other = conv.participants?.find((p) => p !== uid);
  return { uid: other, name: conv.names?.[other] || 'Utente' };
}