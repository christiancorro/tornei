import React, { useState, useEffect } from 'react';
import { Lightbulb, Send, Check, Clock, Trash2, Loader2 } from 'lucide-react';

import { INK, SUN, CLAY, CARD_BG, GRASS_DARK } from '../theme';
import { timeAgo } from '../utils';
import { useActionState } from '../hooks/useActionState';
import { deleteRichiesta } from '../services/richieste';
import { useFeedback } from './FeedbackProvider';
import RichiestaThread from './RichiestaThread';

export default function FeedbackPanel({ onSendFeedback, mieRichieste = [], profile }) {
    const [testo, setTesto] = useState('');
    const [sending, setSending] = useState(false);

    // "Sticky highlight": id delle richieste che avevano una risposta
    // admin non ancora letta al momento dell'apertura della tab.
    // Vive nel componente e si azzera solo quando il pannello viene
    // smontato (l'utente cambia tab): è il momento giusto per
    // "dimenticare" che c'era una novità.
    const [novitaSticky, setNovitaSticky] = useState(() => new Set());

    useEffect(() => {
        const nuove = mieRichieste
            .filter((r) => r.risposto === true && r.lettoDaUtente === false)
            .map((r) => r.id);
        if (nuove.length === 0) return;
        setNovitaSticky((prev) => {
            let cambiato = false;
            const next = new Set(prev);
            for (const id of nuove) {
                if (!next.has(id)) { next.add(id); cambiato = true; }
            }
            return cambiato ? next : prev;
        });
    }, [mieRichieste]);

    // Quali thread sono attualmente aperti, per id richiesta. La card
    // resta evidenziata solo se è nel sticky E il thread è chiuso: appena
    // l'utente apre per leggere, la notifica sparisce; se poi richiude,
    // ricompare (segnalando che sì, la novità c'era davvero — non ci si
    // dimentica di lei mentre si guarda altrove).
    const [threadAperti, setThreadAperti] = useState(() => new Set());

    const clean = testo.trim();
    const disabled = clean.length < 5 || sending;

    async function handleInvia() {
        if (disabled) return;
        setSending(true);
        try {
            await onSendFeedback({ testo: clean });
            setTesto('');
        } catch (e) {
            console.error('[FeedbackPanel] invio fallito:', e);
        } finally {
            setSending(false);
        }
    }

    return (
        <>
            {/* --- Form --- */}
            <div
                className="rounded-xl border-2 p-4 mb-4"
                style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}
            >
                <div className="flex items-start gap-2 mb-3">
                    <Lightbulb size={20} className="shrink-0 mt-0.5" style={{ color: SUN }} />
                    <div>
                        <h4 className="font-black text-base" style={{ color: INK }}>
                            Hai un'idea o un problema?
                        </h4>
                        <p className="text-sm" style={{ color: INK, opacity: 0.7 }}>
                            Scrivi all'amministratore per suggerimenti, richieste o bug. Ogni feedback è ben accetto.
                        </p>
                    </div>
                </div>

                <textarea
                    value={testo}
                    onChange={(e) => setTesto(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    disabled={sending}
                    placeholder="Racconta quello che ti è venuto in mente…"
                    className="w-full px-3 py-2 rounded-lg border-2 text-sm resize-y outline-none"
                    style={{
                        borderColor: 'rgba(34,48,31,0.25)',
                        color: INK,
                        backgroundColor: '#fff',
                        opacity: sending ? 0.6 : 1,
                    }}
                />

                <div className="flex items-center justify-between gap-3 mt-2">
                    <span
                        className="text-xs"
                        style={{
                            color: testo.length > 1800 ? CLAY : INK,
                            opacity: testo.length > 1800 ? 1 : 0.5,
                        }}
                    >
                        {testo.length}/2000
                    </span>

                    <button
                        type="button"
                        onClick={handleInvia}
                        disabled={disabled}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
                        style={{
                            backgroundColor: SUN,
                            color: INK,
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <Send size={16} />
                        {sending ? 'Invio…' : 'Invia'}
                    </button>
                </div>
            </div>

            {/* --- Cronologia --- */}
            <h3 className="font-black text-sm mb-2" style={{ color: INK, opacity: 0.7 }}>
                I tuoi suggerimenti
            </h3>
            {mieRichieste.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: INK, opacity: 0.6 }}>
                    Non hai ancora inviato suggerimenti.
                </p>
            ) : (
                mieRichieste.map((r) => (
                    <RichiestaUtenteCard
                        key={r.id}
                        richiesta={r}
                        profile={profile}
                        conNovita={novitaSticky.has(r.id) && !threadAperti.has(r.id)}
                        onOpenChange={(open) => setThreadAperti((prev) => {
                            const next = new Set(prev);
                            if (open) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                        })}
                    />
                ))
            )}
        </>
    );
}

/* --- Singola card della cronologia utente ---
   Estratta come sotto-componente per contenere lo stato locale
   dell'eliminazione (useActionState) senza contaminare tutto il
   pannello: ogni card gestisce il suo "sto eliminando" e il
   feedback visivo sul pulsante Elimina resta isolato. */
function RichiestaUtenteCard({ richiesta: r, profile, conNovita, onOpenChange }) {
    const { toast, confirm } = useFeedback();

    const elimina = useActionState({
        savedMs: 700,
        onError: () => toast('Eliminazione non riuscita.', 'error'),
    });

    const vista = r.letto;
    const quando = r.createdAt?.toDate?.() ?? r.createdAt ?? null;

    async function handleElimina() {
        const ok = await confirm({
            title: 'Eliminare questa richiesta?',
            message: r.risposto
                ? 'La richiesta e la conversazione con l\'amministratore verranno eliminate. Non potrai più leggerla.'
                : 'La richiesta verrà eliminata definitivamente.',
            confirmLabel: 'Elimina',
            dangerous: true,
        });
        if (!ok) return;
        elimina.run(() => deleteRichiesta(r.id));
        // Nota: la sotto-collezione /risposte resta orfana su Firestore.
        // Non è leggibile da nessuno (le regole richiedono la richiesta
        // parent che ora non esiste più), quindi è di fatto invisibile.
    }

    return (
        <div
            className="rounded-xl border-2 p-3 mb-2"
            style={{
                backgroundColor: conNovita ? '#FFF8E7' : CARD_BG,
                borderColor: conNovita ? SUN : 'rgba(34,48,31,0.15)',
            }}
        >
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                    className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full"
                    style={{
                        backgroundColor: vista ? '#E7F0DE' : '#FFF4DE',
                        color: vista ? GRASS_DARK : '#8A5A00',
                    }}
                >
                    {vista ? <Check size={13} /> : <Clock size={13} />}
                    {vista ? "Visto dall'admin" : 'Suggerimento inviato'}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                    {conNovita && (
                        <span
                            className="text-xs font-black px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: SUN, color: INK }}
                        >
                            Nuova risposta
                        </span>
                    )}
                    {quando && (
                        <span className="text-xs" style={{ color: INK, opacity: 0.45 }}>
                            {timeAgo(quando)}
                        </span>
                    )}

                    {/* Pulsante icona-solo per eliminare la richiesta.
              Discreto (nessun bordo, nessun fondo, solo icona),
              vive nell'header della card accanto al timestamp
              così non ruba spazio al contenuto vero. Il click
              apre confirm() prima di procedere — nessun rischio
              di eliminazione accidentale. */}
                    <button
                        type="button"
                        onClick={handleElimina}
                        disabled={elimina.busy}
                        title="Elimina richiesta"
                        aria-label="Elimina richiesta"
                        className="flex items-center justify-center w-6 h-6 rounded-full transition-colors hover:bg-black/5"
                        style={{
                            color: elimina.saved ? GRASS_DARK : CLAY,
                            opacity: elimina.busy && !elimina.saving ? 0.5 : 1,
                        }}
                    >
                        {elimina.saving && <Loader2 size={14} className="animate-spin" />}
                        {elimina.saved && <Check size={14} />}
                        {elimina.idle && <Trash2 size={14} />}
                    </button>
                </div>
            </div>

            <p className="text-sm whitespace-pre-wrap" style={{ color: INK }}>
                {r.testo}
            </p>

            {r.risposto ? (
                <RichiestaThread
                    richiesta={r}
                    profile={profile}
                    isAdmin={false}
                    onOpenChange={onOpenChange}
                />
            ) : (
                <p className="text-xs mt-0" style={{ color: INK, opacity: 0.5 }}>

                </p>
            )}
        </div>
    );
}