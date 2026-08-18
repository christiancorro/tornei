import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { isPassato, todayISO } from '../utils';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const SOURCE_ID = 'tornei-src';
const LAYER_PIN = 'tornei-pin';
const LAYER_LABEL = 'tornei-label';
// Overlay dell'etichetta: stesso rendering del LAYER_LABEL ma con
// allow-overlap/ignore-placement per FORZARE la visibilità del
// titolo di un pin anche quando la collision detection l'aveva
// nascosto. Filtrato sull'id hoverato, invisibile a riposo.
const LAYER_LABEL_HOVER = 'tornei-label-hover';
const BOX_IMAGE = 'label-box';

/* Sentinel usato come "id non esistente" nel filtro di LAYER_LABEL
   per nascondere tutte le etichette quando non c'è hover. Non deve
   collidere con nessun id reale di Firestore (che sono alfanumerici). */
const NO_HOVER = '__no_hover__';

/* Più tornei nello stesso comune ricadrebbero tutti sullo
   stesso pin: li sparpaglio in una spirale aurea intorno al
   centro comunale così restano cliccabili singolarmente. */
const ANGOLO_AUREO = (137.5 * Math.PI) / 180;

function spargi(lat, lng, indice) {
  if (indice === 0) return [lng, lat];
  const raggio = 0.0015 * Math.sqrt(indice);
  const theta = indice * ANGOLO_AUREO;
  return [lng + raggio * Math.sin(theta), lat + raggio * Math.cos(theta)];
}

const COLORI_DISCIPLINA = {
  'Green Volley': 'rgb(112, 193, 112)',
  'Beach Volley': '#f5b958',
  Pallavolo: '#3949AB',
};
const COLORE_DEFAULT = '#1f1f1f';

const TEXT_FONT = [
  'Poppins Medium',
  'Fredoka Medium',
  'Open Sans Semibold',
  'Arial Unicode MS Bold',
];

/* Rilevo mobile una sola volta al load: la dimensione della viewport
   non cambia spesso in mid-sessione, e comunque una detection statica
   è sufficiente per calibrare pin/label. */
const IS_MOBILE =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(max-width: 640px)').matches;

const TEXT_SIZE = IS_MOBILE ? 12 : 13;

// Fattore di scala del pin su mobile: 0.85 rende il pin ~15% più
// piccolo senza rigenerare l'immagine (icon-size scala la texture
// esistente).
const PIN_SIZE_SCALE = IS_MOBILE ? 0.95 : 1;

/* Vista iniziale: usata sia dall'init della mappa, sia dal pulsante
   "Centra" quando non c'è nessun torneo da inquadrare (filtri troppo
   restrittivi). Tenerli in una costante evita che i due si
   disallineino. */
const INITIAL_CENTER = [13.24, 45.96];
const INITIAL_ZOOM = 8;

/* Opzioni condivise di fitBounds per la vista "centra sui tornei":
   usate sia dall'effect che aggiorna il source, sia dal pulsante
   custom di ricentraggio. */
const FIT_OPTIONS = {
  padding: { top: 100, right: 70, bottom: 70, left: 70 },
  maxZoom: 9,
  duration: 800,
};

function iconKey(disciplina) {
  return `pin-${disciplina || 'default'}`;
}

function pathRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* Geometria del pin: prevalentemente circolare con una punta corta
   in basso, e un "occhio" bianco al centro con puntino colorato
   dentro. Le dimensioni sono scelte così che tutti i numeri chiave
   siano interi puliti — la punta cade esattamente al bordo inferiore
   del contenuto del pin, e l'icon-offset diventa uguale al solo
   padding-ombra. */
const PIN_STROKE = 2;
const PIN_W_CSS = 32;                        // larghezza pin
const PIN_R = PIN_W_CSS / 2 - PIN_STROKE;    // raggio cerchio = 14
/* Distanza centro-cerchio → punta. Piccola protrusione sotto il
   cerchio (~3px), tangenza esatta: sin(α) = r / tipDist ⇒ arco e
   linee alla punta si raccordano senza spigoli visibili. */
const PIN_TIP_DIST = 19;
const PIN_H_CSS = PIN_W_CSS / 2 + PIN_TIP_DIST; // = 33, punta a filo col fondo del contenuto

/* Padding attorno al pin per far respirare l'ombra: senza, il blur
   verrebbe tagliato dai bordi del canvas e l'ombra apparirebbe
   troncata. */
const PIN_PAD_CSS = 6;
/* Con `icon-anchor: 'bottom'` Mapbox allinea il fondo dell'immagine
   al punto geografico. La punta del pin è però `PIN_PAD_CSS` px
   sopra il fondo (padding-ombra sotto). Compenso con icon-offset
   positivo lungo Y: sposta l'icona in basso di questa distanza così
   la punta ricade esattamente sul punto. */
const PIN_TIP_OFFSET = PIN_PAD_CSS;

function creaImmaginePin(colore) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wCss = PIN_W_CSS;
  const hCss = PIN_H_CSS;
  const pad = PIN_PAD_CSS;

  const totalWCss = wCss + pad * 2;
  const totalHCss = hCss + pad * 2;
  const w = Math.round(totalWCss * dpr);
  const h = Math.round(totalHCss * dpr);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const stroke = PIN_STROKE;
  const cx = pad + wCss / 2;
  const cy = pad + wCss / 2;        // cerchio centrato in alto
  const r = PIN_R;
  const tipY = cy + PIN_TIP_DIST;   // punta a filo col bordo inferiore del contenuto

  // Angolo delle tangenti punta→cerchio: sin(α) = r / tipDist.
  // L'arco superiore va da (π - α) a α; il raccordo con le linee
  // verso la punta è geometricamente continuo (niente kink).
  const alpha = Math.asin(r / PIN_TIP_DIST);
  const arcStart = Math.PI - alpha; // tangente bottom-left
  const arcEnd = alpha;             // tangente bottom-right

  // Ombra: si applica SOLO alla prima fill (la sagoma colorata).
  // Bordo bianco e "occhio" vanno disegnati con shadow trasparente,
  // altrimenti anch'essi proietterebbero ombra sporcando l'effetto.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;

  ctx.beginPath();
  ctx.arc(cx, cy, r, arcStart, arcEnd);

  const tipRound = 2;
  const leftTipX = cx - tipRound;
  const rightTipX = cx + tipRound;

  ctx.lineTo(rightTipX, tipY - tipRound);
  ctx.quadraticCurveTo(cx, tipY, leftTipX, tipY - tipRound);
  ctx.closePath();
  ctx.fillStyle = colore;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Bordo bianco. lineJoin 'round' evita che la miter join sulla
  // punta acuta sporga oltre il tip point (default 'miter' darebbe
  // uno spuntone su un angolo stretto).
  ctx.lineWidth = stroke;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // "Occhio": cerchio bianco + puntino colorato al centro, come
  // una piccola coccarda dentro il pin.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  return { imageData: ctx.getImageData(0, 0, w, h), pixelRatio: dpr };
}


function creaImmagineBox() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wCss = 24;   // larghezza box (senza padding-ombra)
  const hCss = 18;   // altezza box (senza padding-ombra)
  const rCss = 8;    // raggio corner
  const padCss = 6;  // margine per l'ombra su tutti i lati

  const totalWCss = wCss + padCss * 2;
  const totalHCss = hCss + padCss * 2;
  const w = Math.round(totalWCss * dpr);
  const h = Math.round(totalHCss * dpr);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Ombra prima della fill del box.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  const border = 0.5;
  pathRoundRect(
    ctx,
    padCss + border,
    padCss + border,
    wCss - 2 * border,
    hCss - 2 * border,
    rCss,
  );
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Il bordo NON deve buttare la sua ombra sopra a quella del riempimento
  // (raddoppierebbe visivamente il contorno).
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.stroke();

  // 9-slice: coordinate in pixel della bitmap effettiva (già dpr).
  const boxLeftPx = (padCss + rCss) * dpr;
  const boxTopPx = (padCss + rCss) * dpr;
  const boxRightPx = (padCss + wCss - rCss) * dpr;
  const boxBottomPx = (padCss + hCss - rCss) * dpr;

  const contentLeftPx = padCss * dpr;
  const contentTopPx = padCss * dpr;
  const contentRightPx = (padCss + wCss) * dpr;
  const contentBottomPx = (padCss + hCss) * dpr;

  return {
    imageData: ctx.getImageData(0, 0, w, h),
    pixelRatio: dpr,
    stretchX: [[boxLeftPx, boxRightPx]],
    stretchY: [[boxTopPx, boxBottomPx]],
    // Content = area interna del box (dove Mapbox posiziona il testo).
    content: [contentLeftPx, contentTopPx, contentRightPx, contentBottomPx],
  };
}


function registraIcone(map) {
  const pins = { ...COLORI_DISCIPLINA, default: COLORE_DEFAULT };
  Object.entries(pins).forEach(([disc, col]) => {
    const key = iconKey(disc === 'default' ? '' : disc);
    if (map.hasImage(key)) return;
    const { imageData, pixelRatio } = creaImmaginePin(col);
    map.addImage(key, imageData, { pixelRatio });
  });

  if (!map.hasImage(BOX_IMAGE)) {
    const box = creaImmagineBox();
    map.addImage(BOX_IMAGE, box.imageData, {
      pixelRatio: box.pixelRatio,
      stretchX: box.stretchX,
      stretchY: box.stretchY,
      content: box.content,
    });
  }
}

function toGeoJSON(tournaments) {
  const contatore = {};
  const features = [];

  tournaments
    .filter((t) => typeof t.lat === 'number' && typeof t.lng === 'number')
    .forEach((t) => {
      const idx = contatore[t.comune] || 0;
      contatore[t.comune] = idx + 1;

      const nome = t.nome || '';
      const nomeBreve = nome.length > 24 ? `${nome.substring(0, 24)}…` : nome;

      features.push({
        type: 'Feature',
        id: t.id,
        geometry: {
          type: 'Point',
          coordinates: spargi(t.lat, t.lng, idx),
        },
        properties: {
          id: t.id,
          nome: nomeBreve,
          disciplina: t.disciplina || '',
        },
      });
    });

  return { type: 'FeatureCollection', features };
}

function soloTorneiCorrenti(tournaments) {
  const oggi = todayISO();
  return tournaments.filter((t) => !isPassato(t, oggi));
}

/* Calcola i bounds e fitta la mappa. Se non c'è niente da inquadrare:
   - se `flyOnEmpty` è true (pulsante utente), torna alla vista iniziale
   - altrimenti (aggiornamento dati) non tocca la vista.
   Ritorna false quando non ha fittato sui pin (0 features). */
function fitToTournaments(map, tournaments, { flyOnEmpty = false } = {}) {
  const geo = toGeoJSON(tournaments);
  if (geo.features.length === 0) {
    if (flyOnEmpty) {
      map.flyTo({
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        duration: 800,
      });
    }
    return false;
  }
  const bounds = new mapboxgl.LngLatBounds();
  geo.features.forEach((f) => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, FIT_OPTIONS);
  return true;
}

/* Pulsante custom "Centra sui tornei": implementa l'interfaccia
   IControl di Mapbox (onAdd/onRemove) così si comporta esattamente
   come i controlli built-in (stessa cornice, stesso stacking).

   Riceve `onClick` invece di catturare i tornei per riferimento: così
   il click prende SEMPRE la lista attuale (i pin filtrati) via il
   ref, non uno snapshot vecchio. */
class RicentraControl {
  constructor(onClick) {
    this._onClick = onClick;
  }
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mapboxgl-ctrl-icon';
    btn.title = 'Centra su tutti i tornei';
    btn.setAttribute('aria-label', 'Centra su tutti i tornei');
    // Icona "viewfinder" con puntino centrale: sposa bene l'idea di
    // "riquadra e centra". Colore ereditato dai controlli Mapbox
    // (stroke #333) così è coerente col resto della UI.
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
           viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 6.5V3.5h3M13.5 3.5h3v3M16.5 13.5v3h-3M6.5 16.5h-3v-3"
              fill="none" stroke="#333" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="10" cy="10" r="2" fill="#333"/>
      </svg>`;
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    btn.addEventListener('click', this._onClick);
    this._btn = btn;

    this._container.appendChild(btn);
    return this._container;
  }
  onRemove() {
    if (this._btn) this._btn.removeEventListener('click', this._onClick);
    this._container?.remove();
    this._map = null;
  }
}

export default function MapView({ tournaments = [], onOpenDetail, active = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tournamentsRef = useRef(tournaments);
  tournamentsRef.current = tournaments;
  const onOpenRef = useRef(onOpenDetail);
  onOpenRef.current = onOpenDetail;
  // Traccio l'id dell'ultimo pin hoverato per evitare setFilter
  // rumorosi ad ogni mousemove (di solito l'utente resta sullo
  // stesso pin per più frame).
  const hoveredIdRef = useRef(null);

  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      // light-v11: base grigia molto neutra. Fa risaltare i pin colorati.
      style: 'mapbox://styles/christiancorro/cmsysc3be00c101sedz54at1h',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: true,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      trackUserLocation: true,
      showUserHeading: false,
      showAccuracyCircle: false,
    });

    geolocateControl.on('geolocate', () => {
      map.easeTo({
        zoom: 9,
        duration: 800,
      });
    });

    map.addControl(geolocateControl, 'top-right');

    map.once('load', () => {
      geolocateControl.trigger();
    });

    // Pulsante custom per ricentrare la vista sui tornei correnti.
    // Uso tournamentsRef così il click prende sempre la lista attuale
    // (filtrata dall'utente); e passo `flyOnEmpty: true` così se i
    // filtri lasciano zero tornei, torniamo alla vista iniziale
    // invece di restare fermi dove si era.
    map.addControl(
      new RicentraControl(() => {
        if (!mapRef.current) return;
        fitToTournaments(
          mapRef.current,
          soloTorneiCorrenti(tournamentsRef.current),
          { flyOnEmpty: true },
        );
      }),
      'top-right',
    );


    map.on('load', () => {
      registraIcone(map);

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer PIN — solo l'icona a goccia.
      map.addLayer({
        id: LAYER_PIN,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'icon-image': [
            'match',
            ['get', 'disciplina'],
            'Green Volley', iconKey('Green Volley'),
            'Beach Volley', iconKey('Beach Volley'),
            'Pallavolo', iconKey('Pallavolo'),
            iconKey(''),
          ],
          'icon-anchor': 'bottom',
          // Il pin ha padding-ombra sotto la punta: compenso spostando
          // l'icona in basso di PIN_TIP_OFFSET, così la punta ricade
          // esattamente sul punto geografico invece che PIN_TIP_OFFSET
          // px sopra.
          'icon-offset': [0, PIN_TIP_OFFSET],
          'icon-size': PIN_SIZE_SCALE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Layer LABEL — sempre visibile, ma con collision detection
      // attiva (allow-overlap NON impostato = default false). Se
      // due tornei sono vicini, Mapbox mostra quello che entra e
      // nasconde l'altro. La label "perdente" verrà svelata al
      // volo dal LAYER_LABEL_HOVER quando l'utente ci passa sopra.
      map.addLayer({
        id: LAYER_LABEL,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 6, // sotto lo zoom 8 le etichette diventano un tappeto
        layout: {
          'icon-image': BOX_IMAGE,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [4, 7, 4, 7],

          'text-field': ['get', 'nome'],
          'text-font': TEXT_FONT,
          'text-size': TEXT_SIZE,
          'text-max-width': 10,
          // Pin ora alto 33px (era 44): abbasso il text-offset così
          // l'etichetta segue il nuovo pin più corto senza staccarsi.
          // -2.9em con text-size 13 ≈ 38px sopra il punto; il box
          // scende 3px sotto il testo per l'icon-text-fit-padding →
          // base box ~35px sopra il punto, testa pin a 33px, gap ~2px.
          'text-anchor': 'bottom',
          'text-offset': [0, -3.1],
        },
        paint: {
          'text-color': '#131313',
        },
      });

      // Layer LABEL_HOVER — override che ignora la collision e
      // filtra sull'id hoverato. A riposo il filtro non matcha
      // nulla (NO_HOVER) quindi il layer è invisibile.
      map.addLayer({
        id: LAYER_LABEL_HOVER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'id'], NO_HOVER],
        layout: {
          'icon-image': BOX_IMAGE,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [4, 7, 4, 7],
          // Forzo la comparsa: allow-overlap ignora la collision
          // detection, ignore-placement impedisce a QUESTA feature
          // di partecipare al calcolo (così non spingerebbe fuori
          // altre etichette).
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,

          'text-field': ['get', 'nome'],
          'text-font': TEXT_FONT,
          'text-size': TEXT_SIZE,
          'text-max-width': 10,
          'text-anchor': 'bottom',
          'text-offset': [0, -3.1],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#131313',
        },
      });

      // Click su un pin (o sulla sua etichetta hoverata) apre il dettaglio.
      const openFromEvent = (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const id = f.properties.id;
        const t = tournamentsRef.current.find((x) => x.id === id);
        if (t) onOpenRef.current?.(t);
      };
      map.on('click', LAYER_PIN, openFromEvent);
      map.on('click', LAYER_LABEL, openFromEvent);
      map.on('click', LAYER_LABEL_HOVER, openFromEvent);

      // Hover: mousemove aggiorna il filtro dell'overlay col nome
      // del torneo sotto al cursore. Se quella label era già visibile
      // nel LAYER_LABEL normale, semplicemente viene ridisegnata
      // sopra (uguale, invisibile la differenza); se era stata
      // nascosta dalla collision, ora appare forzata.
      // Uso mousemove invece di mouseenter perché scorrendo da pin
      // a pin senza uscire dal layer, mouseenter non si ritrigger.
      map.on('mousemove', LAYER_PIN, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features && e.features[0];
        if (!f) return;
        const id = f.properties.id;
        if (hoveredIdRef.current === id) return;
        hoveredIdRef.current = id;
        map.setFilter(LAYER_LABEL_HOVER, ['==', ['get', 'id'], id]);
      });
      map.on('mouseleave', LAYER_PIN, () => {
        map.getCanvas().style.cursor = '';
        if (hoveredIdRef.current === null) return;
        hoveredIdRef.current = null;
        map.setFilter(LAYER_LABEL_HOVER, ['==', ['get', 'id'], NO_HOVER]);
      });

      // styleimagemissing: rigenera icona al volo se il registro
      // viene ripulito (cambio stile ecc.).
      map.on('styleimagemissing', (e) => {
        if (map.hasImage(e.id)) return;
        if (e.id === BOX_IMAGE) {
          const box = creaImmagineBox();
          map.addImage(BOX_IMAGE, box.imageData, {
            pixelRatio: box.pixelRatio,
            stretchX: box.stretchX,
            stretchY: box.stretchY,
            content: box.content,
          });
          return;
        }
        if (e.id.startsWith('pin-')) {
          const disc = e.id.slice('pin-'.length);
          const col = COLORI_DISCIPLINA[disc] || COLORE_DEFAULT;
          const { imageData, pixelRatio } = creaImmaginePin(col);
          map.addImage(e.id, imageData, { pixelRatio });
        }
      });

      setStyleReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const src = map.getSource(SOURCE_ID);
    if (!src) return;

    const correnti = soloTorneiCorrenti(tournaments);
    src.setData(toGeoJSON(correnti));
    fitToTournaments(map, correnti);
  }, [tournaments, styleReady]);

  /* Quando la mappa torna visibile forzo un resize: mentre era
     nascosta il container può aver cambiato larghezza. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !active) return;
    const raf = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(raf);
  }, [active, styleReady]);

  return (
    <div className="max-w-6xl mx-auto sm:px-6 lg:px-6 py-0 mb-0">
      <div className="h-[75vh] max-h-[800px]  rounded-3xl overflow-hidden shadow border-2 border-[#faf9f6] relative">
        {!MAPBOX_TOKEN && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-center p-6 z-10">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Mappa non configurata</p>
              <p className="text-sm text-gray-600">
                Manca <code>VITE_MAPBOX_TOKEN</code> nelle variabili d'ambiente.
              </p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}