import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import { INK } from '../theme';

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

/* Più tornei nello stesso comune ricadrebbero tutti sullo
   stesso pin: li sparpaglio in una spirale aurea intorno al
   centro comunale così restano cliccabili singolarmente,
   senza sovrapporsi visivamente. */
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
  // const map = useMap();
  // const fatto = useRef(false);

  // useEffect(() => {
  //   if (!posizione || fatto.current) return;
  //   fatto.current = true;
  //   map.flyTo(posizione, 10, { duration: 1.2 });
  // }, [posizione, map]);

  return null;
}

export default function MapView({ tournaments = [], onOpenDetail }) {
  const [posizioneUtente, setPosizioneUtente] = useState(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPosizioneUtente([pos.coords.latitude, pos.coords.longitude]),
      (err) =>
        console.warn('[mappa] posizione non disponibile:', err.message),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Nessun geocoding a runtime: la mappa mostra solo i tornei
  // già geolocalizzati al momento del salvataggio (utils/geocode
  // dentro TournamentForm). I tornei vecchi senza lat/lng
  // torneranno visibili quando il loro organizzatore li salva
  // di nuovo (il form scatena il geocoding e li arricchisce).
  const contatore = {};
  const marcatori = tournaments
    .filter((t) => typeof t.lat === 'number' && typeof t.lng === 'number')
    .map((t) => {
      const idx = contatore[t.comune] || 0;
      contatore[t.comune] = idx + 1;
      return { t, posizione: spargi([t.lat, t.lng], idx) };
    });

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-6 py-2 mb-0">
      <div className="h-[74vh] rounded-2xl overflow-hidden shadow border-0">
        <MapContainer
          center={[45.96, 13.24]}
          zoom={10}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <CentraSuUtente posizione={posizioneUtente} />

          {posizioneUtente && (
            <Marker position={posizioneUtente} icon={iconaUtente}>
            </Marker>
          )}

          {marcatori.map(({ t, posizione }) => (
            <Marker
              key={t.id}
              position={posizione}
              icon={creaIconaTorneo(t.disciplina, t.nome)}
              eventHandlers={{
                click: () => onOpenDetail?.(t),
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}