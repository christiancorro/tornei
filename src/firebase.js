/* ---------------------------------------------------------
   Firebase initialization.

   La config web non è un segreto: identifica il progetto, non
   autorizza niente. A proteggere i dati sono firestore.rules.
--------------------------------------------------------- */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
   appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* Nomi delle collection in un posto solo, così un typo
   non può spaccare i dati in due. */
export const COL_USERS = 'users';
export const COL_TORNEI = 'tornei';
export const COL_ANNUNCI = 'annunci';
export const COL_CONVERSAZIONI = 'conversazioni';
export const SUB_MESSAGGI = 'messaggi';
export const COL_RICHIESTE = 'richieste';

export default app;
