import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { SummaryCard, SummaryCardsGrid } from '../components'
import type { MonthlyStats, FinanceStats, BoatData } from '../types'
import { calculateChange, formatDuration } from '../utils'

interface TrendTabProps {
  monthlyStats: MonthlyStats[]
  financeStats: FinanceStats[]
  allBoatsData: BoatData[]
}

export function TrendTab({ monthlyStats, financeStats, allBoatsData }: TrendTabProps) {
  const { isMobile } = useResponsive()

  const currentMonth = monthlyStats[monthlyStats.length - 1]
  const previousMonth = monthlyStats[monthlyStats.length - 2]

  // 計算變化
  const bookingChange = previousMonth
    ? calculateChange(currentMonth?.bookingCount || 0, previousMonth.bookingCount)
    : undefined
  const minutesChange = previousMonth
    ? calculateChange(currentMonth?.totalMinutes || 0, previousMonth.totalMinutes)
    : undefined

  // 自定義 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = monthlyStats.find(m => m.label === label)

    return (
      <div style={{
        background: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: '180px'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '10px', color: '#333' }}>
          {label}
        </div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '13px'
          }}>
            <span style={{ color: p.color }}>
              {p.name}
            </span>
            <span style={{ fontWeight: '600' }}>
              {p.dataKey === 'bookingCount' ? `${p.value} 筆` : `${p.value} 分`}
            </span>
          </div>
        ))}
        {/* 平日/假日分布（如果有資料） */}
        {data?.weekdayCount !== undefined && (
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #eee',
            fontSize: '12px',
            color: '#666'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>📅 平日</span>
              <span>{data.weekdayCount} 筆</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🎉 假日</span>
              <span>{data.weekendCount} 筆</span>
            </div>
          </div>
        )}
        {/* 各船分布 */}
        {data?.boatMinutes && data.boatMinutes.length > 0 && (
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #eee',
            fontSize: '12px',
            color: '#666'
          }}>
            <div style={{ marginBottom: '6px', fontWeight: '500' }}>🚤 各船時數</div>
            {data.boatMinutes.slice(0, 3).map(boat => (
              <div key={boat.boatId} style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '2px'
              }}>
                <span>{boat.boatName}</span>
                <span>{formatDuration(boat.minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* 摘要卡片 */}
      <SummaryCardsGrid>
        <SummaryCard
          label="本月預約"
          value={currentMonth?.bookingCount || 0}
          unit="筆"
          accentColor="#4a90e2"
          change={bookingChange ? {
            value: bookingChange.value,
            direction: bookingChange.direction,
            label: 'vs 上月'
          } : undefined}
        />
        <SummaryCard
          label="本月時數"
          value={currentMonth?.totalMinutes || 0}
          unit="分"
          accentColor="#50c878"
          change={minutesChange ? {
            value: minutesChange.value,
            direction: minutesChange.direction,
            label: 'vs 上月'
          } : undefined}
        />
        <SummaryCard
          label="6個月平均"
          value={Math.round(monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0) / Math.max(monthlyStats.length, 1))}
          unit="筆/月"
          accentColor="#ffd93d"
        />
        <SummaryCard
          label="6個月總計"
          value={monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0)}
          unit="筆"
          accentColor="#6c5ce7"
        />
      </SummaryCardsGrid>

      {/* 預約量折線圖 */}
      <div style={{
        ...getCardStyle(isMobile),
        marginBottom: '24px'
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: '17px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: '#4a90e2',
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          近6個月預約趨勢
          <span style={{ fontSize: '12px', color: '#999', fontWeight: '400' }}>
            (Hover 查看詳情)
          </span>
        </h3>
        <div style={{ width: '100%', height: isMobile ? 250 : 300 }}>
          <ResponsiveContainer>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="bookingCount"
                name="預約數"
                stroke="#4a90e2"
                strokeWidth={3}
                dot={{ fill: '#4a90e2', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="totalMinutes"
                name="時數(分)"
                stroke="#50c878"
                strokeWidth={3}
                dot={{ fill: '#50c878', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月份數據表格 - 桌面版 */}
      {!isMobile && (
        <div style={getCardStyle(isMobile)}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: '17px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '20px',
              background: '#50c878',
              borderRadius: '2px',
              display: 'inline-block'
            }} />
            月份數據明細
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>月份</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>筆數</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>總時數</th>
                  {allBoatsData.map(boat => (
                    <th key={boat.boatId} style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>
                      {boat.boatName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat, idx) => (
                  <tr key={stat.month} style={{
                    background: idx === monthlyStats.length - 1 ? '#e3f2fd' : 'white'
                  }}>
                    <td style={{ padding: '12px', fontWeight: idx === monthlyStats.length - 1 ? '600' : '400' }}>
                      {stat.month}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {stat.bookingCount}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid #e0e0e0' }}>
                      {formatDuration(stat.totalMinutes)}
                    </td>
                    {allBoatsData.map(boat => {
                      const boatData = stat.boatMinutes?.find(b => b.boatId === boat.boatId)
                      const minutes = boatData?.minutes || 0
                      return (
                        <td key={boat.boatId} style={{ padding: '12px', textAlign: 'right', color: minutes > 0 ? '#2196f3' : '#999' }}>
                          {formatDuration(minutes)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 月份數據 - 手機版卡片 */}
      {isMobile && (
        <div style={getCardStyle(isMobile)}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '15px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '4px',
              height: '20px',
              background: '#50c878',
              borderRadius: '2px',
              display: 'inline-block'
            }} />
            月份數據明細
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {monthlyStats.slice().reverse().map((stat, idx) => (
              <div
                key={stat.month}
                style={{
                  padding: '14px',
                  background: idx === 0 ? '#e3f2fd' : '#f8f9fa',
                  borderRadius: '10px'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontWeight: '600', color: '#333' }}>{stat.month}</span>
                  <span style={{ color: '#4a90e2', fontWeight: '600' }}>
                    {stat.bookingCount} 筆 · {formatDuration(stat.totalMinutes)}
                  </span>
                </div>
                {stat.boatMinutes && stat.boatMinutes.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {stat.boatMinutes.map(boat => (
                      <span key={boat.boatId} style={{
                        background: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        {boat.boatName}: {formatDuration(boat.minutes)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 預約月結算 */}
      <div style={{ ...getCardStyle(isMobile), marginTop: '24px' }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: isMobile ? '15px' : '17px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: '#ff9800',
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          📊 預約月結算
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>月份</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>💰 儲值</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>💎 VIP</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>🚤 G23船券</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>⛵ G21船券</th>
              </tr>
            </thead>
            <tbody>
              {financeStats.map((stat, idx) => {
                const prev = idx > 0 ? financeStats[idx - 1] : null
                const getArrow = (curr: number, prevVal: number | null) => {
                  if (prevVal === null || prevVal === 0) return ''
                  const diff = curr - prevVal
                  if (diff > 0) return ' ↑'
                  if (diff < 0) return ' ↓'
                  return ''
                }
                return (
                  <tr key={stat.month} style={{
                    background: idx === financeStats.length - 1 ? '#fff3e0' : 'white'
                  }}>
                    <td style={{ padding: '12px', fontWeight: idx === financeStats.length - 1 ? '600' : '400' }}>
                      {stat.month}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#4a90e2' }}>
                      ${stat.balanceUsed.toLocaleString()}{getArrow(stat.balanceUsed, prev?.balanceUsed ?? null)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#9c27b0' }}>
                      ${stat.vipUsed.toLocaleString()}{getArrow(stat.vipUsed, prev?.vipUsed ?? null)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#50c878' }}>
                      {stat.g23Used} 分{getArrow(stat.g23Used, prev?.g23Used ?? null)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#ff9800' }}>
                      {stat.g21Used} 分{getArrow(stat.g21Used, prev?.g21Used ?? null)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

