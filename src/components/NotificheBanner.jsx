import React, { useEffect, useState } from 'react';
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
--------------------------------------------------------- */

const CHIAVE_CHIUSO = 'vfvg-banner-notifiche-chiuso';

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
  // 'controllo' | 'nascosto' | 'visibile' | 'attesa' | 'fatto'
  const [stato, setStato] = useState('controllo');

  useEffect(() => {
    let vivo = true;

    (async () => {
      if (giaChiuso() || permessoNotifiche() !== 'default') {
        if (vivo) setStato('nascosto');
        return;
      }

      const ok = await pushSupportato();
      if (vivo) setStato(ok ? 'visibile' : 'nascosto');
    })();

    return () => { vivo = false; };
  }, []);

  // Dopo il "fatto" il banner si toglie da solo: il messaggio di
  // conferma serve un paio di secondi, poi è solo ingombro.
  useEffect(() => {
    if (stato !== 'fatto') return undefined;
    const id = window.setTimeout(() => setStato('nascosto'), 2600);
    return () => window.clearTimeout(id);
  }, [stato]);

  async function attiva() {
    setStato('attesa');
    ricordaChiuso();

    try {
      const { esito } = await attivaPush(uid);
      setStato(esito === 'ok' ? 'fatto' : 'nascosto');
    } catch (err) {
      console.warn('[notifiche] attivazione fallita:', err);
      setStato('nascosto');
    }
  }

  function chiudi() {
    ricordaChiuso();
    setStato('nascosto');
  }

  if (stato === 'controllo' || stato === 'nascosto') return null;

  const fatto = stato === 'fatto';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 mt-3 fade-in">
      <div
        className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3"
        style={{
          borderColor: fatto ? 'rgba(72,130,34,0.35)' : 'rgba(34,48,31,0.15)',
          backgroundColor: fatto ? 'rgba(72,130,34,0.06)' : 'rgba(245,165,36,0.07)',
        }}
      >
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: fatto ? 'rgba(72,130,34,0.14)' : 'rgba(245,165,36,0.22)' }}
        >
          {fatto
            ? <Check size={18} style={{ color: GRASS_DARK }} />
            : <BellRing size={18} style={{ color: INK }} />}
        </span>

        <div className="min-w-0 flex-1">
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
                Attiva le notifiche, potrai disattivarle in qualunque momento.
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold shrink-0 disabled:opacity-50"
              style={{ backgroundColor: SUN, color: INK }}
            >
              <Bell size={16} />
              {stato === 'attesa' ? 'Attendo...' : 'Attiva'}
            </button>

            <button
              type="button"
              onClick={chiudi}
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
  );
}
