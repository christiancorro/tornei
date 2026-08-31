import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { PartyPopper, Bell, BellRing, Check, ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';

import { INK, SUN, GRASS_DARK } from '../theme';
import { attivaPush } from '../services/notifiche';
import { completaOnboarding } from '../services/account';
import NotificheSettings from './NotificheSettings';

const USCITA_MS = 320;

const CSS = `
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

.ban-corpo {
  padding-top: 0.75rem;
  transform: translateY(-6px);
  transition: transform 320ms cubic-bezier(0.2, 0.8, 0.3, 1);
}

.ban-guscio.is-aperto .ban-corpo {
  transform: none;
}

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
  .ban-guscio, .ban-corpo, .ban-card { transition: none; }
  .ban-testo { animation: none; }
}
`;

export default function OnboardingBanner({ profile }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [aperto, setAperto] = useState(false);
    const [altezza, setAltezza] = useState(0);
    const corpoRef = useRef(null);

    const [visibile, setVisibile] = useState(true);

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
    }, [step]);

    useEffect(() => {
        if (!visibile) return;
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => setAperto(true));
        });
        return () => cancelAnimationFrame(id);
    }, [visibile]);

    async function handleAttivaNotifiche() {
        setLoading(true);
        try {
            const { esito } = await attivaPush(profile.uid);
            if (esito === 'ok') {
                setStep(3); // Successo, animazione e passaggio alle preferenze
            } else {
                // Rifiutato dall'utente o dal browser. Invece di chiudere brutalmente,
                // possiamo semplicemente fermare il caricamento (o far apparire un alert).
                // Per testare l'UI senza problemi scommenta setStep(3) qui sotto:
                // setStep(3);
                console.warn('[onboarding] Notifiche non attivate:', esito);
            }
        } catch (err) {
            console.warn('[onboarding] Errore attivazione notifiche:', err);
        }
        setLoading(false);
    }

    async function chiudiOnboarding() {
        setLoading(true);

        // 1. Diciamo al vecchio NotificheBanner di non farsi vedere
        try {
            window.localStorage.setItem('vfvg-banner-notifiche-chiuso', '1');
        } catch (e) { }

        // 2. Facciamo partire l'animazione in uscita (il guscio si ritira)
        setAperto(false);

        // 3. Aspettiamo che l'animazione sia finita (320ms) PRIMA di aggiornare il DB.
        // In questo modo diamo il tempo all'interfaccia di chiudersi morbidamente
        // prima che App.jsx lo smonti definitivamente.
        window.setTimeout(() => {
            setVisibile(false);
            completaOnboarding(profile.uid).catch((err) => {
                console.error('[onboarding] Impossibile salvare stato:', err);
            });
        }, USCITA_MS);
    }

    if (!visibile) return null;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6">
            <style>{CSS}</style>

            <div
                className={`ban-guscio ${aperto ? 'is-aperto' : ''}`}
                style={{ height: aperto ? altezza : 0 }}
            >
                <div ref={corpoRef} className="ban-corpo">
                    <div
                        className="ban-card relative flex flex-col sm:flex-row sm:items-start gap-4 rounded-2xl border-2 px-5 py-4 mt-3"
                        style={{
                            borderColor: step === 3 ? 'rgba(72,130,34,0.35)' : 'rgba(34,48,31,0.15)',
                            backgroundColor: step === 3 ? 'rgba(72,130,34,0.06)' : 'rgba(245,165,36,0.07)',
                        }}
                    >
                        {/* ICONA */}
                        <span
                            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center sm:mt-1"
                            style={{
                                backgroundColor: step === 3 ? 'rgba(72,130,34,0.14)' : (step === 1 ? SUN : 'rgba(245,165,36,0.22)'),
                                transition: 'background-color 300ms ease',
                            }}
                        >
                            {step === 1 && <PartyPopper size={20} style={{ color: INK }} />}
                            {step === 2 && <BellRing size={20} style={{ color: INK }} />}
                            {step === 3 && <Check size={20} style={{ color: GRASS_DARK }} />}
                        </span>

                        {/* CONTENUTO */}
                        <div key={step} className="ban-testo min-w-0 flex-1 flex flex-col gap-3">

                            {/* STEP 1 */}
                            {/* STEP 1 */}
                            {step === 1 && (
                                <>
                                    <div className="pr-6 sm:pr-0">
                                        <p className="text-2xl font-bold" style={{ color: INK }}>
                                            Ciao pallavolista! 😊
                                        </p>

                                        <div className="text-base mt-3 flex flex-col gap-3" style={{ color: INK, opacity: 0.85 }}>
                                            <p>
                                                Benvenuto o benvenuta in <strong>Volley FVG</strong>. Sei in un portale dedicato agli appassionati di tornei di green volley e di beach volley del Friuli (e sì, anche Venezia Giulia) e dintorni.
                                            </p>
                                            <ul className="list-disc pl-5 flex flex-col gap-2">
                                                <li>
                                                    In <strong>tornei</strong> troverai la <strong>lista</strong> e la <strong>mappa</strong> dei prossimi tornei. Puoi usare i filtri in alto per affinare la ricerca del tuo prossimo torneo!
                                                </li>
                                                <li>
                                                    Usa la <strong>bacheca</strong> per pubblicare annunci e trovare la tua prossima squadra o nuovi compagni.
                                                </li>
                                                <li>
                                                    Vai su <strong>Il mio profilo</strong> per aggiungere nuovi tornei e molto altro.
                                                </li>
                                            </ul>

                                            <p className="text-sm mt-1 px-3 py-2.5 rounded-xl border border-black/10 bg-black/5">
                                                🚧 Il sito è in continuo sviluppo. Ogni tuo suggerimento è super ben accetto: inviaci le tue idee (o segnalaci problemi) usando la sezione <strong>Suggerimenti</strong> nela pagina del tuo profilo.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3 justify-end">
                                        <button
                                            onClick={() => setStep(2)}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-regular transition-transform active:scale-95"
                                            style={{ backgroundColor: INK, color: '#fff' }}
                                        >
                                            Avanti <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* STEP 2 */}
                            {step === 2 && (
                                <>
                                    <div className="pr-6 sm:pr-0">
                                        <p className="text-xl font-bold" style={{ color: INK }}>
                                            Resta aggiornato
                                        </p>
                                        <p className="text-base mt-1" style={{ color: INK, opacity: 0.8 }}>
                                            Vuoi sapere quando esce un nuovo torneo? Attiva le notifiche per non perderti nulla. Potrai scegliere cosa seguire (niente spam) e disattivarle quando vuoi.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <button
                                            onClick={() => setStep(1)}
                                            disabled={loading}
                                            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <ArrowLeft size={16} /> Indietro
                                        </button>
                                        <button
                                            onClick={handleAttivaNotifiche}
                                            disabled={loading}
                                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
                                            style={{ backgroundColor: SUN, color: INK }}
                                        >
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            {!loading && <Bell size={16} />}
                                            {loading ? 'Attivazione...' : 'Attiva notifiche'}
                                        </button>
                                        <button
                                            onClick={chiudiOnboarding}
                                            disabled={loading}
                                            className="px-3 py-2 rounded-full text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            Non ora
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* STEP 3 */}
                            {step === 3 && (
                                <>
                                    <div>
                                        <p className="text-base font-bold" style={{ color: GRASS_DARK }}>
                                            Notifiche attive!
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: INK, opacity: 0.8 }}>
                                            Scegli cosa ti interessa ricevere.
                                        </p>
                                    </div>

                                    {/* Incorporiamo direttamente le impostazioni del profilo */}
                                    <div className="-mx-2 -mt-2 opacity-90 scale-95 origin-top-left sm:scale-100">
                                        <NotificheSettings profile={profile} />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <button
                                            onClick={() => setStep(2)}
                                            disabled={loading}
                                            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <ArrowLeft size={16} /> Indietro
                                        </button>
                                        <button
                                            onClick={chiudiOnboarding}
                                            disabled={loading}
                                            className="flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
                                            style={{ backgroundColor: INK, color: '#fff' }}
                                        >
                                            {loading && <Loader2 size={16} className="animate-spin" />}
                                            Ho finito 🎉
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* TASTO X (opzionale per skippare subito, visibile solo in step 1 e 2) */}
                        {(step === 1 || step === 2) && (
                            <button
                                type="button"
                                onClick={chiudiOnboarding}
                                disabled={loading}
                                className="absolute top-3 right-3 sm:static w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:bg-black/5"
                                style={{ color: INK, opacity: 0.5 }}
                                aria-label="Chiudi e non mostrare più"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}