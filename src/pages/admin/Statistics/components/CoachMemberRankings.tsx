import type { CSSProperties } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getButtonStyle, getFontSize } from '../../../../styles/designSystem'
import type {
  CoachPerformanceMetric,
  CoachPerformanceMetricRow,
} from '../../../../utils/coachPerformanceMetrics'
import { RankingCard } from './RankingCard'
import type { CoachStats, MemberStats } from '../types'
import { formatDuration } from '../utils'

type PeriodWord = '本月' | '本年'

interface CoachMemberRankingsProps {
  subTab: 'coach' | 'member'
  coachStats: CoachStats[]
  memberStats: MemberStats[]
  periodWord: PeriodWord
  coachMetric: 'service' | CoachPerformanceMetric
  performanceRows: CoachPerformanceMetricRow[]
  performanceLoading: boolean
  performanceError: string | null
  onRetryPerformance: () => void
}

export function CoachMemberRankings({
  subTab,
  coachStats,
  memberStats,
  periodWord,
  coachMetric,
  performanceRows,
  performanceLoading,
  performanceError,
  onRetryPerformance,
}: CoachMemberRankingsProps) {
  const { isMobile } = useResponsive()

  if (subTab === 'coach') {
    if (coachMetric !== 'service') {
      if (performanceLoading) {
        return (
          <div style={{
            padding: designSystem.spacing.xl,
            textAlign: 'center',
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('body', isMobile),
          }}>
            載入排行中…
          </div>
        )
      }
      if (performanceError) {
        return (
          <div style={{ padding: designSystem.spacing.xl, textAlign: 'center' }}>
            <div style={{
              marginBottom: designSystem.spacing.md,
              color: designSystem.colors.danger[700],
              fontSize: getFontSize('body', isMobile),
            }}>
              {performanceError}
            </div>
            <button
              type="button"
              onClick={onRetryPerformance}
              style={getButtonStyle('outline', 'small', isMobile)}
            >
              重新載入
            </button>
          </div>
        )
      }

      const config = {
        designated_lesson: {
          title: '指定單堂排行',
          subtitle: undefined,
          emptyText: `${periodWord}無指定單堂記錄`,
          trackId: 'dashboard_designated_lesson_ranking',
        },
        designated_credit: {
          title: '指定售出排行',
          subtitle: '僅計購買，不含贈送',
          emptyText: `${periodWord}無指定售出記錄`,
          trackId: 'dashboard_designated_credit_ranking',
        },
        product: {
          title: '商品銷售排行',
          subtitle: undefined,
          emptyText: `${periodWord}無商品銷售記錄`,
          trackId: 'dashboard_product_salesperson_ranking',
        },
      }[coachMetric]

      return (
        <RankingCard
          title={config.title}
          subtitle={config.subtitle}
          items={performanceRows}
          emptyText={config.emptyText}
          trackId={config.trackId}
          formatValue={coachMetric === 'product'
            ? (value) => `$${value.toLocaleString()}`
            : undefined}
          countUnit={coachMetric === 'product' ? '件' : '筆'}
        />
      )
    }

    return (
      <>
        <RankingCard
          title="教學時數排行"
          trackId="dashboard_teaching_ranking"
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
          emptyText={`${periodWord}無教學時數記錄`}
          renderDetail={(item) => {
            const coach = coachStats.find(c => c.coachId === item.id)
            if (!coach || coach.designatedStudents.length === 0) return null
            return (
              <div>
                <div style={{
                  fontSize: getFontSize('bodySmall', isMobile),
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
                        fontSize: getFontSize('bodySmall', isMobile),
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
                        fontSize: getFontSize('bodySmall', isMobile),
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
            items={coachStats
              .filter(c => c.drivingMinutes > 0)
              .sort((a, b) => b.drivingMinutes - a.drivingMinutes)
              .map(c => ({
                id: `driving-${c.coachId}`,
                name: c.coachName,
                value: c.drivingMinutes
              }))}
            emptyText={`${periodWord}無駕駛時數記錄`}
          />
        </div>
      </>
    )
  }

  return (
    <RankingCard
      title="會員時數排行"
      trackId="dashboard_member_ranking"
      subtitle="點擊查看常用教練/船"
      items={memberStats.slice(0, 30).map(m => ({
        id: m.memberId,
        name: m.memberName,
        value: m.totalMinutes,
        count: m.bookingCount,
        badge: m.totalMinutes > 0
          ? `指定 ${Math.round(m.designatedMinutes / m.totalMinutes * 100)}%`
          : '指定 0%'
      }))}
      emptyText={`${periodWord}無會員預約記錄`}
      renderDetail={(item) => {
        const member = memberStats.find(m => m.memberId === item.id)
        if (!member) return null
        return (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {member.coaches.length > 0 && (
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{
                  fontSize: getFontSize('bodySmall', isMobile),
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
                      fontSize: getFontSize('bodySmall', isMobile),
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
                  fontSize: getFontSize('bodySmall', isMobile),
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
                      fontSize: getFontSize('bodySmall', isMobile),
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
  )
}

export function getCoachMemberSubTabStyle(isActive: boolean, isMobile: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '10px 16px',
    borderRadius: designSystem.borderRadius.md,
    border: 'none',
    background: isActive ? 'white' : 'transparent',
    color: isActive
      ? designSystem.colors.text.primary
      : designSystem.colors.text.secondary,
    fontSize: getFontSize('button', isMobile),
    fontWeight: isActive ? '600' : '500',
    cursor: 'pointer',
    boxShadow: isActive ? designSystem.shadows.xs : 'none',
  }
}
