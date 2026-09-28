import { StrictMode } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { initializeStorage } from './platform/storage'

async function start() {
  try {
    await initializeStorage()
  } catch {
    // Keep the new tab usable when extension storage is temporarily unavailable.
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Analytics />
    </StrictMode>,
  )
}

void start()
