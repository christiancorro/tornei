import React from 'react';
import { INK } from '../theme';

export default function Footer() {
  return (
    <div className="text-center text-xs pb-8 px-4 space-y-2" style={{ color: INK, opacity: 0.6 }}>
      <p>
        TorneiFVG nasce da un progetto personale di Christian Corrò per aiutare giocatori e organizzatori a trovare e condividere tornei di volley in Friuli Venezia Giulia e dintorni.
      </p>
      <p>
        Se il progetto ti è utile e vuoi supportarne lo sviluppo puoi offrire un piccolo contributo:
      </p>
      <a
        href="https://paypal.me/christiancorro?locale.x=it_IT&country.x=IT"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center mt-4 px-4 py-2 rounded-full font-regular text-sm transition-all hover:scale-101"
        style={{
          backgroundColor: "#fff5e1",
          color: "#242424",
        }}
      >
        Supporta torneiFVG ❤️
      </a>
    </div>
  );
}
