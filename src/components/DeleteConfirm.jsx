import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { INK, CLAY, CLAY_DARK } from '../theme';

export default function DeleteConfirm({ tournament, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(34,48,31,0.5)' }}
      onClick={onCancel}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
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
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border-2 font-bold "
            style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg font-bold text-white  focus:ring-offset-2"
            style={{ backgroundColor: CLAY }}
          >
            Elimina torneo
          </button>
        </div>
      </div>
    </div>
  );
}
