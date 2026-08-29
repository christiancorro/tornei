/* ---------------------------------------------------------
   Lettura del torneo da Firestore, dal bordo della rete.

   NESSUNA CREDENZIALE. Non è una dimenticanza: le regole del
   progetto dicono

     match /tornei/{torneoId} {
       allow read: if resource == null
         || isAdmin()
         || resource.data.status == 'published'
         || (isSignedIn() && resource.data.authorId == request.auth.uid);
     }

   e per un chiamante anonimo quel blocco si riduce a "i tornei
   pubblicati li legge chiunque". La REST API di Firestore
   rispetta le stesse regole del SDK web, quindi una GET senza
   Authorization e senza ?key= restituisce 200 sui tornei
   pubblicati e 403/404 su tutto il resto.

   È esattamente lo stesso permesso su cui gira già
   scripts/generate_sitemap.mjs. Il Worker non è più
   privilegiato di un visitatore qualsiasi: nel repository non
   finisce nessun service account, nessuna private key, nessun
   secret.
--------------------------------------------------------- */

/* Field mask: chiedo SOLO i campi che finiscono nella preview.
   Due motivi, entrambi voluti:
   • privacy — authorEmail, authorId e authorName non escono
     nemmeno da Firestore, quindi non possono finire nell'HTML
     nemmeno per sbaglio;
   • velocità — la risposta è di poche centinaia di byte invece
     del documento intero.

   `status` c'è perché serve a decidere se mostrare la preview,
   non perché venga stampato da qualche parte. */
const CAMPI = [
  'nome',
  'data',
  'dataFine',
  'luogo',
  'comune',
  'costo',
  'locandina',
  'locandinaThumb',
  'status',
  /* Da qui in giù: campi che NON servono alla preview social ma
     finiscono nel testo che leggono i crawler e nel JSON-LD.
     Restano tutti pubblici — sono gli stessi che il sito mostra
     nella card del torneo. authorEmail / authorId / authorName
     continuano a non essere chiesti, come prima. */
  'disciplina',
  'formati',
  'modalita',
  'ora',
  'organizzatore',
  'descrizioneOrganizzatore',
  'sitoWeb',
  'lat',
  'lng',
  'updatedAt',
];

/* Oltre questo tempo mollo il colpo e restituisco null: il sito
   deve caricare comunque, una preview generica è infinitamente
   meglio di una pagina che non arriva. */
const TIMEOUT_MS = 2000;

/* La query di lista attraversa più documenti della lettura
   singola: le concedo qualcosa in più, restando ben sotto il
   limite di CPU del piano gratuito. */
const TIMEOUT_LISTA_MS = 4000;

/* Firestore serializza ogni campo come { stringValue }, { integerValue },
   { arrayValue: { values: [...] } }... Qui mi servono solo le
   stringhe, ma normalizzo anche numeri e booleani per non
   sorprendermi se un campo cambia tipo. */
function valore(campo) {
  if (!campo || typeof campo !== 'object') return undefined;
  if ('stringValue' in campo) return campo.stringValue;
  if ('integerValue' in campo) return String(campo.integerValue);
  if ('doubleValue' in campo) return String(campo.doubleValue);
  if ('booleanValue' in campo) return campo.booleanValue;
  if ('timestampValue' in campo) return campo.timestampValue;
  /* `formati` è l'unico array del documento: ['2x2', '4x4']. Senza
     questo ramo tornava undefined e spariva dal testo. */
  if ('arrayValue' in campo) {
    const values = (campo.arrayValue && campo.arrayValue.values) || [];
    return values.map(valore).filter((v) => v !== undefined);
  }
  if ('nullValue' in campo) return null;
  return undefined;
}

function documentoAOggetto(doc) {
  const fields = doc && doc.fields;
  if (!fields || typeof fields !== 'object') return null;
  const out = {};
  for (const k of CAMPI) {
    const v = valore(fields[k]);
    if (v !== undefined) out[k] = v;
  }
  /* L'id (= lo slug, = l'URL) non sta nei fields: è l'ultimo
     segmento di doc.name. Alla lettura singola non serviva perché
     lo slug lo sapevamo già; nella lista sì, è quello che ci va
     nel link. */
  if (typeof doc.name === 'string') {
    const id = doc.name.split('/').pop();
    if (id) out.id = id;
  }
  if (!Array.isArray(out.formati)) out.formati = [];
  return out;
}

/* ---------------------------------------------------------
   getTorneo(slug, env)

   Ritorna l'oggetto torneo se esiste ED è pubblicato, altrimenti
   null. Non lancia mai: ogni errore (404, 403, rete giù, JSON
   malformato, timeout) diventa null, e chi chiama sa che null
   vuol dire "prosegui senza preview specifica".
--------------------------------------------------------- */
export async function getTorneo(slug, env) {
  const progetto = env.FIREBASE_PROJECT_ID;
  const collection = env.FIRESTORE_COLLECTION || 'tornei';
  if (!progetto || !slug) return null;

  const mask = CAMPI.map((c) => `mask.fieldPaths=${c}`).join('&');
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(progetto)}` +
    `/databases/(default)/documents/${encodeURIComponent(collection)}` +
    `/${encodeURIComponent(slug)}?${mask}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // 404 = torneo inesistente. 403 = esiste ma non è leggibile,
    // cioè non è pubblicato. In entrambi i casi: preview generica.
    if (!res.ok) return null;

    const json = await res.json();
    const torneo = documentoAOggetto(json);
    if (!torneo) return null;

    // Il gate vero. Bozze e tornei rifiutati non hanno preview:
    // sarebbe pubblicare un torneo che l'admin non ha approvato.
    if (torneo.status !== 'published') return null;

    return torneo;
  } catch (err) {
    // Timeout, DNS, TLS, JSON rotto: tutto qui dentro, e tutto
    // finisce nello stesso modo — il sito continua a funzionare.
    return null;
  }
}

/* ---------------------------------------------------------
   listTornei(env, daISO, limite)

   La lista dei tornei dalla data indicata in poi, ordinata per
   data. È quella che diventa la tabella in homepage e la
   sitemap — cioè la pagina che risponde davvero a "quali tornei
   ci sono la prossima settimana in Friuli".

   Il filtro status == 'published' non è cosmetico: le regole
   rifiutano una query che POTREBBE restituire documenti non
   leggibili, quindi senza quel where l'intera lettura fallisce
   con 403. Con il where, un chiamante anonimo passa.

   Stessa disciplina di getTorneo: nessuna credenziale, timeout
   corto, e qualunque cosa vada storta diventa [] — la home
   perde la tabella, non si spacca.
--------------------------------------------------------- */
export async function listTornei(env, daISO, limite = 300) {
  const progetto = env.FIREBASE_PROJECT_ID;
  const collection = env.FIRESTORE_COLLECTION || 'tornei';
  if (!progetto) return [];

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(progetto)}` +
    '/databases/(default)/documents:runQuery';

  const query = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      /* select fa per la query quello che la field mask fa per la
         lettura singola: torna solo quello che ci serve. */
      select: { fields: CAMPI.map((f) => ({ fieldPath: f })) },
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'published' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'data' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { stringValue: String(daISO) },
              },
            },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'ASCENDING' }],
      limit: limite,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(TIMEOUT_LISTA_MS),
    });
    if (!res.ok) return [];

    const righe = await res.json();
    if (!Array.isArray(righe)) return [];

    return righe
      .map((r) => (r && r.document ? documentoAOggetto(r.document) : null))
      .filter((t) => t && t.status === 'published' && t.nome && t.data);
  } catch (err) {
    return [];
  }
}

export async function listAnnunci(env, limite = 100) {
  const progetto = env.FIREBASE_PROJECT_ID;
  if (!progetto) return [];

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(progetto)}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'annunci' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: limite,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const righe = await res.json();
    if (!Array.isArray(righe)) return [];

    return righe.map(r => {
      const f = r?.document?.fields;
      if (!f) return null;
      return {
        id: r.document.name.split('/').pop(),
        tipo: f.tipo?.stringValue || '',
        testo: f.testo?.stringValue || '',
        authorName: f.authorName?.stringValue || '',
      };
    }).filter(a => a);
  } catch (err) {
    return [];
  }
}