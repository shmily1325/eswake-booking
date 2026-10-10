import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPillButton, AdminPillRow } from '../../../components/AdminPageLayout'
import { ClearableSearchInput } from '../../../components/ui/ClearableSearchInput'
import { useToast } from '../../../components/ui'
import { designSystem, getButtonStyle, getFontSize } from '../../../styles/designSystem'
import { getLocalDateString } from '../../../utils/date'
import { fetchAdminCoachDesignatedOverview } from './api'
import { CoachDesignatedHours } from './CoachDesignatedHours'
import type {
  AdminCoachDesignatedOverviewCoach,
  CoachDesignatedStudent,
} from './types'

interface AdminCoachDesignatedHoursProps {
  isMobile: boolean
}

type OverviewFilter = 'active' | 'used' | 'all'

function studentName(student: CoachDesignatedStudent): string {
  return student.nickname || student.name
}

function hasBalance(student: CoachDesignatedStudent): boolean {
  return (student.regular_balance ?? student.balance) !== 0
    || (student.gift_balance ?? 0) !== 0
}

function expiryText(student: CoachDesignatedStudent): string | null {
  const regular = student.regular_expires_on
  const gift = student.gift_expires_on
  if (!regular && !gift) return null
  const today = getLocalDateString()
  if (regular && regular === gift) {
    return `${regular < today ? '已逾使用期限' : '使用期限'} ${regular.replaceAll('-', '/')}`
  }
  return [
    regular
      ? `指定課 ${regular < today ? '已逾期' : '至'} ${regular.replaceAll('-', '/')}`
      : null,
    gift
      ? `贈送 ${gift < today ? '已逾期' : '至'} ${gift.replaceAll('-', '/')}`
      : null,
  ].filter(Boolean).join('・')
}

export function AdminCoachDesignatedHours({
  isMobile,
}: AdminCoachDesignatedHoursProps) {
  const toast = useToast()
  const [coaches, setCoaches] = useState<AdminCoachDesignatedOverviewCoach[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [filter, setFilter] = useState<OverviewFilter>('active')
  const [query, setQuery] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      setCoaches(await fetchAdminCoachDesignatedOverview())
    } catch (error) {
      console.error(error)
      toast.error('無法載入指定課總覽')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const selectedCoach = coaches.find((coach) => coach.coach_id === selectedCoachId) || null
  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-TW')
    return coaches
      .map((coach) => {
        const coachMatches = coach.coach_name.toLocaleLowerCase('zh-TW').includes(keyword)
        const students = coach.students.filter((student) => {
          const active = hasBalance(student)
          if (filter === 'active' && !active) return false
          if (filter === 'used' && active) return false
          if (!keyword || coachMatches) return true
          return `${student.name} ${student.nickname || ''}`
            .toLocaleLowerCase('zh-TW')
            .includes(keyword)
        })
        return { ...coach, students }
      })
      .filter((coach) => coach.students.length > 0)
  }, [coaches, filter, query])

  const openCoach = (coachId: string, memberId: string | null = null) => {
    setSelectedMemberId(memberId)
    setSelectedCoachId(coachId)
  }

  return (
    <section>
      <AdminPillRow
        style={{
          marginBottom: isMobile ? 14 : 18,
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          overflowX: isMobile ? 'auto' : 'visible',
        }}
      >
        <AdminPillButton
          active={selectedCoachId === null}
          onClick={() => {
            setSelectedCoachId(null)
            setSelectedMemberId(null)
            void loadOverview()
          }}
          data-track="admin_designated_overview"
        >
          總覽
        </AdminPillButton>
        {coaches.map((coach) => (
          <AdminPillButton
            key={coach.coach_id}
            active={selectedCoachId === coach.coach_id}
            onClick={() => openCoach(coach.coach_id)}
            data-track="admin_designated_coach"
          >
            {coach.coach_name}
          </AdminPillButton>
        ))}
      </AdminPillRow>

      {loading && coaches.length === 0 ? (
        <div style={{ color: designSystem.colors.text.secondary, padding: '28px 4px' }}>
          載入指定課總覽中…
        </div>
      ) : selectedCoach ? (
        <div>
          <div
            style={{
              marginBottom: isMobile ? 12 : 16,
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
            }}
          >
            目前管理：<strong style={{ color: designSystem.colors.text.primary }}>{selectedCoach.coach_name}</strong>
          </div>
          <CoachDesignatedHours
            key={`${selectedCoach.coach_id}:${selectedMemberId || ''}`}
            coachId={selectedCoach.coach_id}
            isMobile={isMobile}
            initialMemberId={selectedMemberId}
          />
        </div>
      ) : (
        <div>
          <ClearableSearchInput
            value={query}
            onValueChange={setQuery}
            isMobile={isMobile}
            placeholder="搜尋教練或學生"
            aria-label="搜尋教練或學生"
            dataTrack="admin_designated_search"
            containerStyle={{ maxWidth: 480, marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              ['active', '有餘額'],
              ['used', '已用完'],
              ['all', '全部'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  ...getButtonStyle(filter === value ? 'primary' : 'secondary', 'small', isMobile),
                  padding: isMobile ? '8px 13px' : '7px 13px',
                  minHeight: isMobile ? 40 : 36,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleGroups.length === 0 ? (
            <div
              style={{
                padding: isMobile ? '30px 14px' : '38px 18px',
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.background.card,
                textAlign: 'center',
                color: designSystem.colors.text.secondary,
              }}
            >
              {query ? '找不到符合的指定課資料' : '目前沒有符合的指定課資料'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: isMobile ? 12 : 16 }}>
              {visibleGroups.map((coach) => {
                const total = coach.students.reduce((sum, student) => sum + student.balance, 0)
                return (
                  <section
                    key={coach.coach_id}
                    style={{
                      border: `1px solid ${designSystem.colors.border.light}`,
                      borderRadius: designSystem.borderRadius.lg,
                      background: designSystem.colors.background.card,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: isMobile ? '13px 14px' : '14px 18px',
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 10,
                        borderBottom: `1px solid ${designSystem.colors.border.light}`,
                        background: designSystem.colors.background.hover,
                      }}
                    >
                      <strong style={{ fontSize: getFontSize('h3', isMobile) }}>
                        {coach.coach_name}
                      </strong>
                      <span
                        style={{
                          color: designSystem.colors.text.secondary,
                          fontSize: getFontSize('bodySmall', isMobile),
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {coach.students.length} 位・{total} 分
                      </span>
                    </div>
                    <div>
                      {coach.students.map((student, index) => {
                        const expiry = expiryText(student)
                        const expired = Boolean(
                          (student.regular_expires_on && student.regular_expires_on < getLocalDateString())
                          || (student.gift_expires_on && student.gift_expires_on < getLocalDateString()),
                        )
                        return (
                          <button
                            key={student.member_id}
                            type="button"
                            onClick={() => openCoach(coach.coach_id, student.member_id)}
                            data-track="admin_designated_student"
                            style={{
                              width: '100%',
                              border: 'none',
                              borderTop: index === 0
                                ? 'none'
                                : `1px solid ${designSystem.colors.border.light}`,
                              background: 'transparent',
                              padding: isMobile ? '13px 14px' : '13px 18px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              color: designSystem.colors.text.primary,
                            }}
                          >
                            <span style={{ minWidth: 0 }}>
                              <strong style={{ fontSize: getFontSize('body', isMobile) }}>
                                {studentName(student)}
                              </strong>
                              {expiry && (
                                <span
                                  style={{
                                    display: 'block',
                                    marginTop: 3,
                                    color: expired
                                      ? designSystem.colors.danger[700]
                                      : designSystem.colors.text.secondary,
                                    fontSize: getFontSize('caption', isMobile),
                                  }}
                                >
                                  {expiry}
                                </span>
                              )}
                            </span>
                            <span
                              style={{
                                flexShrink: 0,
                                textAlign: 'right',
                                fontSize: getFontSize('bodySmall', isMobile),
                              }}
                            >
                              <strong>{student.regular_balance ?? student.balance} 分</strong>
                              {student.has_gift_entries && (
                                <span
                                  style={{
                                    display: 'block',
                                    marginTop: 3,
                                    color: designSystem.colors.secondary[700],
                                    fontSize: getFontSize('caption', isMobile),
                                  }}
                                >
                                  贈送 {student.gift_balance ?? 0} 分
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
