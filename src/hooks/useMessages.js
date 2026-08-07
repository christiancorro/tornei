import { useEffect, useState, useCallback, useMemo } from 'react';

import {
  subscribeConversations,
  subscribeAllConversations,
  subscribeMessages,
  sendMessage,
  replyToAnnuncio,
  markAsRead,
  deleteConversation,
} from '../services/messages';

export function useConversations(uid) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) { setConversations([]); setLoading(false); return; }
    setLoading(true);
    return subscribeConversations(
      uid,
      (list) => { setConversations(list); setLoading(false); },
      (err) => { console.error('[conversazioni]', err); setLoading(false); }
    );
  }, [uid]);

  // Pallino sul menu: somma dei non letti di tutti i thread.
  const unreadTotal = useMemo(
    () => conversations.reduce((n, c) => n + (c.unread?.[uid] ?? 0), 0),
    [conversations, uid]
  );

  const reply = useCallback((annuncio, sender, testo) => replyToAnnuncio(annuncio, sender, testo), []);

  return { conversations, unreadTotal, loading, reply };
}

/* Vista admin: ogni conversazione dell'app. Parte solo se
   `enabled`, altrimenti la query verrebbe rifiutata. */
export function useAllConversations(enabled) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) { setConversations([]); setLoading(false); return; }
    setLoading(true);
    return subscribeAllConversations(
      (list) => { setConversations(list); setLoading(false); setError(null); },
      (err) => {
        console.error('[tutte le conversazioni]', err);
        setError('Non riesco a caricare le conversazioni.');
        setLoading(false);
      }
    );
  }, [enabled]);

  const remove = useCallback((convId) => deleteConversation(convId), []);

  return { conversations, loading, error, remove };
}

export function useMessages(convId, uid) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(Boolean(convId));

  useEffect(() => {
    if (!convId) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeMessages(
      convId,
      (list) => { setMessages(list); setLoading(false); },
      (err) => { console.error('[messaggi]', err); setLoading(false); }
    );
    // Aprire il thread azzera il contatore dei non letti.
    if (uid) markAsRead(convId, uid);
    return unsub;
  }, [convId, uid]);

  const send = useCallback((toId, testo) => sendMessage(convId, uid, toId, testo), [convId, uid]);

  return { messages, loading, send };
}

export default useConversations;
