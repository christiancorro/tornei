import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.jsx'
import { FeedbackProvider } from './components/FeedbackProvider.jsx'
import 'mapbox-gl/dist/mapbox-gl.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Il provider sta sopra App perché anche App usa confirm()/toast() */}
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </StrictMode>,
)

/* PWA: registro il service worker così il sito è installabile come app
   e funziona offline (vedi public/sw.js). Solo in build di produzione:
   in sviluppo un SW che cacha darebbe fastidio all'hot-reload di Vite. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[pwa] registrazione service worker fallita:', err));
  });
}