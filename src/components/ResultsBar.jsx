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
export default function ResultsBar({ viewMode, onCycleViewMode, isAdmin, onAdd, count }) {
    // The button always shows the mode you'd switch to next:
    // lista → mappa → calendario → lista.
    const nextMode = nextViewMode(viewMode);
    const NextModeIcon = VIEW_MODE_ICONS[nextMode];
    const [hover, setHover] = useState(false);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-6">
            <div className="grid grid-cols-3 items-center gap-3 mb-2 mt-2 min-h-10">

                <div className="flex justify-start">
                    <button
                        type="button"
                        onClick={onCycleViewMode}
                        onMouseEnter={() => setHover(true)}
                        onMouseLeave={() => setHover(false)}
                        className="flex items-center justify-start gap-1.5 w-32 h-9 rounded-full text-sm font-regular whitespace-nowrap shrink-0"
                        style={{
                            color: INK,
                            border: `0px solid ${hover ? INK : 'rgba(21,22,21,0.25)'}`,
                        }}
                    >
                        <NextModeIcon size={18} />
                        {VIEW_MODE_LABELS[nextMode]}
                    </button>
                </div>


                <div className="flex justify-center">
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-regular shadow-sm shrink-0"
                            style={{ backgroundColor: SUN }}
                        >
                            <Plus size={18} />
                            Aggiungi torneo
                        </button>
                    )}
                </div>


                <div className="flex justify-end">
                    <p
                        className="text-sm shrink-0"
                        style={{ color: INK, opacity: 0.6 }}
                    >
                        {count} {count === 1 ? 'torneo trovato' : 'tornei trovati'}
                    </p>
                </div>

            </div>
        </div>
    );
}