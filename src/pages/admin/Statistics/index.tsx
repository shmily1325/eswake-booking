import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { useResponsive } from '../../../hooks/useResponsive'
import { getLocalDateString } from '../../../utils/date'
import { sortBoatsByDisplayOrder } from '../../../utils/boatUtils'
import { isEditorAsync } from '../../../utils/auth'

import { LoadingSkeleton, LastUpdated } from './components'
import { TrendTab, MonthlyTab, FutureTab } from './tabs'
import type {
  MonthlyStats,
  CoachFutureBooking,
  CoachStats,
  MemberStats,
  FinanceStats,
  WeekdayStats,
  BoatData
} from './types'

type TabType = 'trend' | 'monthly' | 'future'

export function Statistics() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState<TabType>('trend')

  // 趨勢數據
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [financeStats, setFinanceStats] = useState<FinanceStats[]>([])
  const [allBoatsData, setAllBoatsData] = useState<BoatData[]>([])

  // 未來預約數據
  const [futureBookings, setFutureBookings] = useState<CoachFutureBooking[]>([])
  const [futureWeekdayStats, setFutureWeekdayStats] = useState<WeekdayStats>({
    weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0
  })

  // 月度統計數據
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [coachStats, setCoachStats] = useState<CoachStats[]>([])
  const [memberStats, setMemberStats] = useState<MemberStats[]>([])
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStats>({
    weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0
  })

  // Tab 配置（重新命名）
  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'trend', label: '歷史趨勢', icon: '📈' },
    { key: 'monthly', label: '月報分析', icon: '🎯' },
    { key: 'future', label: '排程預覽', icon: '📅' }
  ]

  // 載入所有船隻
  const loadAllBoats = async () => {
    const { data } = await supabase.from('boats').select('id, name')
    if (data) {
      const sorted = sortBoatsByDisplayOrder(data)
      setAllBoatsData(sorted.map(b => ({ boatId: b.id, boatName: b.name })))
    }
  }

  // 載入過去6個月的預約趨勢
  const loadMonthlyTrend = async () => {
    const months: MonthlyStats[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const startDate = `${monthStr}-01`
      const endDate = new Date(year, month, 0).getDate()
      const endDateStr = `${monthStr}-${String(endDate).padStart(2, '0')}`

      const { data } = await supabase
        .from('bookings')
        .select('id, duration_min, start_at, boats(id, name)')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDateStr}T23:59:59`)
        .neq('status', 'cancelled')

      if (data) {
        const totalMinutes = data.reduce((sum, b) => sum + (b.duration_min || 0), 0)

        // 平日/假日統計
        let weekdayCount = 0, weekdayMinutes = 0, weekendCount = 0, weekendMinutes = 0
        const boatMap = new Map<number, { boatName: string; minutes: number }>()

        data.forEach((b: any) => {
          const d = new Date(b.start_at)
          const dayOfWeek = d.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const minutes = b.duration_min || 0

          if (isWeekend) {
            weekendCount++
            weekendMinutes += minutes
          } else {
            weekdayCount++
            weekdayMinutes += minutes
          }

          // 各船統計
          const boatId = b.boats?.id || 0
          const boatName = b.boats?.name || '未知'
          const existing = boatMap.get(boatId)
          if (existing) {
            existing.minutes += minutes
          } else {
            boatMap.set(boatId, { boatName, minutes })
          }
        })

        const boatMinutes = Array.from(boatMap.entries())
          .map(([boatId, d]) => ({ boatId, boatName: d.boatName, minutes: d.minutes }))
          .sort((a, b) => a.boatId - b.boatId)

        months.push({
          month: monthStr,
          label: `${month}月`,
          bookingCount: data.length,
          totalMinutes,
          totalHours: Math.round(totalMinutes / 60 * 10) / 10,
          boatMinutes,
          weekdayCount,
          weekdayMinutes,
          weekendCount,
          weekendMinutes
        })
      }
    }

    setMonthlyStats(months)
  }

  // 載入財務統計
  const loadFinanceStats = async () => {
    const stats: FinanceStats[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const startDate = `${monthStr}-01`
      const endDate = new Date(year, month, 0).getDate()
      const endDateStr = `${monthStr}-${String(endDate).padStart(2, '0')}`

      const { data: consumeData } = await supabase
        .from('transactions')
        .select('category, amount, minutes')
        .eq('transaction_type', 'consume')
        .not('booking_participant_id', 'is', null)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDateStr)

      let balanceUsed = 0, vipUsed = 0, g23Used = 0, g21Used = 0
      consumeData?.forEach((tx: any) => {
        if (tx.category === 'balance' && tx.amount) {
          balanceUsed += Math.abs(tx.amount)
        } else if (tx.category === 'vip_voucher' && tx.amount) {
          vipUsed += Math.abs(tx.amount)
        } else if (tx.category === 'boat_voucher_g23' && tx.minutes) {
          g23Used += Math.abs(tx.minutes)
        } else if (tx.category === 'boat_voucher_g21_panther' && tx.minutes) {
          g21Used += Math.abs(tx.minutes)
        }
      })

      stats.push({ month: monthStr, balanceUsed, vipUsed, g23Used, g21Used })
    }

    setFinanceStats(stats)
  }

  // 載入未來預約
  const loadFutureBookings = async () => {
    const today = getLocalDateString()
    const futureMonthsList: string[] = []
    const now = new Date()

    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      futureMonthsList.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }

    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0)
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        id, start_at, duration_min, contact_name,
        booking_coaches(coach_id, coaches(id, name))
      `)
      .gte('start_at', `${today}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })

    let weekdayCount = 0, weekdayMinutes = 0, weekendCount = 0, weekendMinutes = 0

    const coachMap = new Map<string, {
      coachId: string
      coachName: string
      bookings: {
        month: string
        label: string
        count: number
        minutes: number
        contactMap: Map<string, { minutes: number; count: number }>
      }[]
      contactMap: Map<string, { minutes: number; count: number }>
      totalCount: number
      totalMinutes: number
    }>()

    const initCoach = (coachId: string, coachName: string) => ({
      coachId,
      coachName,
      bookings: futureMonthsList.map(m => {
        const [year, monthStr] = m.split('-')
        const monthNum = parseInt(monthStr)
        const label = parseInt(year) !== now.getFullYear()
          ? `${year.slice(2)}年${monthNum}月`
          : `${monthNum}月`
        return {
          month: m,
          label,
          count: 0,
          minutes: 0,
          contactMap: new Map<string, { minutes: number; count: number }>()
        }
      }),
      contactMap: new Map<string, { minutes: number; count: number }>(),
      totalCount: 0,
      totalMinutes: 0
    })

    bookingsData?.forEach((booking: any) => {
      const bookingMonth = booking.start_at.substring(0, 7)
      const coaches = booking.booking_coaches || []
      const contactName = booking.contact_name || '未知'
      const durationMin = booking.duration_min || 0

      const date = new Date(booking.start_at)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      if (isWeekend) {
        weekendCount++
        weekendMinutes += durationMin
      } else {
        weekdayCount++
        weekdayMinutes += durationMin
      }

      const addToCoach = (coachId: string, coachName: string) => {
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, initCoach(coachId, coachName))
        }
        const coach = coachMap.get(coachId)!

        const monthData = coach.bookings.find(b => b.month === bookingMonth)
        if (monthData) {
          monthData.count += 1
          monthData.minutes += durationMin

          if (!monthData.contactMap.has(contactName)) {
            monthData.contactMap.set(contactName, { minutes: 0, count: 0 })
          }
          const monthContactData = monthData.contactMap.get(contactName)!
          monthContactData.minutes += durationMin
          monthContactData.count += 1
        }

        if (!coach.contactMap.has(contactName)) {
          coach.contactMap.set(contactName, { minutes: 0, count: 0 })
        }
        const contactData = coach.contactMap.get(contactName)!
        contactData.minutes += durationMin
        contactData.count += 1

        coach.totalCount += 1
        coach.totalMinutes += durationMin
      }

      if (coaches.length === 0) {
        addToCoach('unassigned', '未指派')
      } else {
        coaches.forEach((bc: any) => {
          addToCoach(bc.coach_id, bc.coaches?.name || '未知')
        })
      }
    })

    const sortedCoaches: CoachFutureBooking[] = Array.from(coachMap.values())
      .map(coach => ({
        coachId: coach.coachId,
        coachName: coach.coachName,
        bookings: coach.bookings.map(b => ({
          month: b.month,
          label: b.label,
          count: b.count,
          minutes: b.minutes,
          contactStats: Array.from(b.contactMap.entries())
            .map(([contactName, data]) => ({ contactName, ...data }))
            .sort((a, b) => b.minutes - a.minutes)
        })),
        contactStats: Array.from(coach.contactMap.entries())
          .map(([contactName, data]) => ({ contactName, ...data }))
          .sort((a, b) => b.minutes - a.minutes),
        totalCount: coach.totalCount,
        totalMinutes: coach.totalMinutes
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)

    setFutureBookings(sortedCoaches)
    setFutureWeekdayStats({ weekdayCount, weekdayMinutes, weekendCount, weekendMinutes })
  }

  // 載入平日/假日統計（月度）
  const loadWeekdayStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`

    const { data } = await supabase
      .from('bookings')
      .select('id, duration_min, start_at')
      .gte('start_at', `${startDate}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
      .neq('status', 'cancelled')

    let weekdayCount = 0, weekdayMinutes = 0, weekendCount = 0, weekendMinutes = 0

    data?.forEach(booking => {
      const date = new Date(booking.start_at)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const minutes = booking.duration_min || 0

      if (isWeekend) {
        weekendCount++
        weekendMinutes += minutes
      } else {
        weekdayCount++
        weekdayMinutes += minutes
      }
    })

    setWeekdayStats({ weekdayCount, weekdayMinutes, weekendCount, weekendMinutes })
  }

  // 載入教練時數統計
  const loadCoachStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`

    // 載入教學記錄
    const { data: teachingData } = await supabase
      .from('booking_participants')
      .select(`
        coach_id, duration_min, lesson_type, member_id,
        coaches:coach_id(id, name),
        members:member_id(id, name, nickname),
        bookings!inner(start_at, boats(id, name))
      `)
      .eq('status', 'processed')
      .eq('is_teaching', true)
      .eq('is_deleted', false)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)

    // 載入駕駛記錄
    const { data: drivingData } = await supabase
      .from('coach_reports')
      .select(`
        coach_id, driver_duration_min,
        coaches:coach_id(id, name),
        bookings!inner(start_at)
      `)
      .not('driver_duration_min', 'is', null)
      .gt('driver_duration_min', 0)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)

    const statsMap = new Map<string, {
      coachId: string
      coachName: string
      teachingMinutes: number
      drivingMinutes: number
      designatedStudents: Map<string, {
        memberId: string
        memberName: string
        minutes: number
        boatMinutes: Map<string, number>
      }>
    }>()

    // 處理教學數據
    teachingData?.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return

      if (!statsMap.has(coachId)) {
        statsMap.set(coachId, {
          coachId,
          coachName: record.coaches?.name || '未知',
          teachingMinutes: 0,
          drivingMinutes: 0,
          designatedStudents: new Map()
        })
      }

      const stats = statsMap.get(coachId)!
      const duration = record.duration_min || 0
      stats.teachingMinutes += duration

      // 指定教練學生統計
      if ((record.lesson_type === 'designated_paid' || record.lesson_type === 'designated_free') && record.member_id) {
        const memberId = record.member_id
        const memberName = record.members?.nickname || record.members?.name || '未知'
        const boatName = record.bookings?.boats?.name || '未知'

        if (!stats.designatedStudents.has(memberId)) {
          stats.designatedStudents.set(memberId, {
            memberId,
            memberName,
            minutes: 0,
            boatMinutes: new Map()
          })
        }
        const student = stats.designatedStudents.get(memberId)!
        student.minutes += duration
        student.boatMinutes.set(boatName, (student.boatMinutes.get(boatName) || 0) + duration)
      }
    })

    // 處理駕駛數據
    drivingData?.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return

      if (!statsMap.has(coachId)) {
        statsMap.set(coachId, {
          coachId,
          coachName: record.coaches?.name || '未知',
          teachingMinutes: 0,
          drivingMinutes: 0,
          designatedStudents: new Map()
        })
      }
      statsMap.get(coachId)!.drivingMinutes += record.driver_duration_min || 0
    })

    const sorted = Array.from(statsMap.values())
      .map(stats => ({
        ...stats,
        designatedStudents: Array.from(stats.designatedStudents.values())
          .map(student => ({
            ...student,
            boatMinutes: Array.from(student.boatMinutes.entries())
              .map(([boatName, minutes]) => ({ boatName, minutes }))
              .sort((a, b) => b.minutes - a.minutes)
          }))
          .sort((a, b) => b.minutes - a.minutes)
      }))
      .sort((a, b) => (b.teachingMinutes + b.drivingMinutes) - (a.teachingMinutes + a.drivingMinutes))

    setCoachStats(sorted)
  }

  // 載入會員統計
  const loadMemberStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`

    const { data: participantData } = await supabase
      .from('booking_participants')
      .select(`
        member_id, duration_min, coach_id, lesson_type, is_teaching,
        members:member_id(id, name, nickname),
        coaches:coach_id(id, name),
        bookings!inner(start_at, boats(id, name))
      `)
      .eq('status', 'processed')
      .eq('is_deleted', false)
      .not('member_id', 'is', null)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)

    const memberMap = new Map<string, {
      memberId: string
      memberName: string
      totalMinutes: number
      designatedMinutes: number
      undesignatedMinutes: number
      bookingCount: number
      coaches: Map<string, number>
      boats: Map<string, number>
    }>()

    participantData?.forEach((record: any) => {
      const memberId = record.member_id
      if (!memberId || !record.members) return

      const memberName = record.members.nickname || record.members.name || '未知'
      const duration = record.duration_min || 0
      const isDesignated = record.lesson_type === 'designated_paid' || record.lesson_type === 'designated_free'

      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          memberId,
          memberName,
          totalMinutes: 0,
          designatedMinutes: 0,
          undesignatedMinutes: 0,
          bookingCount: 0,
          coaches: new Map(),
          boats: new Map()
        })
      }

      const stats = memberMap.get(memberId)!
      stats.totalMinutes += duration
      stats.bookingCount += 1
      if (isDesignated) {
        stats.designatedMinutes += duration
      } else {
        stats.undesignatedMinutes += duration
      }

      if (record.is_teaching && record.coaches?.name) {
        const coachName = record.coaches.name
        stats.coaches.set(coachName, (stats.coaches.get(coachName) || 0) + duration)
      }

      if (record.bookings?.boats?.name) {
        const boatName = record.bookings.boats.name
        stats.boats.set(boatName, (stats.boats.get(boatName) || 0) + duration)
      }
    })

    const sorted = Array.from(memberMap.values())
      .map(member => ({
        ...member,
        coaches: Array.from(member.coaches.entries())
          .map(([coachName, minutes]) => ({ coachName, minutes }))
          .sort((a, b) => b.minutes - a.minutes),
        boats: Array.from(member.boats.entries())
          .map(([boatName, minutes]) => ({ boatName, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)

    setMemberStats(sorted)
  }

  // 權限檢查 - 暫時開放給小編權限
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return
      
      const canAccess = await isEditorAsync(user)
      if (!canAccess) {
        navigate('/')
        return
      }
      
      setHasAccess(true)
    }
    
    checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // 初次載入
  useEffect(() => {
    if (!hasAccess) return
    
    const loadFixedData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          loadMonthlyTrend(),
          loadFutureBookings(),
          loadFinanceStats(),
          loadAllBoats()
        ])
        setLastUpdated(new Date())
      } catch (error) {
        console.error('載入趨勢數據失敗:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFixedData()
  }, [hasAccess])

  // 月份變化時載入月度數據
  useEffect(() => {
    if (!hasAccess) return
    
    const loadMonthlyData = async () => {
      try {
        await Promise.all([
          loadCoachStats(),
          loadMemberStats(),
          loadWeekdayStats()
        ])
      } catch (error) {
        console.error('載入月度統計失敗:', error)
      }
    }
    loadMonthlyData()
  }, [selectedPeriod, hasAccess])

  // 重新整理
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        loadMonthlyTrend(),
        loadFutureBookings(),
        loadFinanceStats(),
        loadCoachStats(),
        loadMemberStats(),
        loadWeekdayStats()
      ])
      setLastUpdated(new Date())
    } catch (error) {
      console.error('重新整理失敗:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const tabStyle = (isActive: boolean) => ({
    padding: isMobile ? '12px 16px' : '14px 24px',
    background: isActive ? 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)' : 'white',
    color: isActive ? 'white' : '#666',
    border: isActive ? 'none' : '1px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.2s',
    boxShadow: isActive ? '0 4px 12px rgba(74, 144, 226, 0.3)' : 'none'
  })

  // 權限檢查中
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          載入中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px'
      }}>
        <PageHeader
          title="📊 Dashboard"
          user={user}
          showBaoLink={true}
        />

        {/* Tab 切換 + 更新時間 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            gap: isMobile ? '8px' : '12px',
            flexWrap: 'wrap'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={tabStyle(activeTab === tab.key)}
              >
                {isMobile ? tab.label : `${tab.icon} ${tab.label}`}
              </button>
            ))}
          </div>
          <LastUpdated
            timestamp={lastUpdated}
            onRefresh={handleRefresh}
            isRefreshing={refreshing}
          />
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div>
            {activeTab === 'trend' && (
              <TrendTab
                monthlyStats={monthlyStats}
                financeStats={financeStats}
                allBoatsData={allBoatsData}
              />
            )}

            {activeTab === 'monthly' && (
              <MonthlyTab
                selectedPeriod={selectedPeriod}
                setSelectedPeriod={setSelectedPeriod}
                coachStats={coachStats}
                memberStats={memberStats}
                weekdayStats={weekdayStats}
              />
            )}

            {activeTab === 'future' && (
              <FutureTab
                futureBookings={futureBookings}
                futureWeekdayStats={futureWeekdayStats}
              />
            )}
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}

