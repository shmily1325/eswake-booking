/**
 * Design thinking (visual-only pass, docs/design.md):
 * 1. Why it felt dashboardy: 3-up KPI cards with rainbow left borders + emoji labels,
 *    dual chart cards with colored accent bars, badge chips in the coach list.
 * 2. Hierarchy: one quiet typography summary first; comparison bars stay for scan;
 *    coach detail list uses type weight over colored pills.
 * 3. Primary task: review teaching/driving hours for a period — props/API unchanged.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaginated } from '../utils/supabasePaginate'
import { extractDate, extractTime, getLocalDateString } from '../utils/formatters'
import { useToast } from './ui'
import { DateRangePicker } from './DateRangePicker'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getLabelStyle,
} from '../styles/designSystem'
import { AdminPillButton, AdminPillRow } from './AdminPageLayout'
import { PerformanceStatistics } from './PerformanceStatistics'
import { CoachLedgerOverview } from './CoachLedgerOverview'
import type {
  CoachLedgerMetricRows,
  CoachLedgerSection,
  LedgerLoadStatus,
  PerformanceLedgerSection,
} from './coachLedgerTypes'

interface CoachStats {
  coachId: string
  coachName: string
  teachingMinutes: number
  teachingCount: number
  drivingMinutes: number
  drivingCount: number
  totalMinutes: number
  details: BookingDetail[]
}

interface BookingDetail {
  bookingId: number
  date: string
  time: string
  boatName: string
  duration: number
  participants: ParticipantInfo[]
  driverDuration?: number
  contactName?: string
}

interface ParticipantInfo {
  name: string
  memberName?: string
  duration: number
  lessonType: string
}

interface TeachingRecord {
  id: number
  coach_id: string
  duration_min: number | null
  participant_name: string | null
  lesson_type: string
  bookings: {
    id: number
    start_at: string
    duration_min: number | null
    contact_name: string | null
    boats: { name: string } | null
  }
  coaches: { name: string } | null
  members: { name: string; nickname: string | null } | null
}

interface DrivingRecord {
  id: number
  booking_id: number
  coach_id: string
  driver_duration_min: number | null
  bookings: TeachingRecord['bookings']
  coaches: { name: string } | null
}

interface StatisticsTabProps {
  isMobile: boolean
  autoFilterCoachId?: string // 自动筛选特定教练（用于教练专用页面）
}

type StatisticsView = 'coach_overview' | CoachLedgerSection
const PERFORMANCE_SECTIONS: PerformanceLedgerSection[] = [
  'designated_lesson',
  'designated_credit',
  'product',
]

export function StatisticsTab({ isMobile, autoFilterCoachId }: StatisticsTabProps) {
  const toast = useToast()
  const [reportKind, setReportKind] = useState<StatisticsView>('service')
  // 如果是教練專用模式，預設顯示本月；否則顯示今天
  const [selectedDate, setSelectedDate] = useState(() => {
    if (autoFilterCoachId) {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
    return getLocalDateString()
  })
  const [selectedCoachId, setSelectedCoachId] = useState<string>(autoFilterCoachId || 'all')
  const [loading, setLoading] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<LedgerLoadStatus>('idle')
  const [serviceError, setServiceError] = useState<string | null>(null)
  const [serviceReloadToken, setServiceReloadToken] = useState(0)
  const [allCoachStats, setAllCoachStats] = useState<CoachStats[]>([]) // 完整列表
  const [coachStats, setCoachStats] = useState<CoachStats[]>([]) // 顯示用的過濾列表
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)
  const [detailDateSortOrder, setDetailDateSortOrder] = useState<'asc' | 'desc'>('asc')
  const [performanceRows, setPerformanceRows] = useState<CoachLedgerMetricRows>({
    designated_lesson: [],
    designated_credit: [],
    product: [],
  })
  const [performanceStatus, setPerformanceStatus] = useState<Record<PerformanceLedgerSection, LedgerLoadStatus>>({
    designated_lesson: 'idle',
    designated_credit: 'idle',
    product: 'idle',
  })
  const [performanceErrors, setPerformanceErrors] = useState<Partial<Record<PerformanceLedgerSection, string>>>({})
  const serviceRequestRef = useRef(0)
  const serviceDataKeyRef = useRef<string | null>(null)

  const handlePerformanceDataChange = useCallback((
    section: PerformanceLedgerSection,
    rows: CoachLedgerMetricRows[PerformanceLedgerSection],
  ) => {
    setPerformanceRows((current) => {
      const previous = current[section]
      if (
        previous.length === rows.length
        && previous.every((row, index) => (
          row.id === rows[index]?.id
          && row.value === rows[index]?.value
          && row.count === rows[index]?.count
          && row.regularValue === rows[index]?.regularValue
          && row.giftValue === rows[index]?.giftValue
        ))
      ) return current
      return { ...current, [section]: rows }
    })
  }, [])

  const handlePerformanceStatusChange = useCallback((
    section: PerformanceLedgerSection,
    status: LedgerLoadStatus,
    error?: string,
  ) => {
    setPerformanceStatus((current) => (
      current[section] === status ? current : { ...current, [section]: status }
    ))
    setPerformanceErrors((current) => {
      if (error) return { ...current, [section]: error }
      if (!(section in current)) return current
      const next = { ...current }
      delete next[section]
      return next
    })
  }, [])

  // 當 autoFilterCoachId 改變時，更新 selectedCoachId
  useEffect(() => {
    if (autoFilterCoachId) {
      setSelectedCoachId(autoFilterCoachId)
    }
  }, [autoFilterCoachId])

  useEffect(() => {
    setServiceStatus('idle')
    setServiceError(null)
  }, [autoFilterCoachId, selectedDate])

  useEffect(() => {
    setPerformanceRows({
      designated_lesson: [],
      designated_credit: [],
      product: [],
    })
    setPerformanceStatus({
      designated_lesson: 'idle',
      designated_credit: 'idle',
      product: 'idle',
    })
    setPerformanceErrors({})
  }, [selectedCoachId, selectedDate])

  useEffect(() => {
    setCoachStats(
      selectedCoachId === 'all'
        ? allCoachStats
        : allCoachStats.filter((coach) => coach.coachId === selectedCoachId),
    )
  }, [allCoachStats, selectedCoachId])

  useEffect(() => {
    if (reportKind !== 'service' && reportKind !== 'coach_overview') {
      serviceRequestRef.current += 1
      setLoading(false)
      setServiceStatus((current) => current === 'loading' ? 'idle' : current)
      return
    }
    const serviceDataKey = `${selectedDate}|${autoFilterCoachId ?? 'admin'}`
    if (serviceDataKeyRef.current === serviceDataKey && serviceStatus === 'success') {
      setLoading(false)
      return
    }
    // 換條件時先清空，避免新資料載入前畫面殘留前條件的統計數字
    setAllCoachStats([])
    setCoachStats([])
    loadPastData(serviceDataKey)
    // loadPastData reads exactly the filter state listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFilterCoachId, reportKind, selectedDate, serviceReloadToken])

  const loadPastData = async (serviceDataKey: string) => {
    if (!selectedDate) return

    const requestId = ++serviceRequestRef.current
    setLoading(true)
    setServiceStatus('loading')
    setServiceError(null)
    try {
      let startDate: string
      let endDateStr: string
      
      if (selectedDate.length === 10) {
        // 日期格式 YYYY-MM-DD
        startDate = selectedDate
        endDateStr = selectedDate
      } else {
        // 月份格式 YYYY-MM
        const [year, month] = selectedDate.split('-')
        startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
        endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`
      }

      // 1. 載入教學記錄
      const teachingData = await fetchAllPaginated<TeachingRecord>(async (from, to) => {
        let query = supabase
          .from('booking_participants')
          .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id, contact_name,
            boats(name)
          ),
          coaches:coach_id(id, name),
          members:member_id(name, nickname)
        `)
          .eq('status', 'processed')
          .eq('is_teaching', true)
          .eq('is_deleted', false)
          .gte('bookings.start_at', `${startDate}T00:00:00`)
          .lte('bookings.start_at', `${endDateStr}T23:59:59`)
        if (autoFilterCoachId) query = query.eq('coach_id', autoFilterCoachId)
        const { data, error } = await query
          .order('id', { ascending: true })
          .range(from, to)
        return { data: data as unknown as TeachingRecord[] | null, error }
      })

      // 2. 載入駕駛記錄
      const drivingData = await fetchAllPaginated<DrivingRecord>(async (from, to) => {
        let query = supabase
          .from('coach_reports')
          .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id, contact_name,
            boats(name)
          ),
          coaches:coach_id(id, name)
        `)
          .gte('bookings.start_at', `${startDate}T00:00:00`)
          .lte('bookings.start_at', `${endDateStr}T23:59:59`)
        if (autoFilterCoachId) query = query.eq('coach_id', autoFilterCoachId)
        const { data, error } = await query
          .order('id', { ascending: true })
          .range(from, to)
        return { data: data as unknown as DrivingRecord[] | null, error }
      })

      // 3. 整理數據
      const coachMap = new Map<string, CoachStats>()

      // 處理教學記錄
      teachingData.forEach((record) => {
        const coachId = record.coach_id
        const coachName = record.coaches?.name || '未知'
        
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, {
            coachId,
            coachName,
            teachingMinutes: 0,
            teachingCount: 0,
            drivingMinutes: 0,
            drivingCount: 0,
            totalMinutes: 0,
            details: []
          })
        }

        const stats = coachMap.get(coachId)!
        stats.teachingMinutes += record.duration_min || 0
        stats.teachingCount += 1

        const bookingId = record.bookings.id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
            bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: [],
            contactName: record.bookings.contact_name || ''
          }
          stats.details.push(detail)
        }

        detail.participants.push({
          name: record.participant_name || '未命名',
          memberName: record.members?.nickname || record.members?.name,
          duration: record.duration_min || 0,
          lessonType: getLessonTypeLabel(record.lesson_type)
        })
      })

      // 處理駕駛記錄
      drivingData.forEach((record) => {
        const coachId = record.coach_id
        const coachName = record.coaches?.name || '未知'
        
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, {
            coachId,
            coachName,
            teachingMinutes: 0,
            teachingCount: 0,
            drivingMinutes: 0,
            drivingCount: 0,
            totalMinutes: 0,
            details: []
          })
        }

        const stats = coachMap.get(coachId)!
        stats.drivingMinutes += record.driver_duration_min || 0
        stats.drivingCount += 1

        const bookingId = record.booking_id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
            bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: [],
            contactName: record.bookings.contact_name || ''
          }
          stats.details.push(detail)
        }

        detail.driverDuration = record.driver_duration_min ?? undefined
      })

      // 計算總時數並排序
      const statsArray = Array.from(coachMap.values())
      statsArray.forEach(stats => {
        stats.totalMinutes = stats.teachingMinutes + stats.drivingMinutes
        stats.details.sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare
          return a.time.localeCompare(b.time)
        })
      })

      statsArray.sort((a, b) => b.totalMinutes - a.totalMinutes)

      if (requestId !== serviceRequestRef.current) return

      // 保存完整列表供教練按鈕與總表共用
      serviceDataKeyRef.current = serviceDataKey
      setAllCoachStats(statsArray)
      setServiceStatus('success')

    } catch (error) {
      if (requestId !== serviceRequestRef.current) return
      console.error('載入數據失敗:', error)
      setServiceError(error instanceof Error ? error.message : '載入數據失敗')
      setServiceStatus('error')
      toast.error('載入數據失敗')
    } finally {
      if (requestId === serviceRequestRef.current) setLoading(false)
    }
  }

  const getLessonTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'undesignated': '不指定',
      'designated_paid': '指定（需收費）',
      'designated_free': '指定（不需收費）'
    }
    return labels[type] || type
  }

  const totalTeachingMinutes = coachStats.reduce((sum, s) => sum + s.teachingMinutes, 0)
  const totalDrivingMinutes = coachStats.reduce((sum, s) => sum + s.drivingMinutes, 0)
  const totalBookings = new Set(coachStats.flatMap(s => s.details.map(d => d.bookingId))).size
  const coachOptions = useMemo(() => {
    const options = new Map<string, string>()
    allCoachStats.forEach((coach) => options.set(coach.coachId, coach.coachName))
    Object.values(performanceRows).flat().forEach((coach) => options.set(coach.id, coach.name))
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .filter((coach) => coach.id !== 'unassigned')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allCoachStats, performanceRows])
  const overviewPendingSection = reportKind === 'coach_overview' && serviceStatus === 'success'
    ? PERFORMANCE_SECTIONS.find((section) => performanceStatus[section] === 'loading')
      ?? PERFORMANCE_SECTIONS.find((section) => performanceStatus[section] === 'idle')
    : undefined
  const activePerformanceSection: PerformanceLedgerSection | null =
    reportKind === 'designated_lesson'
      || reportKind === 'designated_credit'
      || reportKind === 'product'
      ? reportKind
      : overviewPendingSection ?? null
  const overviewErrors = [
    ...(serviceError ? [serviceError] : []),
    ...PERFORMANCE_SECTIONS
      .map((section) => performanceErrors[section])
      .filter((message): message is string => Boolean(message)),
  ]
  const overviewReady = serviceStatus === 'success'
    && PERFORMANCE_SECTIONS.every((section) => performanceStatus[section] === 'success')
  const retryOverview = () => {
    if (serviceStatus === 'error') setServiceReloadToken((value) => value + 1)
    setPerformanceStatus((current) => ({
      designated_lesson: current.designated_lesson === 'error' ? 'idle' : current.designated_lesson,
      designated_credit: current.designated_credit === 'error' ? 'idle' : current.designated_credit,
      product: current.product === 'error' ? 'idle' : current.product,
    }))
    setPerformanceErrors({})
  }

  const controlRowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: isMobile ? designSystem.spacing.sm : designSystem.spacing.md,
    minWidth: 0,
  } as const
  const controlLabelStyle = {
    ...getLabelStyle(isMobile),
    flex: `0 0 ${isMobile ? '36px' : '44px'}`,
    marginBottom: 0,
    paddingTop: 10,
  }

  const reportKindToggle = (
    <div style={controlRowStyle}>
      <div style={controlLabelStyle}>報表</div>
      <AdminPillRow style={{ flex: 1, minWidth: 0, padding: 0 }}>
        <AdminPillButton
          active={reportKind === 'service'}
          onClick={() => setReportKind('service')}
          data-track="statistics_service_open"
        >
          教學／駕駛
        </AdminPillButton>
        <AdminPillButton
          active={reportKind === 'designated_lesson'}
          onClick={() => setReportKind('designated_lesson')}
          data-track="statistics_designated_lesson_open"
        >
          指定單堂
        </AdminPillButton>
        <AdminPillButton
          active={reportKind === 'designated_credit'}
          onClick={() => setReportKind('designated_credit')}
          data-track="statistics_designated_credit_open"
        >
          指定售出
        </AdminPillButton>
        <AdminPillButton
          active={reportKind === 'product'}
          onClick={() => setReportKind('product')}
          data-track="statistics_product_open"
        >
          商品
        </AdminPillButton>
        {!autoFilterCoachId && (
          <AdminPillButton
            active={reportKind === 'coach_overview'}
            onClick={() => setReportKind('coach_overview')}
            data-track="statistics_coach_overview_open"
          >
            教練總表
          </AdminPillButton>
        )}
      </AdminPillRow>
    </div>
  )

  return (
    <div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 12 : 14,
        padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
        background: designSystem.colors.background.card,
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.xl,
        boxShadow: designSystem.shadows.elevation[1],
        marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
      }}>
        <div style={controlRowStyle}>
          <div style={controlLabelStyle}>期間</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <DateRangePicker
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              isMobile={isMobile}
              showTodayButton={!isMobile}
              label=""
              simplified={true}
              singleLine={true}
              trackPrefix={autoFilterCoachId ? 'coach_report_ledger_period' : 'admin_statistics_ledger_period'}
            />
          </div>
        </div>
        {reportKindToggle}

        {/* 教練篩選 - 教練端固定本人，因此不顯示這一列 */}
        {!autoFilterCoachId && (
          <div style={controlRowStyle}>
            <div style={controlLabelStyle}>教練</div>
            <AdminPillRow style={{ flex: 1, minWidth: 0, padding: 0 }}>
              <AdminPillButton
                active={selectedCoachId === 'all'}
                onClick={() => setSelectedCoachId('all')}
                data-track="admin_statistics_ledger_coach_all"
              >
                全部教練
              </AdminPillButton>
              {coachOptions.map((coach) => (
                <AdminPillButton
                  key={coach.id}
                  active={selectedCoachId === coach.id}
                  onClick={() => setSelectedCoachId(coach.id)}
                  data-track={`admin_statistics_ledger_coach_${coach.id}`}
                >
                  {coach.name}
                </AdminPillButton>
              ))}
            </AdminPillRow>
          </div>
        )}
      </div>

      {reportKind === 'coach_overview' && (
        overviewReady ? (
          <CoachLedgerOverview
            isMobile={isMobile}
            serviceRows={coachStats}
            performanceRows={performanceRows}
          />
        ) : overviewErrors.length > 0 && !overviewPendingSection ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              marginBottom: 12,
              color: designSystem.colors.danger[700],
              fontSize: getFontSize('body', isMobile),
            }}>
              總表載入失敗：{overviewErrors[0]}
            </div>
            <button
              type="button"
              onClick={retryOverview}
              style={getButtonStyle('outline', 'small', isMobile)}
            >
              重新載入
            </button>
          </div>
        ) : (
          <div style={{
            padding: 40,
            textAlign: 'center',
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('body', isMobile),
          }}>
            正在載入完整總表...
          </div>
        )
      )}

      {activePerformanceSection && (
        <div hidden={reportKind === 'coach_overview'}>
          <PerformanceStatistics
            key={`${selectedDate}-${selectedCoachId}-${activePerformanceSection}`}
            isMobile={isMobile}
            section={activePerformanceSection}
            selectedDate={selectedDate}
            selectedCoachId={selectedCoachId}
            onSectionDataChange={handlePerformanceDataChange}
            onSectionStatusChange={handlePerformanceStatusChange}
          />
        </div>
      )}

      {reportKind === 'service' && (loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary, fontSize: getFontSize('body', isMobile) }}>
          載入中...
        </div>
      ) : serviceError ? (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{
            marginBottom: 12,
            color: designSystem.colors.danger[700],
            fontSize: getFontSize('body', isMobile),
          }}>
            {serviceError}
          </div>
          <button
            type="button"
            onClick={() => setServiceReloadToken((value) => value + 1)}
            style={getButtonStyle('outline', 'small', isMobile)}
          >
            重新載入
          </button>
        </div>
      ) : coachStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary, fontSize: getFontSize('body', isMobile) }}>
          {selectedDate.length === 10 ? '當日無記錄' : '當月無記錄'}
        </div>
      ) : (
        <>
          {/* 統計摘要 — 平靜排版，非 KPI 卡片牆 */}
          <div style={{
            marginBottom: designSystem.spacing.xl,
            paddingBottom: designSystem.spacing.md,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
          }}>
            <div style={{
              display: isMobile ? 'grid' : 'block',
              gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : undefined,
              gap: isMobile ? designSystem.spacing.sm : 0,
            }}>
              {[
                { label: '教學', minutes: totalTeachingMinutes },
                { label: '駕駛', minutes: totalDrivingMinutes },
              ].map((metric) => (
                <div
                  key={metric.label}
                  style={isMobile ? {
                    padding: '10px 12px',
                    background: designSystem.colors.background.card,
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderRadius: designSystem.borderRadius.md,
                  } : {
                    display: 'inline',
                    fontSize: getFontSize('bodyLarge', false),
                    color: designSystem.colors.text.primary,
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{
                    display: isMobile ? 'block' : 'inline',
                    fontSize: getFontSize(isMobile ? 'bodySmall' : 'bodyLarge', isMobile),
                    color: isMobile ? designSystem.colors.text.secondary : designSystem.colors.text.primary,
                    fontWeight: isMobile ? 500 : 600,
                  }}>
                    {metric.label}{' '}
                  </span>
                  <strong style={{
                    fontSize: getFontSize('bodyLarge', isMobile),
                    color: designSystem.colors.text.primary,
                  }}>
                    {metric.minutes} 分
                  </strong>
                  <span style={{
                    display: isMobile ? 'block' : 'inline',
                    marginTop: isMobile ? 2 : 0,
                    color: designSystem.colors.text.disabled,
                    fontSize: getFontSize('bodySmall', isMobile),
                    fontWeight: 400,
                  }}>
                    {isMobile ? '' : ' '}（{(metric.minutes / 60).toFixed(1)} 小時）
                  </span>
                  {!isMobile && metric.label === '教學' && (
                    <span style={{ color: designSystem.colors.text.disabled, margin: '0 10px' }}>·</span>
                  )}
                </div>
              ))}
            </div>
            <p style={{
              margin: `${designSystem.spacing.xs} 0 0`,
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.secondary,
            }}>
              {totalBookings} 筆預約
            </p>
          </div>

          {/* 比較圖只在同時顯示多位教練時出現；單一教練直接進入細帳。 */}
          {coachStats.length > 1 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
              marginBottom: designSystem.spacing.xl,
            }}>
            {/* 教學時數圖表 */}
            <div style={{
              padding: isMobile ? '14px' : designSystem.spacing.lg,
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <h3 style={{ 
                margin: `0 0 ${isMobile ? '12px' : '16px'} 0`,
                fontSize: getFontSize('h3', isMobile), 
                fontWeight: '600', 
                color: designSystem.colors.text.primary,
              }}>
                教學時數對比
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
                {coachStats.map(stat => (
                  <div key={`teaching-${stat.coachId}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: getFontSize('body', isMobile), fontWeight: '600', color: designSystem.colors.text.primary }}>
                        {stat.coachName}
                      </span>
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                        {stat.teachingMinutes}分 ({stat.teachingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: isMobile ? '6px' : '8px',
                      background: designSystem.colors.background.hover,
                      borderRadius: designSystem.borderRadius.full,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${(stat.teachingMinutes / Math.max(...coachStats.map(s => s.teachingMinutes), 1)) * 100}%`,
                          height: '100%',
                          background: designSystem.colors.primary[500],
                          borderRadius: designSystem.borderRadius.full,
                          transition: 'width 0.3s'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 駕駛時數圖表 */}
            <div style={{
              padding: isMobile ? '14px' : designSystem.spacing.lg,
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <h3 style={{ 
                margin: `0 0 ${isMobile ? '12px' : '16px'} 0`,
                fontSize: getFontSize('h3', isMobile), 
                fontWeight: '600', 
                color: designSystem.colors.text.primary,
              }}>
                駕駛時數對比
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
                {coachStats.map(stat => (
                  <div key={`driving-${stat.coachId}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: getFontSize('body', isMobile), fontWeight: '600', color: designSystem.colors.text.primary }}>
                        {stat.coachName}
                      </span>
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                        {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: isMobile ? '6px' : '8px',
                      background: designSystem.colors.background.hover,
                      borderRadius: designSystem.borderRadius.full,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${(stat.drivingMinutes / Math.max(...coachStats.map(s => s.drivingMinutes), 1)) * 100}%`,
                          height: '100%',
                          background: designSystem.colors.secondary[500],
                          borderRadius: designSystem.borderRadius.full,
                          transition: 'width 0.3s'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}

          {/* 教練列表（可展開細帳） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: getFontSize('h3', isMobile), 
              fontWeight: '600', 
              color: designSystem.colors.text.primary,
            }}>
              教練細帳
            </h2>
            {coachStats.map(stat => (
              <div key={stat.coachId} style={{
                padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
                background: designSystem.colors.background.card,
                borderRadius: designSystem.borderRadius.lg,
                border: expandedCoachId === stat.coachId
                  ? `1px solid ${designSystem.colors.border.dark}`
                  : `1px solid ${designSystem.colors.border.light}`,
                transition: 'border-color 0.2s'
              }}>
                {/* 教練標題 */}
                <div
                  onClick={() => setExpandedCoachId(expandedCoachId === stat.coachId ? null : stat.coachId)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '4px 0',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: getFontSize('bodyLarge', isMobile), 
                      fontWeight: '600', 
                      color: designSystem.colors.text.primary,
                      marginBottom: '6px'
                    }}>
                      {stat.coachName}
                    </h3>
                    <div style={{ 
                      fontSize: getFontSize('bodySmall', isMobile), 
                      color: designSystem.colors.text.secondary,
                      display: isMobile ? 'grid' : 'flex',
                      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : undefined,
                      gap: isMobile ? '6px 12px' : '12px',
                      flexWrap: isMobile ? undefined : 'wrap'
                    }}>
                      <span>
                        教學 {stat.teachingMinutes}分 ({stat.teachingCount}筆)
                      </span>
                      {!isMobile && <span style={{ color: designSystem.colors.text.disabled }}>·</span>}
                      <span>
                        駕駛 {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                      </span>
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: getFontSize('caption', isMobile),
                    color: designSystem.colors.text.disabled,
                    marginLeft: '16px',
                    transition: 'transform 0.2s',
                    transform: expandedCoachId === stat.coachId ? 'rotate(90deg)' : 'rotate(0deg)'
                  }}>
                    ▶
                  </div>
                </div>

                {/* 細帳 */}
                {expandedCoachId === stat.coachId && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${designSystem.colors.border.light}`, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('bodySmall', isMobile) }}>
                      <thead>
                        <tr style={{ background: designSystem.colors.background.hover }}>
                          <th
                            aria-sort={detailDateSortOrder === 'asc' ? 'ascending' : 'descending'}
                            style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}
                          >
                            <button
                              type="button"
                              data-track="coach_ledger_date_sort"
                              onClick={() => setDetailDateSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
                              aria-label={`日期時間，目前${detailDateSortOrder === 'asc' ? '由早到晚' : '由晚到早'}，點擊切換排序`}
                              style={{
                                padding: 0,
                                border: 0,
                                background: 'transparent',
                                color: 'inherit',
                                font: 'inherit',
                                cursor: 'pointer',
                              }}
                            >
                              日期時間 {detailDateSortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                          </th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>船隻</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>學員</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>教學</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>駕駛</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...stat.details]
                          .sort((a, b) => {
                            const comparison = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
                            return detailDateSortOrder === 'asc' ? comparison : -comparison
                          })
                          .map((detail, idx) => (
                          <tr key={`${detail.bookingId}-${idx}`} style={{ borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
                            <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: '600', color: designSystem.colors.text.primary }}>{detail.date}</div>
                              <div style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile) }}>{detail.time}</div>
                              {detail.contactName && (
                                <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile), marginTop: '2px' }}>{detail.contactName}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ color: designSystem.colors.text.secondary }}>{detail.boatName}</div>
                              <div style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile) }}>({detail.duration}分)</div>
                            </td>
                            <td style={{ padding: '10px' }}>
                              {detail.participants.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {detail.participants.map((p, pIdx) => (
                                    <div key={pIdx}>
                                      {p.memberName ? (
                                        <span style={{ color: designSystem.colors.text.primary, fontWeight: '600' }}>{p.memberName}</span>
                                      ) : (
                                        <span style={{ color: designSystem.colors.text.primary }}>{p.name}</span>
                                      )}
                                      <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile), marginLeft: '4px' }}>
                                        {p.lessonType} {p.duration}分
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {detail.participants.length > 0 ? (
                                <span style={{ color: designSystem.colors.text.primary, fontWeight: '600' }}>
                                  {detail.participants.reduce((sum, p) => sum + p.duration, 0)}分
                                </span>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {detail.driverDuration ? (
                                <span style={{ color: designSystem.colors.text.primary, fontWeight: '600' }}>{detail.driverDuration}分</span>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
                              )}
                            </td>
                          </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  )
}

