import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCoachDesignatedCreditReport } from '../pages/coach/designatedHours/api'
import type { CoachDesignatedCreditReportEntry } from '../pages/coach/designatedHours/types'
import {
  designSystem,
  getCardStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
import { getLocalDateString } from '../utils/formatters'
import { fetchAllInBatches, fetchAllPaginated } from '../utils/supabasePaginate'
import { DateRangePicker } from './DateRangePicker'
import { ProductSalesStatistics } from './ProductSalesStatistics'

interface Props {
  isMobile: boolean
  coachId?: string
}

interface CoachOption {
  id: string
  name: string
}

export interface DesignatedLessonParticipant {
  id: number
  coach_id: string
  duration_min: number | null
  participant_name: string | null
  payment_method?: string | null
  coaches: { name: string } | null
  members: { name: string; nickname: string | null } | null
  bookings: { start_at: string; boats?: { name: string } | null } | null
}

export interface DesignatedLessonTransaction {
  booking_participant_id: number | null
  category: string
  description: string | null
  payment_method?: string | null
}

export interface DesignatedLessonRow {
  id: number
  date: string
  time: string
  boatName: string
  memberName: string
  minutes: number
  hasTransaction: boolean
  settledWithoutTransaction: boolean
  paymentMethod: string
}

export interface DesignatedLessonGroup {
  coachId: string
  coachName: string
  minutes: number
  details: DesignatedLessonRow[]
}

export interface DesignatedCreditGroup {
  coachId: string
  coachName: string
  regularMinutes: number
  giftMinutes: number
  totalMinutes: number
  details: CoachDesignatedCreditReportEntry[]
}

function dateRange(value: string): { start: string; end: string } {
  if (value.length === 10) return { start: value, end: value }
  const [year, month] = value.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${value}-01`, end: `${value}-${String(lastDay).padStart(2, '0')}` }
}

function isDesignatedCharge(transaction: DesignatedLessonTransaction): boolean {
  return transaction.category === 'designated_lesson'
    || transaction.description?.includes('【指定課】') === true
}

function paymentMethodLabel(method?: string | null): string {
  const labels: Record<string, string> = {
    balance: '扣儲值',
    cash: '現金',
    transfer: '匯款',
    voucher: '票券',
  }
  return method ? labels[method] || method : '未記錄'
}

// Exported for report aggregation tests.
// eslint-disable-next-line react-refresh/only-export-components
export function buildDesignatedLessonGroups(
  participants: DesignatedLessonParticipant[],
  transactions: DesignatedLessonTransaction[],
): DesignatedLessonGroup[] {
  const transactionsByParticipant = new Map<number, DesignatedLessonTransaction[]>()
  for (const transaction of transactions) {
    if (transaction.booking_participant_id == null || !isDesignatedCharge(transaction)) continue
    const current = transactionsByParticipant.get(transaction.booking_participant_id) ?? []
    current.push(transaction)
    transactionsByParticipant.set(transaction.booking_participant_id, current)
  }

  const groups = new Map<string, DesignatedLessonGroup>()
  for (const participant of participants) {
    const charges = transactionsByParticipant.get(participant.id) ?? []
    const transactionMethods = [...new Set(
      charges.map((transaction) => transaction.payment_method).filter(Boolean) as string[],
    )]
    const fallbackMethod = participant.payment_method || null
    const settledWithoutTransaction = charges.length === 0
      && (fallbackMethod === 'cash' || fallbackMethod === 'transfer')
    const row: DesignatedLessonRow = {
      id: participant.id,
      date: participant.bookings?.start_at.slice(0, 10) ?? '—',
      time: participant.bookings?.start_at.slice(11, 16) ?? '—',
      boatName: participant.bookings?.boats?.name || '未知',
      memberName: participant.members?.nickname?.trim()
        || participant.members?.name
        || participant.participant_name
        || '未命名',
      minutes: Number(participant.duration_min || 0),
      hasTransaction: charges.length > 0,
      settledWithoutTransaction,
      paymentMethod: transactionMethods.length > 0
        ? transactionMethods.map(paymentMethodLabel).join('＋')
        : paymentMethodLabel(fallbackMethod),
    }
    const group = groups.get(participant.coach_id) ?? {
      coachId: participant.coach_id,
      coachName: participant.coaches?.name || '未知教練',
      minutes: 0,
      details: [],
    }
    group.minutes += row.minutes
    group.details.push(row)
    groups.set(group.coachId, group)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      details: group.details.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    }))
    .sort((a, b) => b.minutes - a.minutes || a.coachName.localeCompare(b.coachName))
}

// Exported for report aggregation tests.
// eslint-disable-next-line react-refresh/only-export-components
export function buildDesignatedCreditGroups(
  entries: CoachDesignatedCreditReportEntry[],
): DesignatedCreditGroup[] {
  const groups = new Map<string, DesignatedCreditGroup>()
  for (const entry of entries) {
    const group = groups.get(entry.coach_id) ?? {
      coachId: entry.coach_id,
      coachName: entry.coach_name,
      regularMinutes: 0,
      giftMinutes: 0,
      totalMinutes: 0,
      details: [],
    }
    group.regularMinutes += Number(entry.regular_minutes || 0)
    group.giftMinutes += Number(entry.gift_minutes || 0)
    group.totalMinutes += Number(entry.total_minutes || 0)
    group.details.push(entry)
    groups.set(group.coachId, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      details: group.details.sort((a, b) =>
        b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes || a.coachName.localeCompare(b.coachName))
}

export function PerformanceStatistics({ isMobile, coachId }: Props) {
  const [selectedDate, setSelectedDate] = useState(() =>
    coachId ? getLocalDateString().slice(0, 7) : getLocalDateString(),
  )
  const [selectedCoachId, setSelectedCoachId] = useState(coachId ?? 'all')
  const [coaches, setCoaches] = useState<CoachOption[]>([])

  useEffect(() => {
    if (coachId) setSelectedCoachId(coachId)
  }, [coachId])

  useEffect(() => {
    if (coachId) return
    let cancelled = false
    void supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setCoaches((data ?? []) as CoachOption[])
      })
    return () => {
      cancelled = true
    }
  }, [coachId])

  return (
    <div>
      <div style={{ ...getCardStyle(isMobile), marginBottom: isMobile ? 16 : 24 }}>
        <div style={{ marginBottom: coachId ? 0 : isMobile ? 16 : 20 }}>
          <DateRangePicker
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            isMobile={isMobile}
            showTodayButton={!isMobile}
            label="查詢期間"
            simplified
            trackPrefix={coachId ? 'coach_report_performance_period' : 'admin_statistics_performance_period'}
          />
        </div>
        {!coachId && (
          <div>
            <label style={getLabelStyle(isMobile)}>篩選教練</label>
            <select
              value={selectedCoachId}
              onChange={(event) => setSelectedCoachId(event.target.value)}
              data-track="admin_statistics_performance_coach"
              style={{ ...getInputStyle(isMobile), fontWeight: 500, cursor: 'pointer' }}
            >
              <option value="all">全部教練</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <DesignatedLessonStatistics
        isMobile={isMobile}
        selectedDate={selectedDate}
        selectedCoachId={selectedCoachId}
      />
      <DesignatedCreditStatistics
        isMobile={isMobile}
        selectedDate={selectedDate}
        selectedCoachId={selectedCoachId}
      />
      <ProductSalesStatistics
        isMobile={isMobile}
        selectedDate={selectedDate}
        selectedCoachId={selectedCoachId}
      />
    </div>
  )
}

function DesignatedLessonStatistics({
  isMobile,
  selectedDate,
  selectedCoachId,
}: {
  isMobile: boolean
  selectedDate: string
  selectedCoachId: string
}) {
  const [groups, setGroups] = useState<DesignatedLessonGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setGroups([])
      try {
        const range = dateRange(selectedDate)
        const participants = await fetchAllPaginated<DesignatedLessonParticipant>(async (from, to) => {
          let query = supabase
            .from('booking_participants')
            .select(`
              id, coach_id, duration_min, participant_name, payment_method,
              coaches:coach_id(name),
              members:member_id(name, nickname),
              bookings!inner(start_at, boats(name))
            `)
            .eq('status', 'processed')
            .eq('is_teaching', true)
            .eq('is_deleted', false)
            .eq('lesson_type', 'designated_paid')
            .gte('bookings.start_at', `${range.start}T00:00:00`)
            .lte('bookings.start_at', `${range.end}T23:59:59`)
          if (selectedCoachId !== 'all') query = query.eq('coach_id', selectedCoachId)
          const { data, error: queryError } = await query.order('id').range(from, to)
          return {
            data: data as unknown as DesignatedLessonParticipant[] | null,
            error: queryError,
          }
        })
        const transactions = await fetchAllInBatches<DesignatedLessonTransaction, number>(
          'transactions',
          'booking_participant_id, category, description, payment_method',
          'booking_participant_id',
          participants.map((participant) => participant.id),
          'id',
          250,
          (query) => query.eq('transaction_type', 'consume'),
          '指定課扣款',
        )
        if (!cancelled) setGroups(buildDesignatedLessonGroups(participants, transactions))
      } catch (cause) {
        if (!cancelled) {
          setGroups([])
          setError(cause instanceof Error ? cause.message : '載入指定課單堂失敗')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedCoachId, selectedDate])

  const totals = useMemo(() => groups.reduce(
    (sum, group) => ({
      minutes: sum.minutes + group.minutes,
      count: sum.count + group.details.length,
    }),
    { minutes: 0, count: 0 },
  ), [groups])

  return (
    <PerformanceSection
      title="指定課單堂"
      subtitle="依上課日；僅計指定需收費"
      isMobile={isMobile}
      loading={loading}
      error={error}
      empty={groups.length === 0}
      emptyText={selectedDate.length === 10 ? '當日無指定課單堂' : '當月無指定課單堂'}
      summary={`${totals.minutes} 分 · ${totals.count} 筆`}
    >
      {selectedCoachId === 'all' && groups.length > 1 && (
        <MinutesComparison
          title="指定課單堂時數對比"
          isMobile={isMobile}
          rows={groups.map((group) => ({
            id: group.coachId,
            name: group.coachName,
            minutes: group.minutes,
            detail: `${group.minutes}分 (${group.details.length}筆)`,
          }))}
        />
      )}
      <PerformanceGroupList
        key={`${selectedDate}-${selectedCoachId}-lessons`}
        isMobile={isMobile}
        showCoachName={selectedCoachId === 'all'}
        groups={groups.map((group) => ({
          id: group.coachId,
          name: group.coachName,
          summary: `${group.minutes}分 · ${group.details.length}筆`,
          headers: ['日期時間', '船隻', '會員', '分鐘', '收費方式'],
          rows: group.details.map((detail) => [
            `${detail.date} ${detail.time}`,
            detail.boatName,
            detail.memberName,
            `${detail.minutes}分`,
            detail.hasTransaction || detail.settledWithoutTransaction
              ? detail.paymentMethod
              : '未扣款／異常',
          ]),
        }))}
      />
    </PerformanceSection>
  )
}

function DesignatedCreditStatistics({
  isMobile,
  selectedDate,
  selectedCoachId,
}: {
  isMobile: boolean
  selectedDate: string
  selectedCoachId: string
}) {
  const [groups, setGroups] = useState<DesignatedCreditGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setGroups([])
      try {
        const range = dateRange(selectedDate)
        const entries = await fetchCoachDesignatedCreditReport({
          startAt: `${range.start}T00:00:00+08:00`,
          endAt: `${range.end}T23:59:59+08:00`,
          coachId: selectedCoachId === 'all' ? undefined : selectedCoachId,
        })
        if (!cancelled) setGroups(buildDesignatedCreditGroups(entries))
      } catch (cause) {
        if (!cancelled) {
          setGroups([])
          setError(cause instanceof Error ? cause.message : '載入指定課賣課失敗')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedCoachId, selectedDate])

  const totals = useMemo(() => groups.reduce(
    (sum, group) => ({
      regular: sum.regular + group.regularMinutes,
      gift: sum.gift + group.giftMinutes,
      total: sum.total + group.totalMinutes,
    }),
    { regular: 0, gift: 0, total: 0 },
  ), [groups])

  return (
    <PerformanceSection
      title="指定課售出時數"
      subtitle="依新增日"
      isMobile={isMobile}
      loading={loading}
      error={error}
      empty={groups.length === 0}
      emptyText={selectedDate.length === 10 ? '當日無指定課售出時數' : '當月無指定課售出時數'}
      summary={`總計 ${totals.total} 分 · 購買 ${totals.regular} 分 · 贈送 ${totals.gift} 分`}
    >
      {selectedCoachId === 'all' && groups.length > 1 && (
        <MinutesComparison
          title="指定課售出時數對比"
          isMobile={isMobile}
          rows={groups.map((group) => ({
            id: group.coachId,
            name: group.coachName,
            minutes: group.totalMinutes,
            detail: `${group.totalMinutes}分 (購買${group.regularMinutes}／贈送${group.giftMinutes})`,
          }))}
        />
      )}
      <PerformanceGroupList
        key={`${selectedDate}-${selectedCoachId}-credits`}
        isMobile={isMobile}
        showCoachName={selectedCoachId === 'all'}
        groups={groups.map((group) => ({
          id: group.coachId,
          name: group.coachName,
          summary: `總計 ${group.totalMinutes}分 · 購買 ${group.regularMinutes}分 · 贈送 ${group.giftMinutes}分`,
          headers: ['新增日', '會員', '購買', '贈送', '總分鐘', '備註'],
          rows: group.details.map((detail) => [
            detail.occurred_at.slice(0, 10),
            detail.member_name,
            `${detail.regular_minutes}分`,
            `${detail.gift_minutes}分`,
            `${detail.total_minutes}分`,
            detail.note || '—',
          ]),
        }))}
      />
    </PerformanceSection>
  )
}

function PerformanceSection({
  title,
  subtitle,
  isMobile,
  loading,
  error,
  empty,
  emptyText,
  summary,
  children,
}: {
  title: string
  subtitle: string
  isMobile: boolean
  loading: boolean
  error: string | null
  empty: boolean
  emptyText: string
  summary: string
  children: ReactNode
}) {
  return (
    <section style={{ marginBottom: designSystem.spacing.xl }}>
      <h2 style={{
        margin: '0 0 4px',
        fontSize: getFontSize('h3', isMobile),
        color: designSystem.colors.text.primary,
      }}>
        {title}
      </h2>
      <p style={{
        margin: '0 0 14px',
        fontSize: getFontSize('caption', isMobile),
        color: designSystem.colors.text.disabled,
      }}>
        {subtitle}
      </p>
      {loading ? (
        <StatusText isMobile={isMobile}>載入中...</StatusText>
      ) : error ? (
        <StatusText isMobile={isMobile} danger>{error}</StatusText>
      ) : empty ? (
        <StatusText isMobile={isMobile}>{emptyText}</StatusText>
      ) : (
        <>
          <div style={{
            marginBottom: 14,
            paddingBottom: 12,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
            fontSize: getFontSize('bodyLarge', isMobile),
            fontWeight: 600,
            color: designSystem.colors.text.primary,
          }}>
            {summary}
          </div>
          {children}
        </>
      )}
    </section>
  )
}

function StatusText({
  isMobile,
  danger = false,
  children,
}: {
  isMobile: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <div style={{
      padding: isMobile ? 24 : 32,
      textAlign: 'center',
      color: danger ? designSystem.colors.danger[700] : designSystem.colors.text.secondary,
    }}>
      {children}
    </div>
  )
}

function MinutesComparison({
  title,
  isMobile,
  rows,
}: {
  title: string
  isMobile: boolean
  rows: Array<{ id: string; name: string; minutes: number; detail: string }>
}) {
  const max = Math.max(1, ...rows.map((row) => row.minutes))
  return (
    <div style={{
      marginBottom: designSystem.spacing.lg,
      padding: isMobile ? 14 : designSystem.spacing.lg,
      background: designSystem.colors.background.card,
      border: `1px solid ${designSystem.colors.border.light}`,
      borderRadius: designSystem.borderRadius.lg,
    }}>
      <h3 style={{ margin: '0 0 14px', fontSize: getFontSize('h3', isMobile) }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row) => (
          <div key={row.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <strong>{row.name}</strong>
              <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
                {row.detail}
              </span>
            </div>
            <div style={{
              height: isMobile ? 6 : 8,
              overflow: 'hidden',
              borderRadius: designSystem.borderRadius.full,
              background: designSystem.colors.background.hover,
            }}>
              <div style={{
                width: `${(row.minutes / max) * 100}%`,
                height: '100%',
                borderRadius: designSystem.borderRadius.full,
                background: designSystem.colors.primary[500],
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PerformanceListGroup {
  id: string
  name: string
  summary: string
  headers: string[]
  rows: string[][]
}

function PerformanceGroupList({
  isMobile,
  showCoachName,
  groups,
}: {
  isMobile: boolean
  showCoachName: boolean
  groups: PerformanceListGroup[]
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
      {groups.map((group) => {
        const expanded = expandedIds.has(group.id)
        return (
          <div
            key={group.id}
            style={{
              overflow: 'hidden',
              border: `1px solid ${expanded ? designSystem.colors.border.dark : designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.lg,
              background: designSystem.colors.background.card,
            }}
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedIds((current) => {
                const next = new Set(current)
                if (next.has(group.id)) next.delete(group.id)
                else next.add(group.id)
                return next
              })}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? '12px 14px' : '14px 18px',
                border: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: designSystem.colors.text.primary,
                background: expanded ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
              }}
            >
              <span>
                {showCoachName && <strong style={{ display: 'block', marginBottom: 4 }}>{group.name}</strong>}
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
                  {group.summary}
                </span>
              </span>
              <span style={{
                color: designSystem.colors.text.disabled,
                transform: expanded ? 'rotate(90deg)' : 'none',
              }}>▶</span>
            </button>
            {expanded && (
              <div style={{ overflowX: 'auto', padding: '0 10px 10px', background: designSystem.colors.secondary[50] }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('bodySmall', isMobile) }}>
                  <thead>
                    <tr>
                      {group.headers.map((header) => (
                        <th
                          key={header}
                          style={{
                            padding: 8,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            color: designSystem.colors.text.secondary,
                            borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, rowIndex) => (
                      <tr key={`${group.id}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${group.id}-${rowIndex}-${cellIndex}`}
                            style={{
                              padding: 8,
                              whiteSpace: cellIndex === 1 ? 'normal' : 'nowrap',
                              color: cell.includes('異常')
                                ? designSystem.colors.danger[700]
                                : designSystem.colors.text.primary,
                            }}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
