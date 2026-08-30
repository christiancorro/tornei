import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, X } from 'lucide-react';

import { INK, SUN, GRASS_DARK } from '../theme';
import { attivaPush, permessoNotifiche, pushSupportato } from '../services/notifiche';

/* ---------------------------------------------------------
   Banner "attiva le notifiche", sotto i filtri.

   Compare una volta sola e a chiunque, loggato o no: le notifiche
   dei tornei non hanno bisogno di un account, e chiedere di
   registrarsi per riceverle sarebbe un ostacolo messo lì per
   niente.

   Il permesso del browser si può chiedere SOLO dopo un gesto
   dell'utente: un popup che spunta da solo al caricamento viene
   ignorato (e da Chrome anche bloccato, se troppi lo rifiutano).
   Quindi il banner non chiede niente: propone, e il popup arriva
   dopo il click.

   Sparisce per sempre appena l'utente decide — sì, no, o la X.
   Chi lo chiude non se lo ritrova al prossimo giro: se cambia idea
   c'è l'interruttore in Impostazioni (da loggato) o basta
   riattivarlo dal browser.

   ENTRATA E USCITA
   Il banner si infila fra i filtri e la lista, quindi comparire e
   sparire di colpo vuol dire far saltare in su e in giù tutto
   quello che ha sotto. Per questo apre e chiude ANIMANDO L'ALTEZZA:
   la lista scivola, non sobbalza. Il trucco è la griglia da 0fr a
   1fr — l'unico modo di animare un'altezza "auto" senza misurarla
   a mano in JavaScript.
--------------------------------------------------------- */

const CHIAVE_CHIUSO = 'vfvg-banner-notifiche-chiuso';

/* Deve combaciare con la durata in CSS: il componente resta montato
   per tutta l'uscita, se no non ci sarebbe niente da animare. */
const USCITA_MS = 320;

const CSS = `
/* L'altezza è in pixel e la mette JS misurando il contenuto.

   Il trucco CSS puro (grid-template-rows da 0fr a 1fr) apre e
   chiude benissimo, ma quando è il CONTENUTO a cambiare altezza —
   da "vuoi attivarle?" a "fatto", che su mobile sono 158px contro
   80 — la riga si riadatta di scatto, e la lista sotto sobbalza.
   Con un valore in pixel il browser ha due numeri fra cui
   interpolare, quindi anche quel passaggio scivola. */
.ban-guscio {
  height: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    height 320ms cubic-bezier(0.2, 0.8, 0.3, 1),
    opacity 220ms ease;
}

.ban-guscio.is-aperto {
  opacity: 1;
}

/* Il padding sta QUI dentro e non fuori dal guscio: fuori
   resterebbe anche a banner chiuso, lasciando un buco di 12px.
   È padding e non margin perché offsetHeight deve comprenderlo,
   se no la misura sarebbe corta e il contenuto verrebbe tagliato. */
.ban-corpo {
  padding-top: 0.75rem;
  transform: translateY(-6px);
  transition: transform 320ms cubic-bezier(0.2, 0.8, 0.3, 1);
}

.ban-guscio.is-aperto .ban-corpo {
  transform: none;
}

/* Passaggio da "vuoi attivarle?" a "fatto": i colori si sciolgono
   l'uno nell'altro invece di cambiare di scatto. */
.ban-card {
  transition: background-color 300ms ease, border-color 300ms ease;
}

.ban-testo {
  animation: ban-comparsa 260ms ease-out both;
}

@keyframes ban-comparsa {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .ban-guscio,
  .ban-corpo,
  .ban-card {
    transition: none;
  }


  .ban-testo {
    animation: none;
  }
}
`;

function giaChiuso() {
  try {
    return window.localStorage.getItem(CHIAVE_CHIUSO) === '1';
  } catch {
    return false;
  }
}

function ricordaChiuso() {
  try {
    window.localStorage.setItem(CHIAVE_CHIUSO, '1');
  } catch {
    /* niente localStorage: al massimo il banner ricompare */
  }
}

export default function NotificheBanner({ uid = null }) {
  // Se l'utente non è loggato, interrompi immediatamente senza renderizzare nulla
  if (!uid) return null;

  // 'controllo' | 'nascosto' | 'visibile' | 'attesa' | 'fatto'
  const [stato, setStato] = useState('controllo');

  /* Separato dallo stato: dice se il banner è aperto o chiuso in
     altezza. Nasce a false anche quando il contenuto è già lì, così
     il primo frame è "chiuso" e la transizione ha da dove partire —
     se montasse già aperto non ci sarebbe nessuna animazione. */
  const [aperto, setAperto] = useState(false);

  /* Altezza del contenuto, misurata: è il valore verso cui il
     guscio anima. Un ResizeObserver la tiene aggiornata da sola —
     serve sia quando cambia il testo (proposta → fatto) sia quando
     cambia la larghezza della finestra e le righe si riflowano. */
  const corpoRef = useRef(null);
  const [altezza, setAltezza] = useState(0);

  useLayoutEffect(() => {
    const el = corpoRef.current;
    if (!el) return undefined;

    const misura = () => setAltezza(el.offsetHeight);
    misura();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', misura);
      return () => window.removeEventListener('resize', misura);
    }

    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stato]);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // Se l'utente non è autenticato (!uid), oppure ha già chiuso il banner o bloccato le notifiche
      if (!uid || giaChiuso() || permessoNotifiche() !== 'default') {
        if (vivo) setStato('nascosto');
        return;
      }

      const ok = await pushSupportato();
      if (vivo) setStato(ok ? 'visibile' : 'nascosto');
    })();

    return () => { vivo = false; };
  }, [uid]);

  /* Apertura al frame successivo alla comparsa del contenuto: due
     rAF perché il primo serve a far scrivere il DOM, il secondo a
     far partire la transizione da uno stato già disegnato. */
  useEffect(() => {
    if (stato === 'controllo' || stato === 'nascosto') return undefined;

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAperto(true));
    });

    return () => cancelAnimationFrame(id);
  }, [stato]);

  // Dopo il "fatto" il banner si toglie da solo: il messaggio di
  // conferma serve un paio di secondi, poi è solo ingombro.
  useEffect(() => {
    if (stato !== 'fatto') return undefined;
    const id = window.setTimeout(() => chiudi(), 2600);
    return () => window.clearTimeout(id);
  }, [stato]);

  /* Chiusura in due tempi: prima l'altezza torna a zero, poi — a
     transizione finita — il componente sparisce davvero. */
  function chiudi() {
    setAperto(false);
    window.setTimeout(() => setStato('nascosto'), USCITA_MS);
  }

  async function attiva() {
    setStato('attesa');
    ricordaChiuso();

    try {
      const { esito } = await attivaPush(uid);
      if (esito === 'ok') setStato('fatto');
      else chiudi();
    } catch (err) {
      console.warn('[notifiche] attivazione fallita:', err);
      chiudi();
    }
  }

  function rifiuta() {
    ricordaChiuso();
    chiudi();
  }

  if (stato === 'controllo' || stato === 'nascosto') return null;

  const fatto = stato === 'fatto';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6">
      <style>{CSS}</style>

      <div
        className={`ban-guscio ${aperto ? 'is-aperto' : ''}`}
        style={{ height: aperto ? altezza : 0 }}
      >
        <div ref={corpoRef} className="ban-corpo">
          {/* flex-wrap + il pulsante a larghezza piena su mobile: sotto i
                640px "Attiva" scende su una riga sua, così il testo non
                resta strizzato in una colonna da tre parole. Sopra i 640
                torna tutto in fila. */}
          <div
            className="ban-card flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border-2 px-4 py-3 mt-3"
            style={{
              borderColor: fatto ? 'rgba(72,130,34,0.35)' : 'rgba(34,48,31,0.15)',
              backgroundColor: fatto ? 'rgba(72,130,34,0.06)' : 'rgba(245,165,36,0.07)',
            }}
          >
            <span
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: fatto ? 'rgba(72,130,34,0.14)' : 'rgba(245,165,36,0.22)',
                transition: 'background-color 300ms ease',
              }}
            >
              {fatto
                ? <Check size={18} style={{ color: GRASS_DARK }} />
                : <BellRing size={18} style={{ color: INK }} />}
            </span>

            {/* key sullo stato: il testo nuovo entra in dissolvenza
                  invece di sostituire quello vecchio a scatto. */}
            <div key={fatto ? 'fatto' : 'proposta'} className="ban-testo min-w-0 flex-1">
              {fatto ? (
                <p className="text-sm font-semibold" style={{ color: GRASS_DARK }}>
                  Notifiche attive. Ti avvisiamo appena esce qualcosa di nuovo.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: INK }}>
                    Vuoi sapere quando esce un nuovo torneo?
                  </p>
                  <p className="text-xs" style={{ color: INK, opacity: 0.6 }}>
                    Attiva le notifiche. Puoi disattivarle in qualunque momento dalle impostazioni.
                  </p>
                </>
              )}
            </div>

            {!fatto && (
              <>
                <button
                  type="button"
                  onClick={attiva}
                  disabled={stato === 'attesa'}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full
                      text-sm font-semibold shrink-0 disabled:opacity-50
                      w-full order-last sm:w-auto sm:order-none"
                  style={{ backgroundColor: SUN, color: INK }}
                >
                  <Bell size={16} />
                  {stato === 'attesa' ? 'Attendo...' : 'Attiva'}
                </button>

                <button
                  type="button"
                  onClick={rifiuta}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5"
                  style={{ color: INK, opacity: 0.5 }}
                  aria-label="Non mostrare più"
                  title="Non mostrare più"
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}