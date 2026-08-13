import React, { useState, useEffect } from 'react';
import { Loader2, Save, Check, AlertTriangle } from 'lucide-react';

import { INK, SUN, CLAY, CARD_BG, GRASS_DARK } from '../theme';
import { ROLE_LABELS } from '../roles';
import { updateDisplayName, deleteAccount, accountFootprint } from '../services/account';
import { authErrorMessage } from '../services/auth';
import { useActionState } from '../hooks/useActionState';

const CONFERMA = 'ELIMINA';

export default function AccountSettings({ profile, onDeleted }) {
  const [nome, setNome] = useState(profile?.displayName ?? '');
  const [saveError, setSaveError] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [footprint, setFootprint] = useState(null);
  const [conferma, setConferma] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Salvataggio del nome: idle → 'Salvataggio...' → 'Salvato'.
  // Il messaggio verde "Nome aggiornato" era già lì; lo lasciamo
  // via saveState in modo che compaia SUL pulsante (feedback dove
  // hai cliccato) invece di sopra il pulsante.
  const salva = useActionState({
    savedMs: 900,
    onError: (err) => setSaveError(err.message || authErrorMessage(err?.code)),
  });

  // Eliminazione account: al successo la pagina si smonta (onDeleted),
  // ma un lampo di 'saved' dà comunque un mezzo secondo di "fatto"
  // prima del cambio vista.
  const rimuovi = useActionState({
    savedMs: 500,
    onDone: () => onDeleted?.(),
    onError: (err) => setDeleteError(
      err?.code === 'auth/requires-recent-login'
        ? 'Per sicurezza devi accedere di nuovo prima di eliminare l\'account.'
        : err?.code
          ? authErrorMessage(err.code)
          : err.message || 'Eliminazione non riuscita.'
    ),
  });

  // Conto cosa sparirà solo quando la sezione viene aperta:
  // sono tre query, inutile farle a ogni visita della pagina.
  useEffect(() => {
    if (!showDelete || footprint || !profile?.uid) return;
    accountFootprint(profile.uid).then(setFootprint).catch(() => setFootprint(null));
  }, [showDelete, footprint, profile?.uid]);

  function handleSaveName() {
    setSaveError('');
    salva.run(() => updateDisplayName(profile.uid, nome));
  }

  function handleDelete() {
    setDeleteError('');
    if (conferma !== CONFERMA) {
      setDeleteError(`Scrivi ${CONFERMA} per confermare.`);
      return;
    }
    rimuovi.run(() => deleteAccount(profile.uid));
  }

  const inputStyle = { borderColor: 'rgba(34,48,31,0.25)', color: INK };
  // Il pulsante Salva è disabilitato se: sto salvando, il nome è vuoto
  // o è identico a quello attuale. Su 'saved' resta abilitato ma non
  // riparte (busy=true nel hook copre il click doppio).
  const salvaDisabled = salva.busy || !nome.trim() || nome.trim() === profile?.displayName;

  return (
    <div>
      {/* --- Profilo --- */}
      <div className="rounded-xl border-2 p-4 mb-4" style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}>
        <h3 className="font-black text-base mb-3" style={{ color: INK }}>Profilo</h3>

        <label className="block text-xs font-bold mb-1" style={{ color: INK }}>Nome visualizzato</label>
        <input
          type="text"
          value={nome}
          maxLength={60}
          onChange={(e) => { setNome(e.target.value); setSaveError(''); }}
          disabled={salva.busy}
          className="w-full mb-3 px-3 py-2.5 rounded-lg border-2 outline-none disabled:opacity-60"
          style={inputStyle}
        />

        <div className="text-xs mb-3 space-y-1" style={{ color: INK, opacity: 0.6 }}>
          <p>Email: <strong>{profile?.email}</strong></p>
          <p>Ruolo: <strong>{ROLE_LABELS[profile?.role] ?? '—'}</strong></p>
        </div>

        {saveError && (
          <p className="text-sm font-semibold mb-2" style={{ color: CLAY }}>{saveError}</p>
        )}

        <button
          type="button"
          onClick={handleSaveName}
          disabled={salvaDisabled}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold
                     transition-all duration-200 active:scale-[0.98] disabled:cursor-default"
          style={{
            backgroundColor: salva.saved ? GRASS_DARK : SUN,
            color: salva.saved ? '#fff' : INK,
            opacity: salvaDisabled ? 0.5 : 1,
          }}
        >
          {salva.saving && <Loader2 size={16} className="animate-spin" />}
          {salva.saved && <Check size={16} />}
          {salva.idle && <Save size={16} />}
          {salva.saving ? 'Salvataggio...'
            : salva.saved ? 'Salvato'
            : 'Salva'}
        </button>
      </div>

      {/* --- Zona pericolosa --- */}
      <div className="rounded-xl border-2 p-4" style={{ backgroundColor: CARD_BG, borderColor: `${CLAY}55` }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} style={{ color: CLAY }} />
          <h3 className="font-semibold text-base" style={{ color: CLAY }}>Elimina account</h3>
        </div>

        {!showDelete ? (
          <>
            <p className="text-sm mb-3" style={{ color: INK, opacity: 0.75 }}>
              Cancella definitivamente il tuo account e tutto quello che hai
              pubblicato. L'operazione non si può annullare.
            </p>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{ border: `2px solid ${CLAY}`, color: CLAY }}
            >
              Voglio eliminare il mio account
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: INK, opacity: 0.75 }}>
              Verranno eliminati per sempre:
            </p>
            <ul className="text-sm mb-3 pl-5 list-disc" style={{ color: INK }}>
              <li>{footprint ? footprint.tornei : '…'} tornei pubblicati o proposti</li>
              <li>{footprint ? footprint.annunci : '…'} annunci in bacheca</li>
              <li>
                {footprint ? footprint.conversazioni : '…'} conversazioni private
                <span style={{ opacity: 0.6 }}> (spariscono anche per l'altra persona)</span>
              </li>
            </ul>

            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFF4DE', color: '#8A5A00' }}>
              Si aprirà il popup di Google per confermare che sei davvero tu.
            </p>

            <label className="block text-xs font-bold mb-1" style={{ color: INK }}>
              Scrivi <strong>{CONFERMA}</strong> per confermare
            </label>
            <input
              type="text"
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              disabled={rimuovi.busy}
              className="w-full mb-3 px-3 py-2.5 rounded-lg border-2 outline-none disabled:opacity-60"
              style={inputStyle}
            />

            {deleteError && <p className="text-sm font-semibold mb-3" style={{ color: CLAY }}>{deleteError}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setShowDelete(false); setConferma(''); setDeleteError(''); }}
                disabled={rimuovi.busy}
                className="px-4 py-2 rounded-full text-sm font-bold disabled:opacity-40"
                style={{ border: '2px solid rgba(34,48,31,0.25)', color: INK }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={rimuovi.busy || conferma !== CONFERMA}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold
                           transition-all duration-200 active:scale-[0.98] disabled:cursor-default"
                style={{
                  backgroundColor: rimuovi.saved ? GRASS_DARK : CLAY,
                  color: '#fff',
                  opacity: (rimuovi.busy || conferma !== CONFERMA) && !rimuovi.saved ? 0.5 : 1,
                }}
              >
                {rimuovi.saving && <Loader2 size={16} className="animate-spin" />}
                {rimuovi.saved && <Check size={16} />}
                {rimuovi.saving ? 'Eliminazione...'
                  : rimuovi.saved ? 'Eliminato'
                  : 'Elimina definitivamente'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
