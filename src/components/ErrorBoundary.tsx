import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })

    this.setState({
      error,
      errorInfo
    })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            padding: '40px',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center'
          }}>
            {/* 錯誤圖標 */}
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px'
            }}>
              😕
            </div>

            <h1 style={{ 
              color: '#2d3748',
              fontSize: '28px',
              marginBottom: '16px',
              fontWeight: '700'
            }}>
              糟糕！出了點問題
            </h1>
            
            <p style={{
              color: '#718096',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '30px'
            }}>
              系統遇到了一個意外錯誤，請嘗試重新整理頁面。<br/>
              如果問題持續發生，請聯繫系統管理員。
            </p>

            {/* 簡化的錯誤訊息（可折疊） */}
            <details style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: '#4a5568',
                fontSize: '14px',
                userSelect: 'none'
              }}>
                🔍 查看技術細節
              </summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#e53e3e',
                fontSize: '13px',
                marginTop: '12px',
                fontFamily: 'monospace'
              }}>
                {this.state.error?.message}
              </pre>
            </details>

            {/* 動作按鈕 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
                style={{
                  flex: 1,
                  maxWidth: '200px',
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s',
                }}
              >
                🔄 重新整理
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  flex: 1,
                  maxWidth: '200px',
                  padding: '14px 28px',
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                }}
              >
                🏠 回到首頁
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
