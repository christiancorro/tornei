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