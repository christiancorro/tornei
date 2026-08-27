/* ---------------------------------------------------------
   Notifiche push — la parte nel browser.

   Il giro completo, in breve:
     1. l'utente dà il permesso al browser;
     2. FCM restituisce un "token", cioè l'indirizzo a cui si
        possono recapitare notifiche a QUESTO browser;
     3. il token finisce in Firestore (pushTokens/{token}) insieme
        alle preferenze;
     4. le Cloud Functions leggono quella collection e inviano.

   Due cose da tenere a mente perché il modello torni:

   • Il token è del BROWSER, non della persona. Stesso utente su
     telefono e computer = due token. Per questo le preferenze
     stanno sul token, e quando un utente loggato le cambia le
     riscriviamo su tutti i suoi token: così il comportamento è
     "per account" anche se la meccanica è per dispositivo.

   • Chi non è loggato ha comunque un token, con uid a null e
     tutte le notifiche accese. Non ha impostazioni da cambiare
     (non ha nemmeno la pagina Account): può solo attivare o
     disattivare tutto dal banner.
--------------------------------------------------------- */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import app, { db } from '../firebase';

const COL_TOKEN = 'pushTokens';

/* Chiave pubblica VAPID del progetto (Console Firebase →
   Impostazioni progetto → Cloud Messaging → Certificati push web).
   È pubblica per definizione: identifica il mittente, non autorizza
   nessuno a inviare. */
const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/* Il token corrente lo teniamo anche qui: rileggerlo da FCM
   costerebbe una chiamata di rete ad ogni apertura delle
   impostazioni, e serve solo a sapere QUALE documento leggere. */
const CHIAVE_LOCALE = 'vfvg-push-token';

/* Cosa arriva a chi attiva le notifiche senza scegliere niente.

   Gli annunci partono SPENTI: la bacheca si muove più spesso dei
   tornei e vale meno per chi passa di qui — un "cerco squadra" non
   è una notizia per tutti. Chi li vuole li accende in
   Impostazioni; chi non è loggato non li riceverà mai, ed è la
   conseguenza voluta di questa scelta. */
export const PREFERENZE_DEFAULT = {
  tornei: true,
  annunci: false,
  messaggi: true,
  /* Roba da amministratori: tornei in coda e suggerimenti. La
     preferenza sta su tutti i token, ma il server la guarda solo
     per chi ha davvero il ruolo admin — su chiunque altro è un
     booleano che non fa succedere niente. */
  admin: true,
};

/* Import dinamico: firebase/messaging tira dentro il suo pezzo di
   SDK e su browser che non supportano il push fallisce all'import.
   Caricandolo solo quando serve, chi non attiva mai le notifiche
   non se lo scarica nemmeno. */
async function messaging() {
  const mod = await import('firebase/messaging');
  return { mod, istanza: mod.getMessaging(app) };
}

let supportateCache = null;

/* Il push si può fare qui? Serve tutto: API del browser, service
   worker, e la chiave VAPID configurata. Safari su iPhone risponde
   sì solo se il sito è stato aggiunto alla schermata Home — fuori
   da lì Apple non recapita niente, e non c'è modo di aggirarlo. */
export async function pushSupportato() {
  if (supportateCache !== null) return supportateCache;

  if (typeof window === 'undefined' || !VAPID) {
    supportateCache = false;
    return false;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    supportateCache = false;
    return false;
  }

  try {
    const { mod } = await messaging();
    supportateCache = await mod.isSupported();
  } catch {
    supportateCache = false;
  }

  return supportateCache;
}

export function permessoNotifiche() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export function tokenSalvato() {
  try {
    return window.localStorage.getItem(CHIAVE_LOCALE) || null;
  } catch {
    return null;
  }
}

function ricordaToken(token) {
  try {
    if (token) window.localStorage.setItem(CHIAVE_LOCALE, token);
    else window.localStorage.removeItem(CHIAVE_LOCALE);
  } catch {
    /* localStorage negato (Safari in navigazione privata): pazienza,
       si perde solo la scorciatoia per rileggere le preferenze. */
  }
}

/* FCM ha bisogno di un service worker a cui consegnare i push.
   Riusiamo quello del sito (public/sw.js), che gestisce già la
   cache offline: due service worker sulla stessa origine si
   contenderebbero lo scope. In sviluppo main.jsx non lo registra,
   quindi qui lo registriamo al volo se manca. */
async function registrazioneSW() {
  const esistente = await navigator.serviceWorker.getRegistration('/');
  if (esistente) return esistente;
  return navigator.serviceWorker.register('/sw.js');
}

function descrizioneDispositivo() {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone/iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/macintosh/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Browser';
}

/* Chiede il permesso, si fa dare il token e lo registra.

   Ritorna { esito, token }:
     'ok'        → attivate
     'negato'    → l'utente ha detto no (o l'aveva già detto prima)
     'non-supportato'
   Gli errori veri (rete, VAPID sbagliata) escono come eccezione:
   chi chiama li mostra, perché sono problemi da sistemare. */
export async function attivaPush(uid = null) {
  if (!(await pushSupportato())) return { esito: 'non-supportato', token: null };

  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return { esito: 'negato', token: null };

  const registration = await registrazioneSW();
  const { mod, istanza } = await messaging();

  const token = await mod.getToken(istanza, {
    vapidKey: VAPID,
    serviceWorkerRegistration: registration,
  });

  if (!token) return { esito: 'negato', token: null };

  /* merge: se il token c'era già (stesso browser, seconda
     attivazione) le preferenze scelte prima restano. */
  await setDoc(
    doc(db, COL_TOKEN, token),
    {
      uid: uid ?? null,
      prefs: PREFERENZE_DEFAULT,
      dispositivo: descrizioneDispositivo(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  ricordaToken(token);
  return { esito: 'ok', token };
}

/* Spegne le notifiche su questo dispositivo: via il documento e via
   il token da FCM. Il permesso del browser resta dato — quello si
   toglie solo dalle impostazioni del browser, e va bene così:
   riattivare non richiederà un altro popup. */
export async function disattivaPush() {
  const token = tokenSalvato();

  if (token) {
    await deleteDoc(doc(db, COL_TOKEN, token)).catch(() => { });
  }

  try {
    const { mod, istanza } = await messaging();
    await mod.deleteToken(istanza);
  } catch {
    /* Se FCM non riesce a revocare il token pazienza: senza il
       documento in Firestore non lo useremo comunque più. */
  }

  ricordaToken(null);
}

/* Le preferenze di questo dispositivo. `null` = notifiche non
   attive qui (nessun token registrato). */
export async function leggiPreferenze() {
  const token = tokenSalvato();
  if (!token) return null;

  const snap = await getDoc(doc(db, COL_TOKEN, token));
  if (!snap.exists()) return null;

  return { ...PREFERENZE_DEFAULT, ...(snap.data().prefs ?? {}) };
}

/* Salva le preferenze. Se l'utente è loggato le applica a tutti i
   suoi dispositivi: le impostazioni sono dentro l'account, e
   sarebbe bizzarro che spegnere una notifica sul telefono la
   lasciasse accesa sul computer. */
export async function salvaPreferenze(prefs, uid = null) {
  const token = tokenSalvato();
  const puliti = { ...PREFERENZE_DEFAULT, ...prefs };

  if (!uid) {
    if (!token) return;
    await updateDoc(doc(db, COL_TOKEN, token), { prefs: puliti, updatedAt: serverTimestamp() });
    return;
  }

  const snap = await getDocs(query(collection(db, COL_TOKEN), where('uid', '==', uid)));

  const batch = writeBatch(db);
  let trovati = 0;

  snap.docs.forEach((d) => {
    batch.update(d.ref, { prefs: puliti, updatedAt: serverTimestamp() });
    trovati += 1;
  });

  /* Il token di questo browser potrebbe non essere ancora legato
     all'account (attivato da sloggato, login appena fatto): lo
     aggiorno comunque, così le impostazioni fanno effetto subito. */
  if (token && !snap.docs.some((d) => d.id === token)) {
    batch.set(
      doc(db, COL_TOKEN, token),
      { uid, prefs: puliti, updatedAt: serverTimestamp() },
      { merge: true },
    );
    trovati += 1;
  }

  if (trovati) await batch.commit();
}

/* Al login: attacca il token di questo browser all'account, così i
   messaggi privati sanno dove arrivare. Al logout si passa null e
   il token torna anonimo — continua a ricevere tornei e annunci,
   non i messaggi di nessuno. */
export async function collegaToken(uid) {
  const token = tokenSalvato();
  if (!token) return;

  await setDoc(
    doc(db, COL_TOKEN, token),
    { uid: uid ?? null, updatedAt: serverTimestamp() },
    { merge: true },
  ).catch(() => { });
}