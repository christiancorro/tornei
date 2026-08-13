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
  const remove = useCallback((convId) => deleteConversation(convId), []);

  return { conversations, unreadTotal, loading, reply, remove };
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
    return subscribeMessages(
      convId,
      (list) => { setMessages(list); setLoading(false); },
      (err) => { console.error('[messaggi]', err); setLoading(false); }
    );
  }, [convId]);

  /* Azzera i "non letti" ogni volta che il thread è aperto e la
     lista messaggi cambia — non solo alla prima apertura.

     Prima il markAsRead veniva chiamato una sola volta nel effect
     di subscribe: se un nuovo messaggio arrivava mentre l'utente
     era già dentro il thread, sendMessage lato mittente faceva
     `unread++` sul destinatario, e il destinatario si ritrovava il
     badge sul tab Messaggi pur essendo lì che leggeva.

     Ora, ad ogni cambio di `messages.length` (che copre sia
     l'arrivo di un nuovo messaggio da parte dell'interlocutore sia
     l'invio di un proprio), rimettiamo il contatore a zero. Nella
     vista admin (readOnly, `uid=null`) non facciamo nulla, così il
     destinatario non vede i "letti" per messaggi che in realtà ha
     solo un moderatore aperto. */
  useEffect(() => {
    if (convId && uid) markAsRead(convId, uid);
  }, [convId, uid, messages.length]);

  const send = useCallback((toId, testo) => sendMessage(convId, uid, toId, testo), [convId, uid]);

  return { messages, loading, send };
}

export default useConversations;