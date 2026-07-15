import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { PageShell } from '../../components/PageShell'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import {
  designSystem,
  getButtonStyle,
  getCardStyle,
  getInputStyle,
  getLabelStyle,
} from '../../styles/designSystem'
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
            padding: '14px 0',
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
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
            <span style={{ fontSize: '16px', fontWeight: 700, color: designSystem.colors.text.primary }}>{row.boatName}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: designSystem.colors.text.primary, flexShrink: 0 }}>
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
            <div style={{ color: designSystem.colors.text.secondary }}>已扣款</div>
            <div style={{ textAlign: 'right', color: row.generalMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled }}>
              {formatDuration(row.generalMinutes)}
            </div>
            <div style={{ color: designSystem.colors.text.secondary }}>教練練習</div>
            <div style={{ textAlign: 'right', color: row.practiceMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled }}>
              {formatDuration(row.practiceMinutes)}
            </div>
            <div style={{ color: designSystem.colors.text.secondary, fontWeight: 600 }}>總和</div>
            <div
              style={{
                textAlign: 'right',
                fontWeight: 700,
                color: row.totalMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled,
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
    <PageShell
      variant="focused"
      mobilePadding="16px"
      desktopPadding="24px"
      outerStyle={{ paddingBottom: '80px' }}
    >
        <PageHeader
          title="區間時數合計"
          user={user}
          showBaoLink={!!user && isAdmin(user)}
        />

        <div style={getCardStyle(isMobile)}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'flex-end',
            }}
          >
            <label
              style={{
                ...getLabelStyle(isMobile),
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                marginBottom: 0,
                flex: isMobile ? '1 1 100%' : '0 1 auto',
                minWidth: isMobile ? 0 : '160px',
              }}
            >
              起始日
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  ...getInputStyle(isMobile),
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <label
              style={{
                ...getLabelStyle(isMobile),
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                marginBottom: 0,
                flex: isMobile ? '1 1 100%' : '0 1 auto',
                minWidth: isMobile ? 0 : '160px',
              }}
            >
              結束日
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  ...getInputStyle(isMobile),
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
                ...getButtonStyle('primary', 'medium', isMobile),
                cursor: loading ? 'wait' : 'pointer',
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                width: isMobile ? '100%' : 'auto',
                minHeight: isMobile ? '46px' : '48px',
                boxSizing: 'border-box',
              }}
            >
              {loading ? '載入中…' : '重新計算'}
            </button>
          </div>
          {error && (
            <div style={{ color: designSystem.colors.danger[700], fontSize: '14px', marginTop: '8px' }}>{error}</div>
          )}
        </div>

        {result && !error && (
          <div style={{ ...getCardStyle(isMobile), marginTop: '20px' }}>
            <h3
              style={{
                margin: '0 0 6px 0',
                fontSize: '17px',
                fontWeight: 700,
                color: designSystem.colors.text.primary,
              }}
            >
              各船時數
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: designSystem.colors.text.secondary }}>
              {startDate} ~ {endDate}
            </p>
            {isMobile ? (
              <BoatUsageMobileCards rows={result.boats} />
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: designSystem.colors.background.hover, color: designSystem.colors.text.secondary }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.main}` }}>
                      船隻
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${designSystem.colors.border.main}` }}>
                      已扣款
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${designSystem.colors.border.main}` }}>
                      教練練習
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${designSystem.colors.border.main}` }}>
                      總和
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${designSystem.colors.border.main}` }}>
                      總和（小時）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.boats.map((row) => (
                    <tr key={row.boatId} style={{ background: designSystem.colors.background.card }}>
                      <td style={{ padding: '12px', borderBottom: `1px solid ${designSystem.colors.border.light}` }}>{row.boatName}</td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          color: row.generalMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled
                        }}
                      >
                        {formatDuration(row.generalMinutes)}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          color: row.practiceMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled
                        }}
                      >
                        {formatDuration(row.practiceMinutes)}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'right',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          fontWeight: 600,
                          color: row.totalMinutes > 0 ? designSystem.colors.text.primary : designSystem.colors.text.disabled
                        }}
                      >
                        {formatDuration(row.totalMinutes)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
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
                color: designSystem.colors.text.primary,
              }}
            >
              教練練習列表
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: designSystem.colors.text.secondary, lineHeight: 1.55 }}>
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
    </PageShell>
  )
}
