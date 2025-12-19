// 交易記錄彈出框組件

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
  formatFriendlyDate
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
        zIndex: 9999
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '70vh',
          background: 'white',
          borderRadius: '16px 16px 0 0',
          padding: '20px',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* 標題欄 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #f0f0f0'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
            {getCategoryLabel(category)} 交易記錄
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#999',
              cursor: 'pointer',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* 交易列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入中...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            最近兩個月無交易記錄
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transactions.map((transaction) => {
              const isIncrease = transaction.adjust_type === 'increase' || transaction.transaction_type === 'charge'
              const color = isIncrease ? '#52c41a' : '#ff4d4f'
              const sign = isIncrease ? '+' : '-'
              const value = Math.abs(transaction.amount || transaction.minutes || 0)

              return (
                <div
                  key={transaction.id}
                  style={{
                    padding: '14px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${color}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '6px'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {formatFriendlyDate(transaction.transaction_date)}
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color
                    }}>
                      {sign}
                      {unit === '元' ? '$' : ''}
                      {value}
                      {unit === '分' ? '分' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                    {transaction.description}
                  </div>
                  {transaction.notes && (
                    <div style={{ fontSize: '13px', color: '#999' }}>
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

