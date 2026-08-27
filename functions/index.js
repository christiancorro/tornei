/* ---------------------------------------------------------
   Notifiche push — la parte che gira sul server.

   Perché serve un server: una notifica che arriva a sito chiuso
   non può partire dal browser. Il browser lascia solo un
   "indirizzo" (il token FCM); qualcuno deve poi bussare a
   quell'indirizzo. Quel qualcuno è questo file.

   Sono trigger su Firestore: non è l'app a chiedere l'invio, è
   il database che avvisa quando nasce un documento. Vantaggio
   grosso: funziona da qualsiasi strada arrivi il dato — torneo
   pubblicato dall'organizzatore, torneo approvato dall'admin,
   messaggio scritto da un altro dispositivo. Niente da ricordarsi
   di chiamare nel client.

   Cosa NON fa: raggruppare, riprovare a lungo, tenere statistiche.
   Se un token è morto lo cancella e amen — è la manutenzione che
   serve a una collection di token, e si ripaga da sola.
--------------------------------------------------------- */
const { setGlobalOptions } = require('firebase-functions/v2');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const fcm = getMessaging();

/* La regione deve stare vicino al database, se no i trigger non si
   agganciano. europe-west1 va con Firestore in eur3 (Europa), che è
   il default per un progetto creato dall'Italia. Se il deploy
   protesta, guarda in console qual è la posizione del database e
   metti quella (nam5 → us-central1). */
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const SITO = 'https://volleyfvg.it';
const COL_TOKEN = 'pushTokens';

/* FCM accetta al massimo 500 token per chiamata. */
const LOTTO = 500;

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

function dataLeggibile(iso) {
  if (typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MESI[m - 1]}`;
}

function taglia(testo, max) {
  const pulito = String(testo ?? '').replace(/\s+/g, ' ').trim();
  return pulito.length > max ? `${pulito.slice(0, max - 1)}…` : pulito;
}

/* Invia e fa pulizia.

   I messaggi sono SOLO dati (niente blocco `notification`): a
   disegnare la notifica è il service worker del sito, che così
   decide icona, tag e link senza che il server debba conoscere la
   grafica. FCM vuole valori stringa, quindi qui dentro non ci
   finiscono numeri o booleani. */
async function invia(tokens, dati) {
  if (!tokens.length) return { inviate: 0, rimossi: 0 };

  const payload = {};
  for (const [k, v] of Object.entries(dati)) payload[k] = String(v ?? '');

  let inviate = 0;
  const morti = [];

  for (let i = 0; i < tokens.length; i += LOTTO) {
    const fetta = tokens.slice(i, i + LOTTO);

    const esito = await fcm.sendEachForMulticast({
      tokens: fetta,
      data: payload,
      webpush: {
        headers: { Urgency: 'normal', TTL: '86400' },
      },
    });

    inviate += esito.successCount;

    esito.responses.forEach((risposta, indice) => {
      if (risposta.success) return;
      const codice = risposta.error?.code ?? '';
      /* Token scaduto o mai esistito: il browser l'ha buttato o
         l'utente ha tolto il permesso. Non tornerà valido, quindi
         si cancella invece di riprovarci per sempre. */
      if (
        codice === 'messaging/registration-token-not-registered'
        || codice === 'messaging/invalid-registration-token'
        || codice === 'messaging/invalid-argument'
      ) {
        morti.push(fetta[indice]);
      } else {
        logger.warn('[push] invio fallito', { codice, messaggio: risposta.error?.message });
      }
    });
  }

  if (morti.length) {
    const batch = db.batch();
    morti.forEach((t) => batch.delete(db.collection(COL_TOKEN).doc(t)));
    await batch.commit();
  }

  return { inviate, rimossi: morti.length };
}

/* Tutti i token che hanno acceso questo tipo di notifica.
   `tipo` è una chiave dentro `prefs`: tornei | annunci | messaggi. */
async function tokenPerTipo(tipo) {
  const snap = await db.collection(COL_TOKEN).where(`prefs.${tipo}`, '==', true).get();
  return snap.docs.map((d) => d.id);
}

/* Come sopra, ma di una persona sola: serve ai messaggi, che vanno
   al destinatario e a nessun altro. */
async function tokenDiUtente(uid, tipo) {
  if (!uid) return [];
  const snap = await db
    .collection(COL_TOKEN)
    .where('uid', '==', uid)
    .where(`prefs.${tipo}`, '==', true)
    .get();
  return snap.docs.map((d) => d.id);
}

/* Chi ha scritto la cosa non ha bisogno di essere avvisato che
   l'ha scritta. Tolgo i suoi token dalla lista. */
async function senzaAutore(tokens, autoreUid) {
  if (!autoreUid || !tokens.length) return tokens;

  const suoi = new Set();
  const snap = await db.collection(COL_TOKEN).where('uid', '==', autoreUid).get();
  snap.docs.forEach((d) => suoi.add(d.id));

  return tokens.filter((t) => !suoi.has(t));
}

function notificaTorneo(id, torneo) {
  const quando = dataLeggibile(torneo.data);
  const dove = torneo.luogo || torneo.comune || '';
  const coda = [quando, dove].filter(Boolean).join(' · ');

  return {
    titolo: `Nuovo torneo: ${taglia(torneo.nome, 60)}`,
    corpo: coda || 'Guarda i dettagli',
    url: `${SITO}/?torneo=${id}`,
    tag: `torneo-${id}`,
  };
}

/* ---------------------------------------------------------
   1. Torneo pubblicato direttamente (organizzatore o admin).
--------------------------------------------------------- */
exports.notificaNuovoTorneo = onDocumentCreated('tornei/{torneoId}', async (event) => {
  const torneo = event.data?.data();
  if (!torneo || torneo.status !== 'published') return;

  const tokens = await senzaAutore(await tokenPerTipo('tornei'), torneo.authorId);
  const esito = await invia(tokens, notificaTorneo(event.params.torneoId, torneo));

  logger.info('[push] nuovo torneo', { id: event.params.torneoId, ...esito });
});

/* ---------------------------------------------------------
   2. Torneo approvato dall'admin: era in coda, ora è pubblico.
      È il momento in cui diventa visibile, quindi è ora che
      vale la pena avvisare — non quando è stato proposto.
--------------------------------------------------------- */
exports.notificaTorneoApprovato = onDocumentUpdated('tornei/{torneoId}', async (event) => {
  const prima = event.data?.before?.data();
  const dopo = event.data?.after?.data();
  if (!prima || !dopo) return;
  if (prima.status === 'published' || dopo.status !== 'published') return;

  const tokens = await senzaAutore(await tokenPerTipo('tornei'), dopo.authorId);
  const esito = await invia(tokens, notificaTorneo(event.params.torneoId, dopo));

  logger.info('[push] torneo approvato', { id: event.params.torneoId, ...esito });
});

/* ---------------------------------------------------------
   3. Nuovo annuncio in bacheca.
--------------------------------------------------------- */
exports.notificaNuovoAnnuncio = onDocumentCreated('annunci/{annuncioId}', async (event) => {
  const annuncio = event.data?.data();
  if (!annuncio) return;

  const titolo = annuncio.tipo === 'cerca_giocatore'
    ? 'Cercasi giocatori'
    : 'Qualcuno cerca una squadra';

  const tokens = await senzaAutore(await tokenPerTipo('annunci'), annuncio.authorId);
  const esito = await invia(tokens, {
    titolo,
    corpo: taglia(annuncio.testo, 120),
    url: `${SITO}/?vista=bacheca`,
    tag: `annuncio-${event.params.annuncioId}`,
  });

  logger.info('[push] nuovo annuncio', { id: event.params.annuncioId, ...esito });
});

/* ---------------------------------------------------------
   4. Nuovo messaggio in una conversazione.

      Va solo al destinatario. Il mittente lo ricavo dal messaggio,
      il destinatario dai partecipanti della conversazione: è
      l'altro. Se la conversazione non c'è più (cancellata mentre
      il trigger girava) non c'è nessuno da avvisare.
--------------------------------------------------------- */
exports.notificaNuovoMessaggio = onDocumentCreated(
  'conversazioni/{convId}/messaggi/{messaggioId}',
  async (event) => {
    const messaggio = event.data?.data();
    if (!messaggio) return;

    const conv = await db.collection('conversazioni').doc(event.params.convId).get();
    if (!conv.exists) return;

    const dati = conv.data();
    const destinatario = (dati.participants ?? []).find((p) => p !== messaggio.fromId);
    if (!destinatario) return;

    const mittente = dati.names?.[messaggio.fromId] || 'Qualcuno';

    const tokens = await tokenDiUtente(destinatario, 'messaggi');
    const esito = await invia(tokens, {
      titolo: `Messaggio da ${taglia(mittente, 40)}`,
      corpo: taglia(messaggio.testo, 120),
      url: `${SITO}/?vista=messaggi&conv=${event.params.convId}`,
      /* Stesso tag per tutta la conversazione: due messaggi di
         fila si sostituiscono invece di impilarsi. */
      tag: `conv-${event.params.convId}`,
    });

    logger.info('[push] nuovo messaggio', { conv: event.params.convId, ...esito });
  },
);
