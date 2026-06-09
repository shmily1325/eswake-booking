import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { isLiffPathname, runAppBootstrap } from './appBootstrap'

runAppBootstrap()

const isLiffRoute = typeof window !== 'undefined' && isLiffPathname(window.location.pathname)

async function bootstrap() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  if (isLiffRoute) {
    const { default: AppLiff } = await import('./AppLiff')
    createRoot(rootEl).render(
      <StrictMode>
        <AppLiff />
      </StrictMode>,
    )
    return
  }

  const [{ default: App }, Sentry] = await Promise.all([
    import('./App'),
    import('@sentry/react'),
  ])

  if (import.meta.env.PROD) {
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
  }

  createRoot(rootEl).render(
    <StrictMode>
      <Sentry.ErrorBoundary
        fallback={() => (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7fafc',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '48px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>😰</div>
              <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1a202c', marginBottom: '12px' }}>
                系統發生錯誤
              </h1>
              <p style={{ color: '#718096', marginBottom: '32px', fontSize: '15px', lineHeight: '1.6' }}>
                很抱歉，系統遇到了一個問題
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  background: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '500',
                }}
              >
                重新整理
              </button>
            </div>
          </div>
        )}
      >
        <App />
      </Sentry.ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
