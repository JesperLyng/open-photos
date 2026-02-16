import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PublicSharePage } from './components/PublicSharePage'

const isPublicShareRoute = window.location.pathname.startsWith("/share/");

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPublicShareRoute ? <PublicSharePage /> : <App />}
  </StrictMode>,
)
