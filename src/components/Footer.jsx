import React from 'react';
import { INK } from '../theme';

/* ---------------------------------------------------------
   Il footer racconta cos'è il sito e chi lo ha fatto.

   Lo stesso testo sta in DESCRIZIONE_SITO nel Worker
   (src/contenuto.js), che lo inietta nell'HTML iniziale. La
   duplicazione è voluta: quello che leggono i crawler dev'essere
   l'anticipo di qualcosa che l'utente vede davvero. Un testo che
   esistesse solo nella versione iniettata sarebbe scritto per i
   soli motori — hidden text — ed è la cosa che Google penalizza
   più volentieri. Se cambi qui, cambia anche là.

   Serve anche a rispondere a due domande che i motori AI fanno
   di continuo e a cui il sito finora non sapeva rispondere:
   che cos'è volleyfvg, e chi c'è dietro.
--------------------------------------------------------- */
export default function Footer() {
  return (
    <footer
      className="px-5 pb-10 pt-4 mx-auto max-w-2xl text-sm leading-relaxed space-y-3"
      style={{ color: INK, opacity: 0.62 }}
    >
      {/* <h2 className="text-base font-semibold" style={{ opacity: 0.9 }}>
        Che cos&rsquo;è Volley FVG
      </h2>

      <p>
        Volley FVG è un calendario aperto dei tornei amatoriali di green volley,
        beach volley e pallavolo in Friuli Venezia Giulia e nelle province vicine.
        Ogni torneo ha la sua pagina con data, orario, luogo, formato di gioco,
        costo di iscrizione, locandina e i contatti di chi lo organizza; l&rsquo;elenco
        si sfoglia in lista, sulla mappa o nel calendario.
      </p>

      <p>
        Pubblicare un torneo è gratuito: la proposta viene controllata prima di
        comparire in calendario, così l&rsquo;elenco resta pulito. Nella bacheca si può
        invece cercare una squadra a cui unirsi, oppure cercare giocatori per
        completare la propria.
      </p>

      <p>
        Volley FVG è ideato e realizzato da Christian Corrò, dottorando
        all&rsquo;Università degli Studi di Udine. È un progetto indipendente, nato per
        raccogliere in un posto solo i tornei che altrimenti restano sparsi fra
        volantini, storie di Instagram e passaparola.
      </p> */}
    </footer>
  );
}