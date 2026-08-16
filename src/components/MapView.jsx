import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Euro } from 'lucide-react';

import { CARD_BG, INK } from '../theme';
import { STUB_STYLE } from '../constants';
import { formatDataRange } from '../utils';

const iconaUtente = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: #1976D2;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(25,118,210,0.22), 0 1px 4px rgba(0,0,0,0.35);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function creaIconaTorneo(disciplina, nome) {
  const colori = {
    'Green Volley': '#72c777',
    'Beach Volley': '#f5b958',
    Pallavolo: '#3949AB',
  };

  const colore = colori[disciplina] || '#757575';

  const nomeBreve =
    nome && nome.length > 24
      ? `${nome.substring(0, 24)}…`
      : nome || '';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 160px;
        height: 62px;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          max-width: 150px;
          padding: 3px 7px;
          margin-bottom: 3px;
          background: white;
          color: #333;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          line-height: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          border: 1px solid rgba(0,0,0,0.08);
        ">
          ${nomeBreve}
        </div>

        <div style="
          position: relative;
          width: 30px;
          height: 30px;
          background: ${colore};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 5px rgba(0,0,0,0.35);
          box-sizing: border-box;
        ">
          <div style="
            position: absolute;
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            top: 8px;
            left: 8px;
          "></div>
        </div>
      </div>
    `,
    iconSize: [160, 62],
    iconAnchor: [80, 62],
    popupAnchor: [0, -62],
  });
}

const GEO_CACHE_KEY = 'tornei-fvg:geocache:v1';

function caricaCache() {
  if (typeof localStorage === 'undefined') return {};

  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function salvaCache(cache) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
  }
}

async function geocode(comune) {
  const q = encodeURIComponent(`${comune}, Friuli-Venezia Giulia, Italia`);
  const url = `https://photon.komoot.io/api/?q=${q}&limit=1`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`geo HTTP ${res.status}`);
  }

  const data = await res.json();
  const feat = data?.features?.[0];

  if (!feat) return null;

  const [lon, lat] = feat.geometry.coordinates;

  return [lat, lon];
}

const ANGOLO_AUREO = (137.5 * Math.PI) / 180;

function spargi(base, indice) {
  if (indice === 0) return base;

  const raggio = 0.0015 * Math.sqrt(indice);
  const theta = indice * ANGOLO_AUREO;

  return [
    base[0] + raggio * Math.cos(theta),
    base[1] + raggio * Math.sin(theta),
  ];
}

function CentraSuUtente({ posizione }) {
  const map = useMap();
  const fatto = useRef(false);

  useEffect(() => {
    if (!posizione || fatto.current) return;

    fatto.current = true;

    map.flyTo(posizione, 10, {
      duration: 1.2,
    });
  }, [posizione, map]);

  return null;
}

export default function MapView({ tournaments = [], onOpenDetail }) {
  const [geocache, setGeocache] = useState(caricaCache);
  const [posizioneUtente, setPosizioneUtente] = useState(null);

  useEffect(() => {
    const daCercare = [
      ...new Set(
        tournaments
          .map((t) => t.comune)
          .filter((c) => c && !(c in geocache))
      ),
    ];

    if (daCercare.length === 0) return undefined;

    let annullato = false;

    (async () => {
      for (const comune of daCercare) {
        if (annullato) return;

        try {
          const coords = await geocode(comune);

          if (annullato) return;

          setGeocache((prev) => {
            if (comune in prev) return prev;

            const next = {
              ...prev,
              [comune]: coords,
            };

            salvaCache(next);

            return next;
          });
        } catch (err) {
          console.warn(
            '[mappa] geocoding fallito per',
            comune,
            err
          );
        }

        if (annullato) return;

        await new Promise((r) => setTimeout(r, 400));
      }
    })();

    return () => {
      annullato = true;
    };
  }, [tournaments]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPosizioneUtente([
          pos.coords.latitude,
          pos.coords.longitude,
        ]),
      (err) =>
        console.warn(
          '[mappa] posizione non disponibile:',
          err.message
        ),
      {
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, []);

  const contatore = {};

  const marcatori = tournaments
    .map((t) => {
      const base = geocache[t.comune];

      if (!base) return null;

      const idx = contatore[t.comune] || 0;

      contatore[t.comune] = idx + 1;

      return {
        t,
        posizione: spargi(base, idx),
      };
    })
    .filter(Boolean);

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-6 py-2 mb-0">
      <div className="h-[73vh] rounded-2xl overflow-hidden shadow border-0">
        <MapContainer
          center={[46.07, 13.24]}
          zoom={9}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <CentraSuUtente posizione={posizioneUtente} />

          {posizioneUtente && (
            <Marker
              position={posizioneUtente}
              icon={iconaUtente}
            >
              <Popup>
                <div
                  className="text-sm font-semibold"
                  style={{
                    color: INK,
                    fontFamily: 'inherit',
                  }}
                >
                  Sei qui
                </div>
              </Popup>
            </Marker>
          )}

          {marcatori.map(({ t, posizione }) => {
            const style =
              STUB_STYLE[t.disciplina] ||
              STUB_STYLE['Green Volley'];

            return (
              <Marker
                key={t.id}
                position={posizione}
                icon={creaIconaTorneo(t.disciplina, t.nome)}
                eventHandlers={{
                  click: () => onOpenDetail?.(t),
                }}
              >
                {/*
  <Popup>
    <div
      onClick={() => onOpenDetail?.(t)}
      className="cursor-pointer overflow-hidden rounded-lg"
      style={{
        minWidth: 280,
        maxWidth: 340,
        backgroundColor: CARD_BG,
        color: INK,
        fontFamily: 'inherit',
      }}
    >
      <div className="flex">
        <div className="flex-1 p-3 min-w-0">
          <h3
            className="font-black text-xl leading-tight mb-2"
            style={{ color: INK }}
          >
            {t.nome}
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: style.tagBg,
                color: style.tagText,
              }}
            >
              {t.disciplina}
            </span>

            {t.formati?.map((f) => (
              <span
                key={f}
                className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="text-sm text-gray-700 space-y-1">
            <div className="flex items-center gap-1.5">
              <MapPin
                size={15}
                className="text-gray-400 shrink-0"
              />
              <span>{t.comune}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Euro
                size={15}
                className="text-gray-400 shrink-0"
              />
              <span>{t.costo || 'Gratis'}</span>
            </div>

            <div className="text-xs text-gray-500 mt-1">
              📅{' '}
              {formatDataRange(
                t.data,
                t.dataFine
              )}
            </div>
          </div>
        </div>

        {t.locandina && (
          <div className="w-20 shrink-0 p-2 flex items-center">
            <img
              src={t.locandina}
              alt={`Locandina ${t.nome}`}
              className="w-full rounded-lg shadow-sm"
              style={{
                maxHeight: 120,
                objectFit: 'contain',
              }}
            />
          </div>
        )}
      </div>
    </div>
  </Popup>
  */}
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}