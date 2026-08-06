import React from 'react';
import { INK } from '../theme';

export default function EmptyState({ onReset }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-4">🏐</div>
      <h3 className="font-black text-xl mb-2" style={{ color: INK }}>
        Nessun torneo da queste parti
      </h3>
      <p className="text-sm mb-6" style={{ color: INK, opacity: 0.6 }}>
        Prova ad allargare la ricerca o azzera i filtri.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="px-5 py-2.5 rounded-full text-white font-semibold  focus:ring-offset-2"
        style={{ backgroundColor: INK }}
      >
        Azzera filtri
      </button>
    </div>
  );
}
