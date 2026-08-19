/* ---------------------------------------------------------
   generate-sitemap.mjs

   Rigenera public/sitemap.xml leggendo i tornei "pubblicati"
   direttamente da Firestore, così Google trova un URL per
   ciascun torneo attualmente attivo.

   USO:
     # Con le stesse VITE_FIREBASE_* già configurate per il build:
     node scripts/generate-sitemap.mjs

     # Con dominio esplicito (override del default volleyfvg.it):
     VITE_SITE_URL=https://volleyfvg.it node scripts/generate-sitemap.mjs

   INTEGRARLO NEL BUILD:
     In package.json, cambia lo script "build" così:
       "build": "node scripts/generate-sitemap.mjs && vite build"
     La sitemap finisce in public/ prima che Vite copi tutto in dist/,
     quindi Firebase Hosting la serve senza altre config.

   NOTE:
   - Legge SOLO i tornei con status "pubblicato": bozze e rifiuti
     non finiscono nell'indice.
   - Se Firestore non è raggiungibile (rete giù, credenziali
     mancanti), lo script NON blocca il build: stampa un warning e
     lascia in piedi la sitemap statica esistente. Meglio un indice
     un po' stale che nessun deploy.
   - Non serve firebase-admin: la config web + le regole di lettura
     pubbliche (`allow read: if resource.data.status == "pubblicato"`)
     bastano. Se il tuo firestore.rules è più restrittivo, converti
     lo script a firebase-admin col service account.
--------------------------------------------------------- */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'public', 'sitemap.xml');

const SITE_URL = (process.env.VITE_SITE_URL || 'https://volleyfvg.it').replace(/\/$/, '');

/* Carico le variabili d'ambiente da .env / .env.local se presenti:
   il repo non le committa, ma il dev le ha in locale per Vite. */
function loadDotenv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(__dirname, '..', name);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf8');
    for (const riga of txt.split('\n')) {
      const line = riga.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      // Strip virgolette se presenti
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}
loadDotenv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

/* Escaping XML minimale: & < > " '. Basta per gli id di Firestore
   (alfanumerici) ma è cauto per eventuali future modifiche. */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* Data di ultima modifica in formato W3C (`YYYY-MM-DD`). Preferisco
   solo la data perché è l'informazione utile a Google e non svela
   l'ora del deploy. */
function toW3CDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractDate(d) {
  // Firestore Timestamp → Date; oppure ISO string; oppure null.
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  const parsed = new Date(d);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function buildXml(urls) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const u of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(u.loc)}</loc>`);
    if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    if (u.changefreq) lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
    if (u.priority != null) lines.push(`    <priority>${u.priority}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

async function main() {
  const urls = [
    // Homepage sempre presente, priorità massima.
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: 1.0 },
  ];

  const configPronta =
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;

  if (!configPronta) {
    console.warn('[sitemap] VITE_FIREBASE_* mancanti: scrivo solo la homepage.');
  } else {
    try {
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const q = query(collection(db, 'tornei'), where('status', '==', 'pubblicato'));
      const snap = await getDocs(q);
      let contati = 0;
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const lastmodDate = extractDate(d.updatedAt) || extractDate(d.createdAt);
        urls.push({
          // Deep link riconosciuto da app.jsx: apre la card del torneo.
          loc: `${SITE_URL}/?torneo=${encodeURIComponent(docSnap.id)}`,
          lastmod: lastmodDate ? toW3CDate(lastmodDate) : undefined,
          changefreq: 'weekly',
          priority: 0.8,
        });
        contati += 1;
      });
      console.log(`[sitemap] ${contati} tornei pubblicati indicizzati.`);
    } catch (err) {
      console.warn('[sitemap] lettura Firestore fallita, uso solo homepage:', err.message);
    }
  }

  const xml = buildXml(urls);
  writeFileSync(OUT_PATH, xml, 'utf8');
  console.log(`[sitemap] scritto ${OUT_PATH} (${urls.length} URL, ${SITE_URL}).`);
}

main().catch((err) => {
  console.error('[sitemap] errore fatale:', err);
  process.exit(1);
});
