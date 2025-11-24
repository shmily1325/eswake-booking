import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 全局錯誤邊界
 * 
 * 捕獲子組件中的錯誤，防止整個應用白屏
 * 提供友好的錯誤提示和恢復選項
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // 在生產環境，這裡可以發送錯誤到監控服務
    console.error('應用錯誤:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7fafc',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              padding: '48px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '64px',
                marginBottom: '16px'
              }}
            >
              😰
            </div>
            
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '12px'
              }}
            >
              系統發生錯誤
            </h1>
            
            <p
              style={{
                fontSize: '16px',
                color: '#666',
                marginBottom: '8px'
              }}
            >
              很抱歉，系統遇到了一個問題
            </p>
            
            <p
              style={{
                fontSize: '14px',
                color: '#999',
                marginBottom: '24px'
              }}
            >
              請聯絡管理員
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div
                style={{
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#d32f2f',
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}
            >
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'white',
                  background: '#4299e1',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                onClick={this.handleGoHome}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#4299e1',
                  background: 'white',
                  border: '2px solid #4299e1',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

