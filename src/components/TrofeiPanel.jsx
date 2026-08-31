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
import { formatGiornoMeseAnno, formatDataLunga, todayISO, luogoDi } from '../utils';
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
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap');

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

/* Cornice oro per i preferiti: avvolge la polaroid bianca. Il raggio
   è più contenuto di prima (10px invece di 18px) così segue il bordo
   quasi squadrato della polaroid senza sbordare agli angoli. */
.trofeo-gold-frame {
  position: relative;
  padding: 3px;
  border-radius: 10px;
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

/* ---- Polaroid -------------------------------------------------
   Cornice bianca attorno alla foto, con la classica fascia bassa
   più alta dove vive la didascalia scritta a mano. La foto sta
   nel riquadro in alto (.trofeo-photo), la didascalia sotto. */
.trofeo-polaroid {
  background: #fdfdfb;
  padding: 10px 10px 0;
  border-radius: 6px;
}

.trofeo-photo {
  position: relative;
  overflow: hidden;
  border-radius: 2px;
  background: #efefe9;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.trofeo-caption {
  padding: 12px 8px 16px;
  text-align: center;
}

/* Font "scritto a mano" per la didascalia. Se il progetto carica
   Caveat (Google Fonts) si vede quella; altrimenti si ripiega su
   un corsivo di sistema, così l'effetto polaroid regge comunque. */
.trofeo-caption-title {
  font-family: 'Caveat', 'Marker Felt', 'Segoe Print', 'Bradley Hand', cursive;
  font-size: 1.6rem;
  line-height: 1.02;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.trofeo-caption-date {
  font-family: 'Caveat', 'Marker Felt', 'Segoe Print', 'Bradley Hand', cursive;
  font-size: 1.15rem;
  line-height: 1;
  margin-top: 8px;
}

/* Griglia delle polaroid. Su mobile le card sono più piccole (colonne
   da 120px, così ne stanno 2-3 per riga) con spazi ridotti; da 640px
   in su si torna alla misura piena di prima (180px). Sta in una classe
   e non inline perché serve una media query. */
.trofeo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  column-gap: 0.7rem;
  row-gap: 1.25rem;
}

@media (min-width: 640px) {
  .trofeo-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    column-gap: 1.25rem;
    row-gap: 1.75rem;
  }
}

/* Su schermi piccoli anche cornice e didascalia si rimpiccioliscono,
   così restano in proporzione con la card più compatta. */
@media (max-width: 639px) {
  .trofeo-polaroid {
    padding: 7px 7px 0;
  }

  .trofeo-caption {
    padding: 8px 5px 11px;
  }

  .trofeo-caption-title {
    font-size: 1.1rem;
  }

  .trofeo-caption-date {
    font-size: 0.8rem;
  }
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

/* ---- Ingresso delle polaroid ---------------------------------
   Le foto non compaiono tutte insieme: entrano una dopo l'altra,
   come se qualcuno le stesse sistemando sulla pagina. Il ritardo
   sta sul contenitore e non sulla card, perche' la card ha gia'
   una sua rotazione e un'animazione sullo stesso elemento gliela
   porterebbe via. */
.trofeo-entra {
  animation: trofeo-entra 380ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

@keyframes trofeo-entra {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ---- Scheletro del caricamento -------------------------------
   Al posto del vuoto (che sembrava "non hai nessun torneo" un
   attimo prima di riempirsi di colpo) l'album mostra subito la
   forma di quello che sta arrivando. */
.trofeo-skeleton {
  animation: trofeo-skeleton-pulse 1.4s ease-in-out infinite;
}

.trofeo-skeleton-riga {
  display: block;
  margin: 0 auto;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.10);
}

@keyframes trofeo-skeleton-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .trofeo-gold-frame,
  .trofeo-holo-overlay,
  .trofeo-card:hover .trofeo-shine,
  .trofeo-balloon,
  .trofeo-entra,
  .trofeo-skeleton {
    animation: none !important;
  }
}

/* ---- Album "libro delle avventure" (ispirato ai titoli di coda di
   Up): le polaroid sono incollate su una pagina di carta calda e un
   po' invecchiata, con una punta di texture. Le foto, che hanno già
   la loro ombra, "staccano" bene dalla pagina. ---- */
.trofeo-album {
  position: relative;
  border-radius: 20px;
  padding: 22px 16px 12px;
  background:
    radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%),
    radial-gradient(140% 100% at 100% 100%, rgba(248, 239, 221, 0.16), rgba(248, 236, 214, 0) 60%),
    box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.75),
    inset 0 0 44px rgba(150,115,50,0.06),
    0 14px 34px -22px rgba(90,66,20,0.5);
 overflow: hidden;
}

/* Palloncino filigrana nell'angolo: il cuore visivo di Up, tenuto
   discreto così accompagna le foto senza rubare la scena. */


/* ---- Titolo del capitolo (l'anno): scritto a mano, con accanto una
   scia tratteggiata da mappa dell'avventura e un palloncino. ---- */
.trofeo-chapter {
  font-weight: 600;
  font-size: 1.4rem;
  line-height: 1;
  color: #2c2c2c;
}

.trofeo-chapter-count {
  font-weight: 500;
  font-size: 1rem;
  line-height: 1;
  color: #303030;
  opacity: 0.65;
  white-space: nowrap;
}

.trofeo-trail {
  flex: 1 1 auto;
  min-width: 18px;
  height: 0;
  border-top: 1px dotted rgba(196, 196, 196, 0.42);
  margin: 0 4px;
}



@media (max-width: 639px) {
  .trofeo-chapter { font-size: 1.7rem; }
  .trofeo-chapter-count { font-size: 1.05rem; }
  .trofeo-album { padding: 16px 10px 8px; border-radius: 16px; }
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

  /* Finché la collezione non è arrivata da Firestore non so se è
     vuota o piena: senza questo flag il pannello mostrava per un
     istante "Ancora nessun torneo" e poi si riempiva di colpo. Con
     il flag mostra invece lo scheletro dell'album, che ha già la
     forma giusta. */
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    if (!uid) {
      setTrofei([]);
      setCaricato(true);
      return undefined;
    }

    setCaricato(false);

    const unsub = subscribeMyTrofei(
      uid,
      (lista) => {
        setTrofei(lista);
        setCaricato(true);
      },
      (err) => {
        console.warn('[trofei] subscribe fallito:', err.message);
        // Anche se la lettura fallisce esco dallo stato di attesa:
        // uno scheletro che pulsa all'infinito è peggio di un album
        // vuoto.
        setCaricato(true);
      },
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
        locandina: trofeo.locandinaThumb ?? trofeo.locandina ?? '',
        locandinaThumb: trofeo.locandinaThumb ?? trofeo.locandina ?? '',
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

      <div className="flex items-center gap-3 mb-4 flex-wrap ml-2">
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
            {!caricato
              ? 'Carico la collezione...'
              : trofei.length === 0
                ? 'Ancora nessun torneo'
                : `${trofei.length} ${trofei.length === 1
                  ? 'torneo'
                  : 'tornei'
                }${preferiti > 0
                  ? ` · ${preferiti} preferit${preferiti === 1 ? 'o' : 'i'
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

      {!caricato ? (
        <CollezioneSkeleton />
      ) : trofei.length === 0 && !addOpen ? (
        <div className="trofeo-album text-center py-16 px-4">

          <p
            className="text-sm max-w-sm mx-auto"
            style={{
              color: '#5c4a29',
              opacity: 0.85,
            }}
          >
            Clicca <strong>Aggiungi locandina</strong> e aggiungi
            alla tua collezione i tornei che hai giocato.
          </p>
        </div>
      ) : (
        <div className="trofeo-album">
          {perAnno.map(([anno, trofeiAnno]) => {
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
                  className="w-full flex items-center gap-2 mb-4 px-1 py-1 text-left"
                  style={{ background: 'transparent' }}
                >
                  {chiuso ? (
                    <ChevronRight size={20} style={{ color: '#5c4a29' }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: '#5c4a29' }} />
                  )}

                  <span className="trofeo-chapter">{anno}</span>

                  <span className="trofeo-chapter-count">
                    · {trofeiAnno.length} {trofeiAnno.length === 1 ? 'torneo' : 'tornei'}
                  </span>

                  {/* Scia tratteggiata da mappa dell'avventura + palloncino,
                    come i tragitti disegnati nel libro di Ellie in Up. */}
                  <span className="trofeo-trail" aria-hidden="true" />

                </button>

                {!chiuso && (
                  <div className="trofeo-grid">
                    {trofeiAnno.map((t, i) => (
                      /* Il ritardo sta sul contenitore: la card ha già
                         la sua inclinazione e non può ospitare una
                         seconda transform. Lo cappo a 12 posizioni,
                         se no una collezione grossa impiegherebbe
                         secondi solo a comparire. */
                      <div
                        key={t.torneoId}
                        className="trofeo-entra"
                        style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                      >
                        <TrofeoCard
                          trofeo={t}
                          onOpen={() => apriDettaglio(t)}
                          onToggleFav={() =>
                            handleTogglePreferito(t)
                          }
                          onRemove={() =>
                            handleRimuovi(t)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Scheletro dell'album, mostrato mentre la collezione arriva.

   Non è un semplice spinner: ha la stessa griglia e le stesse
   proporzioni delle polaroid vere, così quando i dati arrivano
   il contenuto prende il posto del segnaposto invece di far
   saltare la pagina. Le polaroid finte entrano scaglionate come
   quelle vere.
--------------------------------------------------------- */
function CollezioneSkeleton({ quante = 6 }) {
  return (
    <div className="trofeo-album" aria-hidden="true">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span
          className="trofeo-skeleton trofeo-skeleton-riga"
          style={{ width: 64, height: 20, margin: 0 }}
        />
      </div>

      <div className="trofeo-grid">
        {Array.from({ length: quante }).map((_, i) => (
          <div
            key={i}
            className="trofeo-entra"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div className="trofeo-polaroid trofeo-skeleton">
              <div
                className="trofeo-photo w-full"
                style={{ paddingTop: '125%' }}
              />

              <div className="trofeo-caption">
                <span
                  className="trofeo-skeleton-riga"
                  style={{ width: '72%', height: 16 }}
                />
                <span
                  className="trofeo-skeleton-riga"
                  style={{ width: '46%', height: 11, marginTop: 9 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
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

  // 1. FIX: Leggiamo entrambi i campi per retrocompatibilità
  const imageUrl = trofeo.locandinaThumb || trofeo.locandina;

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(e);
  };

  return (
    <div
      className="relative group"
      style={{
        paddingTop: 12,
        transform: `rotate(${rotBase}deg)`,
        transformOrigin: 'center top',
        transition:
          'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.05)',
      }}
    >
      {/* Nastro adesivo */}
      <div
        aria-hidden="true"
        className="absolute z-20 pointer-events-none"
        style={{
          top: 0,
          left: '50%',
          width: 64,
          height: 20,
          opacity: 0.72,
          background: `linear-gradient(
            90deg,
            transparent 0%,
            ${nastro} 2%,
            ${nastro} 100%,
            transparent 90%
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
          className="trofeo-card trofeo-polaroid relative"
          style={{
            border: isPref
              ? 'none'
              : '1px solid rgba(34,48,31,0.06)',
            boxShadow: isPref
              ? '0 10px 24px -10px rgba(184, 134, 11, 0.45), 0 2px 6px rgba(0,0,0,0.10)'
              : '0 8px 18px -8px rgba(0,0,0,0.28), 0 2px 5px rgba(0,0,0,0.10)',
            transition:
              'box-shadow 340ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              isPref
                ? '0 14px 32px -10px rgba(184, 134, 11, 0.6), 0 3px 8px rgba(0,0,0,0.14)'
                : '0 14px 26px -10px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              isPref
                ? '0 10px 24px -10px rgba(184, 134, 11, 0.45), 0 2px 6px rgba(0,0,0,0.10)'
                : '0 8px 18px -8px rgba(0,0,0,0.28), 0 2px 5px rgba(0,0,0,0.10)';
          }}
        >
          <div
            className="trofeo-photo w-full"
            style={{ paddingTop: '125%' }}
          >
            {/* 2. FIX: L'immagine (o il fallback) deve essere inserita PRIMA 
                degli effetti nel DOM, in modo da restare sullo sfondo e non coprirli */}
            {imageUrl ? (
              <img
                src={imageUrl}
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

            {/* ORA gli effetti visivi andranno correttamente in sovrimpressione all'immagine */}
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

            {/* Pulsanti interattivi */}
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
                  : 'sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100',
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
              className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center sm:hidden active:scale-90 z-10"
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
            className="trofeo-caption"
            title={trofeo.nome}
          >
            <h4
              className="trofeo-caption-title line-clamp-2"
              style={{
                color: isPref
                  ? '#7a5306'
                  : INK,
              }}
            >
              {trofeo.nome || '—'}
            </h4>

            {trofeo.data && (
              <p
                className="trofeo-caption-date"
                style={{
                  color: isPref
                    ? '#8a6208'
                    : INK,
                  opacity: isPref ? 0.85 : 0.55,
                }}
              >
                {formatGiornoMeseAnno(trofeo.data)}
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
        luogoDi(t)
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
          placeholder="Cerca torneo per nome, luogo o disciplina..."
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
                    {luogoDi(t)
                      ? ` · ${luogoDi(t)}`
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