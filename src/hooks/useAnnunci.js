import { useEffect, useState, useCallback } from 'react';

import {
  subscribeAnnunci,
  subscribeMyAnnunci,
  createAnnuncio,
  deleteAnnuncio,
} from '../services/annunci';

export function useAnnunci() {
  const [annunci, setAnnunci] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return subscribeAnnunci(
      (list) => { setAnnunci(list); setLoading(false); setError(null); },
      (err) => {
        console.error('[annunci]', err);
        setError('Non riesco a caricare la bacheca.');
        setLoading(false);
      }
    );
  }, []);

  const publish = useCallback((payload, profile) => createAnnuncio(payload, profile), []);
  const remove = useCallback((id) => deleteAnnuncio(id), []);

  return { annunci, loading, error, publish, remove };
}

export function useMyAnnunci(uid) {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) { setMine([]); setLoading(false); return; }
    setLoading(true);
    return subscribeMyAnnunci(
      uid,
      (list) => { setMine(list); setLoading(false); },
      (err) => { console.error('[miei annunci]', err); setLoading(false); }
    );
  }, [uid]);

  return { mine, loading };
}

export default useAnnunci;
