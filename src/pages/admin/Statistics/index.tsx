import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { useResponsive } from '../../../hooks/useResponsive'
import { getLocalDateString } from '../../../utils/date'
import { sortBoatsByDisplayOrder } from '../../../utils/boatUtils'
import { isAdmin } from '../../../utils/auth'
import { loadPaidOperationalParticipantsForRange } from '../../../utils/settledNonPracticeBookings'
import { splitMinutesEqually } from '../../../utils/teachingMinutesAllocation'

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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !isAdmin(user)) {
      navigate('/')
    }
  }, [user, navigate])
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

  // 載入過去6個月的預約趨勢（歷史資料，不含未來）
  const loadMonthlyTrend = async () => {
    const months: MonthlyStats[] = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const startDate = `${monthStr}-01`
      
      // 計算結束日期：當月只到昨天，過去月份到月底
      const lastDayOfMonth = new Date(year, month, 0).getDate()
      let endDateStr: string
      
      if (i === 0) {
        // 當月：只統計到昨天（不含今天及未來）
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = getLocalDateString(yesterday)
        // 如果昨天還在上個月，則當月沒有歷史資料
        if (yesterdayStr < startDate) {
          continue // 跳過當月（月初第一天時沒有歷史資料）
        }
        endDateStr = yesterdayStr
      } else {
        // 過去月份：到月底
        endDateStr = `${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`
      }

      const participants = await loadPaidOperationalParticipantsForRange(supabase, startDate, endDateStr)
      const bookingCount = new Set(participants.map((p) => p.bookingId)).size

      const totalMinutes = participants.reduce((sum, p) => sum + p.participantMinutes, 0)

      const weekdayBookingIds = new Set<number>()
      const weekendBookingIds = new Set<number>()
      let weekdayMinutes = 0, weekendMinutes = 0
      const boatMap = new Map<number, { boatName: string; minutes: number }>()

      participants.forEach((p) => {
        const d = new Date(p.start_at)
        const dayOfWeek = d.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const minutes = p.participantMinutes

        if (isWeekend) {
          weekendBookingIds.add(p.bookingId)
          weekendMinutes += minutes
        } else {
          weekdayBookingIds.add(p.bookingId)
          weekdayMinutes += minutes
        }

        const existing = boatMap.get(p.boatId)
        if (existing) existing.minutes += minutes
        else boatMap.set(p.boatId, { boatName: p.boatName, minutes })
      })

      const weekdayCount = weekdayBookingIds.size
      const weekendCount = weekendBookingIds.size

      const boatMinutes = Array.from(boatMap.entries())
        .map(([boatId, d]) => ({ boatId, boatName: d.boatName, minutes: d.minutes }))
        .sort((a, b) => a.boatId - b.boatId)

      months.push({
        month: monthStr,
        label: `${month}月`,
        bookingCount,
        totalMinutes,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        boatMinutes,
        weekdayCount,
        weekdayMinutes,
        weekendCount,
        weekendMinutes
      })
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
      
      // 計算結束日期：當月只到昨天，過去月份到月底
      const lastDayOfMonth = new Date(year, month, 0).getDate()
      let endDateStr: string
      
      if (i === 0) {
        // 當月：只統計到昨天
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = getLocalDateString(yesterday)
        // 如果昨天還在上個月，則當月沒有歷史資料
        if (yesterdayStr < startDate) {
          continue
        }
        endDateStr = yesterdayStr
      } else {
        // 過去月份：到月底
        endDateStr = `${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`
      }

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
        booking_coaches(coach_id, coaches(id, name)),
        booking_members(member_id, members(id, name, nickname))
      `)
      .gte('start_at', `${today}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
      .neq('status', 'cancelled')
      .or('is_coach_practice.is.null,is_coach_practice.eq.false')  // 排除教練練習
      .order('start_at', { ascending: true })

    // 載入已回報的預約 ID（排除這些）
    const { data: reportedBookings } = await supabase
      .from('coach_reports')
      .select('booking_id')
      .gte('bookings!inner.start_at', `${today}T00:00:00`)
      .lte('bookings!inner.start_at', `${endDateStr}T23:59:59`)

    const reportedBookingIds = new Set(reportedBookings?.map(r => r.booking_id) || [])

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
      // 排除已回報的預約
      if (reportedBookingIds.has(booking.id)) {
        return
      }
      const bookingMonth = booking.start_at.substring(0, 7)
      const coaches = booking.booking_coaches || []
      const bookingMembers = booking.booking_members || []
      const durationMin = booking.duration_min || 0

      // 合併會員和非會員名稱
      const memberNamesFromBookingMembers = bookingMembers.map((bm: any) => 
        bm.members?.nickname || bm.members?.name || '未知會員'
      )
      
      // 從 contact_name 取得所有名稱，過濾掉已經在 booking_members 中的
      const contactNames = (booking.contact_name || '').split(/[,，]/).map((n: string) => n.trim()).filter((n: string) => n)
      const nonMemberNames = contactNames.filter((name: string) => 
        !memberNamesFromBookingMembers.some((memberName: string) => 
          memberName === name || name.includes(memberName) || memberName.includes(name)
        )
      )
      
      // 合併：先會員，再非會員
      const memberNames: string[] = memberNamesFromBookingMembers.length > 0 || nonMemberNames.length > 0
        ? [...memberNamesFromBookingMembers, ...nonMemberNames]
        : (booking.contact_name || '未知').split(/[,，]/).map((n: string) => n.trim()).filter((n: string) => n)

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

      // 多教練：預約總時數依教練人數等分（與 teachingMinutesAllocation 一致）；未指派仍計整筆
      const coachShares = coaches.length > 0 ? splitMinutesEqually(durationMin, coaches.length) : null

      const addToCoach = (coachId: string, coachName: string, coachIndex: number) => {
        const shareMin = coachShares ? (coachShares[coachIndex] ?? 0) : durationMin

        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, initCoach(coachId, coachName))
        }
        const coach = coachMap.get(coachId)!

        const monthData = coach.bookings.find(b => b.month === bookingMonth)
        
        // 每位聯絡人／會員：在該教練此筆分攤時數內平分，加總嚴格等於 shareMin（無四捨五入誤差）
        const n = memberNames.length
        const baseMin = n > 0 ? Math.floor(shareMin / n) : 0
        const remainder = n > 0 ? shareMin % n : 0

        memberNames.forEach((memberName, idx) => {
          const perMemberMinutes = n > 0 ? baseMin + (idx < remainder ? 1 : 0) : shareMin
          if (monthData) {
            if (!monthData.contactMap.has(memberName)) {
              monthData.contactMap.set(memberName, { minutes: 0, count: 0 })
            }
            const monthContactData = monthData.contactMap.get(memberName)!
            monthContactData.minutes += perMemberMinutes
            monthContactData.count += 1
          }

          if (!coach.contactMap.has(memberName)) {
            coach.contactMap.set(memberName, { minutes: 0, count: 0 })
          }
          const contactData = coach.contactMap.get(memberName)!
          contactData.minutes += perMemberMinutes
          contactData.count += 1
        })

        if (monthData) {
          monthData.count += 1
          monthData.minutes += shareMin
        }

        coach.totalCount += 1
        coach.totalMinutes += shareMin
      }

      if (coaches.length === 0) {
        addToCoach('unassigned', '未指派', 0)
      } else {
        coaches.forEach((bc: any, coachIndex: number) => {
          addToCoach(bc.coach_id, bc.coaches?.name || '未知', coachIndex)
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

  // 取得月報日期範圍（當月只到昨天，與歷史趨勢一致）
  const getMonthlyDateRange = () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const now = new Date()
    const isCurrentMonth = parseInt(year) === now.getFullYear() && parseInt(month) === now.getMonth() + 1
    if (isCurrentMonth) {
      const yesterday = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
      if (yesterday < startDate) return null
      return { startDate, endDateStr: yesterday }
    }
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    return { startDate, endDateStr: `${selectedPeriod}-${String(endDate).padStart(2, '0')}` }
  }

  // 載入平日/假日統計（月度）
  const loadWeekdayStats = async () => {
    const range = getMonthlyDateRange()
    if (!range) {
      setWeekdayStats({ weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0 })
      return
    }
    const { startDate, endDateStr } = range

    const participants = await loadPaidOperationalParticipantsForRange(supabase, startDate, endDateStr)

    const weekdayBookingIds = new Set<number>()
    const weekendBookingIds = new Set<number>()
    let weekdayMinutes = 0, weekendMinutes = 0

    participants.forEach((p) => {
      const date = new Date(p.start_at)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const minutes = p.participantMinutes

      if (isWeekend) {
        weekendBookingIds.add(p.bookingId)
        weekendMinutes += minutes
      } else {
        weekdayBookingIds.add(p.bookingId)
        weekdayMinutes += minutes
      }
    })

    const weekdayCount = weekdayBookingIds.size
    const weekendCount = weekendBookingIds.size

    setWeekdayStats({ weekdayCount, weekdayMinutes, weekendCount, weekendMinutes })
  }

  // 載入教練時數統計
  const loadCoachStats = async () => {
    const range = getMonthlyDateRange()
    if (!range) {
      setCoachStats([])
      return
    }
    const { startDate, endDateStr } = range

    // 月報教練統計：與回報一致——已處理之教學／駕駛紀錄（非「已扣款預約清單」口徑）
    const { data: teachingData } = await supabase
      .from('booking_participants')
      .select(`
        coach_id, duration_min, lesson_type, member_id, participant_name,
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

      // 指定教練學生統計（包含非會員）
      if (record.lesson_type === 'designated_paid' || record.lesson_type === 'designated_free') {
        // 非會員用 participant_name 作為 ID，會員用 member_id
        const memberId = record.member_id || `non-member:${record.participant_name || '未知'}`
        const memberName = record.member_id 
          ? (record.members?.nickname || record.members?.name || '未知')
          : (record.participant_name || '非會員')
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

  // 載入會員統計（含代扣：非會員由會員代扣時，計入代扣會員）
  const loadMemberStats = async () => {
    const range = getMonthlyDateRange()
    if (!range) {
      setMemberStats([])
      return
    }
    const { startDate, endDateStr } = range

    // 1. 所有已處理參與者（含非會員，用於代扣情境）
    const { data: participantData } = await supabase
      .from('booking_participants')
      .select(`
        id, member_id, duration_min, coach_id, lesson_type, is_teaching,
        members:member_id(id, name, nickname),
        coaches:coach_id(id, name),
        bookings!inner(start_at, boats(id, name))
      `)
      .eq('status', 'processed')
      .eq('is_deleted', false)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)

    // 2. 非會員參與者：從 consume 交易取得代扣會員（實際扣款人）
    const nonMemberIds = participantData?.filter((r: any) => !r.member_id).map((r: any) => r.id) || []
    const proxyMemberMap = new Map<number, { memberId: string; memberName: string }>()
    if (nonMemberIds.length > 0) {
      const { data: proxyTxData } = await supabase
        .from('transactions')
        .select('booking_participant_id, member_id, members:member_id(id, name, nickname)')
        .eq('transaction_type', 'consume')
        .in('booking_participant_id', nonMemberIds)
      // 每筆參與可能有多筆 consume（船費+指定課等），member_id 相同，取第一筆即可
      const seen = new Set<number>()
      proxyTxData?.forEach((tx: any) => {
        const pid = tx.booking_participant_id
        if (pid && tx.member_id && !seen.has(pid)) {
          seen.add(pid)
          const m = tx.members
          proxyMemberMap.set(pid, {
            memberId: tx.member_id,
            memberName: m?.nickname || m?.name || '未知'
          })
        }
      })
    }

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
      // 會員直接計入本人；非會員若有代扣則計入代扣會員
      const memberId = record.member_id || proxyMemberMap.get(record.id)?.memberId
      if (!memberId) return // 非會員且尚未扣款（如現金結清）則略過

      const memberName = record.members?.nickname || record.members?.name ||
        proxyMemberMap.get(record.id)?.memberName || '未知'
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

  // 初次載入
  useEffect(() => {
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
  }, [])

  // 月份變化時載入月度數據
  useEffect(() => {
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
  }, [selectedPeriod])

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
                data-track={`dashboard_tab_${tab.key}`}
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

