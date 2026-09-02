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

   Le due date sono mostrate in due fumetti FISSI, uno ancorato
   in basso a sinistra e uno in basso a destra della pista — non
   seguono più le maniglie. Questo evita completamente il
   problema (che c'era prima) di due fumetti mobili che si
   sovrappongono o escono dal riquadro quando le maniglie sono
   vicine o agli estremi: da fermi agli angoli non collidono mai,
   quindi non serve calcolare offset né misurare larghezze.

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
       0 -> 35   fumetti fissi: uno a sinistra, uno a destra
                 (8px di padding sopra e sotto + line-height 15px
                 + 2px di bordo per lato)
      40 -> 80   fascia di tocco attorno alla pista
      42 -> 74   riga verticale del segnaposto "oggi"
      57 -> 63   pista
      47 -> 73   maniglie (26px, 30px al tocco) centrate sulla pista
      76 -> 94   etichetta "oggi"
   Totale 99px.
--------------------------------------------------------- */
const CSS = `
.drs {
  position: relative;
  /* Padding laterale: le maniglie agli estremi (0% e 100%) sono
     centrate sul bordo della pista, quindi metà cerchio starebbe
     fuori. Il padding gli fa spazio. */
  padding: 0 16px;
  user-select: none;
}

.drs-inner {
  position: relative;
  height: 99px;
  overflow: visible;
}

/* I due fumetti con le date: fissi in basso, uno per lato. Non
   seguono più le maniglie, quindi non serve nessun calcolo di
   posizione: stanno sempre nello stesso punto e cambia solo il
   testo dentro.

   Padding di 8px sopra e sotto (uguale su mobile e desktop) più
   un line-height in px, non "1": un valore in pixel fissa
   l'altezza della riga di testo indipendentemente dai metrics del
   font, così l'altezza totale del fumetto (8+8 padding + 15
   line-height + 2+2 bordo = 35px) è sempre la stessa e lo scarto
   di 5px verso la fascia di tocco (che parte a 40px, vedi
   geometria sopra) non dipende dal rendering. */
.drs-bubble {
  position: absolute;
  top: 0;
  box-sizing: border-box;
  min-width: 100px;
  text-align: center;
  text-transform: lowercase;
  padding: 8px 9px;
  border-radius: 999px;
  color: ${INK};
  font-size: 13.5px;
  font-weight: 600;
  line-height: 15px;
  border: solid 2px #c5c5bd;
  box-shadow: 0 0px 0px rgba(34, 48, 31, 0.16);
  transition: transform 90ms ease, box-shadow 90ms ease;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
}

/* .drs-inner è inset di 16px rispetto a .drs (il padding che fa
   spazio ai cerchietti delle maniglie a 0% e 100%). I fumetti,
   invece, devono allinearsi al bordo vero del widget, non a
   quello (rientrato) della pista: da qui l'offset negativo pari
   al padding di .drs, ripreso identico nella media query mobile
   dove quel padding scende a 15px. */
.drs-bubble-from {
top:5px;
  left: -6px;
}

.drs-bubble-to {
top:5px;
  right: -10px;
}

/* Il fumetto della maniglia in mano si mette leggermente in
   evidenza, così è chiaro quale valore si sta muovendo anche se
   il fumetto non è più attaccato al dito. */
.drs-bubble.is-active {
  transform: scale(1);
}

/* Fascia invisibile attorno alla pista: allarga la zona in cui il
   tocco "prende" (la pista da sola è alta 6px, impossibile da
   centrare col dito). */
.drs-hit {
  position: absolute;
  left: 0;
  right: 0;
  top: 40px;
  height: 40px;
  z-index: 2;
  cursor: pointer;
  touch-action: none;
}

.drs-track {
  position: absolute;
  left: 0;
  right: 0;
  top: 57px;
  height: 6px;
  border-radius: 999px;
  background: rgba(34, 48, 31, 0.12);
  z-index: 1;
}

.drs-track-active {
  position: absolute;
  top: 56px;
  height: 8px;
  border-radius: 999px;
  background: ${SUN};
  box-shadow: 0 6px 16px rgba(245, 165, 36, 0.4);
  z-index: 2;
  pointer-events: none;
}

.drs-dot {
  position: absolute;
  top: 60px;
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
  box-shadow: 0 0 0 4px rgba(245, 165, 36, 0.5);
}

.drs-handle {
  position: absolute;
  top: 60px;
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

.drs-inner.is-dragging .drs-handle {
  transition: none;
}

.drs-today {
  position: absolute;
  top: 46px;
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
    padding: 0 15px;
  }

  .drs-bubble {
    min-width: 100px;
    padding: 8px;
    font-size: 13px;
  }

  .drs-bubble-from {
    left: -10px;
  }

  .drs-bubble-to {
    right: -12px;
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

  /* Quale maniglia è "in mano": serve per lo stile (quella attiva è
     più grande, e il suo fumetto si mette in evidenza) e per sapere
     se c'è un gesto in corso. */
  const [attiva, setAttiva] = useState(null);
  const trascinaRef = useRef(null);

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

  /* Accende i puntini dentro l'intervallo, scritto direttamente sul
     DOM invece che tramite stato: durante il trascinamento
     cambierebbe ad ogni frame, e passare per lo stato vorrebbe dire
     un render in più ogni volta. Salta il giro se l'intervallo non
     è cambiato (le maniglie possono muoversi di un pixel senza
     scavalcare nessuna data). */
  const ultimoIntervalloRef = useRef(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

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

        <div className={`drs-bubble drs-bubble-from ${attiva === 'from' ? 'is-active' : ''}`}>
          {formatta(isoDaGiorno(fromDay))}
        </div>

        <div className={`drs-bubble drs-bubble-to ${attiva === 'to' ? 'is-active' : ''}`}>
          {formatta(isoDaGiorno(toDay))}
        </div>
      </div>
    </div>
  );
}