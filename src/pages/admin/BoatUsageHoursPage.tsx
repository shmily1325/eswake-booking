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
import { CoachPracticeSessionsTable } from '../../components/CoachPracticeSessionsTable'
import { formatDuration } from './Statistics/utils'

function formatHoursOneDecimal(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10)
}

function BoatUsageMobileCards({
  rows,
}: {
  rows: BoatUsageRangeResult['boats']
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((row) => (
        <div
          key={row.boatId}
          style={{
            background: '#fafafa',
            border: '1px solid #eee',
            borderRadius: '10px',
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '10px',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#333' }}>{row.boatName}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#555', flexShrink: 0 }}>
              {formatHoursOneDecimal(row.totalMinutes)} 小時
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 12px',
              fontSize: '13px',
            }}
          >
            <div style={{ color: '#888' }}>營運</div>
            <div style={{ textAlign: 'right', color: row.generalMinutes > 0 ? '#2196f3' : '#999' }}>
              {formatDuration(row.generalMinutes)}
            </div>
            <div style={{ color: '#888' }}>教練練習</div>
            <div style={{ textAlign: 'right', color: row.practiceMinutes > 0 ? '#7b1fa2' : '#999' }}>
              {formatDuration(row.practiceMinutes)}
            </div>
            <div style={{ color: '#888', fontWeight: 600 }}>總和</div>
            <div
              style={{
                textAlign: 'right',
                fontWeight: 700,
                color: row.totalMinutes > 0 ? '#333' : '#999',
              }}
            >
              {formatDuration(row.totalMinutes)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
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
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: isMobile ? '16px' : '24px',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        <PageHeader
          title="⏱️ 區間時數合計"
          user={user}
          showBaoLink={!!user && isAdmin(user)}
        />

        <div style={getCardStyle(isMobile)}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#555', lineHeight: 1.55 }}>
            <strong>營運</strong>：有收錢的船使用時數。
            <br />
            <strong>教練練習</strong>：同區間內標記為教練練習且未取消，以預約表時長加總。
            <br />
            <strong>總和</strong>為兩者相加。僅列出實際船隻。
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'auto auto auto',
              gap: '12px',
              alignItems: 'end',
              marginBottom: '12px',
            }}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '13px',
                minWidth: 0,
              }}
            >
              起始日
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '16px',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '13px',
                minWidth: 0,
              }}
            >
              結束日
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '16px',
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void runLoad()}
              disabled={loading}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)',
                color: 'white',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '15px',
                width: '100%',
                boxSizing: 'border-box',
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
            {isMobile ? (
              <BoatUsageMobileCards rows={result.boats} />
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
                      船隻
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      營運（已扣款）
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
            )}
          </div>
        )}

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
                  background: '#7b1fa2',
                  borderRadius: '2px',
                  display: 'inline-block'
                }}
              />
              教練練習列表
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666', lineHeight: 1.55 }}>
              {startDate} ~ {endDate}；僅實際船隻。每筆為預約表排定之分鐘數。
            </p>
            <CoachPracticeSessionsTable
              sessions={result.practiceSessions}
              showContactPerson={false}
              emptyText="此區間無教練練習紀錄。"
              isMobile={isMobile}
            />
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}
