import { useEffect, useState, useCallback } from 'react';

import {
  watchAuth,
  ensureProfile,
  logout,
  loginWithGoogle,
  resumeRedirectLogin,
} from '../services/auth';
import { subscribeProfile } from '../services/users';
import { isAdmin, isOrganizer, isActive, isBlocked } from '../roles';

/* Due sottoscrizioni annidate: la sessione Auth, e sopra di
   essa il documento users/{uid} in tempo reale. Serve la
   seconda perché un cambio di ruolo deve arrivare subito,
   senza obbligare l'utente a rifare il login. */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Completa un eventuale login via redirect (mobile) prima che
  // watchAuth si stabilizzi.
  useEffect(() => {
    resumeRedirectLogin().catch(() => { });
  }, []);

  useEffect(() => {
    let unsubProfile = null;

    const unsubAuth = watchAuth(async (u) => {
      unsubProfile?.();
      unsubProfile = null;
      setUser(u);

      if (!u) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      // Copre il caso di un profilo mancante: account creato dalla
      // console Firebase, o rimasto senza documento per un errore.
      await ensureProfile(u).catch(() => { });

      unsubProfile = subscribeProfile(
        u.uid,
        (p) => {
          setProfile(p);
          setAuthReady(true);
        },
        () => setAuthReady(true)
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const signInGoogle = useCallback(() => loginWithGoogle(), []);
  const signOut = useCallback(() => logout(), []);

  return {
    user,
    profile,
    authReady,
    role: profile?.role ?? null,
    isAdmin: isAdmin(profile),
    isOrganizer: isOrganizer(profile),
    isActive: isActive(profile),
    isBlocked: isBlocked(profile),
    signInGoogle,
    signOut,
  };
}

export default useAuth;