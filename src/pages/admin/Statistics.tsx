import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle, designSystem } from '../../styles/designSystem'
import { getLocalDateString } from '../../utils/date'
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
}

interface BookingDetail {
  id: number
  startAt: string
  date: string
  time: string
  durationMin: number
  contactName: string
}

interface CoachFutureBooking {
  coachId: string
  coachName: string
  bookings: {
    month: string
    label: string
    count: number
    minutes: number
  }[]
  bookingDetails: BookingDetail[]
  totalCount: number
  totalMinutes: number
}

export function Statistics() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'monthly' | 'future'>('trend')
  const [monthlySubTab, setMonthlySubTab] = useState<'coach' | 'member' | 'boat'>('coach')
  
  // 趨勢數據
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  
  // 當月平日/假日統計
  const [weekdayStats, setWeekdayStats] = useState<{
    weekdayCount: number
    weekdayMinutes: number
    weekendCount: number
    weekendMinutes: number
  }>({ weekdayCount: 0, weekdayMinutes: 0, weekendCount: 0, weekendMinutes: 0 })
  
  // 未來預約數據
  const [futureBookings, setFutureBookings] = useState<CoachFutureBooking[]>([])
  const [futureMonthFilter, setFutureMonthFilter] = useState<string>('all')
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)
  
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
  
  // 船隻統計數據
  const [boatStats, setBoatStats] = useState<{
    boatId: string
    boatName: string
    totalMinutes: number
    bookingCount: number
    coaches: { coachName: string; minutes: number }[]
  }[]>([])
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadAllData()
  }, [selectedPeriod])

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadMonthlyTrend(),
        loadFutureBookings(),
        loadCoachStats(),
        loadMemberStats(),
        loadBoatStats(),
        loadWeekdayStats()
      ])
    } catch (error) {
      console.error('載入統計數據失敗:', error)
    } finally {
      setLoading(false)
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
      
      const { data, error } = await supabase
        .from('bookings')
        .select('id, duration_min')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDateStr}T23:59:59`)
        .neq('status', 'cancelled')
      
      if (!error && data) {
        const totalMinutes = data.reduce((sum, b) => sum + (b.duration_min || 0), 0)
        months.push({
          month: monthStr,
          label: `${month}月`,
          bookingCount: data.length,
          totalMinutes,
          totalHours: Math.round(totalMinutes / 60 * 10) / 10
        })
      }
    }
    
    setMonthlyStats(months)
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

  // 載入未來預約（按教練分組）
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
    
    // 整理數據
    const coachMap = new Map<string, CoachFutureBooking>()
    
    const createBookingDetail = (booking: any): BookingDetail => {
      const startAt = booking.start_at
      const dateStr = startAt.substring(0, 10)
      const timeStr = startAt.substring(11, 16)
      return {
        id: booking.id,
        startAt,
        date: dateStr,
        time: timeStr,
        durationMin: booking.duration_min || 0,
        contactName: booking.contact_name || ''
      }
    }
    
    bookingsData?.forEach((booking: any) => {
      const bookingMonth = booking.start_at.substring(0, 7)
      const coaches = booking.booking_coaches || []
      const detail = createBookingDetail(booking)
      
      if (coaches.length === 0) {
        // 未指派教練的預約
        if (!coachMap.has('unassigned')) {
          coachMap.set('unassigned', {
            coachId: 'unassigned',
            coachName: '未指派',
            bookings: futureMonthsList.map(m => ({
              month: m,
              label: `${parseInt(m.split('-')[1])}月`,
              count: 0,
              minutes: 0
            })),
            bookingDetails: [],
            totalCount: 0,
            totalMinutes: 0
          })
        }
        const coach = coachMap.get('unassigned')!
        const monthData = coach.bookings.find(b => b.month === bookingMonth)
        if (monthData) {
          monthData.count += 1
          monthData.minutes += booking.duration_min || 0
        }
        coach.bookingDetails.push(detail)
        coach.totalCount += 1
        coach.totalMinutes += booking.duration_min || 0
      } else {
        coaches.forEach((bc: any) => {
          const coachId = bc.coach_id
          const coachName = bc.coaches?.name || '未知'
          
          if (!coachMap.has(coachId)) {
            coachMap.set(coachId, {
              coachId,
              coachName,
              bookings: futureMonthsList.map(m => ({
                month: m,
                label: `${parseInt(m.split('-')[1])}月`,
                count: 0,
                minutes: 0
              })),
              bookingDetails: [],
              totalCount: 0,
              totalMinutes: 0
            })
          }
          
          const coach = coachMap.get(coachId)!
          const monthData = coach.bookings.find(b => b.month === bookingMonth)
          if (monthData) {
            monthData.count += 1
            monthData.minutes += booking.duration_min || 0
          }
          coach.bookingDetails.push(detail)
          coach.totalCount += 1
          coach.totalMinutes += booking.duration_min || 0
        })
      }
    })
    
    // 排序並設置
    const sortedCoaches = Array.from(coachMap.values())
      .sort((a, b) => b.totalCount - a.totalCount)
    
    setFutureBookings(sortedCoaches)
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

  // 載入船隻統計
  const loadBoatStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`
    
    // 載入預約記錄（以船為主）
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`
        id, start_at, boat_id, duration_min,
        boats:boat_id(id, name)
      `)
      .gte('start_at', `${startDate}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
    
    // 載入教練資料（含時數）
    const bookingIds = bookingData?.map(b => b.id) || []
    const { data: participantData } = await supabase
      .from('booking_participants')
      .select(`
        booking_id, coach_id, duration_min,
        coaches:coach_id(name)
      `)
      .in('booking_id', bookingIds.length > 0 ? bookingIds : [-1])
    
    // 整理數據
    const boatMap = new Map<string, {
      boatId: string
      boatName: string
      totalMinutes: number
      bookingCount: number
      coaches: Map<string, number>
    }>()
    
    // 建立 booking -> 教練時數 的對應
    const bookingCoachMinutesMap = new Map<number, { coachName: string; minutes: number }[]>()
    participantData?.forEach((p: any) => {
      if (p.coaches?.name) {
        if (!bookingCoachMinutesMap.has(p.booking_id)) {
          bookingCoachMinutesMap.set(p.booking_id, [])
        }
        bookingCoachMinutesMap.get(p.booking_id)!.push({
          coachName: p.coaches.name,
          minutes: p.duration_min || 0
        })
      }
    })
    
    bookingData?.forEach((booking: any) => {
      const boatId = booking.boat_id
      if (!boatId || !booking.boats) return
      
      const boatName = booking.boats.name || '未知'
      
      if (!boatMap.has(boatId)) {
        boatMap.set(boatId, {
          boatId,
          boatName,
          totalMinutes: 0,
          bookingCount: 0,
          coaches: new Map()
        })
      }
      
      const stats = boatMap.get(boatId)!
      stats.totalMinutes += booking.duration_min || 0
      stats.bookingCount += 1
      
      // 統計教練時數
      const coachData = bookingCoachMinutesMap.get(booking.id) || []
      coachData.forEach(({ coachName, minutes }) => {
        stats.coaches.set(coachName, (stats.coaches.get(coachName) || 0) + minutes)
      })
    })
    
    // 轉換為陣列並排序
    const sorted = Array.from(boatMap.values())
      .map(boat => ({
        ...boat,
        coaches: Array.from(boat.coaches.entries())
          .map(([coachName, minutes]) => ({ coachName, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
    
    setBoatStats(sorted)
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
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{
                  flex: 1,
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
              <button
                onClick={() => {
                  const [y, m] = selectedPeriod.split('-').map(Number)
                  const newDate = new Date(y, m, 1)
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
                →
              </button>
              
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
                🎓 教練
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
                👤 會員
              </button>
              <button
                onClick={() => setMonthlySubTab('boat')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: designSystem.borderRadius.md,
                  border: 'none',
                  background: monthlySubTab === 'boat' ? designSystem.colors.primary[500] : '#f0f0f0',
                  color: monthlySubTab === 'boat' ? 'white' : '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                🚤 船隻
              </button>
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>月份</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>預約數</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>總分鐘</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>總小時</th>
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
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.bookingCount}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.totalMinutes}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.totalHours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 平日/假日分佈 */}
                <div style={getCardStyle(isMobile)}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
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
                      平日/假日分佈
                    </h3>
                    <input
                      type="month"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 平日 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '500', color: '#333' }}>
                          📅 平日（週一～五）
                        </span>
                        <span style={{ color: '#4a90e2', fontWeight: '600' }}>
                          {weekdayStats.weekdayCount} 趟 / {Math.round(weekdayStats.weekdayMinutes / 60 * 10) / 10} 小時
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '24px',
                        background: '#e3f2fd',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${weekdayStats.weekdayCount + weekdayStats.weekendCount > 0 
                            ? (weekdayStats.weekdayCount / (weekdayStats.weekdayCount + weekdayStats.weekendCount)) * 100 
                            : 0}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {weekdayStats.weekdayCount + weekdayStats.weekendCount > 0 
                            ? Math.round((weekdayStats.weekdayCount / (weekdayStats.weekdayCount + weekdayStats.weekendCount)) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </div>
                    
                    {/* 假日 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '500', color: '#333' }}>
                          🎉 假日（週六、日）
                        </span>
                        <span style={{ color: '#ff9800', fontWeight: '600' }}>
                          {weekdayStats.weekendCount} 趟 / {Math.round(weekdayStats.weekendMinutes / 60 * 10) / 10} 小時
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '24px',
                        background: '#fff3e0',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${weekdayStats.weekdayCount + weekdayStats.weekendCount > 0 
                            ? (weekdayStats.weekendCount / (weekdayStats.weekdayCount + weekdayStats.weekendCount)) * 100 
                            : 0}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #ff9800, #f57c00)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {weekdayStats.weekdayCount + weekdayStats.weekendCount > 0 
                            ? Math.round((weekdayStats.weekendCount / (weekdayStats.weekdayCount + weekdayStats.weekendCount)) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </div>
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
                      {memberStats.slice(0, 10).map((member, index) => {
                        const maxMinutes = Math.max(...memberStats.slice(0, 10).map(m => m.totalMinutes))
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
                                    {index + 1}. {member.memberName}
                                  </span>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    color: '#666',
                                    background: '#eee',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {member.bookingCount} 次
                                  </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                    {member.totalMinutes} 分
                                  </span>
                                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                    指定 {Math.round(member.designatedMinutes / 60 * 10) / 10}h / 不指定 {Math.round(member.undesignatedMinutes / 60 * 10) / 10}h
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '20px',
                                background: '#e3f2fd',
                                borderRadius: '6px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${(member.totalMinutes / maxMinutes) * 100}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                  borderRadius: '6px',
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
                                        <span style={{ color: '#4a90e2' }}>{boat.minutes} 分</span>
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

            {/* Tab: 船隻統計 */}
            {activeTab === 'monthly' && monthlySubTab === 'boat' && (
              <>
                {boatStats.length > 0 ? (
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
                          background: '#50c878', 
                          borderRadius: '2px',
                          display: 'inline-block'
                        }}></span>
                        🚤 船隻使用排行
                      </div>
                      <span style={{ 
                        fontSize: isMobile ? '11px' : '13px', 
                        color: '#999', 
                        fontWeight: '400',
                        marginLeft: isMobile ? '12px' : '0'
                      }}>
                        點擊查看詳細
                      </span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {boatStats.slice(0, 10).map((boat, index) => {
                        const maxMinutes = Math.max(...boatStats.slice(0, 10).map(b => b.totalMinutes))
                        const isExpanded = expandedMemberId === boat.boatId // 復用 expandedMemberId
                        const hasDetails = boat.coaches.length > 0
                        
                        return (
                          <div key={boat.boatId}>
                            {/* 船隻列 */}
                            <div
                              onClick={() => hasDetails && setExpandedMemberId(isExpanded ? null : boat.boatId)}
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
                                    {index + 1}. {boat.boatName}
                                  </span>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    color: '#666',
                                    background: '#eee',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                  }}>
                                    {boat.bookingCount} 趟
                                  </span>
                                </div>
                                <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                  {boat.totalMinutes} 分 ({Math.round(boat.totalMinutes / 60 * 10) / 10} 小時)
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '20px',
                                background: '#e3f2fd',
                                borderRadius: '6px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${(boat.totalMinutes / maxMinutes) * 100}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                  borderRadius: '6px',
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
                                padding: '12px'
                              }}>
                                <div style={{ 
                                  fontSize: '13px', 
                                  color: '#666', 
                                  marginBottom: '8px',
                                  fontWeight: '500'
                                }}>
                                  🎓 教練
                                </div>
                                {boat.coaches.slice(0, 5).map((coach, cIdx) => (
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
                    {selectedPeriod} 無船隻使用記錄
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
              
              return (
              <>
                {/* 摘要 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #4a90e2',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{monthLabel}預約</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
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
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                      {Math.round(filteredTotalMinutes / 60 * 10) / 10}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>小時</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #ffd93d',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>教練人數</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                      {filteredCoachCount}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>人</div>
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

                {/* 教練未來預約列表 */}
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
                      各教練未來預約
                    </div>
                    <span style={{ 
                      fontSize: isMobile ? '11px' : '13px', 
                      color: '#999', 
                      fontWeight: '400',
                      marginLeft: isMobile ? '12px' : '0'
                    }}>
                      點擊展開預約列表
                    </span>
                  </h3>
                  {futureBookings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {futureBookings.map((coach) => {
                        // 根據月份篩選計算數據
                        const filteredCount = futureMonthFilter === 'all' 
                          ? coach.totalCount 
                          : coach.bookings.find(b => b.month === futureMonthFilter)?.count || 0
                        const filteredMinutes = futureMonthFilter === 'all'
                          ? coach.totalMinutes
                          : coach.bookings.find(b => b.month === futureMonthFilter)?.minutes || 0
                        const filteredDetails = futureMonthFilter === 'all'
                          ? coach.bookingDetails
                          : coach.bookingDetails.filter(d => d.startAt.startsWith(futureMonthFilter))
                        
                        if (filteredCount === 0) return null
                        
                        const isExpanded = expandedCoachId === coach.coachId
                        
                        return (
                          <div key={coach.coachId}>
                            {/* 教練列 */}
                            <div
                              onClick={() => setExpandedCoachId(isExpanded ? null : coach.coachId)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                background: isExpanded ? '#e3f2fd' : '#f8f9fa',
                                borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                  fontSize: '12px', 
                                  color: isExpanded ? '#4a90e2' : '#999',
                                  transition: 'transform 0.2s',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                }}>
                                  ▶
                                </span>
                                <span style={{ fontWeight: '600', color: '#333' }}>
                                  {coach.coachName}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                <span style={{ color: '#4a90e2', fontWeight: '600', fontSize: '14px' }}>
                                  {filteredCount} 筆
                                </span>
                                <span style={{ color: '#50c878', fontWeight: '600', fontSize: '14px' }}>
                                  {Math.round(filteredMinutes / 60 * 10) / 10} 小時
                                </span>
                              </div>
                            </div>
                            
                            {/* 展開的預約列表 */}
                            {isExpanded && (
                              <div style={{
                                background: 'white',
                                border: '1px solid #e3f2fd',
                                borderTop: 'none',
                                borderRadius: '0 0 8px 8px',
                                overflow: 'hidden'
                              }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                  <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '500', color: '#666' }}>日期</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '500', color: '#666' }}>時間</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '500', color: '#666' }}>聯絡人</th>
                                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#666' }}>時長</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredDetails.map((detail) => (
                                      <tr key={detail.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '10px 12px' }}>{detail.date}</td>
                                        <td style={{ padding: '10px 12px' }}>{detail.time}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: '500' }}>{detail.contactName}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{detail.durationMin} 分</td>
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
                  ) : (
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
                {/* 月份選擇 - 參考排班頁面的佈局 */}
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
                    
                    {/* 月份選擇器 */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="month"
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        style={{
                          width: '100%',
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
                    </div>
                    
                    {/* 向後箭頭 */}
                    <button
                      onClick={() => {
                        const [y, m] = selectedPeriod.split('-').map(Number)
                        const newDate = new Date(y, m, 1)
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
                      →
                    </button>

                    {/* 本月按鈕 */}
                    <button
                      onClick={() => {
                        const now = new Date()
                        setSelectedPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
                      }}
                      style={{
                        background: designSystem.colors.secondary[100],
                        border: `1px solid ${designSystem.colors.secondary[300]}`,
                        borderRadius: designSystem.borderRadius.md,
                        height: '44px',
                        padding: '0 12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: designSystem.colors.text.secondary,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      本月
                    </button>
                  </div>
                </div>

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
                                        {index + 1}. {coach.coachName}
                                      </span>
                                    </div>
                                    <span style={{ color: '#4a90e2', fontSize: '14px', fontWeight: '600' }}>
                                      {coach.teachingMinutes} 分 ({Math.round(coach.teachingMinutes / 60 * 10) / 10} 小時)
                                    </span>
                                  </div>
                                  <div style={{
                                    width: '100%',
                                    height: '20px',
                                    background: '#e3f2fd',
                                    borderRadius: '6px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${(coach.teachingMinutes / maxTeaching) * 100}%`,
                                      height: '100%',
                                      background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                      borderRadius: '6px',
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {coachStats
                          .filter(c => c.drivingMinutes > 0)
                          .sort((a, b) => b.drivingMinutes - a.drivingMinutes)
                          .map((coach, index) => {
                            const maxDriving = Math.max(...coachStats.map(c => c.drivingMinutes))
                            return (
                              <div key={`driving-${coach.coachId}`}>
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  marginBottom: '6px' 
                                }}>
                                  <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                    {index + 1}. {coach.coachName}
                                  </span>
                                  <span style={{ color: '#50c878', fontSize: '14px', fontWeight: '600' }}>
                                    {coach.drivingMinutes} 分 ({Math.round(coach.drivingMinutes / 60 * 10) / 10} 小時)
                                  </span>
                                </div>
                                <div style={{
                                  width: '100%',
                                  height: '24px',
                                  background: '#e8f5e9',
                                  borderRadius: '6px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${(coach.drivingMinutes / maxDriving) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #50c878, #2e7d32)',
                                    borderRadius: '6px',
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

