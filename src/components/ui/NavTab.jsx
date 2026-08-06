import React from 'react';

export default function NavTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
  px-4 py-1.5 rounded-full text-sm font-semibold
  border-2 border-transparent
  transition-all
  ${active
          ? 'bg-[#282828] text-[#fff8ef]'
          : 'text-[#282828] opacity-60 hover:opacity-100 hover:border-[#282828]'
        }
`}
    >
      {children}
    </button>
  );
}
