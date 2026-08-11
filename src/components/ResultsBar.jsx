import React, { useState } from 'react';
import { Plus, LayoutList, Map, CalendarDays } from 'lucide-react';

import { INK, SUN } from '../theme';
import { VIEW_MODE_LABELS, nextViewMode } from '../constants';

// Icon shown on the multimodal button for each view mode.
const VIEW_MODE_ICONS = {
    lista: LayoutList,
    // mappa: Map,
    calendario: CalendarDays,
};

/* ---------------------------------------------------------
   Results bar — shared by lista, mappa and calendario.
   Left to right: view switch, add (admin only), result count.
--------------------------------------------------------- */
export default function ResultsBar({ viewMode, onCycleViewMode, canAdd, isOrganizer, onAdd, count, loading = false }) {
    // The button always shows the mode you'd switch to next:
    // lista → mappa → calendario → lista.
    const nextMode = nextViewMode(viewMode);
    const NextModeIcon = VIEW_MODE_ICONS[nextMode];
    const [hover, setHover] = useState(false);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6 mt-4">
            <div className="flex items-center justify-between gap-3 mb-2 mt-2 min-h-10">

                <div className="flex items-center gap-4">
                    {/* Durante il caricamento il conteggio non è ancora
                        vero (sarebbe 0 solo perché la lista deve
                        ancora arrivare): mostrarlo darebbe l'idea di
                        "nessun torneo" mentre invece si sta ancora
                        caricando. Meglio non dire niente finché non
                        c'è un numero reale da mostrare. */}
                    {!loading && (
                        /* Fade-in sul <p> esterno (opacity 0 → 1 con
                           fill-mode both) + colore/opacità sul <span>
                           interno: così a fine animazione il testo torna
                           al suo grigio 0.6 invece di restare pieno. */
                        <p className="text-sm shrink-0 fade-in">
                            <span style={{ color: INK, opacity: 0.6 }}>
                                {count} {count === 1 ? 'torneo' : 'tornei'}
                            </span>
                        </p>
                    )}


                </div>

                {/* {canAdd && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-regular shadow-sm shrink-0"
                        style={{ backgroundColor: SUN }}
                    >
                        <Plus size={18} /> {isOrganizer ? 'Aggiungi torneo' : 'Proponi un torneo'}
                    </button>
                )} */}

                <button
                    type="button"
                    onClick={onCycleViewMode}
                    /* Stesso comportamento del bottone "Accedi": bordo
                       trasparente + opacità 60% a riposo, bordo pieno
                       (colore INK) + opacità 100% sull'hover. La
                       transizione è su tutto (all) così bordo e opacità
                       cambiano insieme. */
                    className="flex items-center gap-1.5 cursor-pointer shrink-0
                        rounded-full border-2 border-transparent transition-all
                        px-4 py-1.5 text-sm font-regular whitespace-nowrap
                        opacity-60 hover:opacity-100 hover:border-[#282828]"
                    style={{ color: INK }}
                >
                    <NextModeIcon size={18} />
                    {VIEW_MODE_LABELS[nextMode]}
                </button>

            </div>
        </div>
    );
}