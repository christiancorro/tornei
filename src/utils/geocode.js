/* Cache dei risultati, per stringa cercata (normalizzata).

   Il form interroga il geocoder due volte per lo stesso luogo: una
   mentre si digita, per dire subito se è stato trovato, e una al
   salvataggio. Senza cache sarebbe una richiesta in più a Nominatim
   per ogni torneo salvato, e le sue regole d'uso chiedono di non
   insistere. Memorizzo anche i "non trovato" (null): sono la
   risposta che il form ripete di più.

   La chiave è la stringa cercata, quindi correggere il luogo fa
   comunque una ricerca nuova. */
const cacheGeocode = new Map();
const CACHE_MAX = 120;

export async function geocode(luogo) {
  if (!luogo || typeof luogo !== 'string') return null;
  let clean = luogo.trim();
  if (!clean) return null;

  // "Mels (UD)" → "Mels, UD": Nominatim interpreta la provincia meglio
  // se separata da virgola che tra parentesi.
  clean = clean.replace(/\s*\(([^)]+)\)\s*$/, ', $1');

  const chiave = clean.toLowerCase();
  if (cacheGeocode.has(chiave)) return cacheGeocode.get(chiave);

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

  const lat = result ? parseFloat(result.lat) : NaN;
  const lon = result ? parseFloat(result.lon) : NaN;

  // Offset verso nord: circa 55 metri
  const OFFSET_LAT = 0.0005;

  const coord = Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat: lat + OFFSET_LAT, lng: lon }
    : null;

  /* Il risultato finisce in cache solo qui, cioè quando la richiesta
     è andata a buon fine. Un errore di rete esce con un throw prima
     di questa riga e non viene memorizzato: al tentativo successivo
     si riprova davvero. */
  ricorda(chiave, coord);

  return coord;
}

function ricorda(chiave, valore) {
  // Cache a dimensione limitata: quando è piena butto la voce più
  // vecchia (Map itera in ordine d'inserimento).
  if (cacheGeocode.size >= CACHE_MAX) {
    const primaChiave = cacheGeocode.keys().next().value;
    cacheGeocode.delete(primaChiave);
  }
  cacheGeocode.set(chiave, valore);
}