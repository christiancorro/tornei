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
// ESEMPIO
// node scripts/seed.mjs --delete-user christian.corro@mail.it  


import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

/* Trova l'uid partendo dall'email, guardando prima in Auth e poi
   in Firestore. Servono entrambi: un profilo può sopravvivere
   all'account (è la "lapide" che lascia la dashboard admin), e un
   account può esistere senza profilo se qualcosa è andato storto
   alla registrazione. */
async function resolveUser(email) {
  let authUser = null;
  try {
    authUser = await getAuth().getUserByEmail(email);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  const snap = await db.collection('users').where('email', '==', email).get();
  const profileUid = snap.empty ? null : snap.docs[0].id;

  const uid = authUser?.uid ?? profileUid;
  if (!uid) throw new Error(`Nessun utente con email ${email}.`);

  return { uid, hasAuth: Boolean(authUser), hasProfile: Boolean(profileUid) };
}

async function deleteQuery(q, label) {
  const snap = await q.get();
  if (!snap.empty) {
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  console.log(`  ${snap.size} ${label}`);
}

async function deleteUser(email) {
  const { uid, hasAuth, hasProfile } = await resolveUser(email);
  console.log(`Elimino ${email} (${uid})...`);

  await deleteQuery(db.collection('tornei').where('authorId', '==', uid), 'tornei');
  await deleteQuery(db.collection('annunci').where('authorId', '==', uid), 'annunci');

  // Firestore non cancella le subcollection a cascata: ogni thread
  // va svuotato prima di rimuovere il documento che lo contiene.
  const convs = await db.collection('conversazioni')
    .where('participants', 'array-contains', uid).get();
  for (const c of convs.docs) {
    const msgs = await c.ref.collection('messaggi').get();
    const batch = db.batch();
    msgs.forEach((m) => batch.delete(m.ref));
    batch.delete(c.ref);
    await batch.commit();
  }
  console.log(`  ${convs.size} conversazioni`);

  if (hasProfile) {
    await db.collection('users').doc(uid).delete();
    console.log('  profilo rimosso');
  }

  if (hasAuth) {
    await getAuth().deleteUser(uid);
    console.log('  account Auth rimosso');
  } else {
    console.log('  (nessun account Auth: era già stato eliminato)');
  }

  console.log(`✓ ${email} eliminato completamente`);
}

async function listUsers() {
  const snap = await db.collection('users').get();
  if (snap.empty) return console.log('Nessun profilo utente.');

  // Segnalo i profili senza account Auth: sono lapidi o residui,
  // e spiegano perché un --delete-user sembrava "non funzionare".
  const authUids = new Set();
  let page = await getAuth().listUsers(1000);
  page.users.forEach((u) => authUids.add(u.uid));
  while (page.pageToken) {
    page = await getAuth().listUsers(1000, page.pageToken);
    page.users.forEach((u) => authUids.add(u.uid));
  }

  snap.forEach((d) => {
    const u = d.data();
    const orfano = authUids.has(d.id) ? '' : '  ← senza account Auth';
    console.log(
      `${(u.role ?? '?').padEnd(10)} ${(u.email ?? '').padEnd(32)} ${u.displayName ?? ''}${orfano}`
    );
  });
}


const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? true;
};

try {
  if (args.includes('--list')) {
    await listUsers();
  } else if (flag('--delete-user')) {
    await deleteUser(flag('--delete-user'));
  } else if (flag('--admin')) {
    await setRole(flag('--admin'), 'admin');
  } else if (flag('--organizer')) {
    await setRole(flag('--organizer'), 'organizer');
  } else {
    console.log(
      'Usa: --list | --admin <email> | --organizer <email> | --delete-user <email> | --seed [--as <email>]'
    );
  }
  process.exit(0);
} catch (err) {
  console.error('✗', err.message);
  process.exit(1);
}
