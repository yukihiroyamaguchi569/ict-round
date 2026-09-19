import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import MergeApp from './MergeApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MergeApp />
  </StrictMode>,
)
