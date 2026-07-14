import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle } from '../styles/designSystem'

const { colors: ds } = designSystem

interface SkippedItem {
  label: string      // 例如: "2025-01-15 10:00" 或 "預約 #123"
  reason: string     // 例如: "教練衝突：王教練已有預約"
}

interface BatchResultDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string                    // 例如: "重複預約結果" 或 "批次修改結果"
  successCount: number
  skippedItems: SkippedItem[]
  successLabel?: string            // 預設: "成功"
  skippedLabel?: string            // 預設: "跳過"
}

export function BatchResultDialog({
  isOpen,
  onClose,
  title,
  successCount,
  skippedItems,
  successLabel = '成功',
  skippedLabel = '跳過',
}: BatchResultDialogProps) {
  const { isMobile } = useResponsive()

  if (!isOpen) return null

  const hasSkipped = skippedItems.length > 0
  const allFailed = successCount === 0 && hasSkipped
  const confirmVariant = allFailed ? 'danger' : hasSkipped ? 'warning' : 'success'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: isMobile ? '0' : '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : '12px',
          width: '100%',
          maxWidth: isMobile ? '100%' : '420px',
          maxHeight: isMobile ? '80vh' : '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* 標題欄 */}
        <div
          style={{
            padding: isMobile ? '20px 20px 16px' : '20px 24px 16px',
            borderBottom: `1px solid ${ds.border.light}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: allFailed ? ds.danger[50] : hasSkipped ? ds.warning[50] : ds.success[50],
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: 'bold',
              color: allFailed ? ds.danger[700] : hasSkipped ? ds.warning[700] : ds.success[700],
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: ds.text.secondary,
              padding: '0 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 統計摘要 */}
        <div
          style={{
            padding: isMobile ? '16px 20px' : '16px 24px',
            display: 'flex',
            gap: '16px',
            borderBottom: hasSkipped ? `1px solid ${ds.border.light}` : 'none',
          }}
        >
          {/* 成功數 */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              background: successCount > 0 ? ds.success[50] : ds.background.hover,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '28px' : '32px',
                fontWeight: 'bold',
                color: successCount > 0 ? ds.success[500] : ds.text.disabled,
              }}
            >
              {successCount}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: successCount > 0 ? ds.success[700] : ds.text.secondary,
                marginTop: '4px',
              }}
            >
              {successLabel}
            </div>
          </div>

          {/* 跳過數 */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              background: hasSkipped ? ds.warning[50] : ds.background.hover,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '28px' : '32px',
                fontWeight: 'bold',
                color: hasSkipped ? ds.warning[500] : ds.text.disabled,
              }}
            >
              {skippedItems.length}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: hasSkipped ? ds.warning[700] : ds.text.secondary,
                marginTop: '4px',
              }}
            >
              {skippedLabel}
            </div>
          </div>
        </div>

        {/* 跳過詳情列表 */}
        {hasSkipped && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '12px 20px' : '12px 24px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: ds.text.secondary,
                marginBottom: '10px',
              }}
            >
              跳過原因詳情
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {skippedItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    background: ds.warning[50],
                    borderRadius: '8px',
                    borderLeft: `3px solid ${ds.warning[500]}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: ds.warning[700],
                      marginBottom: '4px',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: ds.warning[700],
                      lineHeight: 1.4,
                    }}
                  >
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部按鈕 */}
        <div
          style={{
            padding: isMobile ? '16px 20px' : '16px 24px',
            paddingBottom: isMobile
              ? 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))'
              : '16px',
            borderTop: `1px solid ${ds.border.light}`,
            background: 'white',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              ...getButtonStyle(confirmVariant, 'large', isMobile),
              width: '100%',
              fontSize: isMobile ? '16px' : '15px',
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            確認
          </button>
        </div>
      </div>
    </div>
  )
}
