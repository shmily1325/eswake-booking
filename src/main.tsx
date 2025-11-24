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
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ color: '#e53e3e' }}>😅 哎呀，出了點問題</h1>
          <p style={{ color: '#666', margin: '20px 0' }}>
            系統發生錯誤，請嘗試刷新頁面
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            刷新頁面
          </button>
          {import.meta.env.DEV && (
            <details style={{ 
              marginTop: '20px', 
              textAlign: 'left',
              maxWidth: '600px',
              margin: '20px auto'
            }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                開發者資訊
              </summary>
              <pre style={{ 
                background: '#f7fafc',
                padding: '10px',
                borderRadius: '5px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {(error as Error).stack}
              </pre>
            </details>
          )}
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
