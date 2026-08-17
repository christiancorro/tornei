import { useEffect, useState, useCallback } from 'react';

import {
  subscribeRichieste,
  subscribeMyRichieste,
  subscribeRisposte,
  markRichiestaLetta,
  deleteRichiesta,
} from '../services/richieste';

/* --- Lista completa (admin) ---
   `enabled` evita di aprire il listener quando l'utente non è
   admin: le regole rifiuterebbero comunque, ma senza guard la
   console si riempirebbe di "permission denied" ad ogni login. */
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

/* --- Le mie richieste (utente sulla propria dashboard) --- */
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

/* --- Risposte a una singola richiesta ---
   Chiamato dal thread quando si espande. `enabled` è false quando
   il thread è chiuso, così N righe in dashboard non aprono N
   listener onSnapshot in parallelo. */
export function useRisposte(richiestaId, enabled = true) {
  const [risposte, setRisposte] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && richiestaId));

  useEffect(() => {
    if (!enabled || !richiestaId) {
      setRisposte([]); setLoading(false); return;
    }
    setLoading(true);
    return subscribeRisposte(
      richiestaId,
      (list) => { setRisposte(list); setLoading(false); },
      (err) => { console.error('[risposte]', err); setLoading(false); },
    );
  }, [richiestaId, enabled]);

  return { risposte, loading };
}

export default useRichieste;