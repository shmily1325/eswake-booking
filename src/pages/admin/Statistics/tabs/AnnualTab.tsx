import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import {
  SummaryCard,
  SummaryCardsGrid,
  RankingCard,
  WeekdayRatioBar
} from '../components'
import type {
  MonthlyStats,
  FinanceStats,
  BoatData,
  CoachStats,
  MemberStats,
  WeekdayStats
} from '../types'
import { formatDuration, getYearDateRange } from '../utils'

interface AnnualTabProps {
  selectedYear: number
  setSelectedYear: (year: number) => void
  monthlyStats: MonthlyStats[]
  financeStats: FinanceStats[]
  allBoatsData: BoatData[]
  coachStats: CoachStats[]
  memberStats: MemberStats[]
  weekdayStats: WeekdayStats
}

function AnnualLineTooltipContent({
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
      border: `1px solid ${designSystem.colors.border.main}`,
      borderRadius: designSystem.borderRadius.md,
      padding: '12px 14px',
      boxShadow: designSystem.shadows.md,
      minWidth: '176px',
      maxHeight: 'min(70vh, 520px)',
      overflowY: 'auto'
    }}>
      <div style={{
        fontWeight: '600',
        marginBottom: '10px',
        color: designSystem.colors.text.primary
      }}>
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: getFontSize('bodySmall', false)
        }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontWeight: '600' }}>
            {p.dataKey === 'bookingCount' ? `${p.value} 筆` : formatDuration(Number(p.value))}
          </span>
        </div>
      ))}
      {data?.weekdayCount !== undefined && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          fontSize: getFontSize('caption', false),
          color: designSystem.colors.text.secondary
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>平日</span>
            <span>{data.weekdayCount} 筆</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>假日</span>
            <span>{data.weekendCount} 筆</span>
          </div>
        </div>
      )}
      {data && allBoatsData.length > 0 && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          fontSize: getFontSize('caption', false),
          color: designSystem.colors.text.secondary
        }}>
          <div style={{ marginBottom: '6px', fontWeight: '500' }}>各船／設施</div>
          {allBoatsData.map(boat => {
            const bm = data.boatMinutes?.find(b => b.boatId === boat.boatId)
            const minutes = bm?.minutes ?? 0
            return (
              <div key={boat.boatId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '2px',
                color: minutes > 0
                  ? designSystem.colors.text.primary
                  : designSystem.colors.text.disabled
              }}>
                <span>{boat.boatName}</span>
                <span>{formatDuration(minutes)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AnnualTab({
  selectedYear,
  setSelectedYear,
  monthlyStats,
  financeStats,
  allBoatsData,
  coachStats,
  memberStats,
  weekdayStats
}: AnnualTabProps) {
  const { isMobile } = useResponsive()
  const [subTab, setSubTab] = useState<'coach' | 'member'>('coach')
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  const totalBookings = monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0)
  const totalMinutes = monthlyStats.reduce((sum, m) => sum + m.totalMinutes, 0)
  const avgBookings = Math.round(totalBookings / Math.max(monthlyStats.length, 1))

  const financeTotals = financeStats.reduce(
    (acc, s) => ({
      balanceUsed: acc.balanceUsed + s.balanceUsed,
      vipUsed: acc.vipUsed + s.vipUsed,
      g23Used: acc.g23Used + s.g23Used,
      g21Used: acc.g21Used + s.g21Used,
    }),
    { balanceUsed: 0, vipUsed: 0, g23Used: 0, g21Used: 0 }
  )

  const yearRange = getYearDateRange(selectedYear)
  const rangeNote = yearRange
    ? `${yearRange.startDate} ~ ${yearRange.endDateStr}；已結帳／已處理口徑與月報相同${
        selectedYear === currentYear ? '（當年僅統計至昨日）' : ''
      }`
    : '此年尚無可統計之區間'

  return (
    <>
      {/* 年份選擇 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: designSystem.spacing.sm
        }}>
          {yearOptions.map(year => (
            <button
              key={year}
              data-track="dashboard_annual_year"
              type="button"
              onClick={() => setSelectedYear(year)}
              style={{
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: designSystem.borderRadius.md,
                border: selectedYear === year
                  ? 'none'
                  : `1px solid ${designSystem.colors.border.main}`,
                background: selectedYear === year
                  ? designSystem.colors.primary[500]
                  : 'white',
                color: selectedYear === year
                  ? 'white'
                  : designSystem.colors.text.secondary,
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: selectedYear === year ? '600' : '500',
                cursor: 'pointer',
                boxShadow: selectedYear === year ? designSystem.shadows.sm : 'none',
              }}
            >
              {year}年
              {year === currentYear && (
                <span style={{
                  marginLeft: '4px',
                  fontSize: isMobile ? '9px' : '10px',
                  opacity: 0.8
                }}>
                  今年
                </span>
              )}
            </button>
          ))}
        </div>
        <p style={{
          margin: 0,
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.secondary,
          lineHeight: 1.5
        }}>
          {rangeNote}
        </p>
        <div style={{ marginTop: designSystem.spacing.sm }}>
          <WeekdayRatioBar stats={weekdayStats} compact />
        </div>
      </div>

      {/* 年度摘要 */}
      <SummaryCardsGrid>
        <SummaryCard
          label={`${selectedYear} 已結帳`}
          value={totalBookings}
          unit="筆"
          accentColor={designSystem.colors.info[500]}
        />
        <SummaryCard
          label="已扣款時數"
          value={totalMinutes}
          unit="分"
          accentColor={designSystem.colors.success[500]}
        />
        <SummaryCard
          label="月均已結帳"
          value={avgBookings}
          unit="筆/月"
          accentColor={designSystem.colors.warning[500]}
        />
        <SummaryCard
          label="涵蓋月份"
          value={monthlyStats.length}
          unit="月"
          accentColor={designSystem.colors.primary[500]}
        />
      </SummaryCardsGrid>

      <SummaryCardsGrid>
        <SummaryCard
          label="儲值消耗"
          value={`$${financeTotals.balanceUsed.toLocaleString()}`}
          unit=""
          accentColor={designSystem.colors.info[500]}
        />
        <SummaryCard
          label="VIP 消耗"
          value={`$${financeTotals.vipUsed.toLocaleString()}`}
          unit=""
          accentColor={designSystem.colors.warning[500]}
        />
        <SummaryCard
          label="G23 船券"
          value={financeTotals.g23Used}
          unit="分"
          accentColor={designSystem.colors.success[500]}
        />
        <SummaryCard
          label="G21/黑豹船券"
          value={financeTotals.g21Used}
          unit="分"
          accentColor={designSystem.colors.primary[500]}
        />
      </SummaryCardsGrid>

      {/* 12 個月趨勢圖 */}
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
          {selectedYear} 年已結帳趨勢
          <span style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.disabled,
            fontWeight: '400'
          }}>
            （已扣款、不含教練練習）
          </span>
        </h3>
        {monthlyStats.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: designSystem.colors.text.disabled
          }}>
            此年尚無資料
          </div>
        ) : (
          <div
            className="annual-line-chart-unclip"
            style={{ width: '100%', height: isMobile ? 280 : 320, overflow: 'visible' }}
          >
            <style>{`
              .annual-line-chart-unclip .recharts-responsive-container,
              .annual-line-chart-unclip .recharts-wrapper {
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
                    <AnnualLineTooltipContent
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
        )}
      </div>

      {/* 月份明細表 */}
      {!isMobile && monthlyStats.length > 0 && (
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
                    padding: '12px',
                    textAlign: 'left',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap'
                  }}>月份</th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap'
                  }}>已結帳筆數</th>
                  <th style={{
                    padding: '12px',
                    textAlign: 'right',
                    borderBottom: `2px solid ${designSystem.colors.border.main}`,
                    borderRight: `1px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap'
                  }}>總時數</th>
                  {allBoatsData.map(boat => (
                    <th key={boat.boatId} style={{
                      padding: '12px 10px',
                      textAlign: 'right',
                      borderBottom: `2px solid ${designSystem.colors.border.main}`,
                      whiteSpace: 'nowrap',
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
                      padding: '12px',
                      fontWeight: idx === monthlyStats.length - 1 ? '600' : '400',
                      whiteSpace: 'nowrap'
                    }}>
                      {stat.month}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {stat.bookingCount}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      borderRight: `1px solid ${designSystem.colors.border.main}`,
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

      {isMobile && monthlyStats.length > 0 && (
        <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: getFontSize('h3', isMobile),
            fontWeight: '700',
            color: designSystem.colors.text.primary
          }}>
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
                    {stat.bookingCount} 筆
                  </span>
                </div>
                <div style={{
                  fontSize: getFontSize('bodySmall', true),
                  color: designSystem.colors.text.secondary
                }}>
                  總時數 {formatDuration(stat.totalMinutes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 財務明細 */}
      {financeStats.length > 0 && (
        <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: getFontSize(isMobile ? 'bodyLarge' : 'h3', isMobile),
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
            預約月結算
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
                {financeStats.map((stat, idx) => (
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
                      ${stat.balanceUsed.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.warning[700]
                    }}>
                      ${stat.vipUsed.toLocaleString()}
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.success[500]
                    }}>
                      {stat.g23Used} 分
                    </td>
                    <td style={{
                      padding: '12px',
                      textAlign: 'right',
                      color: designSystem.colors.warning[500]
                    }}>
                      {stat.g21Used} 分
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 教練／會員排行 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        <div style={{
          display: 'flex',
          gap: '0',
          background: designSystem.colors.background.hover,
          borderRadius: designSystem.borderRadius.md,
          padding: '4px'
        }}>
          <button
            data-track="dashboard_annual_sub_coach"
            type="button"
            onClick={() => setSubTab('coach')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: designSystem.borderRadius.md,
              border: 'none',
              background: subTab === 'coach' ? 'white' : 'transparent',
              color: subTab === 'coach'
                ? designSystem.colors.text.primary
                : designSystem.colors.text.secondary,
              fontSize: '14px',
              fontWeight: subTab === 'coach' ? '600' : '500',
              cursor: 'pointer',
              boxShadow: subTab === 'coach' ? designSystem.shadows.xs : 'none',
            }}
          >
            教練統計
          </button>
          <button
            data-track="dashboard_annual_sub_member"
            type="button"
            onClick={() => setSubTab('member')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: designSystem.borderRadius.md,
              border: 'none',
              background: subTab === 'member' ? 'white' : 'transparent',
              color: subTab === 'member'
                ? designSystem.colors.text.primary
                : designSystem.colors.text.secondary,
              fontSize: '14px',
              fontWeight: subTab === 'member' ? '600' : '500',
              cursor: 'pointer',
              boxShadow: subTab === 'member' ? designSystem.shadows.xs : 'none',
            }}
          >
            會員統計
          </button>
        </div>
      </div>

      {subTab === 'coach' && (
        <>
          <RankingCard
            title="教學時數排行"
            icon="🎓"
            subtitle="點擊查看指定學生"
            items={coachStats
              .filter(c => c.teachingMinutes > 0)
              .sort((a, b) => b.teachingMinutes - a.teachingMinutes)
              .map(c => ({
                id: c.coachId,
                name: c.coachName,
                value: c.teachingMinutes,
                count: c.designatedStudents.length
              }))}
            emptyText="本年無教學時數記錄"
            renderDetail={(item) => {
              const coach = coachStats.find(c => c.coachId === item.id)
              if (!coach || coach.designatedStudents.length === 0) return null
              return (
                <div>
                  <div style={{
                    fontSize: '13px',
                    color: designSystem.colors.text.secondary,
                    marginBottom: '10px',
                    fontWeight: '500'
                  }}>
                    指定 {coach.coachName} 的學生：
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {coach.designatedStudents.map((student, idx) => (
                      <div
                        key={student.memberId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: designSystem.colors.background.hover,
                          borderRadius: designSystem.borderRadius.sm
                        }}
                      >
                        <span style={{
                          fontSize: '13px',
                          color: designSystem.colors.text.primary
                        }}>
                          {idx + 1}. {student.memberName}
                          {student.boatMinutes.length > 0 && (
                            <span style={{
                              color: designSystem.colors.text.disabled,
                              fontWeight: '400',
                              marginLeft: '8px'
                            }}>
                              {student.boatMinutes.map((b, i) => (
                                <span key={b.boatName}>
                                  {b.boatName}: {b.minutes}分
                                  {i < student.boatMinutes.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: '13px',
                          color: designSystem.colors.warning[500],
                          fontWeight: '600',
                          flexShrink: 0,
                          marginLeft: '12px'
                        }}>
                          {formatDuration(student.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }}
          />

          <div style={{ marginTop: '16px' }}>
            <RankingCard
              title="駕駛時數排行"
              icon="🚤"
              items={coachStats
                .filter(c => c.drivingMinutes > 0)
                .sort((a, b) => b.drivingMinutes - a.drivingMinutes)
                .map(c => ({
                  id: `driving-${c.coachId}`,
                  name: c.coachName,
                  value: c.drivingMinutes
                }))}
              accentColor={designSystem.colors.success[500]}
              emptyText="本年無駕駛時數記錄"
            />
          </div>
        </>
      )}

      {subTab === 'member' && (
        <RankingCard
          title="會員時數排行"
          icon="👤"
          subtitle="點擊查看常用教練/船"
          items={memberStats.slice(0, 20).map(m => ({
            id: m.memberId,
            name: m.memberName,
            value: m.totalMinutes,
            count: m.bookingCount,
            badge: m.totalMinutes > 0
              ? `指定 ${Math.round(m.designatedMinutes / m.totalMinutes * 100)}%`
              : '指定 0%'
          }))}
          emptyText="本年無會員預約記錄"
          renderDetail={(item) => {
            const member = memberStats.find(m => m.memberId === item.id)
            if (!member) return null
            return (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {member.coaches.length > 0 && (
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{
                      fontSize: '13px',
                      color: designSystem.colors.text.secondary,
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      教練
                    </div>
                    {member.coaches.map((coach, idx) => (
                      <div
                        key={coach.coachName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '13px',
                          color: designSystem.colors.text.primary
                        }}
                      >
                        <span>{idx + 1}. {coach.coachName}</span>
                        <span style={{ color: designSystem.colors.info[500] }}>
                          {formatDuration(coach.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {member.boats.length > 0 && (
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{
                      fontSize: '13px',
                      color: designSystem.colors.text.secondary,
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      船
                    </div>
                    {member.boats.map((boat, idx) => (
                      <div
                        key={boat.boatName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '13px',
                          color: designSystem.colors.text.primary
                        }}
                      >
                        <span>{idx + 1}. {boat.boatName}</span>
                        <span style={{ color: designSystem.colors.success[500] }}>
                          {formatDuration(boat.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </>
  )
}
