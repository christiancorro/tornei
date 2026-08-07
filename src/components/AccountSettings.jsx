import React, { useState, useEffect } from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';

import { INK, SUN, CLAY, CARD_BG, GRASS_DARK } from '../theme';
import { ROLE_LABELS } from '../roles';
import { updateDisplayName, deleteAccount, accountFootprint } from '../services/account';
import { authErrorMessage } from '../services/auth';

const CONFERMA = 'ELIMINA';

export default function AccountSettings({ profile, onDeleted }) {
  const [nome, setNome] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [footprint, setFootprint] = useState(null);
  const [conferma, setConferma] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Conto cosa sparirà solo quando la sezione viene aperta:
  // sono tre query, inutile farle a ogni visita della pagina.
  useEffect(() => {
    if (!showDelete || footprint || !profile?.uid) return;
    accountFootprint(profile.uid).then(setFootprint).catch(() => setFootprint(null));
  }, [showDelete, footprint, profile?.uid]);

  async function handleSaveName() {
    setError(''); setSavedMsg('');
    setSaving(true);
    try {
      await updateDisplayName(profile.uid, nome);
      setSavedMsg('Nome aggiornato.');
    } catch (err) {
      setError(err.message || authErrorMessage(err?.code));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError('');
    if (conferma !== CONFERMA) {
      setError(`Scrivi ${CONFERMA} per confermare.`);
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(profile.uid);
      onDeleted?.();
    } catch (err) {
      console.error('[elimina account]', err);
      setError(
        err?.code === 'auth/requires-recent-login'
          ? 'Per sicurezza devi accedere di nuovo prima di eliminare l\'account.'
          : err?.code
            ? authErrorMessage(err.code)
            : err.message || 'Eliminazione non riuscita.'
      );
      setDeleting(false);
    }
  }

  const inputStyle = { borderColor: 'rgba(34,48,31,0.25)', color: INK };

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
          onChange={(e) => { setNome(e.target.value); setSavedMsg(''); }}
          className="w-full mb-3 px-3 py-2.5 rounded-lg border-2 outline-none"
          style={inputStyle}
        />

        <div className="text-xs mb-3 space-y-1" style={{ color: INK, opacity: 0.6 }}>
          <p>Email: <strong>{profile?.email}</strong> (account Google)</p>
          <p>Ruolo: <strong>{ROLE_LABELS[profile?.role] ?? '—'}</strong></p>
        </div>

        {savedMsg && <p className="text-sm font-semibold mb-2" style={{ color: GRASS_DARK }}>{savedMsg}</p>}

        <button
          type="button"
          onClick={handleSaveName}
          disabled={saving || !nome.trim() || nome.trim() === profile?.displayName}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
          style={{
            backgroundColor: SUN,
            color: INK,
            opacity: saving || !nome.trim() || nome.trim() === profile?.displayName ? 0.5 : 1,
          }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salva
        </button>
      </div>

      {/* --- Zona pericolosa --- */}
      <div className="rounded-xl border-2 p-4" style={{ backgroundColor: CARD_BG, borderColor: `${CLAY}55` }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} style={{ color: CLAY }} />
          <h3 className="font-black text-base" style={{ color: CLAY }}>Elimina account</h3>
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
              className="px-4 py-2 rounded-full text-sm font-bold"
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
              className="w-full mb-3 px-3 py-2.5 rounded-lg border-2 outline-none"
              style={inputStyle}
            />

            {error && <p className="text-sm font-semibold mb-3" style={{ color: CLAY }}>{error}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setShowDelete(false); setConferma(''); setError(''); }}
                disabled={deleting}
                className="px-4 py-2 rounded-full text-sm font-bold"
                style={{ border: '2px solid rgba(34,48,31,0.25)', color: INK }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || conferma !== CONFERMA}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: CLAY,
                  color: '#fff',
                  opacity: deleting || conferma !== CONFERMA ? 0.5 : 1,
                }}
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                {deleting ? 'Eliminazione...' : 'Elimina definitivamente'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}