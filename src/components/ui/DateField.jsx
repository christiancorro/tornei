import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { it } from 'react-day-picker/locale';
import 'react-day-picker/style.css';

import { INK, SUN } from '../../theme';
import { MESI, GIORNI_BREVI } from '../../constants';
import { todayISO } from '../../utils';

/* ---------------------------------------------------------
   DateField — campo data con calendario in italiano.

   `<input type="date">` si scrive da solo nella lingua del
   BROWSER, non in quella della pagina: su un computer in inglese
   il form mostrava "08/27/2026" e un calendario con "August" e
   "Sun Mon Tue", e non c'è modo di forzarlo da HTML o da CSS.

   Il calendario vero e proprio è react-day-picker con il locale
   italiano (settimana da lunedì, mesi in italiano) — navigazione,
   tastiera e accessibilità sono roba sua, testata da mezzo mondo.
   Qui intorno resta solo quello che è di questa app: il campo su
   cui si clicca, il pannello che si apre, e la conversione da e
   verso la stringa ISO.

   Fuori infatti non cambia niente: il valore è sempre una stringa
   ISO YYYY-MM-DD, identica a quella che dava l'input nativo, e
   `onChange` la restituisce nello stesso formato — Firestore, i
   filtri e lo slider non si accorgono di niente.

   Props:
     value       ISO YYYY-MM-DD ('' = vuoto)
     onChange(iso)
     min, max    ISO, estremi selezionabili (opzionali)
     clearable   mostra "Cancella" (per la data di fine)
     align       da che lato si apre il pannello: 'left' | 'right'
     inputClass/inputStyle  gli stessi del form, così il campo
                 resta identico agli altri
--------------------------------------------------------- */

/* Quanto dura l'animazione di chiusura del pannello. Deve
   combaciare con `df-pop-out` qui sotto: il pannello resta montato
   per tutto quel tempo, se no non ci sarebbe più niente da animare
   (è la stessa idea di useModalClose, in piccolo e senza il
   listener globale di Esc, che qui è già gestito). */
const CHIUSURA_MS = 120;

/* Le date girano per l'app come stringhe ISO; react-day-picker
   lavora con oggetti Date. Converto a mano invece di usare
   toISOString(), che passa per UTC: a mezzanotte italiana
   sposterebbe il giorno. */
function dataDaIso(iso) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function isoDaData(data) {
  if (!data) return '';
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* "Gio 27 Agosto 2026": il giorno della settimana in testa perché
   per un torneo è l'informazione che si cerca per prima. */
function etichetta(iso) {
  const data = dataDaIso(iso);
  if (!data) return '';
  return `${GIORNI_BREVI[data.getDay()]} ${data.getDate()} ${MESI[data.getMonth()]} ${data.getFullYear()}`;
}

/* "27 Ago 2026": su mobile i due campi data stanno affiancati in
   mezza colonna, e la versione lunga verrebbe tagliata a metà
   parola. Stessa data, scritta corta. */
function etichettaBreve(iso) {
  const data = dataDaIso(iso);
  if (!data) return '';
  return `${data.getDate()} ${MESI[data.getMonth()].slice(0, 3)} ${data.getFullYear()}`;
}

/* Il calendario di react-day-picker vestito come il resto dell'app:
   quasi tutto passa dalle sue variabili CSS, il resto sono tre
   regole per il giorno scelto e per oggi. */
const CSS = `
/* Apertura: il pannello scende di pochi pixel dal bordo del campo,
   crescendo dall'angolo da cui è ancorato. Corsa corta e curva
   soft-out: deve sembrare che si srotoli da sotto al campo, non
   che arrivi da fuori schermo. */
.df-pop {
  animation: df-pop-in 0.16s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

@keyframes df-pop-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Uscita più svelta dell'entrata: chiudere deve sembrare
   immediato, aprire può respirare. Durante la dissolvenza il
   pannello non prende più click: sta già andando via, e un giorno
   cliccato per sbaglio cambierebbe la data. */
.df-pop.is-closing {
  animation: df-pop-out 0.12s ease-in both;
  pointer-events: none;
}

@keyframes df-pop-out {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
  }
}

@media (prefers-reduced-motion: reduce) {
  .df-pop,
  .df-pop.is-closing {
    animation-duration: 0.01ms;
  }
}

.df-cal .rdp-root {
  --rdp-accent-color: ${SUN};
  --rdp-accent-background-color: rgba(245, 165, 36, 0.16);

  --rdp-day-height: 36px;
  --rdp-day-width: 36px;
  --rdp-day_button-height: 34px;
  --rdp-day_button-width: 34px;
  --rdp-day_button-border-radius: 10px;
  --rdp-day_button-border: 2px solid transparent;
  --rdp-selected-border: 2px solid transparent;

  --rdp-today-color: ${INK};
  --rdp-disabled-opacity: 0.25;
  --rdp-outside-opacity: 0.35;

  --rdp-nav-height: 2rem;
  --rdp-nav_button-height: 1.9rem;
  --rdp-nav_button-width: 1.9rem;

  --rdp-weekday-opacity: 0.45;
  --rdp-weekday-padding: 0.15rem 0;
  --rdp-weekday-text-transform: none;

  --rdp-months-gap: 0;

  font-family: inherit;
  font-size: 0.875rem;
  color: ${INK};
}

.df-cal .rdp-caption_label {
  font-size: 1rem;
  font-weight: 500;
  padding-left: 9px
}

.df-cal .rdp-weekday {
  font-size: 11px;
  font-weight: 500;
}

/* Le frecce dei mesi le tengo scure: arancioni (il colore d'accento
   che react-day-picker usa di default) rubavano l'occhio al giorno
   selezionato, che è l'unica cosa che deve spiccare. */
.df-cal .rdp-chevron {
  fill: ${INK};
  opacity: 0.55;
}

.df-cal .rdp-button_previous:hover .rdp-chevron,
.df-cal .rdp-button_next:hover .rdp-chevron {
  opacity: 1;
}

.df-cal .rdp-day_button {
  font-weight: 400;
}

/* Giorno scelto: pastiglia piena, come i chip attivi dei filtri. */
.df-cal .rdp-selected .rdp-day_button {
  background-color: ${SUN};
  color: #ffffff;
}

/* Oggi: solo un fondo tenue, così resta riconoscibile senza
   sembrare selezionato. */
.df-cal .rdp-today:not(.rdp-selected) .rdp-day_button {
  background-color: rgba(245, 165, 36, 0.05);
  border: solid 2px rgba(245, 165, 36, 0.15);
}

.df-cal .rdp-day_button:disabled {
  cursor: default;
}
`;

export default function DateField({
  value = '',
  onChange,
  min = '',
  max = '',
  clearable = false,
  align = 'left',
  placeholder = 'Scegli una data',
  inputClass = '',
  inputStyle,
  ariaLabel,
}) {
  /* Tre stati invece di un booleano: 'inChiusura' è quello che
     tiene il pannello vivo mentre l'animazione di uscita finisce. */
  const [stato, setStato] = useState('chiuso');
  const chiusuraRef = useRef(null);

  const aperto = stato === 'aperto';
  const montato = stato !== 'chiuso';

  const contenitoreRef = useRef(null);
  const pannelloRef = useRef(null);
  const campoRef = useRef(null);

  function apri() {
    window.clearTimeout(chiusuraRef.current);
    setStato('aperto');
  }

  function chiudi({ tornaAlCampo = false } = {}) {
    setStato((s) => {
      if (s !== 'aperto') return s;
      window.clearTimeout(chiusuraRef.current);
      chiusuraRef.current = window.setTimeout(() => setStato('chiuso'), CHIUSURA_MS);
      return 'inChiusura';
    });

    if (tornaAlCampo) campoRef.current?.focus();
  }

  // Timer in sospeso allo smontaggio.
  useEffect(() => () => window.clearTimeout(chiusuraRef.current), []);

  const oggi = todayISO();

  /* Mese da cui si apre il calendario: quello della data scelta;
     a campo vuoto, il primo mese in cui c'è qualcosa da scegliere
     (il minimo consentito, altrimenti oggi). */
  const partenza = value || (min && min > oggi ? min : oggi);
  const [mese, setMese] = useState(() => dataDaIso(partenza));

  /* Il valore può cambiare da fuori mentre il pannello è chiuso
     (es. la data di fine azzerata quando cambia quella di inizio):
     alla riapertura il calendario deve ripartire dal mese giusto. */
  useEffect(() => {
    if (montato) return;
    setMese(dataDaIso(partenza));
  }, [montato, partenza]);

  function scegli(data) {
    // onSelect torna undefined se si riclicca il giorno già scelto:
    // per un campo data "deselezionare" non vuol dire niente, si
    // cancella con il pulsante apposta.
    if (!data) return;
    onChange?.(isoDaData(data));
    chiudi({ tornaAlCampo: true });
  }

  function cancella() {
    onChange?.('');
    chiudi({ tornaAlCampo: true });
  }

  /* Chiusura: click fuori o Esc. Il listener è su pointerdown e non
     su click perché dentro a un modale il click "vero" arriva dopo
     il blur, e un giro di troppo basta a far sparire il pannello
     prima che il giorno riceva il suo evento. */
  useEffect(() => {
    if (!aperto) return undefined;

    const fuori = (e) => {
      if (!contenitoreRef.current?.contains(e.target)) chiudi();
    };

    const tasto = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      chiudi({ tornaAlCampo: true });
    };

    document.addEventListener('pointerdown', fuori);
    document.addEventListener('keydown', tasto, true);

    return () => {
      document.removeEventListener('pointerdown', fuori);
      document.removeEventListener('keydown', tasto, true);
    };
  }, [aperto]);

  /* Il form è un pannello che scorre: se il campo sta in fondo, il
     calendario si aprirebbe sotto la piega. Lo porto in vista appena
     compare — `block: 'nearest'` non muove niente quando è già
     tutto visibile. */
  useLayoutEffect(() => {
    if (!aperto) return;
    pannelloRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [aperto]);

  const selezionata = dataDaIso(value);
  const minData = dataDaIso(min);
  const maxData = dataDaIso(max);

  const spenti = [];
  if (minData) spenti.push({ before: minData });
  if (maxData) spenti.push({ after: maxData });

  return (
    <div className="relative" ref={contenitoreRef}>
      <button
        ref={campoRef}
        type="button"
        onClick={() => (aperto ? chiudi() : apri())}
        aria-haspopup="dialog"
        aria-expanded={aperto}
        aria-label={ariaLabel}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
        style={{
          ...inputStyle,
          borderColor: aperto ? 'rgba(43,43,43,0.55)' : undefined,
        }}
      >
        <span className="truncate" style={{ opacity: value ? 1 : 0.45 }}>
          {value ? (
            <>
              <span className="hidden sm:inline">{etichetta(value)}</span>
              <span className="sm:hidden">{etichettaBreve(value)}</span>
            </>
          ) : (
            placeholder
          )}
        </span>

        <CalendarDays size={16} style={{ opacity: 0.45, flexShrink: 0 }} />
      </button>

      {montato && (
        <div
          ref={pannelloRef}
          role="dialog"
          aria-label="Calendario"
          className={`df-cal df-pop absolute z-30 mt-1.5 p-2 rounded-xl border-2 shadow-xl ${stato === 'inChiusura' ? 'is-closing' : ''}`}
          style={{
            [align === 'right' ? 'right' : 'left']: 0,
            maxWidth: '90vw',
            backgroundColor: '#ffffff',
            borderColor: 'rgba(43,43,43,0.18)',
            /* Cresce dall'angolo con cui è agganciato al campo: da
               sinistra sotto il campo di inizio, da destra sotto
               quello di fine. */
            transformOrigin: align === 'right' ? 'top right' : 'top left',
          }}
        >
          <style>{CSS}</style>

          <DayPicker
            mode="single"
            locale={it}
            selected={selezionata}
            onSelect={scegli}
            month={mese}
            onMonthChange={setMese}
            startMonth={minData}
            endMonth={maxData}
            disabled={spenti}
            showOutsideDays={false}
            animate={false}
            /* Il locale scriverebbe "agosto 2026" e "lun mar mer":
               uso le stesse stringhe del resto dell'app, che sono
               maiuscole all'inizio. */
            formatters={{
              formatCaption: (m) => `${MESI[m.getMonth()]} ${m.getFullYear()}`,
              formatWeekdayName: (g) => GIORNI_BREVI[g.getDay()],
            }}
          />

          <div
            className="flex items-center justify-between gap-2 px-1 pt-2 mt-1"
            style={{ borderTop: '1px solid rgba(43,43,43,0.10)' }}
          >
            <button
              type="button"
              onClick={() => setMese(dataDaIso(min && oggi < min ? min : oggi))}
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ color: INK, opacity: 0.6 }}
            >
              Oggi
            </button>

            {clearable && value && (
              <button
                type="button"
                onClick={cancella}
                className="text-sm font-sembibold px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ color: "#cb5e05", opacity: 1 }}
              >
                <X size={13} /> Cancella
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}