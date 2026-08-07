import { useEffect, useState, useCallback } from 'react';

import {
  subscribePublished,
  subscribePending,
  subscribeMine,
  saveTournament,
  deleteTournament,
  approveTournament,
  rejectTournament,
} from '../services/tournaments';

/* Elenco pubblico: solo i tornei approvati. */
export function useTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return subscribePublished(
      (list) => { setTournaments(list); setLoading(false); setError(null); },
      (err) => {
        console.error('[tornei]', err);
        setError('Non riesco a caricare i tornei.');
        setLoading(false);
      }
    );
  }, []);

  const save = useCallback((t, profile) => saveTournament(t, profile), []);
  const remove = useCallback((t) => deleteTournament(t), []);

  return { tournaments, loading, error, save, remove };
}

/* Coda di moderazione. Il listener parte solo se sei admin:
   per chiunque altro la query fallirebbe con permission-denied. */
export function usePendingTournaments(enabled) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled) { setPending([]); setLoading(false); return; }
    setLoading(true);
    return subscribePending(
      (list) => { setPending(list); setLoading(false); },
      (err) => { console.error('[pending]', err); setLoading(false); }
    );
  }, [enabled]);

  const approve = useCallback((t, adminUid) => approveTournament(t, adminUid), []);
  const reject = useCallback((t, adminUid, motivo) => rejectTournament(t, adminUid, motivo), []);

  return { pending, loading, approve, reject };
}

/* "I miei tornei" — tutti i propri, in qualsiasi stato. */
export function useMyTournaments(uid) {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) { setMine([]); setLoading(false); return; }
    setLoading(true);
    return subscribeMine(
      uid,
      (list) => { setMine(list); setLoading(false); },
      (err) => { console.error('[miei tornei]', err); setLoading(false); }
    );
  }, [uid]);

  return { mine, loading };
}

export default useTournaments;
