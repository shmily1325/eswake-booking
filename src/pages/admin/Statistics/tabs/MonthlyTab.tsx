import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem } from '../../../../styles/designSystem'
import { RankingCard, WeekdayRatioBar } from '../components'
import type { CoachStats, MemberStats, WeekdayStats } from '../types'
import { formatDuration } from '../utils'

interface MonthlyTabProps {
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
  coachStats: CoachStats[]
  memberStats: MemberStats[]
  weekdayStats: WeekdayStats
}

export function MonthlyTab({
  selectedPeriod,
  setSelectedPeriod,
  coachStats,
  memberStats,
  weekdayStats
}: MonthlyTabProps) {
  const { isMobile } = useResponsive()
  const [subTab, setSubTab] = useState<'coach' | 'member'>('coach')

  // 快速月份選擇
  const getQuickMonths = () => {
    const months = []
    const now = new Date()
    const currentYear = now.getFullYear()
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      // 如果不是當年，顯示年份
      const label = year !== currentYear 
        ? `${year}/${month}月`
        : `${month}月`
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label
      })
    }
    return months
  }

  const quickMonths = getQuickMonths()
  const isCurrentMonth = (m: string) => m === quickMonths[0].value

  return (
    <>
      {/* 月份選擇器 */}
      <div style={{
        backgroundColor: 'white',
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        {/* 快速月份按鈕 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: designSystem.spacing.sm
        }}>
          {quickMonths.slice(0, isMobile ? 4 : 6).map(m => (
            <button
              key={m.value}
              data-track="dashboard_month"
              onClick={() => setSelectedPeriod(m.value)}
              style={{
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: designSystem.borderRadius.md,
                border: selectedPeriod === m.value ? 'none' : `1px solid ${designSystem.colors.border.main}`,
                background: selectedPeriod === m.value
                  ? 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)'
                  : 'white',
                color: selectedPeriod === m.value ? 'white' : '#666',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: selectedPeriod === m.value ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selectedPeriod === m.value ? '0 2px 8px rgba(74,144,226,0.3)' : 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {m.label}
              {isCurrentMonth(m.value) && (
                <span style={{
                  marginLeft: '4px',
                  fontSize: isMobile ? '9px' : '10px',
                  opacity: 0.8
                }}>
                  本月
                </span>
              )}
            </button>
          ))}
          {/* 更多月份 - 使用 select 替代 input[type=month] 避免英文 */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: isMobile ? '8px 10px' : '10px 12px',
              borderRadius: designSystem.borderRadius.md,
              border: `1px solid ${designSystem.colors.border.main}`,
              fontSize: isMobile ? '13px' : '14px',
              color: '#666',
              cursor: 'pointer',
              background: '#f8f9fa',
              flexShrink: 0,
            }}
          >
            {/* 產生過去 24 個月的選項 */}
            {Array.from({ length: 24 }, (_, i) => {
              const date = new Date()
              date.setMonth(date.getMonth() - i)
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              const label = `${date.getFullYear()}年${date.getMonth() + 1}月`
              return <option key={value} value={value}>{label}</option>
            })}
          </select>
        </div>

        {/* 子 Tab 按鈕 */}
        <div style={{
          display: 'flex',
          gap: '0',
          background: '#f0f0f0',
          borderRadius: designSystem.borderRadius.md,
          padding: '4px'
        }}>
          <button
            data-track="dashboard_month_sub_coach"
            onClick={() => setSubTab('coach')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: designSystem.borderRadius.md,
              border: 'none',
              background: subTab === 'coach' ? 'white' : 'transparent',
              color: subTab === 'coach' ? '#333' : '#666',
              fontSize: '14px',
              fontWeight: subTab === 'coach' ? '600' : '500',
              cursor: 'pointer',
              boxShadow: subTab === 'coach' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🎓 教練統計
          </button>
          <button
            data-track="dashboard_month_sub_member"
            onClick={() => setSubTab('member')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: designSystem.borderRadius.md,
              border: 'none',
              background: subTab === 'member' ? 'white' : 'transparent',
              color: subTab === 'member' ? '#333' : '#666',
              fontSize: '14px',
              fontWeight: subTab === 'member' ? '600' : '500',
              cursor: 'pointer',
              boxShadow: subTab === 'member' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            👤 會員統計
          </button>
        </div>

        {/* 平日/假日比例條 */}
        <div style={{ marginTop: designSystem.spacing.sm }}>
          <WeekdayRatioBar stats={weekdayStats} compact />
        </div>
      </div>

      {/* 教練統計 */}
      {subTab === 'coach' && (
        <>
          {/* 教學時數排行 */}
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
            accentColor="#4a90e2"
            emptyText="本月無教學時數記錄"
            renderDetail={(item) => {
              const coach = coachStats.find(c => c.coachId === item.id)
              if (!coach || coach.designatedStudents.length === 0) return null
              return (
                <div>
                  <div style={{
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: '10px',
                    fontWeight: '500'
                  }}>
                    ⭐ 指定 {coach.coachName} 的學生：
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
                          background: '#fafafa',
                          borderRadius: '6px'
                        }}
                      >
                        <span style={{ fontSize: '13px', color: '#333' }}>
                          {idx + 1}. {student.memberName}
                          {student.boatMinutes.length > 0 && (
                            <span style={{ color: '#888', fontWeight: '400', marginLeft: '8px' }}>
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
                          color: '#ff9800',
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

          {/* 駕駛時數排行 */}
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
              accentColor="#50c878"
              emptyText="本月無駕駛時數記錄"
            />
          </div>
        </>
      )}

      {/* 會員統計 */}
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
            badge: m.totalMinutes > 0 ? `指定 ${Math.round(m.designatedMinutes / m.totalMinutes * 100)}%` : '指定 0%'
          }))}
          accentColor="#4a90e2"
          emptyText="本月無會員預約記錄"
          renderDetail={(item) => {
            const member = memberStats.find(m => m.memberId === item.id)
            if (!member) return null
            return (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* 常用教練 */}
                {member.coaches.length > 0 && (
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#666',
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      🎓 教練
                    </div>
                    {member.coaches.map((coach, idx) => (
                      <div
                        key={coach.coachName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '13px',
                          color: '#333'
                        }}
                      >
                        <span>{idx + 1}. {coach.coachName}</span>
                        <span style={{ color: '#4a90e2' }}>{formatDuration(coach.minutes)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 常用船 */}
                {member.boats.length > 0 && (
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{
                      fontSize: '13px',
                      color: '#666',
                      marginBottom: '8px',
                      fontWeight: '500'
                    }}>
                      🚤 船
                    </div>
                    {member.boats.map((boat, idx) => (
                      <div
                        key={boat.boatName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '13px',
                          color: '#333'
                        }}
                      >
                        <span>{idx + 1}. {boat.boatName}</span>
                        <span style={{ color: '#50c878' }}>{formatDuration(boat.minutes)}</span>
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

