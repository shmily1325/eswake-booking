import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { EsBrandLockup } from './EsBrandLockup'
import { ES_BRAND } from '../lib/esBrandTokens'
import { designSystem, getButtonStyle } from '../styles/designSystem'

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
          flexDirection: 'column',
          background: ES_BRAND.pageBg,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <header style={{
            background: ES_BRAND.headerBg,
            borderBottom: ES_BRAND.headerBorderBottom,
            padding: `${designSystem.spacing.md} ${designSystem.spacing.xl}`,
          }}>
            <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
              <EsBrandLockup subtitle="系統狀態" />
            </div>
          </header>

          <main style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: designSystem.spacing.xl,
          }}>
          <div style={{
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.lg,
            boxShadow: designSystem.shadows.sm,
            padding: designSystem.spacing.xxl,
            maxWidth: '560px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h1 style={{
              color: designSystem.colors.text.primary,
              fontSize: designSystem.fontSize.h1.desktop,
              margin: `0 0 ${designSystem.spacing.md}`,
              fontWeight: '700'
            }}>
              系統暫時無法顯示
            </h1>

            <p style={{
              color: designSystem.colors.text.secondary,
              fontSize: designSystem.fontSize.body.desktop,
              lineHeight: '1.6',
              margin: `0 0 ${designSystem.spacing.xl}`,
            }}>
              系統遇到了一個意外錯誤，請嘗試重新整理頁面。<br/>
              如果問題持續發生，請聯繫系統管理員。
            </p>

            {/* 簡化的錯誤訊息（可折疊） */}
            <details style={{
              background: designSystem.colors.secondary[50],
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              padding: designSystem.spacing.md,
              marginBottom: designSystem.spacing.xl,
              textAlign: 'left'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: designSystem.colors.text.secondary,
                fontSize: designSystem.fontSize.bodySmall.desktop,
                userSelect: 'none'
              }}>
                查看技術細節
              </summary>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: designSystem.colors.danger[700],
                fontSize: designSystem.fontSize.caption.desktop,
                marginTop: designSystem.spacing.md,
                fontFamily: 'monospace'
              }}>
                {this.state.error?.message}
              </pre>
            </details>

            {/* 動作按鈕 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: designSystem.spacing.md,
              justifyContent: 'center',
            }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  ...getButtonStyle('primary', 'large'),
                  flex: 1,
                  minWidth: '160px',
                  minHeight: '48px',
                }}
              >
                重新整理
              </button>

              <button
                onClick={() => window.location.href = '/'}
                style={{
                  ...getButtonStyle('outline', 'large'),
                  flex: 1,
                  minWidth: '160px',
                  minHeight: '48px',
                }}
              >
                回到首頁
              </button>
            </div>
          </div>
          </main>
        </div>
      )
    }

    return this.props.children
  }
}
