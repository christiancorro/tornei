import React, { useState, useRef } from 'react';
import { ImagePlus, Loader2, Trash2, Link2, Upload } from 'lucide-react';

import { INK, SUN, CLAY, GRASS_DARK, SAND } from '../theme';
import { uploadLocandina, deleteLocandina, MAX_LOCANDINA_MB } from '../services/tournaments';

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/* ---------------------------------------------------------
   Campo locandina: carica un file (compresso) oppure incolla
   un URL. Le due modalità scrivono sullo stesso campo `locandina`,
   ma solo il file valorizza `locandinaPath` — che è ciò che
   permette di cancellare il file da Storage insieme al torneo.
--------------------------------------------------------- */
export default function LocandinaField({
  value, path, onChange, labelClass, labelStyle, inputClass, inputStyle,
}) {
  const [mode, setMode] = useState(path || !value ? 'file' : 'url');
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

    const vecchio = path; // da rimuovere solo a caricamento riuscito

    try {
      const res = await uploadLocandina(file, setProgress);
      onChange({ locandina: res.url, locandinaPath: res.path });
      setInfo(`${formatSize(res.originalSize)} → ${formatSize(res.size)}`);
      if (vecchio && vecchio !== res.path) deleteLocandina(vecchio);
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
    }
  }

  function rimuovi() {
    if (path) deleteLocandina(path);
    onChange({ locandina: '', locandinaPath: '' });
    setInfo('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const TabBtn = ({ id, icon: Icon, children }) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all"
      style={{
        backgroundColor: mode === id ? INK : 'transparent',
        color: mode === id ? SAND : INK,
        border: mode === id ? '2px solid transparent' : '2px solid rgba(34,48,31,0.2)',
      }}
    >
      <Icon size={13} /> {children}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
          Locandina
        </label>
        <div className="flex gap-1.5">
          <TabBtn id="file" icon={Upload}>Carica</TabBtn>
          <TabBtn id="url" icon={Link2}>Link</TabBtn>
        </div>
      </div>

      {mode === 'url' ? (
        <input
          className={inputClass}
          style={inputStyle}
          value={value ?? ''}
          onChange={(e) => onChange({ locandina: e.target.value, locandinaPath: '' })}
          placeholder="https://..."
        />
      ) : value ? (
        <div
          className="flex items-center gap-3 p-3 rounded-lg border-2"
          style={{ borderColor: 'rgba(34,48,31,0.2)' }}
        >
          <img
            src={value}
            alt="Anteprima locandina"
            className="w-16 h-20 object-cover rounded shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: GRASS_DARK }}>
              Immagine caricata
            </p>
            {/* {info && (
              <p className="text-xs" style={{ color: INK, opacity: 0.55 }}>
                Compressa: {info}
              </p>
            )} */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-semibold underline mt-1"
              style={{ color: INK }}
            >
              Sostituisci
            </button>
          </div>
          <button
            type="button"
            onClick={rimuovi}
            className="shrink-0 p-2 rounded-full"
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
