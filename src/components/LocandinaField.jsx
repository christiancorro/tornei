import React, { useState, useRef, useEffect } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

import { INK, SUN, CLAY, GRASS_DARK } from '../theme';
import { uploadLocandina, deleteLocandina, MAX_LOCANDINA_MB } from '../services/tournaments';

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/* ---------------------------------------------------------
   Anteprima con cross-fade.

   Un <img> semplice, cambiando `src`, resta bianco finché il
   nuovo file non è decodificato: dopo "Sostituisci" si vede
   uno sfarfallio. Qui teniamo traccia del load per src e
   facciamo comparire l'immagine in opacità sopra uno sfondo
   tenue — la nuova entra dolce, la vecchia non "sparisce"
   prima del tempo.
--------------------------------------------------------- */
function AnteprimaLocandina({ src, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  // Resetto `loaded` solo su un vero cambio di src: se lo facessi
  // ogni render, la stessa immagine rifarebbe il fade da capo.
  const prevSrcRef = useRef(src);
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      setLoaded(false);
    }
  }, [src]);

  return (
    <div className={`relative w-16 h-20 shrink-0 rounded overflow-hidden ${className}`}>
      {/* Sfondo tenue: riempie lo slot mentre l'img decodifica, così
          non si vede mai un buco bianco durante lo swap. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(34,48,31,0.08)',
          opacity: loaded ? 0 : 1,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />
      <img
        // key=src smonta il vecchio <img> a ogni cambio: garantisce che
        // il `loaded` ripartisca da capo anche se React riusasse
        // l'istanza per pigrizia di riconciliazione.
        key={src}
        src={src}
        alt="Anteprima locandina"
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 260ms ease-out',
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   Campo locandina: carica un file (compresso). Solo l'upload
   valorizza `locandinaPath` — che è ciò che permette di
   cancellare il file da Storage insieme al torneo.

   Da quando l'upload produce anche una preview piccola, il
   campo scrive quattro chiavi in un colpo unico:
     locandina + locandinaPath    → file grande (dettaglio)
     locandinaThumb + …ThumbPath  → file piccolo (card lista)
   Anche "Sostituisci" passa da qui, quindi grande e thumb
   restano sempre in coppia: non può capitare di ritrovarsi
   con la locandina nuova e il thumb vecchio.
--------------------------------------------------------- */
export default function LocandinaField({
  value, path, thumbPath, onChange, labelClass, labelStyle, inputClass, inputStyle,
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file || busy) return;
    setError('');
    setInfo('');
    setBusy(true);
    setProgress(0);

    // Da rimuovere solo a caricamento riuscito: sia il file grande
    // che il thumb del set precedente, se esistevano.
    const vecchioPath = path;
    const vecchioThumbPath = thumbPath;

    try {
      const res = await uploadLocandina(file, setProgress);
      // Patch atomico dei quattro campi: main e thumb non possono
      // divergere. Se dopo un salvataggio vedessi solo l'uno cambiato
      // e l'altro no, sarebbe un baco qui.
      onChange({
        locandina: res.url,
        locandinaPath: res.path,
        locandinaThumb: res.thumbUrl,
        locandinaThumbPath: res.thumbPath,
      });
      setInfo(`${formatSize(res.originalSize)} → ${formatSize(res.size)} + ${formatSize(res.thumbSize)}`);
      if (vecchioPath && vecchioPath !== res.path) deleteLocandina(vecchioPath);
      if (vecchioThumbPath && vecchioThumbPath !== res.thumbPath) deleteLocandina(vecchioThumbPath);
    } catch (err) {
      console.error('[locandina]', err);
      setError(
        err?.code === 'storage/unauthorized'
          ? 'Non hai i permessi per caricare immagini.'
          : err.message || 'Caricamento non riuscito.'
      );
    } finally {
      setBusy(false);
      setProgress(0);
      // Reset del value dell'input: senza questo, riaprire la finestra
      // e scegliere lo stesso file non fa scattare onChange (il browser
      // vede value invariato) — "Sostituisci con lo stesso file" non
      // partirebbe mai.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function rimuovi() {
    if (path) deleteLocandina(path);
    if (thumbPath) deleteLocandina(thumbPath);
    onChange({
      locandina: '',
      locandinaPath: '',
      locandinaThumb: '',
      locandinaThumbPath: '',
    });
    setInfo('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <div className="mb-2">
        <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
          Locandina
        </label>
      </div>

      {value ? (
        <div
          className="flex items-center gap-3 p-3 rounded-lg border-2"
          style={{ borderColor: 'rgba(34,48,31,0.2)' }}
        >
          <div className="relative">
            <AnteprimaLocandina src={value} />
            {/* Durante la sostituzione l'anteprima vecchia resta a
                schermo (il patch dei campi arriva solo a upload finito),
                ma copro con un velo + spinner per dire "ci sto lavorando".
                Senza questo, l'utente non sa se il click ha fatto niente
                e ripreme "Sostituisci". */}
            {busy && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  transition: 'opacity 200ms ease-out',
                }}
                aria-hidden="true"
              >
                <Loader2 size={18} className="animate-spin" style={{ color: INK }} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: GRASS_DARK }}>
              {busy
                ? (progress > 0 ? `Caricamento ${progress}%` : 'Compressione...')
                : 'Immagine caricata'}
            </p>
            {/* {info && (
              <p className="text-xs" style={{ color: INK, opacity: 0.55 }}>
                Compressa: {info}
              </p>
            )} */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="text-xs font-semibold underline mt-1 disabled:opacity-40"
              style={{ color: INK }}
            >
              Sostituisci
            </button>
          </div>
          <button
            type="button"
            onClick={rimuovi}
            disabled={busy}
            className="shrink-0 p-2 rounded-full disabled:opacity-40"
            style={{ color: CLAY }}
            aria-label="Rimuovi locandina"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={busy}
          className="w-full rounded-lg border-2 border-dashed py-6 px-4 flex flex-col items-center gap-2 transition-all"
          style={{
            borderColor: dragging ? INK : 'rgba(34,48,31,0.25)',
            backgroundColor: dragging ? '#FFF4DE' : 'transparent',
          }}
        >
          {busy ? (
            <>
              <Loader2 size={22} className="animate-spin" style={{ color: INK }} />
              <p className="text-sm font-bold" style={{ color: INK }}>
                {progress > 0 ? `Caricamento ${progress}%` : 'Compressione...'}
              </p>
              <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(34,48,31,0.15)' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: SUN }}
                />
              </div>
            </>
          ) : (
            <>
              <ImagePlus size={22} style={{ color: INK, opacity: 0.5 }} />
              <p className="text-sm font-bold" style={{ color: INK }}>
                Trascina l'immagine o tocca per sceglierla
              </p>
              <p className="text-xs" style={{ color: INK, opacity: 0.5 }}>
              </p>
            </>
          )}
        </button>
      )}

      {/* capture="environment" non c'è di proposito: su mobile deve
          aprirsi la galleria, non la fotocamera — la locandina è
          quasi sempre uno screenshot già salvato. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && (
        <p className="text-xs font-semibold mt-2" style={{ color: CLAY }}>{error}</p>
      )}
    </div>
  );
}