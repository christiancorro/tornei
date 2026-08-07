import { useEffect, useState, useCallback, useMemo } from 'react';

import { subscribeUsers, setRole } from '../services/users';
import { ROLE_ADMIN, ROLE_ORGANIZER, ROLE_USER, ROLE_BLOCKED } from '../roles';

/* Lista utenti per la dashboard admin. Il listener parte solo
   se sei admin. */
export function useUsers(enabled) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) { setUsers([]); setLoading(false); return; }
    setLoading(true);
    return subscribeUsers(
      (list) => { setUsers(list); setLoading(false); setError(null); },
      (err) => {
        console.error('[utenti]', err);
        setError('Non riesco a caricare gli utenti.');
        setLoading(false);
      }
    );
  }, [enabled]);

  const counts = useMemo(() => ({
    [ROLE_ADMIN]: users.filter((u) => u.role === ROLE_ADMIN).length,
    [ROLE_ORGANIZER]: users.filter((u) => u.role === ROLE_ORGANIZER).length,
    [ROLE_USER]: users.filter((u) => u.role === ROLE_USER).length,
    [ROLE_BLOCKED]: users.filter((u) => u.role === ROLE_BLOCKED).length,
  }), [users]);

  const changeRole = useCallback((uid, role) => setRole(uid, role), []);

  return { users, counts, loading, error, changeRole };
}

export default useUsers;
