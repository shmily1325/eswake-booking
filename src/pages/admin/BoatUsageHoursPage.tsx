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

const LS_INTERVAL_MIN = 'eswake-boatUsage-intervalMinutes'
const LS_MAINT_LABEL = 'eswake-boatUsage-maintenanceLabel'

function formatHoursOneDecimal(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10)
}

function readStoredIntervalMinutes(): number {
  try {
    const raw = localStorage.getItem(LS_INTERVAL_MIN)
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function readStoredMaintenanceLabel(): string {
  try {
    return localStorage.getItem(LS_MAINT_LABEL) ?? ''
  } catch {
    return ''
  }
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

  /** 保養／耗材：與「總和（分鐘）」比對的目標；0 表示不顯示進度 */
  const [intervalMinutes, setIntervalMinutes] = useState(readStoredIntervalMinutes)
  const [maintenanceLabel, setMaintenanceLabel] = useState(readStoredMaintenanceLabel)

  const setIntervalMinutesPersist = (value: number) => {
    setIntervalMinutes(value)
    try {
      if (value > 0) localStorage.setItem(LS_INTERVAL_MIN, String(value))
      else localStorage.removeItem(LS_INTERVAL_MIN)
    } catch {
      /* ignore */
    }
  }

  const setMaintenanceLabelPersist = (value: string) => {
    setMaintenanceLabel(value)
    try {
      if (value.trim()) localStorage.setItem(LS_MAINT_LABEL, value.trim())
      else localStorage.removeItem(LS_MAINT_LABEL)
    } catch {
      /* ignore */
    }
  }

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
            <strong>營運</strong>：有收錢的船使用時數。
            <br />
            <strong>教練練習</strong>：同區間內標記為教練練習且未取消，以預約表時長加總。
            <br />
            <strong>總和</strong>為兩者相加。僅列出實際船隻。
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

          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'flex-end'
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', minWidth: '120px' }}>
              項目（選填）
              <input
                type="text"
                value={maintenanceLabel}
                onChange={(e) => setMaintenanceLabelPersist(e.target.value)}
                placeholder="例如：機油"
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', minWidth: '140px' }}>
              目標間隔（分鐘）
              <input
                type="number"
                min={0}
                step={1}
                value={intervalMinutes || ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                  setIntervalMinutesPersist(Number.isFinite(v) && v >= 0 ? v : 0)
                }}
                placeholder="例如：3000"
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px' }}
              />
            </label>
            <button
              type="button"
              onClick={() => setStartDate(endDate)}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #bdbdbd',
                background: '#fff',
                color: '#424242',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reset 起算點
            </button>
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
            目標 &gt; 0 時，表格會用各船「總和（分鐘）」對照目標顯示進度。換完保養後可按 Reset：將<strong>起始日</strong>設成目前<strong>結束日</strong>，再把結束日往後調即可重算。
          </p>
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
                    {intervalMinutes > 0 && (
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', minWidth: '140px' }}>
                        進度
                        {maintenanceLabel.trim() ? `（${maintenanceLabel.trim()}）` : ''}
                      </th>
                    )}
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
                      {intervalMinutes > 0 && (
                        <td style={{ padding: '12px', borderBottom: '1px solid #eee', verticalAlign: 'middle' }}>
                          {(() => {
                            const pct = Math.min(100, (row.totalMinutes / intervalMinutes) * 100)
                            const over = row.totalMinutes >= intervalMinutes
                            return (
                              <div>
                                <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                                  {formatDuration(row.totalMinutes)} / {formatDuration(intervalMinutes)}
                                  <span style={{ marginLeft: '6px', fontWeight: 600, color: over ? '#c62828' : '#2e7d32' }}>
                                    {Math.round(pct)}%
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: '6px',
                                    borderRadius: '3px',
                                    background: '#eee',
                                    overflow: 'hidden'
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${pct}%`,
                                      borderRadius: '3px',
                                      background: over ? '#ef5350' : '#66bb6a',
                                      transition: 'width 0.2s ease'
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })()}
                        </td>
                      )}
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
