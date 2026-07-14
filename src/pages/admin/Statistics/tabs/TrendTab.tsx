import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'
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

function TrendLineTooltipContent({
  active,
  payload,
  label,
  monthlyStats,
  allBoatsData
}: {
  active?: boolean
  payload?: any[]
  label?: string
  monthlyStats: MonthlyStats[]
  allBoatsData: BoatData[]
}) {
  if (!active || !payload || !payload.length) return null

  const data = monthlyStats.find(m => m.label === label)

  return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '12px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        minWidth: '176px',
        maxHeight: 'min(70vh, 520px)',
        overflowY: 'auto'
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
              {p.dataKey === 'bookingCount' ? `${p.value} 筆` : formatDuration(Number(p.value))}
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
        {/* 各船／設施：與下方表格欄位順序一致，加總應等於已扣款時數 */}
        {data && allBoatsData.length > 0 && (
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #eee',
            fontSize: '12px',
            color: '#666'
          }}>
            <div style={{ marginBottom: '6px', fontWeight: '500' }}>🚤 各船／設施</div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {allBoatsData.map(boat => {
                const bm = data.boatMinutes?.find(b => b.boatId === boat.boatId)
                const minutes = bm?.minutes ?? 0
                return (
                  <div key={boat.boatId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '2px',
                    color: minutes > 0 ? '#333' : '#aaa'
                  }}>
                    <span>{boat.boatName}</span>
                    <span>{formatDuration(minutes)}</span>
                  </div>
                )
              })}
              {(() => {
                const columnSum = allBoatsData.reduce((s, boat) => {
                  const bm = data.boatMinutes?.find(b => b.boatId === boat.boatId)
                  return s + (bm?.minutes ?? 0)
                }, 0)
                const total = data.totalMinutes ?? 0
                const orphan = total - columnSum
                if (orphan <= 0) return null
                return (
                  <div style={{
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#e65100',
                    fontSize: '11px'
                  }}>
                    <span>其他（未在表頭的船）</span>
                    <span>{formatDuration(orphan)}</span>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
  )
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

  return (
    <>
      {/* 摘要卡片 */}
      <SummaryCardsGrid>
        <SummaryCard
          label="本月已結帳"
          value={currentMonth?.bookingCount || 0}
          unit="筆"
          accentColor={designSystem.colors.info[500]}
          change={bookingChange ? {
            value: bookingChange.value,
            direction: bookingChange.direction,
            label: 'vs 上月'
          } : undefined}
        />
        <SummaryCard
          label="本月已扣款時數"
          value={currentMonth?.totalMinutes || 0}
          unit="分"
          accentColor={designSystem.colors.success[500]}
          change={minutesChange ? {
            value: minutesChange.value,
            direction: minutesChange.direction,
            label: 'vs 上月'
          } : undefined}
        />
      </SummaryCardsGrid>

      {/* 預約量折線圖 — 卡片預設 overflow:hidden 會裁切 Hover Tooltip，此處放開 */}
      <div style={{
        ...getCardStyle(isMobile),
        marginBottom: '24px',
        overflow: 'visible'
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: getFontSize('h3', isMobile),
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: designSystem.colors.text.primary
        }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: designSystem.colors.info[500],
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          歷史月趨勢
        </h3>
        <div
          className="trend-line-chart-unclip"
          style={{ width: '100%', height: isMobile ? 280 : 320, overflow: 'visible' }}
        >
          <style>{`
            .trend-line-chart-unclip .recharts-responsive-container,
            .trend-line-chart-unclip .recharts-wrapper {
              overflow: visible !important;
            }
          `}</style>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyStats} margin={{ top: 36, right: 8, left: 0, bottom: 8 }}>
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />
              <CartesianGrid strokeDasharray="3 3" stroke={designSystem.colors.border.light} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                allowEscapeViewBox={{ x: true, y: true }}
                content={(props: any) => (
                  <TrendLineTooltipContent
                    {...props}
                    monthlyStats={monthlyStats}
                    allBoatsData={allBoatsData}
                  />
                )}
                wrapperStyle={{ zIndex: 20, pointerEvents: 'auto' }}
              />
              <Line
                type="monotone"
                dataKey="bookingCount"
                name="已結帳筆數"
                stroke={designSystem.colors.info[500]}
                strokeWidth={3}
                dot={{ fill: designSystem.colors.info[500], strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="totalMinutes"
                name="已扣款時數"
                stroke={designSystem.colors.success[500]}
                strokeWidth={3}
                dot={{ fill: designSystem.colors.success[500], strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月份數據明細 — 各船欄；圖表 Hover 也有，但表格方便對帳 */}
      {!isMobile && (
        <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: getFontSize('h3', isMobile),
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: designSystem.colors.text.primary
          }}>
            <span style={{
              width: '4px',
              height: '20px',
              background: designSystem.colors.success[500],
              borderRadius: '2px',
              display: 'inline-block'
            }} />
            月份數據明細
          </h3>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              width: 'max-content',
              minWidth: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
              tableLayout: 'auto'
            }}>
              <thead>
                <tr style={{ background: designSystem.colors.background.hover }}>
                  <th style={{
                    padding: '12px 16px 12px 12px',
                    textAlign: 'left',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle'
                  }}>月份</th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle'
                  }} title="每筆已結帳預約計一次">已結帳筆數</th>
                  <th style={{
                    padding: '12px 20px 12px 16px',
                    textAlign: 'right',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    borderRight: `1px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap',
                    verticalAlign: 'middle'
                  }} title="已結帳參與者回報分鐘加總">總時數</th>
                  {allBoatsData.map(boat => (
                    <th key={boat.boatId} style={{
                      padding: '12px 10px',
                      textAlign: 'right',
                      borderBottom: `2px solid ${designSystem.colors.border.main}`,
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: designSystem.colors.text.secondary
                    }}>
                      {boat.boatName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat, idx) => (
                  <tr key={stat.month} style={{
                    background: idx === monthlyStats.length - 1
                      ? designSystem.colors.info[50]
                      : 'white'
                  }}>
                    <td style={{
                      padding: '12px 16px 12px 12px',
                      fontWeight: idx === monthlyStats.length - 1 ? '600' : '400',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle'
                    }}>
                      {stat.month}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stat.bookingCount}
                    </td>
                    <td style={{
                      padding: '12px 20px 12px 16px',
                      textAlign: 'right',
                      borderRight: `1px solid ${designSystem.colors.border.main}`,
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {formatDuration(stat.totalMinutes)}
                    </td>
                    {allBoatsData.map(boat => {
                      const boatData = stat.boatMinutes?.find(b => b.boatId === boat.boatId)
                      const minutes = boatData?.minutes || 0
                      return (
                        <td key={boat.boatId} style={{
                          padding: '12px 10px',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '13px',
                          color: minutes > 0
                            ? designSystem.colors.info[700]
                            : designSystem.colors.text.disabled
                        }}>
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

      {isMobile && (
        <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: getFontSize('h3', isMobile),
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: designSystem.colors.text.primary
          }}>
            <span style={{
              width: '4px',
              height: '20px',
              background: designSystem.colors.success[500],
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
                  background: idx === 0
                    ? designSystem.colors.info[50]
                    : designSystem.colors.background.hover,
                  borderRadius: designSystem.borderRadius.md
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontWeight: '600',
                    color: designSystem.colors.text.primary
                  }}>
                    {stat.month}
                  </span>
                  <span style={{
                    color: designSystem.colors.info[500],
                    fontWeight: '600'
                  }}>
                    {stat.bookingCount} 筆 · {formatDuration(stat.totalMinutes)}
                  </span>
                </div>
                {stat.boatMinutes && stat.boatMinutes.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: getFontSize('caption', true),
                    color: designSystem.colors.text.secondary
                  }}>
                    {stat.boatMinutes.map(boat => (
                      <span key={boat.boatId} style={{
                        background: designSystem.colors.background.card,
                        padding: '4px 8px',
                        borderRadius: designSystem.borderRadius.sm
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

      {/* 財務月結算（按月明細；年報為年度合計） */}
      <div style={{ ...getCardStyle(isMobile), marginTop: '24px' }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: getFontSize('h3', isMobile),
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: designSystem.colors.text.primary
        }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: designSystem.colors.warning[500],
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          財務月結算
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            tableLayout: 'fixed'
          }}>
            <thead>
              <tr style={{ background: designSystem.colors.background.hover }}>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  borderBottom: `2px solid ${designSystem.colors.border.main}`
                }}>月份</th>
                <th style={{
                  padding: '12px',
                  textAlign: 'right',
                  borderBottom: `2px solid ${designSystem.colors.border.main}`
                }}>儲值</th>
                <th style={{
                  padding: '12px',
                  textAlign: 'right',
                  borderBottom: `2px solid ${designSystem.colors.border.main}`
                }}>VIP</th>
                <th style={{
                  padding: '12px',
                  textAlign: 'right',
                  borderBottom: `2px solid ${designSystem.colors.border.main}`
                }}>G23船券</th>
                <th style={{
                  padding: '12px',
                  textAlign: 'right',
                  borderBottom: `2px solid ${designSystem.colors.border.main}`
                }}>G21/黑豹</th>
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
                    background: idx === financeStats.length - 1
                      ? designSystem.colors.warning[50]
                      : 'white'
                  }}>
                    <td style={{
                      padding: '12px',
                      fontWeight: idx === financeStats.length - 1 ? '600' : '400'
                    }}>
                      {stat.month}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.info[500]
                    }}>
                      ${stat.balanceUsed.toLocaleString()}{getArrow(stat.balanceUsed, prev?.balanceUsed ?? null)}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.warning[700]
                    }}>
                      ${stat.vipUsed.toLocaleString()}{getArrow(stat.vipUsed, prev?.vipUsed ?? null)}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.success[500]
                    }}>
                      {stat.g23Used} 分{getArrow(stat.g23Used, prev?.g23Used ?? null)}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.warning[500]
                    }}>
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

