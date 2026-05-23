import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { UserProfileProvider } from './context/UserProfileContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <UserProfileProvider>
          <Toaster position="top-right" duration={4000} closeButton richColors />
          <App />
        </UserProfileProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
