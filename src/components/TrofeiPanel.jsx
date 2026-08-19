import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Images,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

import { INK, SAND, SUN, CLAY, CARD_BG } from '../theme';
import { formatDataLunga, todayISO } from '../utils';
import { db, COL_TORNEI } from '../firebase';
import { subscribePublished } from '../services/tournaments';
import {
  subscribeMyTrofei,
  addTrofeo,
  removeTrofeo,
  setPreferito,
} from '../services/trofei';
import { useFeedback } from './FeedbackProvider';

const TROFEO_HOLO_CSS = `
@keyframes trofeo-gold-shift {
  0%, 100% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
}

@keyframes trofeo-holo-shimmer {
  0%, 100% {
    background-position: 0% 50%;
    opacity: 0.32;
  }
  50% {
    background-position: 100% 50%;
    opacity: 0.55;
  }
}

.trofeo-gold-frame {
  position: relative;
  padding: 3px;
  border-radius: 18px;
  background: linear-gradient(
    135deg,
    #a3720a 0%,
    #f4c841 15%,
    #fff5ba 30%,
    #ffd54a 45%,
    #b7860a 60%,
    #ffe66a 78%,
    #a3720a 100%
  );
  background-size: 220% 220%;
  animation: trofeo-gold-shift 5s ease-in-out infinite;
  box-shadow:
    0 12px 26px -10px rgba(212, 160, 23, 0.55),
    0 0 0 1px rgba(140, 100, 8, 0.28);
}

.trofeo-holo-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255,255,255,0) 28%,
    rgba(255,235,150,0.45) 44%,
    rgba(255,255,255,0.75) 50%,
    rgba(180,220,255,0.45) 56%,
    rgba(255,255,255,0) 72%,
    transparent 100%
  );
  background-size: 260% 260%;
  mix-blend-mode: overlay;
  animation: trofeo-holo-shimmer 3.6s ease-in-out infinite;
}

@keyframes trofeo-shine-sweep {
  0% {
    transform: translateX(-140%) skewX(-18deg);
  }
  100% {
    transform: translateX(220%) skewX(-18deg);
  }
}

.trofeo-shine {
  position: absolute;
  top: -10%;
  bottom: -10%;
  left: 0;
  width: 28%;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsla(0, 0%, 100%, 0.55) 50%,
    transparent 100%
  );
  transform: translateX(-140%) skewX(-18deg);
}

.trofeo-card:hover .trofeo-shine {
  opacity: 1;
  animation: trofeo-shine-sweep 900ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .trofeo-gold-frame,
  .trofeo-holo-overlay,
  .trofeo-card:hover .trofeo-shine {
    animation: none !important;
  }
}
`;

function tiltDaId(id) {
  let h = 0;
  for (const c of String(id || '')) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return ((h % 7) - 3) * 0.6;
}

const NASTRI = [
  'rgb(255, 243, 203)',
  'rgb(255, 246, 235)',
  'rgb(255, 241, 217)',
];

function nastroColore(id) {
  let h = 0;
  for (const c of String(id || '')) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return NASTRI[h % NASTRI.length];
}

export default function TrofeiPanel({ uid, onOpenDetail }) {
  const [trofei, setTrofei] = useState([]);
  const [tornei, setTornei] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const { confirm, toast } = useFeedback();

  useEffect(() => {
    if (!uid) return undefined;

    const unsub = subscribeMyTrofei(uid, setTrofei, (err) =>
      console.warn('[trofei] subscribe fallito:', err.message),
    );

    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!addOpen) return undefined;

    const unsub = subscribePublished(setTornei, (err) =>
      console.warn('[trofei/picker] subscribe fallito:', err.message),
    );

    return unsub;
  }, [addOpen]);

  const preferiti = useMemo(
    () => trofei.filter((t) => t.preferito).length,
    [trofei],
  );

  const perAnno = useMemo(() => {
    const groups = new Map();

    for (const t of trofei) {
      let anno = 'Senza data';

      if (
        typeof t.data === 'string' &&
        /^\d{4}-/.test(t.data)
      ) {
        anno = t.data.slice(0, 4);
      }

      if (!groups.has(anno)) {
        groups.set(anno, []);
      }

      groups.get(anno).push(t);
    }

    return Array.from(groups.entries());
  }, [trofei]);

  const [anniChiusi, setAnniChiusi] = useState(() => new Set());

  const toggleAnno = (anno) => {
    setAnniChiusi((prev) => {
      const next = new Set(prev);

      if (next.has(anno)) {
        next.delete(anno);
      } else {
        next.add(anno);
      }

      return next;
    });
  };

  async function handleRimuovi(trofeo) {
    const ok = await confirm({
      title: 'Rimuovere questa locandina?',
      message: `"${trofeo.nome}" sparirà dalla tua collezione. Puoi sempre riaggiungerla dal catalogo.`,
      confirmLabel: 'Rimuovi',
    });

    if (!ok) return;

    try {
      await removeTrofeo(uid, trofeo.torneoId);
    } catch (err) {
      console.warn('[trofei] rimozione fallita:', err.message);
    }
  }

  async function handleTogglePreferito(trofeo) {
    try {
      await setPreferito(
        uid,
        trofeo.torneoId,
        !trofeo.preferito,
      );
    } catch (err) {
      console.warn(
        '[trofei] toggle preferito fallito:',
        err.message,
      );
    }
  }

  async function apriDettaglio(trofeo) {
    if (!onOpenDetail) return;

    try {
      const snap = await getDoc(
        doc(db, COL_TORNEI, trofeo.torneoId),
      );

      if (snap.exists()) {
        const t = {
          id: snap.id,
          ...snap.data(),
        };

        t.formati = Array.isArray(t.formati)
          ? t.formati
          : [];

        onOpenDetail(t);
        return;
      }

      toast(
        'Il torneo originale non è più disponibile.',
        'info',
      );

      onOpenDetail({
        id: trofeo.torneoId,
        nome: trofeo.nome ?? '',
        data: trofeo.data ?? '',
        disciplina: trofeo.disciplina ?? '',
        locandina: trofeo.locandinaThumb ?? '',
        locandinaThumb: trofeo.locandinaThumb ?? '',
        formati: [],
      });
    } catch (err) {
      console.warn(
        '[trofeo/open] getDoc fallito:',
        err.message,
      );

      toast(
        'Non riesco ad aprire il dettaglio di questo torneo.',
        'error',
      );
    }
  }

  return (
    <div>
      <style>{TROFEO_HOLO_CSS}</style>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Images
              size={18}
              style={{
                color: INK,
                opacity: 0.6,
              }}
            />

            <h3
              className="font-black text-lg"
              style={{ color: INK }}
            >
              La mia collezione
            </h3>
          </div>

          <p
            className="text-xs"
            style={{
              color: INK,
              opacity: 0.55,
            }}
          >
            {trofei.length === 0
              ? 'Nessuna locandina in collezione.'
              : `${trofei.length} ${trofei.length === 1
                ? 'locandina'
                : 'locandine'
              }${preferiti > 0
                ? ` · ${preferiti} preferit${preferiti === 1 ? 'a' : 'e'
                }`
                : ''
              }`}
          </p>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold shrink-0"
          style={{
            backgroundColor: addOpen
              ? 'rgba(34,48,31,0.08)'
              : SUN,
            color: INK,
          }}
        >
          {addOpen ? <X size={16} /> : <Plus size={16} />}
          {addOpen ? 'Chiudi' : 'Aggiungi locandina'}
        </button>
      </div>

      {addOpen && (
        <AggiungiTrofeoPicker
          tornei={tornei}
          giaAvuti={
            new Set(trofei.map((t) => t.torneoId))
          }
          onAdd={async (torneo) => {
            try {
              await addTrofeo(uid, torneo);
            } catch (err) {
              console.warn(
                '[trofei] add fallito:',
                err.message,
              );
            }
          }}
        />
      )}

      {trofei.length === 0 && !addOpen ? (
        <div
          className="text-center py-16 px-4 rounded-2xl"
          style={{
            backgroundColor: 'rgba(34,48,31,0.04)',
          }}
        >
          <div className="text-5xl mb-3">
            🖼️
          </div>

          <p
            className="text-sm"
            style={{
              color: INK,
              opacity: 0.7,
            }}
          >
            Clicca <strong>Aggiungi locandina</strong> per
            iniziare la tua collezione dei tornei giocati.
          </p>
        </div>
      ) : (
        perAnno.map(([anno, trofeiAnno]) => {
          const chiuso = anniChiusi.has(anno);

          return (
            <section
              key={anno}
              className="mb-8"
            >
              <button
                type="button"
                onClick={() => toggleAnno(anno)}
                aria-expanded={!chiuso}
                className="w-full flex items-center gap-2 px-3 py-2 mb-4 rounded-xl text-2xl font-semibold"
                style={{
                  backgroundColor:
                    'rgba(34,48,31,0.01)',
                  color: INK,
                  border:
                    '1px solid rgba(34,48,31,0.1)',
                }}
              >
                {chiuso ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}

                <span>{anno}</span>

                <span
                  className="text-sm font-semibold"
                  style={{ opacity: 0.6 }}
                >
                  ({trofeiAnno.length})
                </span>
              </button>

              {!chiuso && (
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(180px, 1fr))',
                    columnGap: '1.25rem',
                    rowGap: '1.75rem',
                  }}
                >
                  {trofeiAnno.map((t) => (
                    <TrofeoCard
                      key={t.torneoId}
                      trofeo={t}
                      onOpen={() => apriDettaglio(t)}
                      onToggleFav={() =>
                        handleTogglePreferito(t)
                      }
                      onRemove={() =>
                        handleRimuovi(t)
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function TrofeoCard({
  trofeo,
  onOpen,
  onToggleFav,
  onRemove,
}) {
  const isPref = !!trofeo.preferito;
  const rotBase = tiltDaId(trofeo.torneoId);
  const nastro = nastroColore(trofeo.torneoId);

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(e);
  };

  return (
    <div
      className="relative group"
      style={{
        paddingTop: 10,
        transform: `rotate(${rotBase}deg)`,
        transformOrigin: 'center top',
        transition:
          'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform =
          `rotate(${rotBase * 0.01}deg) translateY(-4px)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform =
          `rotate(${rotBase}deg) translateY(0)`;
      }}
    >
      <div
        aria-hidden="true"
        className="absolute z-20 pointer-events-none"
        style={{
          top: 0,
          left: '50%',
          width: 64,
          height: 20,
          background: `linear-gradient(
            90deg,
            transparent 0%,
            ${nastro} 8%,
            ${nastro} 92%,
            transparent 95%
          )`,
          transform:
            'translateX(-50%) rotate(-3deg)',

        }}
      />

      <div
        className={
          isPref ? 'trofeo-gold-frame' : ''
        }
      >
        <div
          className="trofeo-card relative rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#fff',
            border: isPref
              ? 'none'
              : '1px solid rgba(34,48,31,0.08)',
            boxShadow: isPref
              ? '0 10px 24px -10px rgba(184, 134, 11, 0.45), 0 2px 6px rgba(0,0,0,0.08)'
              : '0 6px 14px -8px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.06)',
            transition:
              'box-shadow 340ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              isPref
                ? '0 14px 32px -10px rgba(184, 134, 11, 0.6), 0 3px 8px rgba(0,0,0,0.12)'
                : '0 12px 24px -10px rgba(0,0,0,0.28), 0 3px 8px rgba(0,0,0,0.10)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              isPref
                ? '0 10px 24px -10px rgba(184, 134, 11, 0.45), 0 2px 6px rgba(0,0,0,0.08)'
                : '0 6px 14px -8px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.06)';
          }}
        >
          <div
            className="w-full relative overflow-hidden"
            style={{
              paddingTop: '133.33%',
              backgroundColor: '#ffffff',
            }}
          >
            {isPref && (
              <div
                className="trofeo-holo-overlay"
                aria-hidden="true"
              />
            )}

            <div
              className="trofeo-shine"
              aria-hidden="true"
            />

            {trofeo.locandinaThumb ? (
              <img
                src={trofeo.locandinaThumb}
                alt={trofeo.nome}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  backgroundColor:
                    'rgba(34,48,31,0.08)',
                  color: INK,
                  fontSize: '3rem',
                  fontWeight: 900,
                  opacity: 0.35,
                }}
              >
                {(trofeo.nome || '?')
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}

            <button
              type="button"
              onClick={onOpen}
              aria-label={`Apri dettaglio: ${trofeo.nome || 'torneo'
                }`}
              className="absolute inset-0 cursor-pointer"
              style={{
                background: 'transparent',
                border: 'none',
              }}
            />

            <button
              type="button"
              onClick={stop(onToggleFav)}
              aria-label={
                isPref
                  ? 'Rimuovi dai preferiti'
                  : 'Aggiungi ai preferiti'
              }
              aria-pressed={isPref}
              className={[
                'absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 z-10',
                isPref
                  ? ''
                  : 'opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100',
              ].join(' ')}
              style={{
                backgroundColor: isPref
                  ? '#e0245e'
                  : 'rgba(255,255,255,0.96)',
                transition:
                  'opacity 200ms, transform 140ms, background-color 220ms',
                boxShadow:
                  '0 2px 6px rgba(0,0,0,0.22)',
              }}
            >
              <Heart
                size={16}
                strokeWidth={2.2}
                style={{
                  color: isPref
                    ? '#fff'
                    : '#7a7a7a',
                  fill: isPref
                    ? '#fff'
                    : 'transparent',
                  transition:
                    'fill 200ms, color 200ms',
                }}
              />
            </button>

            <button
              type="button"
              onClick={stop(onRemove)}
              aria-label="Rimuovi dalla collezione"
              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 z-10"
              style={{
                backgroundColor:
                  'rgba(255,255,255,0.96)',
                color: CLAY,
                transition:
                  'opacity 200ms, transform 140ms',
                boxShadow:
                  '0 2px 5px rgba(0,0,0,0.18)',
              }}
            >
              <Trash2 size={13} />
            </button>

            <button
              type="button"
              onClick={stop(onRemove)}
              aria-label="Rimuovi dalla collezione"
              className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center sm:hidden active:scale-90 z-10"
              style={{
                backgroundColor:
                  'rgba(255,255,255,0.88)',
                color: CLAY,
                boxShadow:
                  '0 1px 3px rgba(0,0,0,0.18)',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div
            className="px-3 pt-2.5 pb-2 text-center"
            style={{
              background: isPref
                ? 'linear-gradient(180deg, rgba(255,236,150,0.8), rgba(240,196,80,0.28))'
                : 'linear-gradient(180deg, rgba(0,0,0,0.01), rgba(0,0,0,0.02))',
              borderTop: isPref
                ? '1px solid rgba(184,134,11,0.35)'
                : '1px solid rgba(34,48,31,0.08)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.55)',
            }}
            title={trofeo.nome}
          >
            <h4
              className="font-black text-lg leading-tight line-clamp-2"
              style={{
                color: isPref
                  ? '#3d2907'
                  : INK,
                letterSpacing: '0.005em',
                textShadow:
                  '0 1px 0 rgba(255,255,255,0.55)',
              }}
            >
              {trofeo.nome || '—'}
            </h4>

            {trofeo.data && (
              <p
                className="text-[10px] font-bold mt-1"
                style={{
                  color: isPref
                    ? '#4a3208'
                    : INK,
                  opacity: isPref
                    ? 0.75
                    : 0.5,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  textShadow:
                    '0 1px 0 rgba(255,255,255,0.35)',
                }}
              >
                {formatDataLunga(trofeo.data)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AggiungiTrofeoPicker({
  tornei,
  giaAvuti,
  onAdd,
}) {
  const [query, setQuery] = useState('');
  const oggi = todayISO();

  const risultati = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtrati = tornei.filter((t) => {
      if (giaAvuti.has(t.id)) return false;

      if (typeof t.data !== 'string') {
        return false;
      }

      if (t.data > oggi) {
        return false;
      }

      if (!q) return true;

      return (
        (t.nome || '')
          .toLowerCase()
          .includes(q) ||
        (t.comune || '')
          .toLowerCase()
          .includes(q) ||
        (t.disciplina || '')
          .toLowerCase()
          .includes(q)
      );
    });

    filtrati.sort((a, b) =>
      a.data < b.data ? 1 : -1,
    );

    return filtrati.slice(0, 20);
  }, [
    tornei,
    giaAvuti,
    query,
    oggi,
  ]);

  return (
    <div
      className="rounded-2xl border-2 p-4 mb-6"
      style={{
        backgroundColor:
          'rgba(255,210,137,0.08)',
        borderColor:
          'rgba(34,48,31,0.12)',
      }}
    >
      <label className="flex items-center gap-2 mb-3">
        <Search
          size={16}
          style={{
            color: INK,
            opacity: 0.55,
          }}
        />

        <input
          type="search"
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
          placeholder="Cerca torneo per nome, comune o disciplina..."
          className="w-full bg-transparent outline-none text-sm"
          style={{ color: INK }}
        />
      </label>

      {tornei.length === 0 ? (
        <p
          className="text-xs"
          style={{
            color: INK,
            opacity: 0.5,
          }}
        >
          Carico il catalogo...
        </p>
      ) : risultati.length === 0 ? (
        <p
          className="text-xs"
          style={{
            color: INK,
            opacity: 0.5,
          }}
        >
          {query
            ? 'Nessun torneo corrisponde alla ricerca.'
            : 'Hai aggiunto tutti i tornei passati 🎉'}
        </p>
      ) : (
        <ul
          className="divide-y"
          style={{
            borderColor:
              'rgba(34,48,31,0.08)',
          }}
        >
          {risultati.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onAdd(t)}
                className="w-full flex items-center gap-3 py-2 text-left hover:bg-black/[0.03] transition-colors rounded-md px-2"
              >
                <div
                  className="w-10 h-10 rounded-md overflow-hidden shrink-0"
                  style={{
                    backgroundColor:
                      'rgba(34,48,31,0.08)',
                  }}
                >
                  {t.locandinaThumb ||
                    t.locandina ? (
                    <img
                      src={
                        t.locandinaThumb ||
                        t.locandina
                      }
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: INK }}
                  >
                    {t.nome || '—'}
                  </p>

                  <p
                    className="text-xs"
                    style={{
                      color: INK,
                      opacity: 0.55,
                    }}
                  >
                    {t.data
                      ? formatDataLunga(t.data)
                      : '—'}
                    {t.comune
                      ? ` · ${t.comune}`
                      : ''}
                  </p>
                </div>

                <Plus
                  size={16}
                  style={{
                    color: INK,
                    opacity: 0.55,
                  }}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}