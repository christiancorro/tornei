import React, { useState } from 'react';
import { INK } from '../../theme';

export default function Chip({ active, onClick, children, color, role }) {
  const c = color || INK;
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === 'radio' ? active : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 border-transparent transition-colors whitespace-nowrap shrink-0 "
      style={{
        borderColor: active || hover ? c : 'rgba(34,48,31,0.25)',
        backgroundColor: active ? c : 'transparent',
        color: active ? '#FFFFFF' : INK,
      }}
    >
      {children}
    </button>
  );
}