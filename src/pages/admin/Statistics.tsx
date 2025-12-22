import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle, designSystem } from '../../styles/designSystem'
import { getLocalDateString } from '../../utils/date'
import { sortBoatsByDisplayOrder } from '../../utils/boatUtils'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts'

interface MonthlyStats {
  month: string
  label: string
  bookingCount: number
  totalMinutes: number
  totalHours: number
  // 各船時數
  boatMinutes: { boatId: number; boatName: string; minutes: number }[]
}

interface CoachFutureBooking {
  coachId: string
  coachName: string
  bookings: {
    month: string
    label: string
    count: number
    minutes: number
    // 該月份的會員時數分布
    contactStats: {
      contactName: string
      minutes: number
      count: number
    }[]
  }[]
  // 全部月份的會員時數分布（用於 "全部" 篩選）
  contactStats: {
    contactName: string
    minutes: number
    count: number
  }[]
  totalCount: number
  totalMinutes: number
}

export function Statistics() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'monthly' | 'future'>('trend')
  const [monthlySubTab, setMonthlySubTab] = useState<'coach' | 'member'>('coach')
  
  // 趨勢數據
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  
  // 當月平日/假日統計
  const [weekdayStats, setWeekdayStats] = useState<{
    weekdayCount: number
    weekdayMinutes: number
    weekendCount: number
    weekendMinutes: number
  }>({ weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0 })
  
  // 財務統計（預約月結算）
  const [financeStats, setFinanceStats] = useState<{
    month: string
    balanceUsed: number  // 儲值結算金額
    vipUsed: number  // VIP結算金額
    g23Used: number  // G23船券結算分鐘
    g21Used: number  // G21船券結算分鐘
  }[]>([])
  
  // 所有船隻列表
  const [allBoatsData, setAllBoatsData] = useState<{ boatId: number; boatName: string }[]>([])
  
  // 未來預約數據
  const [futureBookings, setFutureBookings] = useState<CoachFutureBooking[]>([])
  const [futureMonthFilter, setFutureMonthFilter] = useState<string>('all')
  const [expandedFutureCoachId, setExpandedFutureCoachId] = useState<string | null>(null)
  
  // 未來平日/假日統計
  const [futureWeekdayStats, setFutureWeekdayStats] = useState<{
    weekdayCount: number
    weekdayMinutes: number
    weekendCount: number
    weekendMinutes: number
  }>({ weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0 })
  
  // 教練時數數據
  const [coachStats, setCoachStats] = useState<{
    coachId: string
    coachName: string
    teachingMinutes: number
    drivingMinutes: number
    designatedStudents: {
      memberId: string
      memberName: string
      minutes: number
      boatMinutes: { boatName: string; minutes: number }[]
    }[]
  }[]>([])
  const [expandedTeachingCoachId, setExpandedTeachingCoachId] = useState<string | null>(null)
  
  // 會員統計數據
  const [memberStats, setMemberStats] = useState<{
    memberId: string
    memberName: string
    totalMinutes: number
    designatedMinutes: number
    undesignatedMinutes: number
    bookingCount: number
    coaches: { coachName: string; minutes: number }[]
    boats: { boatName: string; minutes: number }[]
  }[]>([])
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 載入所有船隻（按照 DayView 順序排序）
  const loadAllBoats = async () => {
    const { data } = await supabase
      .from('boats')
      .select('id, name')
    
    if (data) {
      const sorted = sortBoatsByDisplayOrder(data)
      setAllBoatsData(sorted.map(b => ({ boatId: b.id, boatName: b.name })))
    }
  }
  
  // 初次載入：趨勢和未來預約（固定資料，不需跟著月份變化）
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
      } catch (error) {
        console.error('載入趨勢數據失敗:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFixedData()
  }, [])

  // 月份變化時載入：教練/會員/船隻/平日假日
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
      
      // 查詢預約資料（含船資訊）
      const { data, error } = await supabase
        .from('bookings')
        .select('id, duration_min, boats(id, name)')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDateStr}T23:59:59`)
        .neq('status', 'cancelled')
      
      if (!error && data) {
        const totalMinutes = data.reduce((sum, b) => sum + (b.duration_min || 0), 0)
        
        // 統計各船時數
        const boatMap = new Map<number, { boatName: string; minutes: number }>()
        data.forEach((b: any) => {
          const boatId = b.boats?.id || 0
          const boatName = b.boats?.name || '未知'
          const existing = boatMap.get(boatId)
          if (existing) {
            existing.minutes += (b.duration_min || 0)
          } else {
            boatMap.set(boatId, { boatName, minutes: b.duration_min || 0 })
          }
        })
        const boatMinutes = Array.from(boatMap.entries())
          .map(([boatId, data]) => ({ boatId, boatName: data.boatName, minutes: data.minutes }))
          .sort((a, b) => a.boatId - b.boatId)
        
        months.push({
          month: monthStr,
          label: `${month}月`,
          bookingCount: data.length,
          totalMinutes,
          totalHours: Math.round(totalMinutes / 60 * 10) / 10,
          boatMinutes
        })
      }
    }
    
    setMonthlyStats(months)
  }

  // 載入財務統計（過去6個月：預約月結算）
  const loadFinanceStats = async () => {
    const stats: { month: string; balanceUsed: number; vipUsed: number; g23Used: number; g21Used: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const startDate = `${monthStr}-01`
      const endDate = new Date(year, month, 0).getDate()
      const endDateStr = `${monthStr}-${String(endDate).padStart(2, '0')}`
      
      // 查詢該月份從預約扣款的交易記錄
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

  // 載入平日/假日統計（使用 selectedPeriod）
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
    
    let weekdayCount = 0, weekdayMinutes = 0
    let weekendCount = 0, weekendMinutes = 0
    
    data?.forEach(booking => {
      const date = new Date(booking.start_at)
      const dayOfWeek = date.getDay() // 0=週日, 6=週六
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

  // 載入未來預約（按教練分組，含會員時數分布）
  const loadFutureBookings = async () => {
    const today = getLocalDateString()
    
    // 取得未來3個月的日期範圍
    const futureMonthsList: string[] = []
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      futureMonthsList.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    
    // 載入未來的預約
    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0)
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, start_at, duration_min, contact_name,
        booking_coaches(coach_id, coaches(id, name))
      `)
      .gte('start_at', `${today}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
    
    if (bookingsError) {
      console.error('載入未來預約失敗:', bookingsError)
      return
    }
    
    // 計算平日/假日統計
    let weekdayCount = 0, weekdayMinutes = 0
    let weekendCount = 0, weekendMinutes = 0
    
    // 整理數據：教練 -> 會員時數分布
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
      contactMap: Map<string, { minutes: number; count: number }> // 全局會員統計
      totalCount: number
      totalMinutes: number
    }>()
    
    const initCoach = (coachId: string, coachName: string) => ({
      coachId,
      coachName,
      bookings: futureMonthsList.map(m => {
        const [year, monthStr] = m.split('-')
        const monthNum = parseInt(monthStr)
        // 如果年份與當前年份不同，顯示年份
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
      
      // 平日/假日統計
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
      
      // 處理教練分組
      const addToCoach = (coachId: string, coachName: string) => {
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, initCoach(coachId, coachName))
        }
        const coach = coachMap.get(coachId)!
        
        // 月份統計
        const monthData = coach.bookings.find(b => b.month === bookingMonth)
        if (monthData) {
          monthData.count += 1
          monthData.minutes += durationMin
          
          // 該月份的會員統計
          if (!monthData.contactMap.has(contactName)) {
            monthData.contactMap.set(contactName, { minutes: 0, count: 0 })
          }
          const monthContactData = monthData.contactMap.get(contactName)!
          monthContactData.minutes += durationMin
          monthContactData.count += 1
        }
        
        // 全局會員統計（用於 "全部" 篩選）
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
    
    // 轉換為陣列並排序
    const sortedCoaches: CoachFutureBooking[] = Array.from(coachMap.values())
      .map(coach => ({
        coachId: coach.coachId,
        coachName: coach.coachName,
        bookings: coach.bookings.map(b => ({
          month: b.month,
          label: b.label,
          count: b.count,
          minutes: b.minutes,
          // 該月份的會員統計
          contactStats: Array.from(b.contactMap.entries())
            .map(([contactName, data]) => ({ contactName, ...data }))
            .sort((a, b) => b.minutes - a.minutes)
        })),
        // 全局會員統計
        contactStats: Array.from(coach.contactMap.entries())
          .map(([contactName, data]) => ({ contactName, ...data }))
          .sort((a, b) => b.minutes - a.minutes),
        totalCount: coach.totalCount,
        totalMinutes: coach.totalMinutes
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes) // 按時數排序
    
    setFutureBookings(sortedCoaches)
    setFutureWeekdayStats({ weekdayCount, weekdayMinutes, weekendCount, weekendMinutes })
  }

  // 載入教練時數統計
  const loadCoachStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`
    
    // 載入教學記錄（包含船隻資訊）
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
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)
    
    // 整理數據
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
      stats.teachingMinutes += record.duration_min || 0
      
      // 統計指定學生（計算有指定的，或彈簧床的教學）
      const boatName = record.bookings?.boats?.name || '未知船'
      const isDesignated = record.lesson_type === 'designated_paid' || record.lesson_type === 'designated_free'
      const isTrampoline = boatName.includes('彈簧床')
      // 彈簧床特例：即使不指定也算指定（因為彈簧床一定有教練教）
      const shouldCount = isDesignated || isTrampoline
      if (shouldCount && record.member_id && record.members) {
        const memberId = record.member_id
        const memberName = record.members.nickname || record.members.name || '未知'
        const duration = record.duration_min || 0
        
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
    
    // 轉換為陣列並排序
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
    
    // 載入會員預約記錄
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
    
    // 整理數據
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
      
      // 統計教練時數（只計算有指定教學的）
      if (record.is_teaching && record.coaches?.name) {
        const coachName = record.coaches.name
        stats.coaches.set(coachName, (stats.coaches.get(coachName) || 0) + duration)
      }
      
      // 統計船時數
      if (record.bookings?.boats?.name) {
        const boatName = record.bookings.boats.name
        stats.boats.set(boatName, (stats.boats.get(boatName) || 0) + duration)
      }
    })
    
    // 轉換為陣列並排序
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

  const totalFutureBookings = futureBookings.reduce((sum, c) => sum + c.totalCount, 0)
  const totalFutureMinutes = futureBookings.reduce((sum, c) => sum + c.totalMinutes, 0)

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

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('trend')}
            style={tabStyle(activeTab === 'trend')}
          >
            {isMobile ? '趨勢' : '📈 預約趨勢'}
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            style={tabStyle(activeTab === 'monthly')}
          >
            {isMobile ? '月度' : '📊 月度統計'}
          </button>
          <button
            onClick={() => setActiveTab('future')}
            style={tabStyle(activeTab === 'future')}
          >
            {isMobile ? '未來' : '📅 未來預約'}
          </button>
        </div>

        {/* 月度統計：月份選擇器 + 子 Tab */}
        {activeTab === 'monthly' && (
          <div style={{
            backgroundColor: 'white',
            padding: designSystem.spacing.sm,
            borderRadius: designSystem.borderRadius.lg,
            boxShadow: designSystem.shadows.sm,
            marginBottom: designSystem.spacing.md
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: designSystem.spacing.sm
            }}>
              {/* 向前箭頭 */}
              <button
                onClick={() => {
                  const [y, m] = selectedPeriod.split('-').map(Number)
                  const newDate = new Date(y, m - 2, 1)
                  setSelectedPeriod(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${designSystem.colors.border.main}`,
                  borderRadius: designSystem.borderRadius.md,
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: designSystem.colors.text.primary,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                ←
              </button>
              
              {/* 月份輸入 */}
              <input
                type="month"
                value={selectedPeriod}
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '44px',
                  padding: '0 12px',
                  borderRadius: designSystem.borderRadius.md,
                  border: `1px solid ${designSystem.colors.border.main}`,
                  fontSize: '16px',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa',
                  color: designSystem.colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              
              {/* 向後箭頭 */}
              {(() => {
                const now = new Date()
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                const isAtCurrentMonth = selectedPeriod >= currentMonth
                return (
                  <button
                    onClick={() => {
                      if (isAtCurrentMonth) return
                      const [y, m] = selectedPeriod.split('-').map(Number)
                      const newDate = new Date(y, m, 1)
                      setSelectedPeriod(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
                    }}
                    disabled={isAtCurrentMonth}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${designSystem.colors.border.main}`,
                      borderRadius: designSystem.borderRadius.md,
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      color: isAtCurrentMonth ? '#ccc' : designSystem.colors.text.primary,
                      cursor: isAtCurrentMonth ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                      opacity: isAtCurrentMonth ? 0.5 : 1
                    }}
                  >
                    →
                  </button>
                )
              })()}
              
              {/* 本月按鈕 */}
              <button
                onClick={() => {
                  const now = new Date()
                  setSelectedPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
                }}
                style={{
                  background: designSystem.colors.primary[500],
                  color: 'white',
                  border: 'none',
                  borderRadius: designSystem.borderRadius.md,
                  padding: '0 16px',
                  height: '44px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                本月
              </button>
            </div>
            
            {/* 子 Tab 按鈕 */}
            <div style={{ 
              display: 'flex',
              gap: '8px',
              marginTop: designSystem.spacing.sm
            }}>
              <button
                onClick={() => setMonthlySubTab('coach')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: designSystem.borderRadius.md,
                  border: 'none',
                  background: monthlySubTab === 'coach' ? designSystem.colors.primary[500] : '#f0f0f0',
                  color: monthlySubTab === 'coach' ? 'white' : '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                教練
              </button>
              <button
                onClick={() => setMonthlySubTab('member')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: designSystem.borderRadius.md,
                  border: 'none',
                  background: monthlySubTab === 'member' ? designSystem.colors.primary[500] : '#f0f0f0',
                  color: monthlySubTab === 'member' ? 'white' : '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                會員
              </button>
            </div>
            
            {/* 平日/假日摘要 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: designSystem.spacing.sm,
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: designSystem.borderRadius.md
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>平日</div>
                <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600', color: '#333' }}>
                  {weekdayStats.weekdayCount} 筆 / {weekdayStats.weekdayMinutes} 分
                </div>
              </div>
              <div style={{ width: '1px', background: '#ddd' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>假日</div>
                <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600', color: '#333' }}>
                  {weekdayStats.weekendCount} 筆 / {weekdayStats.weekendMinutes} 分
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px', 
            color: '#999',
            fontSize: '16px'
          }}>
            載入統計數據中...
          </div>
        ) : (
          <div>
            {/* Tab 1: 預約趨勢 */}
            {activeTab === 'trend' && (
              <>
                {/* 摘要卡片 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #4a90e2',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>本月預約</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats[monthlyStats.length - 1]?.bookingCount || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #50c878',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>本月時數</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats[monthlyStats.length - 1]?.totalHours || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>小時</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #ffd93d',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>6個月平均</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {Math.round(monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0) / Math.max(monthlyStats.length, 1))}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆/月</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #6c5ce7',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>6個月總計</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                </div>

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
                    }}></span>
                    近6個月預約趨勢
                  </h3>
                  <div style={{ width: '100%', height: isMobile ? 250 : 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={monthlyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                          formatter={(value, name) => [
                            name === 'bookingCount' ? `${value} 筆` : `${value} 小時`,
                            name === 'bookingCount' ? '預約數' : '時數'
                          ]}
                        />
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
                          dataKey="totalHours" 
                          name="時數" 
                          stroke="#50c878" 
                          strokeWidth={3}
                          dot={{ fill: '#50c878', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 月份數據表格 */}
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
                    }}></span>
                    月份數據明細
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>月份</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>筆數</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', borderRight: '1px solid #e0e0e0' }}>總時數</th>
                          {/* 動態顯示各船欄位 */}
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
                              {stat.totalMinutes} 分 ({stat.totalHours} 小時)
                            </td>
                            {/* 各船時數 */}
                            {allBoatsData.map(boat => {
                              const boatData = stat.boatMinutes?.find(b => b.boatId === boat.boatId)
                              const minutes = boatData?.minutes || 0
                              return (
                                <td key={boat.boatId} style={{ padding: '12px', textAlign: 'right', color: minutes > 0 ? '#2196f3' : '#999' }}>
                                  {minutes} 分
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 預約月結算 */}
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
                      background: '#ff9800', 
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}></span>
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
            )}

            {/* Tab: 會員統計 */}
            {activeTab === 'monthly' && monthlySubTab === 'member' && (
              <>
                {memberStats.length > 0 ? (
                  <div style={{
                    ...getCardStyle(isMobile),
                    padding: isMobile ? '14px' : '20px'
                  }}>
                    <h3 style={{ 
                      margin: '0 0 16px 0', 
                      fontSize: isMobile ? '15px' : '17px', 
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: isMobile ? 'flex-start' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? '4px' : '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          width: '4px', 
                          height: '20px', 
                          background: '#4a90e2', 
                          borderRadius: '2px',
                          display: 'inline-block'
                        }}></span>
                        👤 會員時數排行
                      </div>
                      <span style={{ 
                        fontSize: isMobile ? '11px' : '13px', 
                        color: '#999', 
                        fontWeight: '400',
                        marginLeft: isMobile ? '12px' : '0'
                      }}>
                        點擊查看常用教練/船
                      </span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {memberStats.slice(0, 20).map((member, index) => {
                        const maxMinutes = Math.max(...memberStats.slice(0, 20).map(m => m.totalMinutes))
                        const isExpanded = expandedMemberId === member.memberId
                        const hasDetails = member.coaches.length > 0 || member.boats.length > 0
                        
                        return (
                          <div key={member.memberId}>
                            {/* 會員列 */}
                            <div
                              onClick={() => hasDetails && setExpandedMemberId(isExpanded ? null : member.memberId)}
                              style={{
                                padding: '12px',
                                background: isExpanded ? '#e3f2fd' : '#f8f9fa',
                                borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                cursor: hasDetails ? 'pointer' : 'default',
                                transition: 'background 0.2s'
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {hasDetails && (
                                    <span style={{ 
                                      fontSize: '12px', 
                                      color: isExpanded ? '#4a90e2' : '#999',
                                      transition: 'transform 0.2s',
                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}>
                                      ▶
                                    </span>
                                  )}
                                  <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`} {member.memberName}
                                  </span>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    color: '#666',
                                    background: '#e3f2fd',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {member.bookingCount} 次
                                  </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                    {member.totalMinutes} 分 ({Math.round(member.totalMinutes / 60 * 10) / 10} 小時)
                                  </span>
                                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                                    指定 {member.designatedMinutes}分 / 不指定 {member.undesignatedMinutes}分
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '8px',
                                background: '#e3f2fd',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${(member.totalMinutes / maxMinutes) * 100}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                  borderRadius: '4px',
                                  transition: 'width 0.3s'
                                }} />
                              </div>
                            </div>
                            
                            {/* 展開的詳細資訊 */}
                            {isExpanded && hasDetails && (
                              <div style={{
                                background: 'white',
                                border: '1px solid #e3f2fd',
                                borderTop: 'none',
                                borderRadius: '0 0 8px 8px',
                                padding: '12px',
                                display: 'flex',
                                gap: '24px',
                                flexWrap: 'wrap'
                              }}>
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
                                    {member.coaches.map((coach, cIdx) => (
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
                                        <span>{cIdx + 1}. {coach.coachName}</span>
                                        <span style={{ color: '#4a90e2' }}>{coach.minutes} 分</span>
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
                                    {member.boats.map((boat, bIdx) => (
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
                                        <span>{bIdx + 1}. {boat.boatName}</span>
                                        <span style={{ color: '#50c878' }}>{boat.minutes} 分</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    ...getCardStyle(isMobile),
                    textAlign: 'center',
                    padding: '60px',
                    color: '#999'
                  }}>
                    {selectedPeriod} 無會員預約記錄
                  </div>
                )}
              </>
            )}


            {/* Tab: 未來預約 */}
            {activeTab === 'future' && (() => {
              // 根據月份篩選計算摘要數據
              const filteredTotalBookings = futureMonthFilter === 'all'
                ? totalFutureBookings
                : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === futureMonthFilter)?.count || 0), 0)
              const filteredTotalMinutes = futureMonthFilter === 'all'
                ? totalFutureMinutes
                : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === futureMonthFilter)?.minutes || 0), 0)
              const filteredCoachCount = futureMonthFilter === 'all'
                ? futureBookings.filter(c => c.coachId !== 'unassigned').length
                : futureBookings.filter(c => c.coachId !== 'unassigned' && (c.bookings.find(b => b.month === futureMonthFilter)?.count || 0) > 0).length
              const monthLabel = futureMonthFilter === 'all' 
                ? '未來3個月' 
                : `${parseInt(futureMonthFilter.split('-')[1])}月`
              
              // 計算最大時數用於進度條
              const maxMinutes = Math.max(...futureBookings.map(c => 
                futureMonthFilter === 'all' ? c.totalMinutes : (c.bookings.find(b => b.month === futureMonthFilter)?.minutes || 0)
              ))
              
              return (
              <>
                {/* 摘要卡片 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #4a90e2',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{monthLabel}預約</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {filteredTotalBookings}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #50c878',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>總預約時數</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {Math.round(filteredTotalMinutes / 60 * 10) / 10}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>小時</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #ff9800',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>教練人數</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {filteredCoachCount}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>人</div>
                  </div>
                  {/* 平日/假日分布 */}
                  <div style={{
                    ...getCardStyle(isMobile),
                    marginBottom: 0,
                    gridColumn: isMobile ? '1 / -1' : 'auto'
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>平日/假日分布</div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#4a90e2', marginBottom: '4px' }}>平日</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                          {futureWeekdayStats.weekdayCount} 筆
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {Math.round(futureWeekdayStats.weekdayMinutes / 60 * 10) / 10} 小時
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#ff9800', marginBottom: '4px' }}>假日</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                          {futureWeekdayStats.weekendCount} 筆
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {Math.round(futureWeekdayStats.weekendMinutes / 60 * 10) / 10} 小時
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 月份篩選 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  marginBottom: '24px'
                }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '15px'
                  }}>
                    篩選月份
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setFutureMonthFilter('all')}
                      style={{
                        padding: '8px 16px',
                        background: futureMonthFilter === 'all' ? '#4a90e2' : 'white',
                        color: futureMonthFilter === 'all' ? 'white' : '#666',
                        border: futureMonthFilter === 'all' ? 'none' : '1px solid #e0e0e0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}
                    >
                      全部
                    </button>
                    {futureBookings[0]?.bookings.map(b => (
                      <button
                        key={b.month}
                        onClick={() => setFutureMonthFilter(b.month)}
                        style={{
                          padding: '8px 16px',
                          background: futureMonthFilter === b.month ? '#4a90e2' : 'white',
                          color: futureMonthFilter === b.month ? 'white' : '#666',
                          border: futureMonthFilter === b.month ? 'none' : '1px solid #e0e0e0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 教練時數排行 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  padding: isMobile ? '14px' : '20px'
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: isMobile ? '15px' : '17px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '4px' : '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        width: '4px', 
                        height: '20px', 
                        background: '#4a90e2', 
                        borderRadius: '2px',
                        display: 'inline-block'
                      }}></span>
                      🎓 教練時數排行
                    </div>
                    <span style={{ 
                      fontSize: isMobile ? '11px' : '13px', 
                      color: '#999', 
                      fontWeight: '400',
                      marginLeft: isMobile ? '12px' : '0'
                    }}>
                      點擊查看會員時數分布
                    </span>
                  </h3>
                  {futureBookings.length > 0 ? (() => {
                    // 計算非未指派教練的排名
                    let coachRank = 0
                    return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {futureBookings.map((coach) => {
                        // 根據月份篩選計算數據
                        const filteredMinutes = futureMonthFilter === 'all'
                          ? coach.totalMinutes
                          : coach.bookings.find(b => b.month === futureMonthFilter)?.minutes || 0
                        const filteredCount = futureMonthFilter === 'all' 
                          ? coach.totalCount 
                          : coach.bookings.find(b => b.month === futureMonthFilter)?.count || 0
                        
                        if (filteredMinutes === 0) return null
                        
                        // 計算真正排名（跳過未指派）
                        const displayRank = coach.coachId === 'unassigned' ? null : ++coachRank
                        
                        const isExpanded = expandedFutureCoachId === coach.coachId
                        // 根據月份篩選取得對應的會員統計
                        const filteredContactStats = futureMonthFilter === 'all'
                          ? coach.contactStats
                          : coach.bookings.find(b => b.month === futureMonthFilter)?.contactStats || []
                        const hasContacts = filteredContactStats.length > 0
                        
                        return (
                          <div key={coach.coachId}>
                            {/* 教練列 */}
                            <div
                              onClick={() => hasContacts && setExpandedFutureCoachId(isExpanded ? null : coach.coachId)}
                              style={{
                                padding: '12px',
                                background: isExpanded ? '#e3f2fd' : '#f8f9fa',
                                borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                cursor: hasContacts ? 'pointer' : 'default',
                                transition: 'background 0.2s'
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {hasContacts && (
                                    <span style={{ 
                                      fontSize: '12px', 
                                      color: isExpanded ? '#4a90e2' : '#999',
                                      transition: 'transform 0.2s',
                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}>
                                      ▶
                                    </span>
                                  )}
                                  <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                    {displayRank === null 
                                      ? '⚠️' 
                                      : (displayRank <= 3 ? ['🥇', '🥈', '🥉'][displayRank - 1] : `${displayRank}.`)
                                    } {coach.coachName}
                                    {coach.coachId === 'unassigned' && (
                                      <span style={{ 
                                        marginLeft: '8px', 
                                        fontSize: '11px', 
                                        color: '#ff9800',
                                        background: '#fff3e0',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                      }}>待指派</span>
                                    )}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <span style={{ color: '#666', fontSize: '13px' }}>
                                    {filteredCount} 筆
                                  </span>
                                  <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                    {filteredMinutes} 分 ({Math.round(filteredMinutes / 60 * 10) / 10} 小時)
                                  </span>
                                </div>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '8px',
                                background: '#e3f2fd',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${maxMinutes > 0 ? (filteredMinutes / maxMinutes) * 100 : 0}%`,
                                  height: '100%',
                                  background: coach.coachId === 'unassigned' 
                                    ? 'linear-gradient(90deg, #ff9800, #f57c00)' 
                                    : 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                  borderRadius: '4px',
                                  transition: 'width 0.3s'
                                }} />
                              </div>
                            </div>
                            
                            {/* 展開的會員時數分布 */}
                            {isExpanded && hasContacts && (
                              <div style={{
                                background: 'white',
                                border: '1px solid #e3f2fd',
                                borderTop: 'none',
                                borderRadius: '0 0 8px 8px',
                                padding: '12px'
                              }}>
                                <div style={{ 
                                  fontSize: '13px', 
                                  color: '#666', 
                                  marginBottom: '10px',
                                  fontWeight: '500'
                                }}>
                                  👥 會員時數分布：
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {filteredContactStats.map((contact, cIdx) => (
                                    <div 
                                      key={contact.contactName}
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
                                        {cIdx + 1}. {contact.contactName}
                                        <span style={{ color: '#999', marginLeft: '8px' }}>
                                          ({contact.count} 筆)
                                        </span>
                                      </span>
                                      <span style={{ 
                                        fontSize: '13px', 
                                        color: '#4a90e2',
                                        fontWeight: '600',
                                        flexShrink: 0,
                                        marginLeft: '12px'
                                      }}>
                                        {contact.minutes} 分 ({Math.round(contact.minutes / 60 * 10) / 10} 小時)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    )})() : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      目前沒有未來預約
                    </div>
                  )}
                </div>
              </>
            )})()}

            {/* Tab 3: 教練時數 */}
            {activeTab === 'monthly' && monthlySubTab === 'coach' && (
              <>
                {coachStats.length > 0 ? (
                  <>
                    {/* 教學時數排行 */}
                    <div style={{
                      ...getCardStyle(isMobile),
                      marginBottom: isMobile ? '16px' : '24px',
                      padding: isMobile ? '14px' : '20px'
                    }}>
                      <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: isMobile ? '15px' : '17px', 
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? '4px' : '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            width: '4px', 
                            height: '20px', 
                            background: '#4a90e2', 
                            borderRadius: '2px',
                            display: 'inline-block'
                          }}></span>
                          🎓 教學時數排行
                        </div>
                        <span style={{ 
                          fontSize: isMobile ? '11px' : '13px', 
                          color: '#999', 
                          fontWeight: '400',
                          marginLeft: isMobile ? '12px' : '0'
                        }}>
                          點擊查看指定學生
                        </span>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {coachStats
                          .filter(c => c.teachingMinutes > 0)
                          .sort((a, b) => b.teachingMinutes - a.teachingMinutes)
                          .map((coach, index) => {
                            const maxTeaching = Math.max(...coachStats.map(c => c.teachingMinutes))
                            const isExpanded = expandedTeachingCoachId === coach.coachId
                            const hasDesignatedStudents = coach.designatedStudents.length > 0
                            
                            return (
                              <div key={`teaching-${coach.coachId}`}>
                                {/* 教練列 */}
                                <div
                                  onClick={() => hasDesignatedStudents && setExpandedTeachingCoachId(isExpanded ? null : coach.coachId)}
                                  style={{
                                    padding: '12px',
                                    background: isExpanded ? '#e3f2fd' : '#f8f9fa',
                                    borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                    cursor: hasDesignatedStudents ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {hasDesignatedStudents && (
                                        <span style={{ 
                                          fontSize: '12px', 
                                          color: isExpanded ? '#4a90e2' : '#999',
                                          transition: 'transform 0.2s',
                                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                        }}>
                                          ▶
                                        </span>
                                      )}
                                      <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`} {coach.coachName}
                                      </span>
                                    </div>
                                    <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                      {coach.teachingMinutes} 分 ({Math.round(coach.teachingMinutes / 60 * 10) / 10} 小時)
                                    </span>
                                  </div>
                                  <div style={{
                                    width: '100%',
                                    height: '8px',
                                    background: '#e3f2fd',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${(coach.teachingMinutes / maxTeaching) * 100}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                      borderRadius: '4px',
                                      transition: 'width 0.3s'
                                    }} />
                                  </div>
                                </div>
                                
                                {/* 展開的指定學生列表 */}
                                {isExpanded && hasDesignatedStudents && (
                                  <div style={{
                                    background: 'white',
                                    border: '1px solid #e3f2fd',
                                    borderTop: 'none',
                                    borderRadius: '0 0 8px 8px',
                                    padding: '12px'
                                  }}>
                                    <div style={{ 
                                      fontSize: '13px', 
                                      color: '#666', 
                                      marginBottom: '10px',
                                      fontWeight: '500'
                                    }}>
                                      ⭐ 指定 {coach.coachName} 的學生：
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {coach.designatedStudents.map((student, sIdx) => (
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
                                            {sIdx + 1}. {student.memberName}
                                            {student.boatMinutes.length > 0 && (
                                              <span style={{ color: '#888', fontWeight: '400' }}>
                                                {' - '}
                                                {student.boatMinutes.map((b, idx) => (
                                                  <span key={b.boatName}>
                                                    {b.boatName}: {b.minutes}分
                                                    {idx < student.boatMinutes.length - 1 && ', '}
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
                                            {student.minutes} 分
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        {coachStats.filter(c => c.teachingMinutes > 0).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                            本月無教學時數記錄
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 駕駛時數排行 */}
                    <div style={{
                      ...getCardStyle(isMobile),
                      padding: isMobile ? '14px' : '20px'
                    }}>
                      <h3 style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: isMobile ? '15px' : '17px', 
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
                        }}></span>
                        🚤 駕駛時數排行
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {coachStats
                          .filter(c => c.drivingMinutes > 0)
                          .sort((a, b) => b.drivingMinutes - a.drivingMinutes)
                          .map((coach, index) => {
                            const maxDriving = Math.max(...coachStats.map(c => c.drivingMinutes))
                            
                            return (
                              <div 
                                key={`driving-${coach.coachId}`}
                                style={{
                                  padding: '12px',
                                  background: '#f8f9fa',
                                  borderRadius: '8px'
                                }}
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '8px'
                                }}>
                                  <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`} {coach.coachName}
                                  </span>
                                  <span style={{ color: '#50c878', fontSize: '14px', fontWeight: '600' }}>
                                    {coach.drivingMinutes} 分 ({Math.round(coach.drivingMinutes / 60 * 10) / 10} 小時)
                                  </span>
                                </div>
                                <div style={{
                                  width: '100%',
                                  height: '8px',
                                  background: '#e8f5e9',
                                  borderRadius: '4px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${(coach.drivingMinutes / maxDriving) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #50c878, #2e7d32)',
                                    borderRadius: '4px',
                                    transition: 'width 0.3s'
                                  }} />
                                </div>
                              </div>
                            )
                          })}
                        {coachStats.filter(c => c.drivingMinutes > 0).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                            本月無駕駛時數記錄
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    ...getCardStyle(isMobile),
                    textAlign: 'center',
                    padding: '60px',
                    color: '#999'
                  }}>
                    {selectedPeriod} 無教練時數記錄
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}

