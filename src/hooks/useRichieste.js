import { useEffect, useState, useCallback } from 'react';

import {
  subscribeRichieste,
  markRichiestaLetta,
  deleteRichiesta,
} from '../services/richieste';

/* `enabled` evita di aprire il listener quando l'utente non è admin:
   le regole rifiuterebbero comunque, ma senza guard la console si
   riempirebbe di errori "permission denied" ad ogni login. */
export function useRichieste(enabled) {
  const [richieste, setRichieste] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled) {
      setRichieste([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeRichieste(
      (list) => { setRichieste(list); setLoading(false); },
      (err) => { console.error('[richieste]', err); setLoading(false); },
    );
  }, [enabled]);

  const markRead = useCallback(
    (id, letto = true) => markRichiestaLetta(id, letto),
    [],
  );
  const remove = useCallback((id) => deleteRichiesta(id), []);

  return { richieste, loading, markRead, remove };
}

import { subscribeMyRichieste } from '../services/richieste';

export function useMyRichieste(uid) {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) { setMine([]); setLoading(false); return; }
    setLoading(true);
    return subscribeMyRichieste(
      uid,
      (list) => { setMine(list); setLoading(false); },
      (err) => { console.error('[mie richieste]', err); setLoading(false); },
    );
  }, [uid]);

  return { mine, loading };
}

export default useRichieste;
