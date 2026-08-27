import React, { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { INK, SUN } from '../../theme';
import { MESI_BREVI } from '../../constants';

/* ---------------------------------------------------------
   DateRangeSlider — intervallo di date a due maniglie.

   Sostituisce i due calendari "DAL / AL" degli altri filtri: su
   un calendario si sceglie una data alla volta e non si vede
   dove cadono i tornei, qui invece l'intervallo è una cosa sola
   e i puntini sulla pista dicono subito dove sono i tornei.

   Mobile e desktop usano lo stesso codice: i Pointer Events
   coprono dito, mouse e penna insieme. Quello che cambia è solo
   la taglia delle maniglie (più grandi al tocco) e il fatto che
   si può trascinare anche toccando la pista, non solo la
   maniglia — al dito centrare un cerchietto è scomodo.

   FLUIDITÀ — due velocità
   I filtri si aggiornano MENTRE si trascina: la lista e i pin
   seguono la maniglia, non aspettano che la si molli. Il rischio,
   però, è quello di prima: ricalcolare tutta la pagina ad ogni
   pixel rendeva il gesto a scatti — non era lo slider a essere
   lento, era il resto che si ridisegnava sotto al dito sessanta
   volte al secondo.

   Quindi le due cose viaggiano a velocità diverse:
     • le maniglie, i fumetti e i puntini stanno in una "bozza"
       locale e seguono il dito ad ogni frame, senza passare dai
       filtri;
     • i filtri veri vengono avvisati al massimo ogni
       COMMIT_TRASCINAMENTO_MS, e dentro startTransition — React
       li tratta come lavoro rimandabile e li interrompe se nel
       frattempo il dito si è mosso ancora. Il gesto ha sempre la
       precedenza sul ricalcolo.
   Al rilascio parte l'ultimo aggiornamento, questa volta urgente.
   Da tastiera il valore esce poco dopo l'ultimo tasto, così
   tenendo premuta una freccia non si ricalcola a raffica.

   Props:
     minIso, maxIso  estremi della pista (ISO YYYY-MM-DD)
     fromIso, toIso  valori correnti, già dentro gli estremi
     onChange(from, to)
     todayIso        per il segnaposto "oggi" (se dentro la pista)
     dates           date dei tornei, per i puntini
--------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/* Quanto aspettare, dopo l'ultimo tasto, prima di far uscire il
   valore. Solo per la tastiera: tenendo premuta una freccia i
   giorni scorrono e non ha senso rifiltrare ad ognuno. */
const COMMIT_TASTIERA_MS = 220;

/* Ogni quanto, al massimo, i filtri vengono aggiornati durante il
   trascinamento. Sotto i ~100ms l'occhio non distingue più i
   singoli aggiornamenti (la lista sembra seguire il dito), sopra si
   inizia a notare il ritardo. È un tetto, non un ritardo: il primo
   aggiornamento parte subito. */
const COMMIT_TRASCINAMENTO_MS = 90;

/* Spazio minimo fra i due fumetti: sotto questa distanza si
   sfalsano in verticale invece di stare sulla stessa riga. */
const GAP_FUMETTI = 8;

/* Dove cade "oggi" sulla pista, in percentuale.

   La scala non è lineare: il passato sta tutto nella metà sinistra
   e il futuro tutto nella destra, qualunque sia la loro durata in
   giorni. Serve perché è nel futuro che si sceglie davvero — i
   tornei a cui iscriversi sono lì — e con una scala lineare i
   prossimi due mesi finivano schiacciati in un angolo mentre mezza
   pista se la prendeva un archivio che si guarda di rado. */
const PERNO_OGGI = 50;

/* Le due conversioni giorno ⇄ percentuale, che devono restare
   l'una l'inversa dell'altra: la prima disegna, la seconda legge
   la posizione del dito.

   Quando "oggi" non sta in mezzo agli estremi (nessun torneo
   passato, o nessuno futuro) la spezzata non ha senso — metà pista
   coprirebbe zero giorni — e si torna alla scala lineare. */
export function percentualeDaGiorno(giorno, minDay, todayDay, maxDay) {
  const span = Math.max(1, maxDay - minDay);

  if (!(todayDay > minDay && todayDay < maxDay)) {
    return ((giorno - minDay) / span) * 100;
  }

  if (giorno <= todayDay) {
    return ((giorno - minDay) / (todayDay - minDay)) * PERNO_OGGI;
  }

  return PERNO_OGGI
    + ((giorno - todayDay) / (maxDay - todayDay)) * (100 - PERNO_OGGI);
}

export function giornoDaPercentuale(percentuale, minDay, todayDay, maxDay) {
  const span = Math.max(1, maxDay - minDay);

  if (!(todayDay > minDay && todayDay < maxDay)) {
    return minDay + (percentuale / 100) * span;
  }

  if (percentuale <= PERNO_OGGI) {
    return minDay + (percentuale / PERNO_OGGI) * (todayDay - minDay);
  }

  return todayDay
    + ((percentuale - PERNO_OGGI) / (100 - PERNO_OGGI)) * (maxDay - todayDay);
}

/* Le date sono ISO senza fuso: le tratto come giorni interi in UTC,
   così l'ora legale non sposta mai un torneo di un giorno. */
export function giornoDaIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function isoDaGiorno(giorno) {
  return new Date(giorno * DAY_MS).toISOString().slice(0, 10);
}

function formatta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESI_BREVI[m - 1]} ${y}`;
}

function clamp(valore, min, max) {
  return Math.min(Math.max(valore, min), max);
}

/* ---------------------------------------------------------
   Geometria verticale (px dentro .drs-inner), dall'alto:
      0 → 23   fumetto ALZATO (solo quando i due si sfalsano)
     27 → 57   fumetti a riposo, con la punta
     58 → 88   maniglie (26px, 30px al tocco) centrate sulla pista
     70 → 76   pista
     57 → 89   riga verticale del segnaposto "oggi"
     91 → 107  etichetta "oggi"
   Totale 108px. I 27px in cima sono lo spazio in cui sale il
   fumetto quando le due date sono vicine: sta lì vuoto il resto
   del tempo, ma è l'unico modo di avere lo sfalsamento verticale
   senza che il fumetto esca dal riquadro dei filtri.
--------------------------------------------------------- */
const CSS = `
.drs {
  position: relative;
  /* Padding laterale: le maniglie agli estremi (0% e 100%) sono
     centrate sul bordo della pista, quindi metà cerchio starebbe
     fuori. Il padding gli fa spazio, e ci fa stare anche il
     fumetto della data quando è tutto a sinistra o a destra. */
  padding: 0 34px;
  user-select: none;
}

.drs-inner {
  position: relative;
  height: 108px;
  overflow: visible;
}

.drs-bubble {
  --drs-bubble-y: 0px;
  --drs-bubble-scale: 0.94;

  position: absolute;
  top: 27px;
  left: 0;
  min-width: 88px;
  text-align: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: ${INK};
  color: #fff8ef;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 8px 20px rgba(34, 48, 31, 0.16);

  /* --drs-bubble-dx e' lo scostamento laterale che tiene il fumetto
     dentro al riquadro quando la maniglia e' vicina a un estremo.
     Lo calcola il layout effect, che sa quanto e' largo davvero una
     volta scritta la data dentro. La punta lo annulla e resta
     agganciata alla maniglia. */
  transform:
    translateX(-50%)
    translateX(var(--drs-bubble-dx, 0px))
    translateY(var(--drs-bubble-y))
    scale(var(--drs-bubble-scale));

  /* Solo il top e' in transizione: e' il movimento verticale
     dello sfalsamento a dover essere morbido. La posizione
     orizzontale invece deve restare incollata alla maniglia, quindi
     il left non e' mai in transizione. */
  transition:
    top 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 90ms ease,
    box-shadow 90ms ease;

  white-space: nowrap;
  max-width: 100%;
  z-index: 20;
  pointer-events: none;
}

.drs-bubble.is-active {
  --drs-bubble-y: -1px;
  --drs-bubble-scale: 1.05;
  box-shadow: 0 12px 28px rgba(34, 48, 31, 0.28);
}

/* Il fumetto che sale quando i due sono troppo vicini per stare
   sulla stessa riga. Sale sempre quello NON in mano: la data che
   si sta muovendo resta al suo posto, sotto il dito. */
.drs-bubble.is-alzato {
  top: 0;
}

/* Mentre si trascina resta in transizione solo il top: lo
   scostamento orizzontale fa parte della transform, e smussarlo
   vorrebbe dire vedere il fumetto arrivare in ritardo sulla
   maniglia. Lo sfalsamento verticale invece deve restare morbido
   anche in mezzo al gesto — è il momento in cui succede. */
.drs-inner.is-dragging .drs-bubble {
  transition: top 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.drs-inner.is-dragging .drs-handle {
  transition: none;
}

.drs-bubble-tip {
  position: absolute;
  /* La punta resta sulla maniglia anche quando il fumetto e' stato
     scostato per non sovrapporsi all'altro: annullo lo scostamento.
     Diviso per la scala del fumetto perche' la punta sta nelle sue
     coordinate: senza, lo scostamento verrebbe rimpicciolito (o
     ingrandito) insieme al resto e la punta resterebbe indietro di
     qualche pixel proprio quando e' scostata di piu'. */
  left: calc(50% - var(--drs-bubble-dx, 0px) / var(--drs-bubble-scale, 1));
  bottom: -6px;
  width: 14px;
  height: 8px;
  transform: translateX(-50%);
  color: ${INK};
  pointer-events: none;
}

/* Fascia invisibile attorno alla pista: allarga la zona in cui il
   tocco "prende" (la pista da sola è alta 6px, impossibile da
   centrare col dito). */
.drs-hit {
  position: absolute;
  left: 0;
  right: 0;
  top: 53px;
  height: 40px;
  z-index: 2;
  cursor: pointer;
  touch-action: none;
}

.drs-track {
  position: absolute;
  left: 0;
  right: 0;
  top: 70px;
  height: 6px;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.12);
  z-index: 1;
}

.drs-track-active {
  position: absolute;
  top: 68px;
  height: 10px;
  border-radius: 999px;
  background: ${SUN};
  box-shadow: 0 6px 16px rgba(245, 165, 36, 0.4);
  z-index: 2;
  pointer-events: none;
}

.drs-dot {
  position: absolute;
  top: 73px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.28);
  width: 4px;
  height: 4px;
  transition:
    width 160ms ease,
    height 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
  z-index: 3;
  pointer-events: none;
}

.drs-dot.is-in {
  width: 5px;
  height: 5px;
  background: ${INK};
  box-shadow: 0 0 0 5px rgba(245, 165, 36, 0.5);
}

.drs-handle {
  position: absolute;
  top: 73px;
  left: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 999px;
  border: 3px solid ${INK};
  background: ${SUN};
  box-shadow:
    0 6px 14px rgba(34, 48, 31, 0.2),
    inset 0 0 0 3px rgba(255, 255, 255, 0.36);
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 10;
  touch-action: none;
  transition: transform 90ms ease, box-shadow 90ms ease;
}

.drs-handle:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.drs-handle.is-active,
.drs-handle:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.16);
  box-shadow:
    0 10px 26px rgba(34, 48, 31, 0.34),
    inset 0 0 0 3px rgba(255, 255, 255, 0.5);
}

.drs-handle:focus-visible {
  outline: 3px solid rgba(245, 165, 36, 0.55);
  outline-offset: 3px;
}

.drs-today {
  position: absolute;
  top: 57px;
  left: 0;
  transform: translateX(-50%);
  z-index: 4;
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  font-family: inherit;
  color: ${INK};
  cursor: pointer;
}

.drs-today-line {
  /* display:block perché è uno <span>: senza, larghezza e altezza
     verrebbero ignorate e il segnaposto collasserebbe a niente. */
  display: block;
  width: 2px;
  height: 32px;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.42);
  margin: 0 auto;
  transition: background 140ms ease;
}

.drs-today-text {
  display: block;
  position: absolute;
  top: 34px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.08);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.75;
  white-space: nowrap;
  transition: background 140ms ease, opacity 140ms ease, transform 140ms ease;
}

.drs-today:hover .drs-today-line {
  background: ${INK};
}

.drs-today:hover .drs-today-text {
  opacity: 1;
  background: rgba(245, 165, 36, 0.55);
  transform: translateX(-50%) scale(1.04);
}

.drs-today:active .drs-today-text {
  transform: translateX(-50%) scale(0.97);
}

@media (max-width: 640px) {
  .drs {
    padding: 0 30px;
  }

  .drs-bubble {
    min-width: 78px;
    padding: 5px 8px;
    font-size: 11.5px;
  }

  /* Al dito serve un bersaglio più grande di quello del mouse. */
  .drs-handle {
    width: 30px;
    height: 30px;
  }

  .drs-dot {
    width: 3px;
    height: 3px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drs-bubble,
  .drs-handle,
  .drs-dot,
  .drs-today-line,
  .drs-today-text {
    transition: none;
  }
}
`;

function Punta() {
  return (
    <svg className="drs-bubble-tip" viewBox="0 0 16 9" aria-hidden="true">
      <path
        d="M1.4 0.2H14.6C15.25 0.2 15.55 1 15.08 1.45L9.15 7.55C8.5 8.22 7.5 8.22 6.85 7.55L0.92 1.45C0.45 1 0.75 0.2 1.4 0.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* I puntini non si spostano mai: le loro posizioni dipendono solo
   dalle date dei tornei. Li tengo in un componente memoizzato così
   React non li ripercorre ad ogni pixel di trascinamento; a
   cambiare, durante il gesto, è solo la classe "dentro
   l'intervallo", e quella la mette il layout effect direttamente
   sul DOM. È la differenza fra ridisegnare cinque nodi per frame e
   ridisegnarne cinquanta. */
const Puntini = memo(function Puntini({ posizioni }) {
  return (
    <>
      {posizioni.map((p) => (
        <div
          key={p.giorno}
          className="drs-dot"
          data-giorno={p.giorno}
          style={{ left: `${p.pct}%` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
});

/* Rientro nel riquadro: quanto spostare un fumetto perché non esca
   dal pannello dei filtri quando la sua maniglia è vicina a un
   estremo. Solo i bordi — la collisione FRA i due fumetti si
   risolve in verticale (uno sale), non spostandoli di lato.

   Zero quasi sempre: serve solo negli ultimi pixel della pista. */
export function scostamentoBordo(x, w, larghezza, padSx, padDx) {
  const min = w / 2 - padSx;
  const max = larghezza + padDx - w / 2;

  // Fumetto più largo dello spazio disponibile: lo lascio centrato
  // sulla maniglia invece di incastrarlo storto.
  if (max < min) return 0;

  return clamp(x, min, max) - x;
}

/* I due fumetti stanno sulla stessa riga? Il confronto è sulle
   posizioni FINALI, quelle dopo il rientro nel riquadro: due
   fumetti spinti insieme contro un bordo si sovrapporrebbero
   anche se le maniglie sono lontane. */
export function troppoVicini(centroA, wA, centroB, wB) {
  return centroB - centroA < wA / 2 + wB / 2 + GAP_FUMETTI;
}

export default function DateRangeSlider({
  minIso,
  maxIso,
  fromIso,
  toIso,
  onChange,
  todayIso,
  dates = [],
}) {
  const innerRef = useRef(null);
  const fromBubbleRef = useRef(null);
  const toBubbleRef = useRef(null);

  /* Quale maniglia è "in mano": serve per lo stile (quella attiva è
     più grande) e per sapere se c'è un gesto in corso. */
  const [attiva, setAttiva] = useState(null);
  const trascinaRef = useRef(null);

  /* Larghezza della pista. È uno stato e non una misura al volo
     perché al ridimensionamento della finestra il componente deve
     ridisegnarsi (i fumetti vanno riposizionati). */
  const [larghezza, setLarghezza] = useState(0);

  /* Padding del contenitore: lo leggo una volta e ad ogni resize,
     non ad ogni frame. getComputedStyle costringe il browser a
     ricalcolare il layout sul momento, e in mezzo a un
     trascinamento è proprio il genere di lavoro da non fare. */
  const padRef = useRef({ sx: 0, dx: 0 });

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return undefined;

    const misura = () => {
      setLarghezza(el.clientWidth);

      const contenitore = el.parentElement;
      if (!contenitore) return;
      const stile = window.getComputedStyle(contenitore);
      padRef.current = {
        sx: parseFloat(stile.paddingLeft) || 0,
        dx: parseFloat(stile.paddingRight) || 0,
      };
    };

    misura();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', misura);
      return () => window.removeEventListener('resize', misura);
    }

    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const minDay = giornoDaIso(minIso);
  const maxDay = giornoDaIso(maxIso);
  const todayDay = giornoDaIso(todayIso);

  const fromProp = clamp(giornoDaIso(fromIso) ?? minDay, minDay, maxDay);
  const toProp = clamp(giornoDaIso(toIso) ?? maxDay, fromProp, maxDay);

  /* La bozza: i valori mentre li si sta muovendo, prima che escano
     verso i filtri. `null` = nessun gesto in corso, comandano le
     props. Il ref affianca lo stato perché i gestori di evento
     leggerebbero un valore vecchio (sono registrati su window e si
     portano dietro la closure del render in cui sono nati). */
  const [bozza, setBozza] = useState(null);
  const bozzaRef = useRef(null);
  const commitRef = useRef(null);

  /* Quando i filtri sono stati avvisati l'ultima volta, e il timer
     che li avvisa a fine raffica: insieme fanno il tetto di un
     aggiornamento ogni COMMIT_TRASCINAMENTO_MS senza perdere
     l'ultima posizione del dito. */
  const ultimoInvioRef = useRef(0);
  const liveRef = useRef(null);

  const fromDay = bozza ? bozza.from : fromProp;
  const toDay = bozza ? bozza.to : toProp;

  /* Le props più recenti, lette dai gestori di evento senza doverli
     ricreare (e ri-registrare) ad ogni render. */
  const statoRef = useRef(null);
  statoRef.current = { fromProp, toProp, minDay, maxDay, todayDay, onChange };

  /* Consegna il valore ai filtri. Da qui in poi la pagina si
     ricalcola: lista, conteggio, pin della mappa.

     `urgente` distingue i due momenti. Durante il trascinamento
     no: l'aggiornamento entra in startTransition, così React lo
     considera lavoro rimandabile e lo lascia indietro se nel
     frattempo arriva un altro movimento — la maniglia non aspetta
     mai la lista. Alla fine del gesto sì: il dito è fermo, tanto
     vale finire subito, e serve che le props siano aggiornate nello
     stesso batch in cui la bozza viene buttata (se no la maniglia
     tornerebbe per un frame al valore vecchio). */
  const notifica = useCallback((valori, urgente) => {
    if (!valori) return;

    const { fromProp: f, toProp: t, onChange: avvisa } = statoRef.current;
    if (!avvisa) return;
    if (valori.from === f && valori.to === t) return;

    ultimoInvioRef.current = performance.now();

    const da = isoDaGiorno(valori.from);
    const a = isoDaGiorno(valori.to);

    if (urgente) avvisa(da, a);
    else startTransition(() => avvisa(da, a));
  }, []);

  /* Fine di un'interazione: ultimo invio e via la bozza, da qui in
     poi comandano di nuovo le props. */
  const conferma = useCallback(() => {
    window.clearTimeout(commitRef.current);
    window.clearTimeout(liveRef.current);

    const valori = bozzaRef.current;
    bozzaRef.current = null;
    setBozza(null);

    notifica(valori, true);
  }, [notifica]);

  /* Aggiorna la bozza e decide quando consegnarla:
       'live'      subito, ma non più di una volta ogni
                   COMMIT_TRASCINAMENTO_MS (trascinamento)
       'differito' poco dopo l'ultimo tasto (tastiera)
       'subito'    click singoli (segnaposto "oggi") */
  const aggiorna = useCallback((nuovoFrom, nuovoTo, quando) => {
    const { minDay: min, maxDay: max } = statoRef.current;

    const f = clamp(nuovoFrom, min, max);
    const t = clamp(nuovoTo, min, max);
    const valori = f <= t ? { from: f, to: t } : { from: t, to: f };

    const prima = bozzaRef.current;
    const invariato = prima
      ? prima.from === valori.from && prima.to === valori.to
      : valori.from === statoRef.current.fromProp && valori.to === statoRef.current.toProp;

    if (invariato) return;

    bozzaRef.current = valori;
    setBozza(valori);

    if (quando === 'subito') {
      conferma();
      return;
    }

    if (quando === 'differito') {
      window.clearTimeout(commitRef.current);
      commitRef.current = window.setTimeout(conferma, COMMIT_TASTIERA_MS);
      return;
    }

    /* 'live': il primo movimento fa filtrare subito, i successivi
       non più spesso del tetto. Il timer finale serve a non
       perdere l'ultima posizione quando il dito si ferma dentro
       la finestra: senza, la lista resterebbe indietro di un
       aggiornamento fino al rilascio. */
    const trascorso = performance.now() - ultimoInvioRef.current;
    window.clearTimeout(liveRef.current);

    if (trascorso >= COMMIT_TRASCINAMENTO_MS) {
      notifica(valori, false);
      return;
    }

    liveRef.current = window.setTimeout(
      () => notifica(bozzaRef.current, false),
      COMMIT_TRASCINAMENTO_MS - trascorso,
    );
  }, [conferma, notifica]);

  // Timer in sospeso allo smontaggio: niente conferme fantasma.
  useEffect(() => () => {
    window.clearTimeout(commitRef.current);
    window.clearTimeout(liveRef.current);
  }, []);

  const pct = useCallback(
    (giorno) => percentualeDaGiorno(giorno, minDay, todayDay, maxDay),
    [minDay, todayDay, maxDay],
  );

  const fromPct = pct(fromDay);
  const toPct = pct(toDay);

  const giornoDaX = useCallback((clientX) => {
    const el = innerRef.current;
    const { minDay: min, todayDay: oggiG, maxDay: max } = statoRef.current;
    if (!el) return min;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return min;

    const x = clamp(clientX - rect.left, 0, rect.width);
    return Math.round(giornoDaPercentuale((x / rect.width) * 100, min, oggiG, max));
  }, []);

  /* Il trascinamento, agganciato al frame.

     I pointermove arrivano più fitti dei frame (su schermi a 120Hz,
     o quando il browser accumula eventi): rispondere ad ognuno
     sarebbe lavoro buttato. Tengo l'ultima X e aggiorno una volta
     per frame, che è il ritmo con cui lo schermo può davvero
     mostrare qualcosa. */
  const ultimaXRef = useRef(0);
  const rafRef = useRef(null);

  const applicaFrame = useCallback(() => {
    rafRef.current = null;

    const quale = trascinaRef.current;
    if (!quale) return;

    const giorno = giornoDaX(ultimaXRef.current);
    const attuale = bozzaRef.current
      ?? { from: statoRef.current.fromProp, to: statoRef.current.toProp };

    /* Le maniglie non si scavalcano: la sinistra si ferma sulla
       destra e viceversa. Senza questo, un trascinamento veloce
       invertirebbe l'intervallo a metà gesto. */
    if (quale === 'from') aggiorna(Math.min(giorno, attuale.to), attuale.to, 'live');
    else aggiorna(attuale.from, Math.max(giorno, attuale.from), 'live');
  }, [giornoDaX, aggiorna]);

  /* I listener stanno su window e non sulla maniglia: il dito (o il
     mouse) esce quasi sempre dal cerchietto mentre trascina, e su
     window il gesto continua a essere seguito lo stesso. Vivono
     solo durante il trascinamento, e le loro dipendenze sono tutte
     stabili: si registrano all'inizio del gesto e si tolgono alla
     fine, mai nel mezzo. */
  useEffect(() => {
    if (!attiva) return undefined;

    const onMove = (e) => {
      ultimaXRef.current = e.clientX;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(applicaFrame);
      }
    };

    const onUp = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      trascinaRef.current = null;
      setAttiva(null);
      // Fine del gesto: adesso il valore può uscire verso i filtri.
      conferma();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [attiva, applicaFrame, conferma]);

  function iniziaTrascinamento(quale, e) {
    e.preventDefault();
    ultimaXRef.current = e.clientX;
    trascinaRef.current = quale;
    setAttiva(quale);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  /* Tocco sulla pista: si muove la maniglia più vicina e da lì il
     gesto continua come un trascinamento normale.

     Fuori dall'intervallo la "più vicina" è decisa dal lato, non
     dalla distanza: un tocco a destra della maniglia destra muove
     quella, sempre. Serve soprattutto quando le due maniglie sono
     sovrapposte (intervallo di un giorno solo): a pari distanza
     vincerebbe sempre la sinistra, che però non può spostarsi oltre
     la destra, e il tocco sembrerebbe non fare niente. */
  function toccoSullaPista(e) {
    const giorno = giornoDaX(e.clientX);

    let quale;
    if (giorno <= fromDay) quale = 'from';
    else if (giorno >= toDay) quale = 'to';
    else quale = giorno - fromDay <= toDay - giorno ? 'from' : 'to';

    if (quale === 'from') aggiorna(Math.min(giorno, toDay), toDay, 'live');
    else aggiorna(fromDay, Math.max(giorno, fromDay), 'live');

    iniziaTrascinamento(quale, e);
  }

  function tasti(quale, e) {
    const passo = e.shiftKey ? 7 : 1;
    let delta = 0;

    if (e.key === 'ArrowLeft') delta = -passo;
    else if (e.key === 'ArrowRight') delta = passo;
    else if (e.key === 'PageDown') delta = -7;
    else if (e.key === 'PageUp') delta = 7;
    else if (e.key === 'Home') {
      e.preventDefault();
      if (quale === 'from') aggiorna(minDay, toDay, 'differito');
      else aggiorna(fromDay, fromDay, 'differito');
      return;
    } else if (e.key === 'End') {
      e.preventDefault();
      if (quale === 'from') aggiorna(toDay, toDay, 'differito');
      else aggiorna(fromDay, maxDay, 'differito');
      return;
    }

    if (delta === 0) return;

    e.preventDefault();
    setAttiva(quale);

    if (quale === 'from') aggiorna(clamp(fromDay + delta, minDay, toDay), toDay, 'differito');
    else aggiorna(fromDay, clamp(toDay + delta, fromDay, maxDay), 'differito');
  }

  /* Puntini dei tornei. Deduplico i giorni: dieci tornei lo stesso
     weekend darebbero dieci puntini sovrapposti, e il DOM se li
     porterebbe dietro per niente. */
  const puntini = useMemo(() => {
    const giorni = new Set();
    for (const iso of dates) {
      const g = giornoDaIso(iso);
      if (g == null || g < minDay || g > maxDay) continue;
      giorni.add(g);
    }
    return Array.from(giorni).map((giorno) => ({
      giorno,
      pct: percentualeDaGiorno(giorno, minDay, todayDay, maxDay),
    }));
  }, [dates, minDay, todayDay, maxDay]);

  const mostraOggi =
    todayDay != null && todayDay >= minDay && todayDay <= maxDay;

  /* Ritocchi dopo ogni render (niente array di dipendenze: le
     posizioni cambiano ad ogni movimento e la data scritta dentro
     al fumetto può cambiare larghezza):
       • scosto i fumetti quel tanto che basta perché non si
         sovrappongano fra loro né escano dal riquadro;
       • accendo i puntini dentro l'intervallo.
     Tutto scritto direttamente sul DOM: sono ritocchi visivi, e
     passare per lo stato vorrebbe dire un render in più per ogni
     frame di trascinamento. */
  const ultimoIntervalloRef = useRef(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const fumettoA = fromBubbleRef.current;
    const fumettoB = toBubbleRef.current;
    if (!inner || !fumettoA || !fumettoB) return;

    if (larghezza > 0) {
      const xA = (fromPct / 100) * larghezza;
      const xB = (toPct / 100) * larghezza;
      const wA = fumettoA.offsetWidth;
      const wB = fumettoB.offsetWidth;

      const dxA = scostamentoBordo(xA, wA, larghezza, padRef.current.sx, padRef.current.dx);
      const dxB = scostamentoBordo(xB, wB, larghezza, padRef.current.sx, padRef.current.dx);

      fumettoA.style.setProperty('--drs-bubble-dx', `${dxA}px`);
      fumettoB.style.setProperty('--drs-bubble-dx', `${dxB}px`);

      /* Date vicine: uno dei due sale, così restano leggibili
         entrambi. Sale quello NON in mano — la data che si sta
         muovendo resta dov'è, sotto il dito. A riposo (nessuna
         maniglia in mano) sale quella di fine. */
      const vicini = troppoVicini(xA + dxA, wA, xB + dxB, wB);

      fumettoA.classList.toggle('is-alzato', vicini && attiva === 'to');
      fumettoB.classList.toggle('is-alzato', vicini && attiva !== 'to');
    }

    // I puntini cambiano solo quando cambia l'intervallo: se le
    // maniglie non hanno scavalcato nessuna data, salto il giro.
    const precedente = ultimoIntervalloRef.current;
    if (precedente && precedente.from === fromDay && precedente.to === toDay) return;
    ultimoIntervalloRef.current = { from: fromDay, to: toDay };

    for (const dot of inner.querySelectorAll('.drs-dot')) {
      const g = Number(dot.dataset.giorno);
      dot.classList.toggle('is-in', g >= fromDay && g <= toDay);
    }
  });

  return (
    <div className="drs">
      <style>{CSS}</style>

      <div className={`drs-inner ${attiva ? 'is-dragging' : ''}`} ref={innerRef}>
        <div
          ref={fromBubbleRef}
          className={`drs-bubble ${attiva === 'from' ? 'is-active' : ''}`}
          style={{ left: `${fromPct}%` }}
        >
          {formatta(isoDaGiorno(fromDay))}
          <Punta />
        </div>

        <div
          ref={toBubbleRef}
          className={`drs-bubble ${attiva === 'to' ? 'is-active' : ''}`}
          style={{ left: `${toPct}%` }}
        >
          {formatta(isoDaGiorno(toDay))}
          <Punta />
        </div>

        <div className="drs-track" />
        <div
          className="drs-track-active"
          style={{ left: `${fromPct}%`, width: `${Math.max(0, toPct - fromPct)}%` }}
        />
        <div className="drs-hit" onPointerDown={toccoSullaPista} aria-hidden="true" />

        <Puntini posizioni={puntini} />

        {mostraOggi && (
          <button
            type="button"
            className="drs-today"
            style={{ left: `${pct(todayDay)}%` }}
            onClick={() => aggiorna(todayDay, Math.max(todayDay, toDay), 'subito')}
            title="Riporta l'inizio a oggi"
            aria-label="Riporta l'inizio a oggi"
          >
            <span className="drs-today-line" />
            <span className="drs-today-text">oggi</span>
          </button>
        )}

        <button
          type="button"
          role="slider"
          className={`drs-handle ${attiva === 'from' ? 'is-active' : ''}`}
          style={{ left: `${fromPct}%`, zIndex: fromDay === maxDay ? 12 : 10 }}
          onPointerDown={(e) => iniziaTrascinamento('from', e)}
          onKeyDown={(e) => tasti('from', e)}
          onBlur={() => {
            setAttiva((v) => (v === 'from' ? null : v));
            conferma();
          }}
          aria-label="Data iniziale"
          aria-valuemin={minDay}
          aria-valuemax={toDay}
          aria-valuenow={fromDay}
          aria-valuetext={formatta(isoDaGiorno(fromDay))}
        />

        <button
          type="button"
          role="slider"
          className={`drs-handle ${attiva === 'to' ? 'is-active' : ''}`}
          style={{ left: `${toPct}%`, zIndex: 11 }}
          onPointerDown={(e) => iniziaTrascinamento('to', e)}
          onKeyDown={(e) => tasti('to', e)}
          onBlur={() => {
            setAttiva((v) => (v === 'to' ? null : v));
            conferma();
          }}
          aria-label="Data finale"
          aria-valuemin={fromDay}
          aria-valuemax={maxDay}
          aria-valuenow={toDay}
          aria-valuetext={formatta(isoDaGiorno(toDay))}
        />
      </div>
    </div>
  );
}