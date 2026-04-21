import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem } from '../../../../styles/designSystem'
import { sortBoatsByDisplayOrder } from '../../../../utils/boatUtils'
import {
  computeBoatsMonthlyUptime,
  type BoatUnavailableHoursInput,
} from '../../../../utils/boatMonthlyUptime'

interface BoatUptimeTabProps {
  /** 父層按下重新整理時變更，用於觸發重抓 */
  lastUpdatedKey: number
}

export function BoatUptimeTab({ lastUpdatedKey }: BoatUptimeTabProps) {
  const { isMobile } = useResponsive()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [boats, setBoats] = useState<{ id: number; name: string }[]>([])
  const [records, setRecords] = useState<BoatUnavailableHoursInput[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [y, m] = selectedMonth.split('-').map(Number)
        const lastDay = new Date(y, m, 0).getDate()
        const monthLast = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`
        const monthFirst = `${selectedMonth}-01`

        const [boatsRes, unRes] = await Promise.all([
          supabase.from('boats').select('id, name').order('id'),
          supabase
            .from('boat_unavailable_dates')
            .select('boat_id, start_date, end_date, start_time, end_time, is_active')
            .eq('is_active', true)
            .lte('start_date', monthLast)
            .gte('end_date', monthFirst),
        ])

        if (cancelled) return
        if (boatsRes.data) setBoats(sortBoatsByDisplayOrder(boatsRes.data))
        if (unRes.data) setRecords(unRes.data as BoatUnavailableHoursInput[])
        else setRecords([])
      } catch (e) {
        console.error('BoatUptimeTab load error:', e)
        if (!cancelled) setRecords([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedMonth, lastUpdatedKey])

  const rows = useMemo(
    () => computeBoatsMonthlyUptime(selectedMonth, boats, records),
    [selectedMonth, boats, records]
  )

  const quickMonths = useMemo(() => {
    const out: { value: string; label: string }[] = []
    const now = new Date()
    const currentYear = now.getFullYear()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const label = year !== currentYear ? `${year}/${month}月` : `${month}月`
      out.push({ value: `${year}-${String(month).padStart(2, '0')}`, label })
    }
    return out
  }, [])

  const thStyle = {
    textAlign: 'left' as const,
    padding: '10px 12px',
    fontSize: '13px',
    color: '#555',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600 as const,
  }
  const tdStyle = {
    padding: '10px 12px',
    fontSize: '13px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  }

  return (
    <div>
      <div
        style={{
          backgroundColor: 'white',
          padding: designSystem.spacing.sm,
          borderRadius: designSystem.borderRadius.lg,
          boxShadow: designSystem.shadows.sm,
          marginBottom: designSystem.spacing.md,
        }}
      >
        <div
          style={{
            fontSize: '15px',
            fontWeight: 600,
            marginBottom: '12px',
            color: '#333',
          }}
        >
          月份
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {quickMonths.slice(0, isMobile ? 4 : 6).map((m) => (
            <button
              key={m.value}
              data-track="dashboard_boat_uptime_month"
              type="button"
              onClick={() => setSelectedMonth(m.value)}
              style={{
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: designSystem.borderRadius.md,
                border:
                  selectedMonth === m.value
                    ? 'none'
                    : `1px solid ${designSystem.colors.border.main}`,
                background:
                  selectedMonth === m.value
                    ? 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)'
                    : 'white',
                color: selectedMonth === m.value ? 'white' : '#666',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: selectedMonth === m.value ? '600' : '500',
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#666' }}>
          其他月份
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              fontSize: '16px',
            }}
          />
        </label>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          padding: designSystem.spacing.md,
          borderRadius: designSystem.borderRadius.lg,
          boxShadow: designSystem.shadows.sm,
          overflowX: 'auto',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: isMobile ? '17px' : '18px',
            color: '#333',
          }}
        >
          船隻月妥善率（曆法小時）
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
          分母為當月天數 × 24 小時；分子為扣除合併後的維修／停用時段。維修天數 = 維修小時 ÷ 24。
          不含彈簧床、陸上課程；同一時段多筆維修會合併計算。
        </p>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>載入中…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? 520 : 640 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={thStyle}>船隻</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>曆法總小時</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>維修小時</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>維修天數</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>妥善率</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.boatId}>
                  <td style={tdStyle}>
                    <strong>{r.boatName}</strong>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.calendarHours}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.downtimeHours}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.downtimeDaysDecimal}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.uptimePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
