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
          padding: '40px',
          maxWidth: '800px',
          margin: '0 auto',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#e53e3e' }}>⚠️ 發生錯誤</h1>
          
          <div style={{
            background: '#fff5f5',
            border: '2px solid #feb2b2',
            borderRadius: '8px',
            padding: '20px',
            marginTop: '20px'
          }}>
            <h2 style={{ marginTop: 0 }}>錯誤訊息：</h2>
            <pre style={{ 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#c53030'
            }}>
              {this.state.error?.message}
            </pre>

            <h3>Stack Trace:</h3>
            <pre style={{ 
              whiteSpace: 'pre-wrap',
              fontSize: '12px',
              background: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px'
            }}>
              {this.state.error?.stack}
            </pre>

            {this.state.errorInfo && (
              <>
                <h3>Component Stack:</h3>
                <pre style={{ 
                  whiteSpace: 'pre-wrap',
                  fontSize: '12px',
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            重新載入頁面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
