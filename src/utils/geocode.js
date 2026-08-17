/* ---------------------------------------------------------
   Geocoding — Photon (dati OSM), Italia-wide.

   Nessuna cache locale: la coordinata risolta finisce su
   Firestore insieme al torneo, quindi ogni geocode fatto qui
   è "one shot" al momento del salvataggio. La mappa poi legge
   lat/lng direttamente dal documento, senza rete.

   Photon è gratuito e non richiede API key. Ha un rate limit
   morbido (~qualche req/s per IP): fine per il nostro caso
   d'uso, dove geocodifichiamo al submit del form dell'utente.
--------------------------------------------------------- */

export async function geocode(citta) {
  if (!citta || typeof citta !== 'string') return null;
  const clean = citta.trim();
  if (!clean) return null;

  const url = 'https://photon.komoot.io/api/'
    + `?q=${encodeURIComponent(clean + ', Italia')}`
    + '&limit=1&lang=it'
    // Bias verso il centro del Nord-Est italiano: aiuta con le
    // omonimie fra comuni ("Castello", "Villanova"…) senza
    // escludere il resto d'Italia. Non è un filtro, è un peso
    // sul ranking dei risultati.
    + '&lat=46.0&lon=13.0';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo HTTP ${res.status}`);

  const data = await res.json();
  const feat = data?.features?.[0];

  // Photon non ha un parametro `countrycodes`: filtriamo qui.
  // Se il match cade fuori Italia meglio null che un pin a caso
  // sull'altra parte del mondo.
  const country = feat?.properties?.country;
  if (!feat || (country && country !== 'Italia' && country !== 'Italy')) return null;

  // Photon restituisce [lon, lat] (standard GeoJSON), noi
  // usiamo `lat`/`lng` per coerenza con il resto dell'app.
  const [lon, lat] = feat.geometry.coordinates;
  return { lat, lng: lon };
}
