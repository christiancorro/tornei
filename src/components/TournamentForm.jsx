import React, { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

import { INK, SUN, GRASS_DARK } from '../theme';
import { DISCIPLINE, DISCIPLINE_COLORS, FORMATI } from '../constants';
import { emptyTournament, toggleValue } from '../utils';
import { geocode } from '../utils/geocode';
import Chip from './ui/Chip';
import LocandinaField from './LocandinaField';

/* ---------------------------------------------------------
   Admin form (add / edit)
--------------------------------------------------------- */
export default function TournamentForm({ initial, onSave, onCancel }) {
  const { closing, close } = useModalClose(onCancel);
  const [form, setForm] = useState(initial || emptyTournament());
  const [errore, setErrore] = useState('');
  const isEdit = Boolean(initial);

  // Stato del pulsante Salva: idle → saving → saved → chiusura
  const { state: saveState, run, busy } = useActionState({
    savedMs: 700,
    onDone: close,
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (busy) return;

    // required non funziona su un input file nascosto
    if (!form.locandina) {
      setErrore('Aggiungi la locandina.');
      return;
    }

    setErrore('');

    // Geocode il comune se serve davvero:
    // • torneo nuovo (nessun lat/lng)
    // • torneo esistente ma con comune cambiato dopo l'ultimo salvataggio
    // • torneo esistente senza coordinate (creato prima di questa feature)
    //
    // Se il geocoder fallisce (rete, città inesistente, timeout) NON
    // blocchiamo il salvataggio: il torneo si crea/aggiorna comunque,
    // non apparirà sulla mappa finché lat/lng non vengono compilati.
    // È il compromesso giusto: un errore di rete non deve impedire
    // la pubblicazione di un torneo.
    //
    // Confronto normalizzato (trim + lowercase) così "Udine " e "udine"
    // non sembrano diversi e non scatenano un geocode inutile. La
    // presenza delle coord si testa con typeof: `lat === 0` è un valore
    // valido, non "mancante".
    let patch = form;
    const norm = (s) => (s || '').trim().toLowerCase();
    const comuneCambiato = initial
      ? norm(initial.comune) !== norm(form.comune)
      : true;
    const senzaCoords =
      typeof form.lat !== 'number' || typeof form.lng !== 'number';

    if (form.comune && (comuneCambiato || senzaCoords)) {
      try {
        const coords = await geocode(form.comune);
        if (coords) {
          patch = { ...form, lat: coords.lat, lng: coords.lng };
        } else if (comuneCambiato) {
          // Città cambiata ma il geocoder non trova la nuova: azzero
          // le vecchie coord perché erano riferite al comune precedente,
          // ora sbagliato. Meglio invisibile sulla mappa che geolocalizzato
          // nel posto sbagliato.
          patch = { ...form, lat: null, lng: null };
        }
      } catch (err) {
        console.warn('[form] geocoding fallito per', form.comune, err);
      }
    }

    run(() => onSave(patch));
  }

  // Il modale non deve chiudersi mentre stiamo salvando
  function chiudiSePossibile() {
    if (!busy) close();
  }


  const inputClass =
    'w-full px-3.5 py-2.5 rounded-lg border-2 border-[rgba(43,43,43,0.25)] outline-none text-sm focus:border-gray-500 focus:ring-0';

  const inputStyle = {
    color: INK,
    backgroundColor: '#ffffff',
  };

  const labelClass = 'text-xs font-semibold mb-1 block';

  const labelStyle = {
    color: INK,
    opacity: 0.6,
  };

  return (
    <div
      /* items-end + p-0 su mobile: il form è un bottom-sheet
         fullscreen (senza margini ai lati e sotto), esattamente
         come la card di dettaglio del torneo. Su desktop
         (sm:items-center sm:p-4) torna una sheet centrata. */
      className={`fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999] modal-backdrop ${closing ? 'is-closing' : ''
        }`}
      style={{
        backgroundColor: 'rgba(20, 19, 18, 0.93)',
        isolation: 'isolate',
      }}
      onClick={chiudiSePossibile}
    >
      <div
        /* Dimensioni/altezza/border-radius vivono in
           `.tournament-form-panel` (styles.css): fullscreen su
           mobile con angoli arrotondati solo in alto, sheet
           centrata da 90vh + max-w-xl su desktop. */
        className={`w-full overflow-y-auto modal-panel tournament-form-panel ${closing ? 'is-closing' : ''
          }`}
        style={{
          backgroundColor: '#ffffff',
          position: 'relative',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER — solo top-corner arrotondati su mobile
            (il fondo del pannello è a filo dello schermo). */}
        <div
          className="sticky top-0 border-b-2 px-6 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-2xl"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(34,48,31,0.1)',
            zIndex: 10,
          }}
        >
          <h2
            className="font-black text-lg"
            style={{ color: INK }}
          >
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

        {/* FORM — .tournament-form-content aggiunge
            padding-bottom con env(safe-area-inset-bottom), così
            l'ultimo pulsante non finisce sotto l'home-indicator
            iOS quando il form è fullscreen. */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 tournament-form-content"
        >
          {/* NOME TORNEO */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Nome torneo
            </label>

            <input
              required
              className={inputClass}
              style={inputStyle}
              value={form.nome}
              onChange={(e) =>
                update('nome', e.target.value)
              }
              placeholder="Es. Green Volley X"
            />
          </div>

          {/* DISCIPLINA */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Disciplina
            </label>

            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Disciplina"
            >
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

          {/* FORMATI */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Formati (uno o più — es. 2x2 e 4x4 insieme)
            </label>

            <div className="flex flex-wrap gap-2">
              {FORMATI.map((f) => (
                <Chip
                  key={f}
                  active={form.formati.includes(f)}
                  onClick={() => {
                    update(
                      'formati',
                      toggleValue(form.formati, f)
                    );
                  }}
                >
                  {f}
                </Chip>
              ))}
            </div>
          </div>

          {/* MODALITÀ DI GIOCO */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Modalità di gioco
            </label>

            <input
              className={inputClass}
              style={inputStyle}
              value={form.modalita}
              onChange={(e) =>
                update('modalita', e.target.value)
              }
              placeholder="Es. Misto, minimo 2 donne in campo"
            />
          </div>

          {/* DATE */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Data
              </label>

              <input
                required
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.data}
                onChange={(e) =>
                  update('data', e.target.value)
                }
              />
            </div>

            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Data fine (se su più giorni)
              </label>

              <input
                type="date"
                className={inputClass}
                style={inputStyle}
                value={form.dataFine}
                onChange={(e) =>
                  update('dataFine', e.target.value)
                }
                min={form.data || undefined}
              />
            </div>
          </div>

          {/* ORA INIZIO */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Ora inizio
            </label>

            <input
              type="time"
              className={inputClass}
              style={inputStyle}
              value={form.ora}
              onChange={(e) =>
                update('ora', e.target.value)
              }
            />
          </div>

          {/* CITTÀ / COSTO */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Città
              </label>

              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.comune}
                onChange={(e) =>
                  update('comune', e.target.value)
                }
                placeholder="Es. Udine"
              />
            </div>

            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Costo
              </label>

              <input
                className={inputClass}
                style={inputStyle}
                value={form.costo}
                onChange={(e) =>
                  update('costo', e.target.value)
                }
                placeholder="Es: 15"
              />
            </div>
          </div>

          {/* ORGANIZZATORE */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Organizzatore
            </label>

            <input
              className={inputClass}
              style={inputStyle}
              value={form.organizzatore}
              onChange={(e) =>
                update('organizzatore', e.target.value)
              }
              placeholder="Es. ASD X"
            />
          </div>

          {/* ALTRE INFO */}
          <div>
            <label
              className={labelClass}
              style={labelStyle}
            >
              Altre info (opzionale, testo libero)
            </label>

            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              value={form.descrizioneOrganizzatore}
              onChange={(e) =>
                update(
                  'descrizioneOrganizzatore',
                  e.target.value
                )
              }
              placeholder="Breve testo per altre info mostrato nella scheda dettagliata del torneo: come iscriversi, recapito telefonico, regole particolari, ..."
            />
          </div>

          {/* SOCIAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Instagram (opzionale)
              </label>

              <input
                className={inputClass}
                style={inputStyle}
                value={form.instagram}
                onChange={(e) =>
                  update('instagram', e.target.value)
                }
                placeholder="https://instagram.com/..."
              />
            </div>

            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Facebook (opzionale)
              </label>

              <input
                className={inputClass}
                style={inputStyle}
                value={form.facebook}
                onChange={(e) =>
                  update('facebook', e.target.value)
                }
                placeholder="https://facebook.com/..."
              />
            </div>

            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Sito web (opzionale)
              </label>

              <input
                className={inputClass}
                style={inputStyle}
                value={form.sitoWeb}
                onChange={(e) =>
                  update('sitoWeb', e.target.value)
                }
                placeholder="https://..."
              />
            </div>
          </div>

          {/* LOCANDINA */}
          <LocandinaField
            value={form.locandina}
            path={form.locandinaPath}
            thumbPath={form.locandinaThumbPath}
            onChange={(patch) =>
              setForm((f) => ({ ...f, ...patch }))
            }
            labelClass={labelClass}
            labelStyle={labelStyle}
            inputClass={inputClass}
            inputStyle={inputStyle}
          />

          {/* ERRORE */}
          {errore && (
            <p
              className="text-sm font-semibold"
              style={{ color: '#8C3520' }}
            >
              {errore}
            </p>
          )}

          {/* BOTTONI */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={chiudiSePossibile}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg border-2 font-semibold disabled:opacity-40"
              style={{
                borderColor: 'rgba(34,48,31,0.25)',
                color: INK,
                backgroundColor: '#ffffff',
              }}
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={busy}
              className="
                flex-1 py-2.5 rounded-lg font-semibold text-white
                shadow-sm transition-all duration-200
                flex items-center justify-center gap-2
                active:scale-[0.98]
                disabled:cursor-default
                focus:ring-0
              "
              style={{
                backgroundColor:
                  saveState === 'saved'
                    ? GRASS_DARK
                    : SUN,
              }}
            >
              {saveState === 'saving' && (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Salvataggio...
                </>
              )}

              {saveState === 'saved' && (
                <>
                  <Check size={16} />
                  Salvato!
                </>
              )}

              {saveState === 'idle' &&
                (isEdit
                  ? 'Modifica torneo'
                  : 'Crea torneo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}