import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';

import { INK, GRASS_DARK, CLAY, SUN } from '../theme';
import { authErrorMessage } from '../services/auth';

/* Logo Google ufficiale: le linee guida del brand lo richiedono,
   e un'icona generica abbassa il riconoscimento del bottone. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.7C7.8 41 15.3 46 24 46z" />
      <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.4-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.3 2 7.8 7 4.3 14.2l7.4 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
    </svg>
  );
}

export default function AuthModal({ onGoogle, onClose }) {
  const { closing, close } = useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogle() {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await onGoogle();
      // null = siamo passati al redirect: la pagina si ricaricherà.
      if (user) close();
    } catch (err) {
      setError(authErrorMessage(err?.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-sm p-6 modal-panel ${closing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-black text-lg mb-1" style={{ color: INK }}>
          Accedi a volley<span style={{ color: SUN }}>FVG</span>
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          È necessario solo se vuoi proporre un torneo e scrivere e rispondere agli annunci in bacheca.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 rounded-lg border-2 font-bold flex items-center justify-center gap-2.5 mb-4"
          style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          {busy ? 'Attendi...' : 'Continua con Google'}
        </button>

        {error && <p className="text-sm font-semibold mb-3" style={{ color: CLAY }}>{error}</p>}

        <p className="text-xs" style={{ color: INK, opacity: 0.55 }}>
          Al primo accesso verrà creato il tuo profilo con il nome del tuo
          account Google. Puoi cambiare il nome dalle impostazioni quando vuoi.
        </p>

        <button
          type="button"
          onClick={close}
          className="w-full mt-4 py-2 text-sm font-semibold underline"
          style={{ color: INK }}
        >
          Continua senza accedere
        </button>
      </div>
    </div>
  );
}