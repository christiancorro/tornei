export async function geocode(luogo) {
  if (!luogo || typeof luogo !== 'string') return null;
  let clean = luogo.trim();
  if (!clean) return null;

  // "Mels (UD)" → "Mels, UD": Nominatim interpreta la provincia meglio
  // se separata da virgola che tra parentesi.
  clean = clean.replace(/\s*\(([^)]+)\)\s*$/, ', $1');

  async function query(q) {
    const url = 'https://nominatim.openstreetmap.org/search'
      + `?q=${encodeURIComponent(q)}`
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
    return data?.[0] ?? null;
  }

  // Il luogo non è per forza un comune: può essere un parco, un
  // impianto, un indirizzo. La ricerca free-text di Nominatim li trova
  // tutti. Primo tentativo con ", Italia" per disambiguare; se non
  // trova nulla (capita con nomi di parchi già abbastanza specifici)
  // riprovo senza il suffisso, che a volte restringe troppo.
  let result = await query(clean + ', Italia');
  if (!result) result = await query(clean);

  if (!result) return null;

  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Offset verso nord: circa 55 metri
  const OFFSET_LAT = 0.0005;

  return {
    lat: lat + OFFSET_LAT,
    lng: lon
  };
}