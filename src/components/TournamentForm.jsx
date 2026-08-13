import React, { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

import { INK, SUN, GRASS_DARK } from '../theme';
import { DISCIPLINE, DISCIPLINE_COLORS, FORMATI } from '../constants';
import { emptyTournament, toggleValue } from '../utils';
import Chip from './ui/Chip';
import LocandinaField from './LocandinaField';

/* ---------------------------------------------------------
   Admin form (add / edit) — no backend yet, so this writes
   straight into local state.

   Chiusura del modale: prima chiudeva app.jsx dopo il save.
   Adesso la chiusura è governata da qui, perché il pulsante
   attraversa tre stati (idle → saving → saved) e vogliamo che
   il feedback "Salvato!" sia visibile un attimo prima che il
   pannello vada via. Il chiamante (`onSave`) deve rilanciare
   l'errore se il salvataggio fallisce, così il bottone può
   tornare in idle.
--------------------------------------------------------- */
export default function TournamentForm({ initial, onSave, onCancel }) {
  const { closing, close } = useModalClose(onCancel);
  const [form, setForm] = useState(initial || emptyTournament());
  const [errore, setErrore] = useState('');
  const isEdit = Boolean(initial);
  // Stato del pulsante Salva: idle → saving → saved → chiusura del
  // modale. Su errore torna in idle e il toast lo mostra il chiamante
  // (app.jsx handleSave rilancia dopo aver mostrato il toast).
  const { state: saveState, run, busy } = useActionState({
    savedMs: 700,
    onDone: close,
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    // `required` non funziona su un input file nascosto, quindi il
    // controllo sulla locandina va fatto qui a mano.
    if (!form.locandina) {
      setErrore('Aggiungi la locandina.');
      return;
    }
    setErrore('');
    run(() => onSave(form));
  }

  // Il modale non deve chiudersi mentre stiamo salvando: né dal backdrop,
  // né dalla X, né dall'Escape. Altrimenti si perderebbe la conferma o
  // peggio si annullerebbe un'operazione in corso.
  function chiudiSePossibile() {
    if (!busy) close();
  }

  const inputClass = 'w-full px-3.5 py-2.5 rounded-lg border-2 outline-none text-sm focus:ring-2 focus:ring-amber-500';
  const inputStyle = { borderColor: 'rgba(43, 43, 43, 0.25)', color: INK };
  const labelClass = 'text-xs font-semibold mb-1 block';
  const labelStyle = { color: INK, opacity: 0.6 };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''}`}
      style={{ backgroundColor: 'rgba(20, 19, 18, 0.93)' }}
      onClick={chiudiSePossibile}
    >
      <div
        className={`bg-white rounded-2xl w-full max-w-2xl overflow-y-auto modal-panel ${closing ? 'is-closing' : ''}`}
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 bg-white border-b-2 px-6 py-4 flex items-center justify-between rounded-t-2xl"
          style={{ borderColor: 'rgba(34,48,31,0.1)' }}
        >
          <h2 className="font-black text-lg" style={{ color: INK }}>
            {isEdit ? 'Modifica torneo' : 'Nuovo torneo'}
          </h2>
          <button
            type="button"
            onClick={chiudiSePossibile}
            disabled={busy}
            className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-40"
            style={{ color: INK }}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>
              Nome torneo
            </label>
            <input
              required
              className={inputClass}
              style={inputStyle}
              value={form.nome}
              onChange={(e) => update('nome', e.target.value)}
              placeholder="Es. Green Volley X"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Disciplina
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Disciplina">
              {DISCIPLINE.map((d) => (
                <Chip
                  key={d}
                  role="radio"
                  active={form.disciplina === d}
                  onClick={() => update('disciplina', d)}
                  color={DISCIPLINE_COLORS[d]}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Formati (uno o più — es. 2x2 e 4x4 insieme)
            </label>
            <div className="flex flex-wrap gap-2">
              {FORMATI.map((f) => (
                <Chip
                  key={f}
                  active={form.formati.includes(f)}
                  onClick={() => {
                    update('formati', toggleValue(form.formati, f));
                  }}
                >
                  {f}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Modalità di gioco
            </label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.modalita}
              onChange={(e) => update('modalita', e.target.value)}
              placeholder="Es. Misto, minimo 2 donne in campo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Data
              </label>
              <input required type="date" className={inputClass} style={inputStyle} value={form.data} onChange={(e) => update('data', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Data fine (se su più giorni)
              </label>
              <input
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.dataFine}
                onChange={(e) => update('dataFine', e.target.value)}
                min={form.data || undefined}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Ora inizio
            </label>
            <input type="time" className={inputClass} style={inputStyle} value={form.ora} onChange={(e) => update('ora', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Città
              </label>
              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.comune}
                onChange={(e) => update('comune', e.target.value)}
                placeholder="Es. Udine"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Costo
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.costo}
                onChange={(e) => update('costo', e.target.value)}
                placeholder="Es: 15"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Organizzatore
            </label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.organizzatore}
              onChange={(e) => update('organizzatore', e.target.value)}
              placeholder="Es. ASD X"
            />
          </div>

          <div>
            <label className={labelClass} style={labelStyle}>
              Altre info (opzionale, testo libero)
            </label>
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              value={form.descrizioneOrganizzatore}
              onChange={(e) => update('descrizioneOrganizzatore', e.target.value)}
              placeholder="Breve testo per altre info mostrato nella scheda dettagliata del torneo: come iscriversi, recapito telefonico, regole particolari, ..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Instagram (opzionale)
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.instagram}
                onChange={(e) => update('instagram', e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Facebook (opzionale)
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.facebook}
                onChange={(e) => update('facebook', e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Sito web (opzionale)
              </label>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.sitoWeb}
                onChange={(e) => update('sitoWeb', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <LocandinaField
            value={form.locandina}
            path={form.locandinaPath}
            /* Serve al campo per cancellare il thumb vecchio quando
               l'utente sostituisce l'immagine o preme "Rimuovi": senza
               questo, il thumb resta orfano su Storage. */
            thumbPath={form.locandinaThumbPath}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            labelClass={labelClass}
            labelStyle={labelStyle}
            inputClass={inputClass}
            inputStyle={inputStyle}
          />

          {errore && (
            <p className="text-sm font-semibold" style={{ color: '#8C3520' }}>{errore}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={chiudiSePossibile}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg border-2 font-semibold disabled:opacity-40"
              style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={busy}
              /* Transizione morbida su tutto (colore, ombra, scala):
                 il pulsante "cambia carattere" tra idle → saving → saved
                 invece di sostituirsi di colpo. La scala 0.98 sul click
                 va con :active in styles.css; qui ci pensa transition-all. */
              className="flex-1 py-2.5 rounded-lg font-semibold text-white shadow-sm transition-all duration-200
                         flex items-center justify-center gap-2
                         active:scale-[0.98] disabled:cursor-default
                         focus:ring-offset-2"
              style={{
                // Verde a conferma avvenuta: dice "è successo" senza
                // bisogno di leggere il testo. Idle e saving restano
                // sul giallo del brand.
                backgroundColor: saveState === 'saved' ? GRASS_DARK : SUN,
              }}
            >
              {saveState === 'saving' && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvataggio...
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <Check size={16} />
                  Salvato!
                </>
              )}
              {saveState === 'idle' && (isEdit ? 'Modifica torneo' : 'Crea torneo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
