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
  'ora',
  'luogo',
  'comune',
  'locandina',
  'locandinaThumb',
  'status',
];

/* Oltre questo tempo mollo il colpo e restituisco null: il sito
   deve caricare comunque, una preview generica è infinitamente
   meglio di una pagina che non arriva. */
const TIMEOUT_MS = 2000;

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
