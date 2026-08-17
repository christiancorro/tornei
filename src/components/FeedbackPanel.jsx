import React, { useState } from 'react';
import { Lightbulb, Send, Check, Clock } from 'lucide-react';

import { INK, SUN, CLAY, CARD_BG, GRASS_DARK } from '../theme';
import { timeAgo } from '../utils';

export default function FeedbackPanel({ onSendFeedback, mieRichieste = [] }) {
    const [testo, setTesto] = useState('');
    const [sending, setSending] = useState(false);

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
                            Scrivi all'amministratore per suggerimenti, richieste o eventuali bug trovati. Ogni feedback è ben accetto.
                        </p>
                    </div>
                </div>

                <textarea
                    value={testo}
                    onChange={(e) => setTesto(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    disabled={sending}
                    placeholder="Scrivi quello che ti è venuto in mente …"
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
            {mieRichieste.length > 0 && (
                <>
                    <h3 className="font-black text-sm mb-2" style={{ color: INK, opacity: 0.7 }}>
                        Le tue richieste
                    </h3>
                    {mieRichieste.map((r) => {
                        const vista = r.letto;
                        // createdAt può essere un Timestamp Firestore o null (offline).
                        const quando = r.createdAt?.toDate?.() ?? r.createdAt ?? null;
                        return (
                            <div
                                key={r.id}
                                className="rounded-xl border-2 p-3 mb-2"
                                style={{ backgroundColor: CARD_BG, borderColor: 'rgba(34,48,31,0.15)' }}
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
                                        {vista ? 'Vista dall\'admin' : 'In attesa'}
                                    </span>
                                    {quando && (
                                        <span className="text-xs shrink-0" style={{ color: INK, opacity: 0.45 }}>
                                            {timeAgo(quando)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm whitespace-pre-wrap" style={{ color: INK }}>
                                    {r.testo}
                                </p>
                            </div>
                        );
                    })}
                </>
            )}
        </>
    );
}