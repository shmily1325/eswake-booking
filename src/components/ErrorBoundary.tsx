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

/**
 * 判斷是否為「動態載入 chunk 失敗」的錯誤。
 * 常見於部署新版後，舊分頁去抓已不存在的舊檔名 chunk。
 */
function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  const signature = `${error.name ?? ''} ${error.message ?? ''}`
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(
    signature,
  )
}

/** 同一分頁最短自動重整間隔，避免（真的壞掉時）無限重整迴圈 */
const CHUNK_RELOAD_MIN_INTERVAL_MS = 10 * 1000
const CHUNK_RELOAD_TS_KEY = 'app_chunk_reload_at'

/**
 * chunk 載入失敗時嘗試自動重整一次。
 * 回傳 true 表示已觸發重整（呼叫端可直接 return，不用再 setState）。
 */
function tryAutoReloadForChunkError(error: Error | null): boolean {
  if (typeof window === 'undefined') return false
  if (!isChunkLoadError(error)) return false

  try {
    const now = Date.now()
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_TS_KEY) || '0')
    if (Number.isFinite(last) && now - last < CHUNK_RELOAD_MIN_INTERVAL_MS) {
      // 剛剛才重整過還是同樣錯誤 → 不再重整，改顯示錯誤畫面讓使用者手動處理
      return false
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(now))
  } catch {
    // sessionStorage 不可用（如隱私模式）→ 保守起見不自動重整，走一般錯誤畫面
    return false
  }

  window.location.reload()
  return true
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

    // 部署新版造成的舊 chunk 抓不到 → 自動重整一次即可恢復，使用者無感。
    if (tryAutoReloadForChunkError(error)) {
      return
    }

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
          fontFamily: "var(--font-ui, 'PingFang TC', 'Microsoft JhengHei UI', 'Microsoft JhengHei', system-ui, sans-serif)"
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
              系統遇到了一個意外錯誤，請嘗試重新整理頁面。
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
