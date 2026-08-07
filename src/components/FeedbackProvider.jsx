import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

import { INK, SAND, SUN, CLAY, GRASS_DARK } from '../theme';
import { useModalClose } from '../hooks/useModalClose';

/* ---------------------------------------------------------
   Sostituisce confirm() e alert() nativi.

   confirm() blocca il thread e non si può stilare; alert()
   appare in cima al browser con l'URL del sito, che è brutto
   e per certi utenti sembra un avviso di sicurezza.

   Qui: confirm() restituisce una Promise<boolean>, quindi il
   codice chiamante resta identico a prima (basta un await),
   e i messaggi passeggeri diventano toast.
--------------------------------------------------------- */
const FeedbackContext = createContext(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback va usato dentro <FeedbackProvider>');
  return ctx;
}

/* --- Dialogo di conferma --- */
function ConfirmDialog({ opts, onResolve }) {
  const { closing, close } = useModalClose(() => onResolve(false));
  const [busy, setBusy] = useState(false);

  const danger = opts.danger !== false;
  const accent = danger ? CLAY : GRASS_DARK;

  async function conferma() {
    setBusy(true);
    onResolve(true);
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-[60] modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-sm p-6 modal-panel ${closing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: danger ? '#FBE3DC' : '#FFF4DE', color: accent }}
        >
          {danger ? <AlertTriangle size={22} /> : <Info size={22} />}
        </div>

        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
          {opts.title}
        </h3>

        {opts.message && (
          <p className="text-sm text-gray-500 mb-6 whitespace-pre-line">{opts.message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold"
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            {opts.cancelLabel ?? 'Annulla'}
          </button>
          <button
            type="button"
            onClick={conferma}
            disabled={busy}
            autoFocus
            className="flex-1 py-2.5 rounded-lg font-bold"
            style={{
              backgroundColor: danger ? CLAY : SUN,
              color: danger ? '#fff' : INK,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {opts.confirmLabel ?? 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Toast --- */
const TOAST_STYLE = {
  error: { bg: '#FBE3DC', fg: '#8C3520', Icon: AlertTriangle },
  success: { bg: '#E7F0DE', fg: GRASS_DARK, Icon: Check },
  info: { bg: INK, fg: SAND, Icon: Info },
};

function Toast({ toast, onDismiss }) {
  const s = TOAST_STYLE[toast.type] ?? TOAST_STYLE.info;
  const { Icon } = s;
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-4 py-3 shadow-lg pointer-events-auto modal-panel"
      style={{ backgroundColor: s.bg, color: s.fg, maxWidth: '22rem' }}
      role="status"
    >
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p className="text-sm font-semibold flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label="Chiudi"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info', ms = 4000) => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, type }]);
    if (ms) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  /* Uso:  if (await confirm({ title: '...', message: '...' })) { ... } */
  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({
      opts: typeof opts === 'string' ? { title: opts } : opts,
      resolve,
    });
  }), []);

  const handleResolve = useCallback((value) => {
    setDialog((d) => {
      d?.resolve(value);
      return null;
    });
  }, []);

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}

      {dialog && <ConfirmDialog opts={dialog.opts} onResolve={handleResolve} />}

      {/* pointer-events-none sul contenitore: i toast non devono
          rubare i click a quello che c'è sotto. */}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export default FeedbackProvider;