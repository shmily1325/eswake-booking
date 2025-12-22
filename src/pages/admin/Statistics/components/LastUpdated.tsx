import { useState, useEffect } from 'react'

interface LastUpdatedProps {
  timestamp: Date
  onRefresh: () => void
  isRefreshing?: boolean
}

export function LastUpdated({ timestamp, onRefresh, isRefreshing = false }: LastUpdatedProps) {
  const [, setTick] = useState(0)

  // 每分鐘更新顯示
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diff < 60) return '剛剛'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '12px',
      color: '#999'
    }}>
      <span>更新於 {formatTime(timestamp)}</span>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        style={{
          background: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: isRefreshing ? 0.6 : 1
        }}
      >
        <span style={{
          display: 'inline-block',
          animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
        }}>
          🔄
        </span>
        重新整理
      </button>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

