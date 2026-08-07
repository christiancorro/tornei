import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';

import { INK, SUN } from '../theme';
import { DISCIPLINE, FORMATI, PROVINCE, PROVINCE_LABELS } from '../constants';
import { emptyTournament, toggleValue } from '../utils';
import Chip from './ui/Chip';
import LocandinaField from './LocandinaField';

/* ---------------------------------------------------------
   Admin form (add / edit) — no backend yet, so this writes
   straight into local state.
--------------------------------------------------------- */
export default function TournamentForm({ initial, onSave, onCancel }) {
  const { closing, close } = useModalClose(onCancel);
  const [form, setForm] = useState(initial || emptyTournament());

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const [errore, setErrore] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    // `required` non funziona su un input file nascosto, quindi il
    // controllo sulla locandina va fatto qui a mano.
    if (!form.locandina) {
      setErrore('Aggiungi la locandina: è la prima cosa che si guarda.');
      return;
    }
    setErrore('');
    onSave(form);
  }

  const inputClass = 'w-full px-3.5 py-2.5 rounded-lg border-2 outline-none text-sm focus:ring-2 focus:ring-amber-500';
  const inputStyle = { borderColor: 'rgba(43, 43, 43, 0.25)', color: INK };
  const labelClass = 'text-xs font-semibold mb-1 block';
  const labelStyle = { color: INK, opacity: 0.6 };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 modal-backdrop ${closing ? 'is-closing' : ''}`}
      style={{ backgroundColor: 'rgba(20, 19, 18, 0.93)' }}
      onClick={close}
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
            {initial ? 'Modifica torneo' : 'Nuovo torneo'}
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-full hover:bg-gray-100 "
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
            <select className={inputClass} style={inputStyle} value={form.disciplina} onChange={(e) => update('disciplina', e.target.value)}>
              {DISCIPLINE.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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
                Luogo
              </label>
              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.luogo}
                onChange={(e) => update('luogo', e.target.value)}
                placeholder="Es. Parco del Cormor"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>
                Comune
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Provincia
              </label>
              <select className={inputClass} style={inputStyle} value={form.provincia} onChange={(e) => update('provincia', e.target.value)}>
                {PROVINCE.map((p) => (
                  <option key={p} value={p}>
                    {PROVINCE_LABELS[p]} ({p})
                  </option>
                ))}
              </select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Iscrizioni entro
              </label>
              <input
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.iscrizioniEntro}
                onChange={(e) => update('iscrizioniEntro', e.target.value)}
              />
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <LocandinaField
            value={form.locandina}
            path={form.locandinaPath}
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
              onClick={close}
              className="flex-1 py-2.5 rounded-lg border-2 font-semibold "
              style={{ borderColor: 'rgba(34,48,31,0.25)', color: INK }}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg font-semibold text-white shadow-sm  focus:ring-offset-2"
              style={{ backgroundColor: SUN }}
            >
              Crea torneo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}