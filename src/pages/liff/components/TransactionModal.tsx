// 交易記錄彈出框組件

import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME } from '../liffUiStyles'
import type { Transaction } from '../types'
import { getCategoryLabel, getCategoryUnit } from '../types'

interface TransactionModalProps {
  show: boolean
  onClose: () => void
  category: string
  transactions: Transaction[]
  loading: boolean
  formatFriendlyDate: (dateStr: string) => string
}

export function TransactionModal({
  show,
  onClose,
  category,
  transactions,
  loading,
  formatFriendlyDate,
}: TransactionModalProps) {
  if (!show) return null

  const unit = getCategoryUnit(category)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '70dvh',
          background: LIFF_THEME.cardBg,
          borderRadius: `${LIFF_THEME.cardRadius}px ${LIFF_THEME.cardRadius}px 0 0`,
          padding: '20px',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: LIFF_THEME.cardBorder,
        }}>
          <h3 style={{ margin: 0, fontSize: getFontSizePx('bodyLarge', false), fontWeight: 700, color: LIFF_THEME.inkSoft }}>
            {getCategoryLabel(category)} 交易記錄
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            style={{
              background: LIFF_THEME.surfaceInset,
              border: 'none',
              borderRadius: '50%',
              fontSize: getFontSizePx('h3', false),
              color: LIFF_THEME.muted,
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: LIFF_THEME.muted }}>
            載入中...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: LIFF_THEME.muted }}>
            最近兩個月無交易記錄
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {transactions.map((transaction) => {
              const isIncrease = transaction.adjust_type === 'increase' || transaction.transaction_type === 'charge'
              const color = isIncrease ? '#2e7d32' : '#c62828'
              const sign = isIncrease ? '+' : '-'
              const value = Math.abs(transaction.amount || transaction.minutes || 0)

              return (
                <div
                  key={transaction.id}
                  style={{
                    padding: '14px',
                    background: LIFF_THEME.surfaceInset,
                    borderRadius: '12px',
                    border: LIFF_THEME.cardBorder,
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '6px',
                  }}>
                    <div style={{ fontSize: getFontSizePx('body', true), color: LIFF_THEME.muted }}>
                      {formatFriendlyDate(transaction.transaction_date)}
                    </div>
                    <div style={{
                      fontSize: getFontSizePx('bodyLarge', false),
                      fontWeight: 700,
                      color,
                    }}>
                      {sign}
                      {unit === '元' ? '$' : ''}
                      {value}
                      {unit === '分' ? '分' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: getFontSizePx('body', true), color: LIFF_THEME.inkSoft, marginBottom: '4px' }}>
                    {transaction.description}
                  </div>
                  {transaction.notes && (
                    <div style={{ fontSize: getFontSizePx('button', true), color: LIFF_THEME.mutedLight }}>
                      備註：{transaction.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  )
}
