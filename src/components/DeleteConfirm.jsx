import React from 'react';
import { AlertTriangle, Loader2, Check } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

import { INK, CLAY, CLAY_DARK, GRASS_DARK } from '../theme';

/* ---------------------------------------------------------
   Conferma di eliminazione con feedback in tre stati:
     idle    → "Elimina torneo"
     saving  → spinner + "Eliminazione..."
     saved   → check + "Eliminato" (verde), poi chiusura

   Il modale gestisce da sé la chiusura dopo la conferma
   (via `onDone: close` passato a useActionState): il parent
   non deve più chiudere subito dopo il save, altrimenti si
   perde lo stato 'saved'. Vedi handleDeleteConfirm in
   app.jsx per la controparte.
--------------------------------------------------------- */
export default function DeleteConfirm({ tournament, onConfirm, onCancel }) {
  const { closing, close } = useModalClose(onCancel);
  const { state, run, busy } = useActionState({ savedMs: 700, onDone: close });

  function handleDelete() {
    // onConfirm rilancia in caso di errore (app.jsx): il hook lo
    // vede, torna in idle, e il toast lo mostra il chiamante.
    run(() => onConfirm());
  }

  function chiudiSePossibile() {
    if (!busy) close();
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={chiudiSePossibile}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-sm p-6 modal-panel ${closing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FBE3DC', color: CLAY_DARK }}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
          Eliminare il torneo?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          <span className="font-bold" style={{ color: INK }}>
            {tournament.nome}
          </span>{' '}
          verrà rimosso dalla lista. Non si può annullare.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={chiudiSePossibile}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold disabled:opacity-40"
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg font-bold text-white transition-all duration-200
                       flex items-center justify-center gap-2
                       active:scale-[0.98] disabled:cursor-default
                       focus:ring-offset-2"
            style={{
              // Verde solo a conferma avvenuta: prima del click il
              // pulsante deve gridare "attenzione", non "andrà bene".
              backgroundColor: state === 'saved' ? GRASS_DARK : CLAY,
            }}
          >
            {state === 'saving' && (
              <>
                <Loader2 size={16} className="animate-spin" />
                Eliminazione...
              </>
            )}
            {state === 'saved' && (
              <>
                <Check size={16} />
                Eliminato
              </>
            )}
            {state === 'idle' && 'Elimina torneo'}
          </button>
        </div>
      </div>
    </div>
  );
}
