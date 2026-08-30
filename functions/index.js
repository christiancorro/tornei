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
   metti quella (nam5 → us-central1).

   Vale per tutte le funzioni di questo file. Se un domani ne
   aggiungi una che deve stare altrove, la regione si può mettere
   anche sulla singola: onDocumentCreated({ document: '...',
   region: '...' }, ...). */
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

/* Come sopra, ma di una persona sola: serve ai messaggi e alle
   notifiche di servizio, che vanno a qualcuno di preciso.

   Qui la preferenza NON è nella query ma nel filtro in memoria, e
   la differenza conta: `where('prefs.admin', '==', true)` non
   trova i documenti in cui quel campo non esiste, e i token
   registrati prima che la preferenza fosse aggiunta non ce l'hanno.
   Sarebbero rimasti invisibili per sempre, senza errori, senza
   log — semplicemente zero destinatari.

   Filtrando qui, una preferenza mancante vale "accesa": è il
   default con cui verrebbe scritta comunque, e vale per tutte
   quelle che verranno aggiunte in futuro. Costa una lettura per
   token della persona, che sono uno o due. */
async function tokenDiUtente(uid, tipo) {
  if (!uid) return [];

  const snap = await db.collection(COL_TOKEN).where('uid', '==', uid).get();

  return snap.docs
    .filter((d) => d.data()?.prefs?.[tipo] !== false)
    .map((d) => d.id);
}

/* I token di chi amministra il sito, per le notifiche di servizio
   (roba da approvare, suggerimenti in arrivo).

   Gli admin si leggono da `users` invece di tenerne una lista a
   parte: il ruolo è già lì ed è la stessa fonte che usano le regole
   di sicurezza. Sono pochissimi, quindi una query per ciascuno non
   è un problema. */
async function tokenDegliAdmin() {
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  if (admins.empty) return [];

  const liste = await Promise.all(
    admins.docs.map((d) => tokenDiUtente(d.id, 'admin')),
  );

  return liste.flat();
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
   1. Torneo appena creato. Due strade a seconda di com'è nato:

      • già pubblicato (organizzatore o admin) → lo sanno tutti;
      • in coda (proposto da un utente) → lo sanno gli admin, che
        sono gli unici che possono farci qualcosa. Nessun altro
        deve sapere che esiste un torneo non ancora approvato.
--------------------------------------------------------- */
exports.notificaNuovoTorneo = onDocumentCreated('tornei/{torneoId}', async (event) => {
  const torneo = event.data?.data();
  if (!torneo) return;

  if (torneo.status === 'published') {
    const tokens = await senzaAutore(await tokenPerTipo('tornei'), torneo.authorId);
    const esito = await invia(tokens, notificaTorneo(event.params.torneoId, torneo));

    logger.info('[push] nuovo torneo', { id: event.params.torneoId, ...esito });
    return;
  }

  if (torneo.status === 'pending') {
    const tokens = await senzaAutore(await tokenDegliAdmin(), torneo.authorId);
    const esito = await invia(tokens, {
      titolo: 'Torneo da approvare',
      corpo: `${taglia(torneo.nome, 50)} — proposto da ${taglia(torneo.authorName || 'un utente', 30)}`,
      url: `${SITO}/?vista=admin`,
      tag: `pending-${event.params.torneoId}`,
    });

    logger.info('[push] torneo in coda', { id: event.params.torneoId, ...esito });
  }
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

  const [tokensPubblico, tokensAutore] = await Promise.all([
    senzaAutore(await tokenPerTipo('tornei'), dopo.authorId),
    tokenDiUtente(dopo.authorId, 'tornei'),
  ]);

  const [esitoPubblico, esitoAutore] = await Promise.all([
    invia(tokensPubblico, notificaTorneo(event.params.torneoId, dopo)),
    invia(tokensAutore, {
      titolo: 'Il tuo torneo è stato approvato! 🎉',
      corpo: `"${taglia(dopo.nome, 60)}" è ora online e visibile a tutti.`,
      url: `${SITO}/?torneo=${event.params.torneoId}`,
      tag: `approvato-${event.params.torneoId}`,
    }),
  ]);

  logger.info('[push] torneo approvato', {
    id: event.params.torneoId,
    pubblico: esitoPubblico,
    autore: esitoAutore,
  });
});

/* ---------------------------------------------------------
   3. Nuovo annuncio in bacheca.
--------------------------------------------------------- */
exports.notificaNuovoAnnuncio = onDocumentCreated('annunci/{annuncioId}', async (event) => {
  const annuncio = event.data?.data();
  if (!annuncio) return;

  const titolo = annuncio.tipo === 'cerca_giocatore'
    ? 'Cercasi giocatori'
    : 'Qualcuno sta cercando una squadra';

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
   4. Nuovo suggerimento dagli utenti: va agli admin.

      Come i tornei in coda, è una notifica di servizio: segnala
      qualcosa che aspetta una risposta, e la aspetta da loro.
--------------------------------------------------------- */
exports.notificaNuovaRichiesta = onDocumentCreated('richieste/{richiestaId}', async (event) => {
  const richiesta = event.data?.data();
  if (!richiesta) return;

  const tokens = await senzaAutore(await tokenDegliAdmin(), richiesta.authorId);
  const esito = await invia(tokens, {
    titolo: `Suggerimento da ${taglia(richiesta.authorName || 'un utente', 30)}`,
    corpo: taglia(richiesta.testo, 120),
    url: `${SITO}/?vista=admin`,
    tag: `richiesta-${event.params.richiestaId}`,
  });

  logger.info('[push] nuova richiesta', { id: event.params.richiestaId, ...esito });
});

/* ---------------------------------------------------------
   5. Nuovo messaggio in una conversazione.

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