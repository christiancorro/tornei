import React from 'react';
import { INK } from '../../theme';

export default function MonthHeader({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-black text-xl sm:text-2xl uppercase tracking-wide" style={{ color: INK }}>
        {label}
      </h2>
      <div className="flex-1 h-0" style={{ borderTop: '2px dashed rgba(34,48,31,0.15)' }} />
    </div>
  );
}
