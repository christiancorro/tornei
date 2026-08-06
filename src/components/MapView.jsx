import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const tournamentIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 30px;
      height: 30px;
      background: #ffcc33;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 3px 8px rgba(0,0,0,0.25);
      border:2px solid white;
    ">
      <span style="
        transform: rotate(45deg);
        font-size:18px;
      ">🏐</span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const testMarkers = [
  {
    id: 1,
    name: 'Beach Volley Udine',
    location: 'Udine',
    date: '15 Agosto 2026',
    teams: '16 squadre',
    position: [46.0711, 13.2346],
  },
  {
    id: 2,
    name: 'Torneo Parco Moretti',
    location: 'Udine',
    date: '20 Agosto 2026',
    teams: '12 squadre',
    position: [46.0720, 13.2360],
  },
  {
    id: 3,
    name: 'Summer Volley Cup',
    location: 'Campoformido',
    date: '25 Agosto 2026',
    teams: '24 squadre',
    position: [46.0635, 13.1590],
  },
  {
    id: 4,
    name: 'Volley Night Udine',
    location: 'Udine Sud',
    date: '30 Agosto 2026',
    teams: '8 squadre',
    position: [46.0608, 13.2455],
  },
];
export default function MapView() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-6 py-2 mb-6">
      <div className="h-[600px] rounded-2xl overflow-hidden shadow-lg border-1">
        <MapContainer
          center={[46.07, 13.24]}
          zoom={10}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {testMarkers.map((tournament) => (
            <Marker
              key={tournament.id}
              position={tournament.position}
              icon={tournamentIcon}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold">
                    {tournament.name}
                  </h3>
                  <p>{tournament.location}</p>
                  <p>📅 {tournament.date}</p>
                  <p>🏐 {tournament.teams}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}