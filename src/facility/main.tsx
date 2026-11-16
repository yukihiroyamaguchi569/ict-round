import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import FacilityApp from './FacilityApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FacilityApp />
  </StrictMode>,
)
