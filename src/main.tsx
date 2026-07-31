import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App.tsx'
import { installOkfFetch } from './connection/fetch.ts'
import './styles.css'

// Installed before anything renders. The langonrock client reads the global
// fetch when it issues a request, and the browser's own fetch is blocked in
// both local and remote mode because the server sends no CORS headers.
installOkfFetch(tauriFetch)

const container = document.getElementById('root')

if (container === null) {
  throw new Error('no #root element to mount into')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
