import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { useModalClose } from '../hooks/useModalClose';
import { useActionState } from '../hooks/useActionState';

import { INK, SUN, GRASS_DARK, CLAY_DARK } from '../theme';
import { DISCIPLINE, DISCIPLINE_COLORS, FORMATI } from '../constants';
import { emptyTournament, toggleValue, nextDayISO } from '../utils';
import { geocode } from '../utils/geocode';
import Chip from './ui/Chip';
import DateField from './ui/DateField';
import LocandinaField from './LocandinaField';

/* ---------------------------------------------------------
   Admin form (add / edit)
--------------------------------------------------------- */
export default function TournamentForm({ initial, onSave, onCancel }) {
  // closeOnEsc:false + niente click sul backdrop (vedi sotto): il
  // modale del form si chiude solo con la X o con "Annulla", così non
  // si perde per sbaglio quanto compilato.
  const { closing, close } = useModalClose(onCancel, { closeOnEsc: false });
  // Aprendo un torneo vecchio (che teneva il posto in `comune`),
  // travaso il valore in `luogo` così il campo lo mostra e, al
  // salvataggio, il torneo migra sul campo nuovo.
  const [form, setForm] = useState(
    initial
      ? { ...initial, luogo: initial.luogo || initial.comune || '' }
      : emptyTournament()
  );
  const [errore, setErrore] = useState('');
  const isEdit = Boolean(initial);

  /* Esito della ricerca del luogo sulla mappa, mostrato sotto al
     campo: 'idle' (campo vuoto) | 'checking' | 'ok' | 'notfound' |
     'error' (geocoder irraggiungibile). Serve a non scoprire solo
     dopo il salvataggio che il torneo non comparirà sulla mappa. */
  const [luogoStato, setLuogoStato] = useState('idle');

  /* Con un luogo non trovato il primo salvataggio si ferma e lo
     segnala. Se l'utente ripete il salvataggio senza toccare il
     luogo vuol dire che gli va bene così: il torneo si salva lo
     stesso, semplicemente senza pin sulla mappa. Il flag torna
     giù appena il luogo cambia (vedi l'effect qui sotto). */
  const salvaSenzaCoordinateRef = useRef(false);

  /* Controllo il luogo mentre si scrive, ma solo quando ci si ferma:
     700ms dall'ultimo tasto. Senza la pausa partirebbe una richiesta
     a Nominatim per ogni carattere. Le risposte fuori tempo massimo
     (l'utente ha già continuato a scrivere) vengono scartate con il
     flag `annullato`, così non sovrascrivono un esito più recente. */
  const luogoDigitato = form.luogo;

  useEffect(() => {
    salvaSenzaCoordinateRef.current = false;

    const q = (luogoDigitato || '').trim();
    if (!q) {
      setLuogoStato('idle');
      return undefined;
    }

    let annullato = false;
    setLuogoStato('checking');

    const id = window.setTimeout(async () => {
      try {
        const coords = await geocode(q);
        if (annullato) return;
        setLuogoStato(coords ? 'ok' : 'notfound');
      } catch (err) {
        console.warn('[form] controllo luogo fallito:', err);
        if (!annullato) setLuogoStato('error');
      }
    }, 700);

    return () => {
      annullato = true;
      window.clearTimeout(id);
    };
  }, [luogoDigitato]);

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

    /* Le date non sono più input nativi (il calendario del browser
       parlava la lingua del browser, non italiano), quindi il
       controllo "campo obbligatorio" e quello sull'ordine delle due
       date li facciamo qui, come già si fa per la locandina. */
    if (!form.data) {
      setErrore('Scegli la data del torneo.');
      return;
    }

    if (form.dataFine && form.dataFine <= form.data) {
      setErrore('La data di fine deve venire dopo quella di inizio.');
      return;
    }

    // required non funziona su un input file nascosto
    if (!form.locandina) {
      setErrore('Aggiungi la locandina.');
      return;
    }

    setErrore('');

    // Geocode il luogo SEMPRE prima del salvataggio (torneo nuovo o
    // modifica): così le coordinate sono sempre allineate con il
    // luogo corrente, e un'eventuale correzione (typo sistemato,
    // frazione cambiata, DB del geocoder aggiornato, offset modificato
    // in utils/geocode.js) si riflette subito sulla mappa.
    //
    // Se il geocoder fallisce (rete, luogo inesistente, timeout) NON
    // blocchiamo il salvataggio: il torneo si crea/aggiorna comunque.
    // Comportamento sulle coordinate esistenti quando il geocoder non
    // trova risultato:
    // • luogo INVARIATO rispetto a `initial` → teniamo le vecchie
    //   coord (sono ancora valide, il geocoder ha solo fallito ora);
    // • luogo CAMBIATO (o torneo nuovo) → azzeriamo lat/lng, meglio
    //   invisibile sulla mappa che pinnato nel posto sbagliato.
    //
    // Confronto normalizzato (trim + lowercase) così "Udine " e
    // "udine" non contano come cambio. Sul torneo vecchio il valore
    // di partenza è `comune` (poi migrato in `luogo`).
    let patch = form;
    const norm = (s) => (s || '').trim().toLowerCase();
    const luogoIniziale = initial ? (initial.luogo || initial.comune) : '';
    const luogoCambiato = initial
      ? norm(luogoIniziale) !== norm(form.luogo)
      : true;

    if (form.luogo) {
      try {
        const coords = await geocode(form.luogo);

        if (coords) {
          patch = { ...form, lat: coords.lat, lng: coords.lng };
          setLuogoStato('ok');
        } else {
          setLuogoStato('notfound');

          /* Prima volta: mi fermo e lo dico, invece di salvare un
             torneo che poi non si troverebbe sulla mappa senza che
             nessuno l'abbia detto. Il salvataggio non è bloccato —
             ripetendolo senza toccare il luogo si procede comunque. */
          if (!salvaSenzaCoordinateRef.current) {
            salvaSenzaCoordinateRef.current = true;
            setErrore(
              `Luogo non trovato: il torneo non comparirà sulla mappa. Prova a scrivere solo Città e provincia (es. "Mels, UD"). Se il luogo è giusto così, premi di nuovo ${isEdit ? '"Modifica torneo"' : '"Crea torneo"'} per salvarlo lo stesso.`,
            );
            return;
          }

          if (luogoCambiato) {
            patch = { ...form, lat: null, lng: null };
          }
        }
      } catch (err) {
        console.warn('[form] geocoding fallito per', form.luogo, err);
        setLuogoStato('error');
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

              <DateField
                value={form.data}
                onChange={(iso) => update('data', iso)}
                inputClass={inputClass}
                inputStyle={inputStyle}
                placeholder="Scegli una data"
                ariaLabel="Data del torneo"
              />
            </div>

            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Data fine (se su più giorni)
              </label>

              <DateField
                value={form.dataFine}
                onChange={(iso) => update('dataFine', iso)}
                /* min = giorno DOPO la data inizio: un torneo "su più
                   giorni" finisce almeno il giorno successivo, e il
                   calendario (campo vuoto) si apre lì invece che sul
                   mese corrente. */
                min={form.data ? nextDayISO(form.data) : undefined}
                clearable
                align="right"
                inputClass={inputClass}
                inputStyle={inputStyle}
                placeholder="Nessuna"
                ariaLabel="Data di fine del torneo"
              />
            </div>
          </div>

          {/* CITTÀ / COSTO */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={labelClass}
                style={labelStyle}
              >
                Luogo
              </label>

              <input
                required
                className={inputClass}
                style={inputStyle}
                value={form.luogo}
                onChange={(e) =>
                  update('luogo', e.target.value)
                }
                placeholder="Luogo (Provincia)"
                aria-describedby="esito-luogo"
              />

              {/* Esito della ricerca sulla mappa, sotto al campo. */}
              <EsitoLuogo stato={luogoStato} />
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

/* ---------------------------------------------------------
   Riga di esito sotto al campo Luogo.

   È il posto dove si scopre, mentre si compila e non dopo aver
   salvato, se il luogo scritto esiste per il geocoder: da lì
   dipende il pin sulla mappa. Quando non lo trova suggerisce la
   forma che funziona quasi sempre — Città e provincia.
--------------------------------------------------------- */
function EsitoLuogo({ stato }) {
  if (stato === 'idle') return null;

  const contenuto = {
    checking: {
      icona: <Loader2 size={12} className="animate-spin shrink-0 mt-0.5" />,
      testo: 'Cerco il luogo sulla mappa...',
      colore: INK,
      opacita: 0.55,
    },
    ok: {
      icona: <MapPin size={12} className="shrink-0 mt-0.5" />,
      testo: 'Luogo trovato: comparirà sulla mappa.',
      colore: GRASS_DARK,
      opacita: 1,
    },
    notfound: {
      icona: <AlertTriangle size={12} className="shrink-0 mt-0.5" />,
      testo: 'Luogo non trovato. Prova a scrivere solo Città e provincia, es. "Mels, UD".',
      colore: CLAY_DARK,
      opacita: 1,
    },
    error: {
      icona: <AlertTriangle size={12} className="shrink-0 mt-0.5" />,
      testo: 'Non riesco a controllare il luogo adesso.',
      colore: INK,
      opacita: 0.55,
    },
  }[stato];

  if (!contenuto) return null;

  return (
    <p
      id="esito-luogo"
      className="text-xs mt-1.5 flex items-start gap-1.5 leading-snug"
      style={{ color: contenuto.colore, opacity: contenuto.opacita }}
    >
      {contenuto.icona}
      <span>{contenuto.testo}</span>
    </p>
  );
}