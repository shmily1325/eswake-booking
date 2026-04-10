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
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        <PageHeader
          title="⏱️ 區間時數合計"
          user={user}
          showBaoLink={!!user && isAdmin(user)}
        />

        <div style={getCardStyle(isMobile)}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#555', lineHeight: 1.55 }}>
            <strong>一般預約</strong>與 Dashboard「歷史趨勢」月份明細相同：未取消、排除教練練習，以預約表時長加總。
            <strong> 教練練習</strong>為同區間內標記為教練練習且未取消之預約，同樣以預約表時長加總。
            <strong> 總和</strong>為兩者相加。僅列出實際船隻（不含彈簧床、陸上課程）。選與趨勢圖相同區間時，「一般預約」欄應與趨勢圖各船分鐘數一致。
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
          <div style={{ ...getCardStyle(isMobile), marginTop: '20px' }}>
            <h3
              style={{
                margin: '0 0 6px 0',
                fontSize: '17px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '20px',
                  background: '#1976d2',
                  borderRadius: '2px',
                  display: 'inline-block'
                }}
              />
              各船時數
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666' }}>
              {startDate} ~ {endDate}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                      船隻
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      一般預約
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      教練練習
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      總和
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      總和（小時）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.boats.map((row, idx) => (
                    <tr key={row.boatId} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{row.boatName}</td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: '1px solid #eee',
                          color: row.generalMinutes > 0 ? '#2196f3' : '#999'
                        }}
                      >
                        {formatDuration(row.generalMinutes)}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: '1px solid #eee',
                          color: row.practiceMinutes > 0 ? '#7b1fa2' : '#999'
                        }}
                      >
                        {formatDuration(row.practiceMinutes)}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: '1px solid #eee',
                          fontWeight: 600,
                          color: row.totalMinutes > 0 ? '#333' : '#999'
                        }}
                      >
                        {formatDuration(row.totalMinutes)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #eee' }}>
                        {formatHoursOneDecimal(row.totalMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}
