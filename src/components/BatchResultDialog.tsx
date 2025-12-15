import { useResponsive } from '../hooks/useResponsive'

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
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: allFailed ? '#fff5f5' : hasSkipped ? '#fffbeb' : '#f0fdf4',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>
              {allFailed ? '❌' : hasSkipped ? '⚠️' : '✅'}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: 'bold',
                color: allFailed ? '#dc2626' : hasSkipped ? '#d97706' : '#16a34a',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#666',
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
            borderBottom: hasSkipped ? '1px solid #e0e0e0' : 'none',
          }}
        >
          {/* 成功數 */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              background: successCount > 0 ? '#dcfce7' : '#f3f4f6',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '28px' : '32px',
                fontWeight: 'bold',
                color: successCount > 0 ? '#16a34a' : '#9ca3af',
              }}
            >
              {successCount}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: successCount > 0 ? '#15803d' : '#6b7280',
                marginTop: '4px',
              }}
            >
              ✓ {successLabel}
            </div>
          </div>

          {/* 跳過數 */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              background: hasSkipped ? '#fef3c7' : '#f3f4f6',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '28px' : '32px',
                fontWeight: 'bold',
                color: hasSkipped ? '#d97706' : '#9ca3af',
              }}
            >
              {skippedItems.length}
            </div>
            <div
              style={{
                fontSize: '14px',
                color: hasSkipped ? '#b45309' : '#6b7280',
                marginTop: '4px',
              }}
            >
              ⊘ {skippedLabel}
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
                color: '#6b7280',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
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
                    background: '#fef9e7',
                    borderRadius: '8px',
                    borderLeft: '3px solid #f59e0b',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#92400e',
                      marginBottom: '4px',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#78350f',
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
            paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom))' : '16px',
            borderTop: '1px solid #e0e0e0',
            background: 'white',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '12px',
              borderRadius: '10px',
              border: 'none',
              background: allFailed
                ? '#dc2626'
                : hasSkipped
                  ? '#f59e0b'
                  : '#16a34a',
              color: 'white',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            確認
          </button>
        </div>
      </div>
    </div>
  )
}

