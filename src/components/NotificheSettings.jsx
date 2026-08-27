import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Megaphone, MessageCircle, CalendarPlus } from 'lucide-react';

import { INK, SUN, CLAY, CARD_BG } from '../theme';
import {
  PREFERENZE_DEFAULT,
  attivaPush,
  disattivaPush,
  leggiPreferenze,
  permessoNotifiche,
  pushSupportato,
  salvaPreferenze,
} from '../services/notifiche';

/* ---------------------------------------------------------
   Impostazioni → Notifiche.

   Il permesso è del browser e vive per dispositivo; le
   preferenze invece le scriviamo su tutti i dispositivi
   dell'account, perché spegnere una notifica sul telefono e
   ritrovarsela accesa sul computer sarebbe una sorpresa
   sgradevole.

   Due stati vale la pena distinguerli bene:
   • "mai chiesto" → si può proporre il pulsante;
   • "negato"      → il popup del browser non si può richiamare
                     da codice, quindi l'unica cosa onesta è
                     spiegare dove si riattiva a mano.
--------------------------------------------------------- */

const VOCI = [
  {
    chiave: 'tornei',
    icona: CalendarPlus,
    titolo: 'Nuovi tornei',
    testo: 'Quando viene pubblicato un torneo.',
  },
  {
    chiave: 'annunci',
    icona: Megaphone,
    titolo: 'Nuovi annunci',
    testo: 'Quando qualcuno cerca squadra o giocatori in bacheca.',
  },
  {
    chiave: 'messaggi',
    icona: MessageCircle,
    titolo: 'Messaggi',
    testo: 'Quando ti scrivono in risposta a un annuncio.',
  },
];

function Interruttore({ acceso, onChange, etichetta, disabilitato }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceso}
      aria-label={etichetta}
      disabled={disabilitato}
      onClick={() => onChange(!acceso)}
      className="relative shrink-0 rounded-full transition-colors disabled:opacity-40"
      style={{
        width: 46,
        height: 26,
        backgroundColor: acceso ? SUN : 'rgba(34,48,31,0.18)',
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-all"
        style={{
          width: 20,
          height: 20,
          top: 3,
          left: acceso ? 23 : 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}

export default function NotificheSettings({ profile }) {
  const uid = profile?.uid ?? null;

  const [supportato, setSupportato] = useState(null); // null = sto controllando
  const [permesso, setPermesso] = useState(permessoNotifiche());
  const [prefs, setPrefs] = useState(null);           // null = non attive qui
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    let vivo = true;

    (async () => {
      const ok = await pushSupportato();
      if (!vivo) return;

      setSupportato(ok);
      if (!ok) return;

      setPermesso(permessoNotifiche());
      const salvate = await leggiPreferenze();
      if (vivo) setPrefs(salvate);
    })();

    return () => { vivo = false; };
  }, []);

  async function attiva() {
    setErrore('');
    setBusy(true);

    try {
      const { esito } = await attivaPush(uid);
      setPermesso(permessoNotifiche());

      if (esito === 'ok') {
        setPrefs(await leggiPreferenze());
      } else if (esito === 'negato') {
        setErrore('Il browser ha bloccato le notifiche.');
      }
    } catch (err) {
      console.warn('[notifiche] attivazione fallita:', err);
      setErrore('Attivazione non riuscita. Riprova fra poco.');
    } finally {
      setBusy(false);
    }
  }

  async function disattiva() {
    setErrore('');
    setBusy(true);

    try {
      await disattivaPush();
      setPrefs(null);
    } catch (err) {
      console.warn('[notifiche] disattivazione fallita:', err);
      setErrore('Non sono riuscito a disattivarle. Riprova.');
    } finally {
      setBusy(false);
    }
  }

  /* Aggiorno subito l'interruttore e poi salvo: aspettare la rete
     per far muovere una levetta la fa sembrare rotta. Se il
     salvataggio fallisce torno indietro e lo dico. */
  async function cambia(chiave, valore) {
    const precedenti = prefs;
    const nuove = { ...PREFERENZE_DEFAULT, ...prefs, [chiave]: valore };

    setPrefs(nuove);
    setErrore('');

    try {
      await salvaPreferenze(nuove, uid);
    } catch (err) {
      console.warn('[notifiche] salvataggio preferenze fallito:', err);
      setPrefs(precedenti);
      setErrore('Modifica non salvata. Riprova.');
    }
  }

  const attive = permesso === 'granted' && prefs !== null;

  return (
    <div
      className="rounded-xl border-2 p-4 mb-4"
      style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Bell size={18} style={{ color: INK, opacity: 0.6 }} />
        <h3 className="font-black text-base" style={{ color: INK }}>Notifiche</h3>
      </div>

      <p className="text-xs mb-3" style={{ color: INK, opacity: 0.6 }}>
        Arrivano anche a sito chiuso, come quelle di un'app.
      </p>

      {supportato === null && (
        <p className="text-sm flex items-center gap-2" style={{ color: INK, opacity: 0.6 }}>
          <Loader2 size={15} className="animate-spin" /> Controllo...
        </p>
      )}

      {supportato === false && (
        <p className="text-sm" style={{ color: INK, opacity: 0.7 }}>
          Questo browser non supporta le notifiche push. Su iPhone funzionano solo dopo aver
          aggiunto il sito alla schermata Home (Condividi → Aggiungi a Home).
        </p>
      )}

      {supportato && permesso === 'denied' && (
        <p className="text-sm" style={{ color: INK, opacity: 0.75 }}>
          Le notifiche sono bloccate per questo sito. Il permesso può ridarlo solo il browser:
          tocca il lucchetto accanto all'indirizzo e riattiva le notifiche, poi torna qui.
        </p>
      )}

      {supportato && permesso !== 'denied' && !attive && (
        <button
          type="button"
          onClick={attiva}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: SUN, color: INK }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          Attiva le notifiche
        </button>
      )}

      {attive && (
        <>
          <div className="space-y-1">
            {VOCI.map(({ chiave, icona: Icona, titolo, testo }) => (
              <div key={chiave} className="flex items-center gap-3 py-2">
                <Icona size={17} style={{ color: INK, opacity: 0.55 }} className="shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{titolo}</p>
                  <p className="text-xs" style={{ color: INK, opacity: 0.55 }}>{testo}</p>
                </div>

                <Interruttore
                  acceso={Boolean(prefs?.[chiave])}
                  onChange={(v) => cambia(chiave, v)}
                  etichetta={titolo}
                  disabilitato={busy}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={disattiva}
            disabled={busy}
            className="flex items-center gap-1.5 mt-3 text-xs font-bold disabled:opacity-50"
            style={{ color: INK, opacity: 0.6 }}
          >
            <BellOff size={14} />
            Disattiva su questo dispositivo
          </button>
        </>
      )}

      {errore && (
        <p className="text-sm font-semibold mt-3" style={{ color: CLAY }}>{errore}</p>
      )}
    </div>
  );
}
