import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle } from '../../styles/designSystem'
import { isAdmin } from '../../utils/auth'
import { getLocalDateString } from '../../utils/date'
import {
  loadBoatUsageRangeStats,
  type BoatUsageRangeResult
} from '../../utils/boatUsageRangeStats'
import { formatDuration } from './Statistics/utils'

function formatHoursOneDecimal(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10)
}

export function BoatUsageHoursPage() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()

  const today = getLocalDateString()
  const defaultStart = (() => {
    const d = new Date()
    d.setDate(1)
    return getLocalDateString(d)
  })()

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BoatUsageRangeResult | null>(null)

  const runLoad = useCallback(async () => {
    if (startDate > endDate) {
      setError('起始日不能晚於結束日')
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadBoatUsageRangeStats(supabase, startDate, endDate)
      setResult(data)
    } catch (e) {
      console.error(e)
      setError('載入失敗，請稍後再試')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    if (user) {
      void runLoad()
    }
  }, [user, runLoad])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        <PageHeader
          title="⏱️ 區間時數合計"
          user={user}
          showBaoLink={!!user && isAdmin(user)}
        />

        <div style={getCardStyle(isMobile)}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#555', lineHeight: 1.5 }}>
            供維護保養參考：教練練習以預約表時數計入（無回報亦計）。其餘預約與 Dashboard「月報分析」會員統計相同：僅計
            「已處理」且已扣款（會員直接計；非會員須有 consume）之預約，每筆加預約表上的時數一次。
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'flex-end',
              marginBottom: '12px'
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              起始日
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              結束日
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}
              />
            </label>
            <button
              type="button"
              onClick={() => void runLoad()}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)',
                color: 'white',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? '載入中…' : '重新計算'}
            </button>
          </div>
          {error && (
            <div style={{ color: '#c62828', fontSize: '14px', marginTop: '8px' }}>{error}</div>
          )}
        </div>

        {result && !error && (
          <div style={{ ...getCardStyle(isMobile), marginTop: '20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#666' }}>
              {startDate} ~ {endDate}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? '28px' : '34px',
                fontWeight: 800,
                color: '#1976d2',
                letterSpacing: '-0.5px'
              }}
            >
              {formatDuration(result.totalMinutes)}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '18px', color: '#555' }}>
              {formatHoursOneDecimal(result.totalMinutes)} 小時
            </p>
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}
