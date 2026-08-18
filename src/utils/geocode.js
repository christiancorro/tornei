export async function geocode(citta) {
  if (!citta || typeof citta !== 'string') return null;
  const clean = citta.trim();
  if (!clean) return null;

  const url = 'https://nominatim.openstreetmap.org/search'
    + `?q=${encodeURIComponent(clean + ', Italia')}`
    + '&format=json'
    + '&limit=1'
    + '&countrycodes=it';

  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'it'
    }
  });

  if (!res.ok) throw new Error(`geo HTTP ${res.status}`);

  const data = await res.json();
  const result = data?.[0];

  if (!result) return null;

  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Offset verso nord: circa 55 metri
  const OFFSET_LAT = 0.0010;

  return {
    lat: lat + OFFSET_LAT,
    lng: lon
  };
}