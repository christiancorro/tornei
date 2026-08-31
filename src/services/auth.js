/* ---------------------------------------------------------
   Auth service — solo Google.

   Un unico metodo di accesso significa nessuna password da
   gestire, nessun reset da implementare, nessun caso di
   "stessa email, due credenziali" da riconciliare.

   Il profilo in users/{uid} viene creato al primo accesso:
   è quel documento, non l'utente Auth, a decidere i permessi.
--------------------------------------------------------- */
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db, COL_USERS } from '../firebase';
import { ROLE_USER } from '../roles';

setPersistence(auth, browserLocalPersistence).catch(() => { });

/* `prompt: select_account` evita che chi ha più account Google
   venga loggato in automatico con quello sbagliato. */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureProfile(cred.user);
    return cred.user;
  } catch (err) {
    // Safari iOS e le webview di Instagram/Facebook bloccano i
    // popup: lì si passa al redirect, che completa al ritorno
    // in app dentro resumeRedirectLogin().
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

/* Chiamata una volta all'avvio da useAuth: raccoglie il
   risultato del redirect, se c'è stato. Senza, il flusso
   mobile si interrompe a metà. */
export async function resumeRedirectLogin() {
  const result = await getRedirectResult(auth).catch(() => null);
  if (result?.user) await ensureProfile(result.user);
  return result?.user ?? null;
}

export function logout() {
  return fbSignOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/* Crea users/{uid} se manca. Idempotente: la chiamiamo a ogni
   accesso. Il ruolo è sempre 'user' — le regole rifiutano
   qualsiasi altro valore in creazione. */
export async function ensureProfile(user) {
  if (!user) return null;
  const ref = doc(db, COL_USERS, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    // Se l'utente ha cambiato foto su Google, la riallineo. NON tocco
    // displayName: potrebbe averlo modificato dalle impostazioni, e
    // sovrascriverlo a ogni accesso vanificherebbe la modifica.
    if (user.photoURL && user.photoURL !== data.photoURL) {
      await updateDoc(ref, { photoURL: user.photoURL }).catch(() => { });
      return { ...data, photoURL: user.photoURL, uid: user.uid };
    }
    return { ...data, uid: user.uid };
  }

  const profile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL ?? '',
    role: ROLE_USER,
    createdAt: serverTimestamp(),
    onboardingCompletato: false,
  };
  await setDoc(ref, profile);
  return profile;
}

export function authErrorMessage(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Accesso annullato.';
    case 'auth/user-disabled':
      return 'Questo account è stato disattivato.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Connessione assente. Controlla la rete.';
    case 'auth/unauthorized-domain':
      return 'Dominio non autorizzato in Firebase Console → Authentication → Settings.';
    case 'auth/requires-recent-login':
      return 'Per sicurezza devi riaccedere prima di continuare.';
    case 'permission-denied':
      return 'Non hai i permessi per questa operazione.';
    default:
      return 'Operazione non riuscita. Riprova.';
  }
}
