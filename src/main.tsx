import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { runAppBootstrap } from './appBootstrap'
import { resolveAppEntry } from './lib/appEntry'

runAppBootstrap()

const entry = resolveAppEntry()

async function bootstrap() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  if (entry === 'liff') {
    const { default: AppLiff } = await import('./AppLiff')
    createRoot(rootEl).render(
      <StrictMode>
        <AppLiff />
      </StrictMode>,
    )
    return
  }

  if (entry === 'public-book') {
    const { default: AppPublicBook } = await import('./AppPublicBook')
    createRoot(rootEl).render(
      <StrictMode>
        <AppPublicBook />
      </StrictMode>,
    )
    return
  }

  if (entry === 'public-guide') {
    const { default: AppPublicGuide } = await import('./AppPublicGuide')
    createRoot(rootEl).render(
      <StrictMode>
        <AppPublicGuide />
      </StrictMode>,
    )
    return
  }

  const { default: App } = await import('./App')
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  if (import.meta.env.PROD) {
    void import('@sentry/react').then(Sentry => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN || '',
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        beforeSend(event, hint) {
          const error = hint.originalException as Error
          if (error?.message?.includes('Network') || error?.message?.includes('Failed to fetch')) {
            return null
          }
          if (error?.name === 'AbortError') {
            return null
          }
          return event
        },
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.category === 'console' && breadcrumb.level !== 'error') {
            return null
          }
          return breadcrumb
        },
      })
    })
  }
}

void bootstrap()
