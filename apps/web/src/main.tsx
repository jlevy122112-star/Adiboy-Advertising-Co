import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { PrivacyPolicy } from './legal/PrivacyPolicy.tsx'
import { TermsOfService } from './legal/TermsOfService.tsx'

function getHash() {
  return window.location.hash.replace(/^#\/?/, '').toLowerCase()
}

function Root() {
  const [hash, setHash] = useState(getHash)

  useEffect(() => {
    function onHash() { setHash(getHash()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function goBack() {
    window.location.hash = ''
  }

  if (hash === 'privacy')          return <PrivacyPolicy onBack={goBack} />
  if (hash === 'terms')            return <TermsOfService onBack={goBack} />
  if (hash === 'billing-success')  {
    window.location.hash = 'pricing'
    return null
  }

  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
