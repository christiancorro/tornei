import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Check, Info, X, Loader2 } from 'lucide-react';

import { INK, SAND, SUN, CLAY, GRASS_DARK } from '../theme';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

/* ---------------------------------------------------------
   Sostituisce confirm() e alert() nativi.

   confirm() blocca il thread e non si può stilare; alert()
   appare in cima al browser con l'URL del sito, che è brutto
   e per certi utenti sembra un avviso di sicurezza.

   Due modalità d'uso:

   1) LEGACY — restituisce una Promise<boolean>. Il chiamante
      fa l'azione dopo (senza feedback sul dialog):
        if (await confirm({ title: '...' })) { await doStuff(); }

   2) CON FEEDBACK — passi anche onConfirm: il dialog aspetta
      l'azione, mostra 'saving' e poi 'saved' sul pulsante di
      conferma, e solo dopo chiude:
        await confirm({
          title: 'Elimina conversazione?',
          onConfirm: async () => await deleteConv(id),
          savedLabel: 'Eliminato',
        });
      Se onConfirm rilancia, il dialog resta aperto e mostra
      l'errore (dall'onError o come toast a monte). Il Promise
      esterno risolve `true` a chiusura completata, `false` se
      l'utente annulla.
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
  // Il hook chiude il modale (via `close` in onDone) SOLO nella modalità
  // con onConfirm: nell'altra modalità il pulsante risolve subito e il
  // dialog si smonta perché il context toglie `dialog`.
  const azione = useActionState({
    savedMs: 700,
    onDone: () => {
      // Chiudo il dialog e poi risolvo `true`. L'ordine è importante:
      // se risolvessi prima, il context smonterebbe il dialog e la
      // transizione di uscita non si vedrebbe.
      close();
      onResolve(true);
    },
    onError: (err) => {
      // Non chiudo: l'utente resta sul dialog e può ritentare o
      // annullare. Se il chiamante ha passato un `errorMessage`
      // sarà lui a farne un toast; qui è comunque loggato.
      console.error('[confirm] onConfirm ha rilanciato:', err);
    },
  });

  const busy = azione.busy;
  const danger = opts.danger !== false;
  const accent = danger ? CLAY : GRASS_DARK;
  const savedColor = GRASS_DARK; // conferma sempre verde
  const savedLabel = opts.savedLabel ?? 'Fatto';
  const savingLabel = opts.savingLabel ?? 'Attendi...';
  const confirmLabel = opts.confirmLabel ?? 'Conferma';

  function chiudiSePossibile() {
    if (!busy) close();
  }

  function conferma() {
    if (busy) return;
    if (opts.onConfirm) {
      // Modalità con feedback: il hook aspetta e poi chiude via onDone.
      azione.run(() => opts.onConfirm());
    } else {
      // Modalità legacy: risolvo subito, l'azione la fa il chiamante.
      // La chiusura la fa il context togliendo `dialog`, ma prima
      // faccio partire l'animazione di uscita per non tagliarla.
      close();
      // Piccola attesa così la transizione parte prima che il context
      // smonti il component. useModalClose ha già impostato `closing`.
      setTimeout(() => onResolve(true), 0);
    }
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-[60] modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={chiudiSePossibile}
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
            onClick={chiudiSePossibile}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold disabled:opacity-40"
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            {opts.cancelLabel ?? 'Annulla'}
          </button>
          <button
            type="button"
            onClick={conferma}
            disabled={busy}
            autoFocus
            className="flex-1 py-2.5 rounded-lg font-bold transition-all duration-200
                       flex items-center justify-center gap-2
                       active:scale-[0.98] disabled:cursor-default"
            style={{
              backgroundColor: azione.saved ? savedColor : (danger ? CLAY : SUN),
              color: azione.saved || danger ? '#fff' : INK,
            }}
          >
            {azione.saving && <Loader2 size={16} className="animate-spin" />}
            {azione.saved && <Check size={16} />}
            {azione.saving ? savingLabel
              : azione.saved ? savedLabel
              : confirmLabel}
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

  /* Uso:
       if (await confirm({ title: '...', message: '...' })) { ... }
     oppure con feedback sul pulsante:
       await confirm({
         title: '...',
         onConfirm: async () => { await doStuff(); },
         savedLabel: 'Eliminato',
       });
  */
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
