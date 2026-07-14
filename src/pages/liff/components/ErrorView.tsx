// 錯誤顯示組件

import { getFontSizePx } from '../../../styles/designSystem'
import { liffCard, liffPage, liffPrimaryBtn, LIFF_THEME } from '../liffUiStyles'

interface ErrorViewProps {
  error: string
  /** 例如整頁重新載入，略過 LIFF WebView 冷啟動偶發失敗 */
  onRetry?: () => void
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  return (
    <div style={{
      ...liffPage,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        ...liffCard,
        padding: '30px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <div style={{ fontSize: getFontSizePx('h3', true), color: '#d32f2f', fontWeight: '600', marginBottom: '8px' }}>
          發生錯誤
        </div>
        <div style={{ fontSize: getFontSizePx('body', true), color: LIFF_THEME.muted }}>
          {error}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{ ...liffPrimaryBtn(true), marginTop: '20px', width: 'auto', padding: '12px 24px' }}
          >
            重新整理
          </button>
        )}
      </div>
    </div>
  )
}
