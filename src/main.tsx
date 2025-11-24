import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.tsx'

// 初始化 Sentry 錯誤監控
// 只在正式環境啟用（開發時不需要）
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "", // 從環境變數讀取
    environment: import.meta.env.MODE,
    
    // 效能監控（只追蹤 10% 的請求，省配額）
    tracesSampleRate: 0.1,
    
    // 過濾不重要的錯誤
    beforeSend(event, hint) {
      const error = hint.originalException as Error
      
      // 忽略網路錯誤（使用者網路問題不是你的責任）
      if (error?.message?.includes('Network') || 
          error?.message?.includes('Failed to fetch')) {
        return null
      }
      
      // 忽略取消的請求
      if (error?.name === 'AbortError') {
        return null
      }
      
      return event
    },
    
    // 新增額外的上下文資訊
    beforeBreadcrumb(breadcrumb) {
      // 不記錄太詳細的 console.log（節省空間）
      if (breadcrumb.category === 'console' && breadcrumb.level !== 'error') {
        return null
      }
      return breadcrumb
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary 
      fallback={({ error }) => (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7fafc',
          padding: '20px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '48px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>😰</div>
            <h1 style={{ 
              fontSize: '24px',
              fontWeight: '600',
              color: '#1a202c',
              marginBottom: '12px'
            }}>
              系統發生錯誤
            </h1>
            <p style={{ 
              color: '#718096',
              marginBottom: '32px',
              fontSize: '15px',
              lineHeight: '1.6'
            }}>
              很抱歉，系統遇到了一個問題
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
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
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#3182ce'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#4299e1'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                重新整理
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#4299e1',
                  border: '2px solid #4299e1',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#ebf8ff'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white'
                }}
              >
                返回首頁
              </button>
            </div>
            {import.meta.env.DEV && (
              <details style={{ 
                marginTop: '32px',
                textAlign: 'left',
                background: '#f7fafc',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <summary style={{ 
                  cursor: 'pointer',
                  color: '#4a5568',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  🔍 開發者資訊
                </summary>
                <pre style={{ 
                  background: '#edf2f7',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  fontSize: '11px',
                  color: '#2d3748',
                  margin: '8px 0 0 0'
                }}>
                  {(error as Error).stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
