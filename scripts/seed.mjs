/* ---------------------------------------------------------
   Script di amministrazione (Admin SDK — bypassa le regole,
   giralo solo dal tuo computer).

   Setup:
     Firebase Console > Impostazioni progetto > Account di servizio
     > "Genera nuova chiave privata" -> serviceAccount.json nella root
     npm install firebase-admin

   Comandi:
     node scripts/seed.mjs --admin tua@email.it   → ti rende admin
     node scripts/seed.mjs --seed                 → carica i dati di esempio
     node scripts/seed.mjs --list                 → elenca utenti e ruoli
--------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

import { INITIAL_TOURNAMENTS, INITIAL_ANNUNCI } from '../src/data.js';

const serviceAccount = JSON.parse(readFileSync('./serviceAccount.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

/* Crea (o aggiorna) il profilo e assegna un ruolo.
   Questa è l'unica via per creare il primo admin: le regole
   vietano di nascere admin, quindi qualcuno deve farlo da fuori. */
async function setRole(email, role) {
  const user = await getAuth().getUserByEmail(email);
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || email.split('@')[0],
      role,
      createdAt: FieldValue.serverTimestamp(),
      roleUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`✓ ${email} (${user.uid}) → ruolo "${role}"`);
}

async function listUsers() {
  const snap = await db.collection('users').get();
  if (snap.empty) return console.log('Nessun profilo utente.');
  snap.forEach((d) => {
    const u = d.data();
    console.log(`${(u.role ?? '?').padEnd(10)} ${(u.email ?? '').padEnd(32)} ${u.displayName ?? ''}`);
  });
}

/* I dati di esempio vengono attribuiti all'admin e nascono
   già pubblicati: sono contenuto seed, non proposte da moderare. */
async function seed(adminEmail) {
  const admin = adminEmail ? await getAuth().getUserByEmail(adminEmail) : null;

  let batch = db.batch();
  INITIAL_TOURNAMENTS.forEach(({ id, ...t }) => {
    batch.set(db.collection('tornei').doc(), {
      ...t,
      status: 'published',
      authorId: admin?.uid ?? 'seed',
      authorName: admin?.displayName ?? 'Seed',
      authorEmail: admin?.email ?? '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log(`✓ ${INITIAL_TOURNAMENTS.length} tornei caricati`);

  batch = db.batch();
  INITIAL_ANNUNCI.forEach(({ id, data, ...a }) => {
    batch.set(db.collection('annunci').doc(), {
      ...a,
      authorId: admin?.uid ?? 'seed',
      authorName: admin?.displayName ?? 'Seed',
      data: new Date(data).toISOString(),
      createdAt: new Date(data),
    });
  });
  await batch.commit();
  console.log(`✓ ${INITIAL_ANNUNCI.length} annunci caricati`);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? true;
};

try {
  if (args.includes('--list')) {
    await listUsers();
  } else if (flag('--admin')) {
    await setRole(flag('--admin'), 'admin');
  } else if (flag('--organizer')) {
    await setRole(flag('--organizer'), 'organizer');
  } else if (args.includes('--seed')) {
    await seed(flag('--as'));
  } else {
    console.log('Usa: --admin <email> | --organizer <email> | --seed [--as <email>] | --list');
  }
  process.exit(0);
} catch (err) {
  console.error('✗', err.message);
  process.exit(1);
}
