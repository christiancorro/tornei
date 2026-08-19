/* ---------------------------------------------------------
   migrate-tornei-slug.mjs

   Rinomina tutti i doc di /tornei dall'ID auto-generato di
   Firestore (es. "A9Fk7bLc2P") al nuovo formato slug basato
   su nome + data: "<nome-slug>-<gg>-<mm>-<aaaa>".

   Esempio:  A9Fk7bLc2P  →  finale-serie-c-15-06-2026

   REQUISITI
   ---------
   1. Service account JSON di Firebase Admin.
      Firebase Console → Impostazioni progetto → Service accounts
      → "Genera nuova chiave privata". Salva come
      scripts/serviceAccount.json.
   2. **AGGIUNGI scripts/serviceAccount.json a .gitignore.**
      È una credenziale privilegiata: non deve mai finire su
      GitHub.
   3. npm install firebase-admin  (una tantum)

   USO
   ---
     # Dry-run: mostra il piano senza scrivere niente
     node scripts/migrate-tornei-slug.mjs --dry-run

     # Esecuzione reale
     node scripts/migrate-tornei-slug.mjs

   COSA FA
   -------
   - Legge TUTTI i documenti di /tornei (bypassa le rules grazie
     ad admin SDK).
   - Calcola lo slug ideale per ognuno.
   - Se un doc ha già lo slug ideale (o suo derivato -2, -3),
     lo salta.
   - Assegna gli slug garantendo unicità: prima "prenota" quelli
     dei doc che restano invariati, poi assegna il resto.
   - Per ogni rename usa un batch atomico (set nuovo + delete
     vecchio): niente stato intermedio dove il torneo esiste su
     entrambi gli ID o su nessuno.

   COSA NON FA
   -----------
   - Non tocca Firebase Storage. I path delle locandine sono
     `locandine/<random>.<ext>` — indipendenti dall'ID torneo.
   - Non aggiorna la sitemap (viene rigenerata al prossimo build).
   - Non crea redirect dai vecchi ID. Se qualcuno ha bookmarkato
     un vecchio URL, dopo la migrazione riceve la pagina base
     dell'app (l'ID non risolve più). Per crawler / Google
     l'impatto è nullo perché la sitemap sarà rigenerata con i
     nuovi ID e Google reindicizzerà. Se ti serve la retro-
     compatibilità URL, fammi sapere e aggiungo un campo
     `previousIds` sul doc + fallback nel resolver dell'app.

   IDEMPOTENZA
   -----------
   Puoi lanciarlo più volte: al secondo giro tutti i doc hanno
   già lo slug atteso e vengono saltati. La check è basata sul
   pattern `^<idealSlug>(-\\d+)?$`, quindi anche i doc migrati
   con suffisso -2/-3 non vengono ri-rinominati.
--------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// API modulare di firebase-admin v12+: `cert` e `initializeApp`
// arrivano da 'firebase-admin/app', `getFirestore` dal proprio
// entry-point. Il vecchio `admin.credential.cert(...)` non è più
// disponibile via default import in ESM.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_PATH = join(__dirname, 'serviceAccount.json');
const DRY = process.argv.includes('--dry-run');

const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/* Mesi in italiano abbreviati. DEVE stare in sync con MESI_SLUG in
   src/services/tournaments.js — se cambi uno dei due i nuovi tornei
   nascono con slug diverso dai vecchi migrati e non hai più
   idempotenza sulla rerun della migrazione. */
const MESI_SLUG = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];

function slugTorneo(nome, dataISO) {
  const base = slugify(nome) || 'torneo';
  if (typeof dataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
    const [y, m, d] = dataISO.split('-');
    const mese = MESI_SLUG[parseInt(m, 10) - 1] || m;
    const giorno = String(parseInt(d, 10));
    return `${base}-${giorno}-${mese}-${y}`;
  }
  return base;
}

/* Un doc "ha già slug" se il suo id è idealSlug o idealSlug-N.
   Se sì, lo lascio dov'è così l'URL resta stabile fra migrazioni. */
function haGiaSlug(oldId, idealSlug) {
  if (oldId === idealSlug) return true;
  const re = new RegExp(`^${idealSlug.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}-\\d+$`);
  return re.test(oldId);
}

async function main() {
  console.log(`[migrate] modalità: ${DRY ? 'DRY-RUN (nessuna scrittura)' : 'REALE'}`);
  const snap = await db.collection('tornei').get();
  console.log(`[migrate] trovati ${snap.size} tornei totali.`);

  const kept = new Set();            // ID già validi, non toccati
  const toRename = [];               // { oldId, data, idealSlug }

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const oldId = docSnap.id;
    const idealSlug = slugTorneo(data.nome, data.data);
    if (haGiaSlug(oldId, idealSlug)) {
      kept.add(oldId);
    } else {
      toRename.push({ oldId, data, idealSlug });
    }
  }

  console.log(`[migrate] ${kept.size} già slug (nessuna azione).`);
  console.log(`[migrate] ${toRename.length} da rinominare.`);

  // Assegnazione slug con collision-handling: prima "prenoto"
  // quelli tenuti così non li possiamo sovrascrivere.
  const used = new Set(kept);
  const plan = [];

  for (const item of toRename) {
    let candidato = item.idealSlug;
    let n = 2;
    while (used.has(candidato)) {
      candidato = `${item.idealSlug}-${n}`;
      n += 1;
    }
    used.add(candidato);
    plan.push({ oldId: item.oldId, newId: candidato, data: item.data });
  }

  for (const p of plan) {
    console.log(`  ${p.oldId}  →  ${p.newId}  (${p.data.nome || '(no name)'} / ${p.data.data || '(no date)'})`);
  }

  if (DRY) {
    console.log('[migrate] DRY-RUN: fine. Rilancia senza --dry-run per applicare.');
    return;
  }

  if (plan.length === 0) {
    console.log('[migrate] niente da fare.');
    return;
  }

  console.log(`[migrate] applico ${plan.length} rename...`);
  let done = 0;
  for (const p of plan) {
    const batch = db.batch();
    batch.set(db.collection('tornei').doc(p.newId), p.data);
    batch.delete(db.collection('tornei').doc(p.oldId));
    await batch.commit();
    done += 1;
    process.stdout.write(`\r[migrate] ${done}/${plan.length}`);
  }
  process.stdout.write('\n');
  console.log('[migrate] completato.');
}

main().catch((err) => {
  console.error('[migrate] errore fatale:', err);
  process.exit(1);
});