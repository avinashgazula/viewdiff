import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './routes'
import './app.css'

// Load Monaco setup async — reduces peak memory during build
// and doesn't block initial render (editor loads after shell)
import('./monaco-setup')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
