import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { useRequireAdmin } from '../utils/auth'
import { getButtonStyle, getCardStyle } from '../styles/designSystem'

interface Coach {
  id: string
  name: string
}

interface ReportStatus {
  coachId: string
  coachName: string
  totalBookings: number
  coachReported: number
  driverReported: number
  missingReports: Array<{
    bookingId: number
    startAt: string
    contactName: string
    boatName: string
    needsCoachReport: boolean
    needsDriverReport: boolean
  }>
}

interface WorkStats {
  coachId: string
  coachName: string
  // 教練統計
  coachBookings: number
  coachMinutes: number
  coachStudents: number
  paymentMethods: { [key: string]: number }
  // 駕駛統計
  driverBookings: number
  driverMinutes: number
  avgFuelRemaining: number
}

interface CoachOverviewProps {
  user: User
}

export function CoachOverview({ user }: CoachOverviewProps) {
  useRequireAdmin(user)
  const { isMobile } = useResponsive()

  // Tab 切換
  const [activeTab, setActiveTab] = useState<'report-status' | 'work-stats' | 'data-analysis'>('report-status')

  // 篩選條件
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [timeRange, setTimeRange] = useState<'last-month' | 'this-month' | 'next-month' | 'custom'>('this-month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all')

  // 數據
  const [reportStatuses, setReportStatuses] = useState<ReportStatus[]>([])
  const [workStats, setWorkStats] = useState<WorkStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCoaches()
  }, [])

  useEffect(() => {
    if (activeTab === 'report-status') {
      loadReportStatus()
    } else if (activeTab === 'work-stats' || activeTab === 'data-analysis') {
      loadWorkStats()
    }
  }, [activeTab, selectedDate, timeRange, startDate, endDate, selectedCoachId])

  const isFacility = (boatName?: string | null) => {
    return boatName === '彈簧床'
  }

  const loadCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    if (error) {
      console.error('載入教練失敗:', error)
      return
    }
    
    setCoaches(data || [])
  }

  const loadReportStatus = async () => {
    setLoading(true)
    try {
      // 載入從今天開始的所有未來預約（包括今天）
      const today = new Date()
      const startOfToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`

      // 載入預約（從今天到未來 30 天）
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          contact_name,
          boat_id,
          boats (name)
        `)
        .gte('start_at', startOfToday)
        .eq('status', 'confirmed')
        .order('start_at')
        .limit(500)

      if (bookingsError) throw bookingsError
      if (!bookingsData || bookingsData.length === 0) {
        setReportStatuses([])
        setLoading(false)
        return
      }

      const bookingIds = bookingsData.map(b => b.id)

      // 批次載入教練、駕駛、回報
      const [coachesResult, driversResult, coachReportsResult, participantsResult] = await Promise.all([
        supabase.from('booking_coaches').select('booking_id, coach_id').in('booking_id', bookingIds),
        supabase.from('booking_drivers').select('booking_id, driver_id').in('booking_id', bookingIds),
        supabase.from('coach_reports').select('booking_id, coach_id').in('booking_id', bookingIds),
        supabase.from('booking_participants').select('booking_id, coach_id').in('booking_id', bookingIds)
      ])

      // 組織數據
      const coachMap = new Map<string, ReportStatus>()

      for (const coach of coaches) {
        if (selectedCoachId !== 'all' && coach.id !== selectedCoachId) continue

        const coachBookingIds = coachesResult.data
          ?.filter(bc => bc.coach_id === coach.id)
          .map(bc => bc.booking_id) || []

        const driverBookingIds = driversResult.data
          ?.filter(bd => bd.driver_id === coach.id)
          .map(bd => bd.driver_id) || []

        // 找出這個教練需要回報的預約
        const relevantBookingIds = new Set([...coachBookingIds, ...driverBookingIds])

        // 如果教練是教練但沒有駕駛，也要算駕駛回報
        for (const bookingId of coachBookingIds) {
          const hasDriver = driversResult.data?.some(bd => bd.booking_id === bookingId)
          if (!hasDriver) {
            relevantBookingIds.add(bookingId)
          }
        }

        if (relevantBookingIds.size === 0) continue

        const missingReports: ReportStatus['missingReports'] = []
        let coachReported = 0
        let driverReported = 0

        for (const bookingId of relevantBookingIds) {
          const booking = bookingsData.find(b => b.id === bookingId)
          if (!booking) continue

          const boatName = (booking.boats as any)?.name
          const isFacilityBooking = isFacility(boatName)

          const isCoach = coachBookingIds.includes(bookingId)
          const isExplicitDriver = driverBookingIds.includes(bookingId)
          const hasNoDriver = !driversResult.data?.some(bd => bd.booking_id === bookingId)
          const isImplicitDriver = isCoach && hasNoDriver && !isFacilityBooking

          // 需要回報的判斷
          const needsCoachReport = isCoach
          const needsDriverReport = !isFacilityBooking && (isExplicitDriver || isImplicitDriver)

          // 已回報的判斷
          // 教練回報：檢查 booking_participants 表中是否有該教練的記錄
          // 注意：如果教練提交空回報（確認無客人），則不會有記錄，這是目前的限制
          const hasCoachReport = participantsResult.data?.some(
            p => p.booking_id === bookingId && p.coach_id === coach.id
          ) || false
          
          // 駕駛回報：檢查 coach_reports 表
          const hasDriverReport = coachReportsResult.data?.some(
            cr => cr.booking_id === bookingId && cr.coach_id === coach.id
          ) || false

          // 計數已回報的數量
          if (needsCoachReport && hasCoachReport) coachReported++
          if (needsDriverReport && hasDriverReport) driverReported++

          // 收集未回報的預約
          const missingCoachReport = needsCoachReport && !hasCoachReport
          const missingDriverReport = needsDriverReport && !hasDriverReport
          
          if (missingCoachReport || missingDriverReport) {
            missingReports.push({
              bookingId,
              startAt: booking.start_at,
              contactName: booking.contact_name,
              boatName: (booking.boats as any)?.name || '未知',
              needsCoachReport: missingCoachReport,
              needsDriverReport: missingDriverReport
            })
          }
        }

        coachMap.set(coach.id, {
          coachId: coach.id,
          coachName: coach.name,
          totalBookings: relevantBookingIds.size,
          coachReported,
          driverReported,
          missingReports
        })
      }

      setReportStatuses(Array.from(coachMap.values()))
    } catch (error) {
      console.error('載入回報狀況失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let start: string, end: string

    if (timeRange === 'last-month') {
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1
      start = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month + 1, 0).getDate()
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
    } else if (timeRange === 'this-month') {
      const year = now.getFullYear()
      const month = now.getMonth()
      start = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month + 1, 0).getDate()
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
    } else if (timeRange === 'next-month') {
      const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
      const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1
      start = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month + 1, 0).getDate()
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
    } else {
      start = startDate ? `${startDate}T00:00:00` : ''
      end = endDate ? `${endDate}T23:59:59` : ''
    }

    return { start, end }
  }

  const loadWorkStats = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      
      if (!start || !end) {
        setWorkStats([])
        setLoading(false)
        return
      }

      // 載入預約
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .gte('start_at', start)
        .lte('start_at', end)
        .eq('status', 'confirmed')

      if (bookingsError) throw bookingsError
      if (!bookingsData || bookingsData.length === 0) {
        setWorkStats([])
        setLoading(false)
        return
      }

      const bookingIds = bookingsData.map(b => b.id)

      // 批次載入回報數據
      const [participantsResult, coachReportsResult] = await Promise.all([
        supabase.from('booking_participants').select('*').in('booking_id', bookingIds),
        supabase.from('coach_reports').select('*').in('booking_id', bookingIds)
      ])

      const statsMap = new Map<string, WorkStats>()

      for (const coach of coaches) {
        if (selectedCoachId !== 'all' && coach.id !== selectedCoachId) continue

        // 教練統計
        const coachParticipants = participantsResult.data?.filter(p => p.coach_id === coach.id) || []
        const coachBookings = new Set(coachParticipants.map(p => p.booking_id)).size
        const coachMinutes = coachParticipants.reduce((sum, p) => sum + p.duration_min, 0)
        const coachStudents = coachParticipants.length

        const paymentMethods: { [key: string]: number } = {}
        for (const p of coachParticipants) {
          paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] || 0) + 1
        }

        // 駕駛統計
        const driverReports = coachReportsResult.data?.filter(cr => cr.coach_id === coach.id) || []
        const driverBookings = driverReports.length
        const driverMinutes = driverReports.reduce((sum, cr) => sum + cr.driver_duration_min, 0)
        const avgFuelRemaining = driverReports.length > 0
          ? driverReports.reduce((sum, cr) => sum + cr.fuel_amount, 0) / driverReports.length
          : 0

        if (coachBookings > 0 || driverBookings > 0) {
          statsMap.set(coach.id, {
            coachId: coach.id,
            coachName: coach.name,
            coachBookings,
            coachMinutes,
            coachStudents,
            paymentMethods,
            driverBookings,
            driverMinutes,
            avgFuelRemaining
          })
        }
      }

      setWorkStats(Array.from(statsMap.values()))
    } catch (error) {
      console.error('載入工作統計失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCompletionRate = (status: ReportStatus) => {
    const totalNeeded = status.totalBookings * 2 // 教練 + 駕駛
    const completed = status.coachReported + status.driverReported
    return Math.round((completed / totalNeeded) * 100)
  }

  const exportData = () => {
    if (workStats.length === 0) {
      alert('沒有資料可以匯出')
      return
    }

    // 生成 CSV 內容
    let csv = '\uFEFF' // UTF-8 BOM for Excel
    csv += `教練工作狀況報表\n`
    csv += `日期：${selectedDate}\n`
    csv += `\n`

    // 教練統計
    csv += `教練,預約數,教學時數(分),學員數,現金,匯款,扣儲值,票券,指定(需收費),指定(不需收費)\n`
    workStats.forEach(stats => {
      csv += `${stats.coachName},`
      csv += `${stats.coachBookings},`
      csv += `${stats.coachMinutes},`
      csv += `${stats.coachStudents},`
      csv += `${stats.paymentMethods['cash'] || 0},`
      csv += `${stats.paymentMethods['transfer'] || 0},`
      csv += `${stats.paymentMethods['balance'] || 0},`
      csv += `${stats.paymentMethods['voucher'] || 0},`
      csv += `${stats.paymentMethods['designated_paid'] || 0},`
      csv += `${stats.paymentMethods['designated_free'] || 0}\n`
    })

    csv += `\n`

    // 駕駛統計
    csv += `教練,駕駛預約數,駕駛時數(分),平均剩餘油量(%)\n`
    workStats.forEach(stats => {
      csv += `${stats.coachName},`
      csv += `${stats.driverBookings},`
      csv += `${stats.driverMinutes},`
      csv += `${stats.avgFuelRemaining.toFixed(1)}\n`
    })

    // 下載
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `教練工作狀況_${selectedDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="教練工作狀況"
        showBaoLink={true}
      />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* 回報狀況：自動顯示今天和未來的預約 */}
          {activeTab === 'report-status' && (
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
              border: '1px solid #90caf9',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#1565c0',
              lineHeight: '1.6'
            }}>
              💡 <strong>提示：</strong>顯示今天及未來的所有預約回報狀況
            </div>
          )}

          {/* 工作統計和數據分析用月份選擇 */}
          {(activeTab === 'work-stats' || activeTab === 'data-analysis') && (
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: '#666' }}>
                時間範圍
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setTimeRange('last-month')}
                  style={{
                    ...getButtonStyle(timeRange === 'last-month' ? 'primary' : 'secondary'),
                    flex: isMobile ? '1 1 auto' : '0 0 auto'
                  }}
                >
                  上月
                </button>
                <button
                  onClick={() => setTimeRange('this-month')}
                  style={{
                    ...getButtonStyle(timeRange === 'this-month' ? 'primary' : 'secondary'),
                    flex: isMobile ? '1 1 auto' : '0 0 auto'
                  }}
                >
                  本月
                </button>
                <button
                  onClick={() => setTimeRange('next-month')}
                  style={{
                    ...getButtonStyle(timeRange === 'next-month' ? 'primary' : 'secondary'),
                    flex: isMobile ? '1 1 auto' : '0 0 auto'
                  }}
                >
                  下月
                </button>
                <button
                  onClick={() => setTimeRange('custom')}
                  style={{
                    ...getButtonStyle(timeRange === 'custom' ? 'primary' : 'secondary'),
                    flex: isMobile ? '1 1 auto' : '0 0 auto'
                  }}
                >
                  自訂
                </button>
              </div>

              {timeRange === 'custom' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'block', color: '#666' }}>
                      開始日期
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'block', color: '#666' }}>
                      結束日期
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 教練篩選 */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: '#666' }}>
              教練篩選
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="all">全部教練</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('report-status')}
            style={{
              ...getButtonStyle(activeTab === 'report-status' ? 'primary' : 'secondary'),
              flex: isMobile ? '1 1 auto' : '0 0 auto'
            }}
          >
            📋 回報狀況
          </button>
          <button
            onClick={() => setActiveTab('work-stats')}
            style={{
              ...getButtonStyle(activeTab === 'work-stats' ? 'primary' : 'secondary'),
              flex: isMobile ? '1 1 auto' : '0 0 auto'
            }}
          >
            📊 工作統計
          </button>
          <button
            onClick={() => setActiveTab('data-analysis')}
            style={{
              ...getButtonStyle(activeTab === 'data-analysis' ? 'primary' : 'secondary'),
              flex: isMobile ? '1 1 auto' : '0 0 auto'
            }}
          >
            📈 數據分析
          </button>
        </div>

        {/* 載入中 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入中...
          </div>
        )}

        {/* Tab 1: 回報狀況 */}
        {!loading && activeTab === 'report-status' && (
          <div>
            {reportStatuses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                😔 沒有找到相關資料
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {reportStatuses.map(status => {
                  const completionRate = getCompletionRate(status)
                  const isComplete = status.missingReports.length === 0

                  return (
                    <div
                      key={status.coachId}
                      style={{
                        ...getCardStyle(isMobile),
                        borderLeft: isComplete ? '4px solid #4caf50' : '4px solid #ff9800'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                            {status.coachName}
                          </h3>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: isComplete ? '#e8f5e9' : '#fff3e0',
                            color: isComplete ? '#2e7d32' : '#f57c00'
                          }}>
                            {completionRate}% 完成
                          </span>
                        </div>

                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                          總預約：{status.totalBookings} 筆 | 
                          教練回報：{status.coachReported} / {status.totalBookings} | 
                          駕駛回報：{status.driverReported} / {status.totalBookings}
                        </div>

                        {/* 進度條 */}
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#e0e0e0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${completionRate}%`,
                            height: '100%',
                            background: isComplete ? '#4caf50' : '#ff9800',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>

                      {/* 未回報列表 */}
                      {status.missingReports.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#d32f2f' }}>
                            ⚠️ 未完成回報 ({status.missingReports.length} 筆)
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {status.missingReports.map(report => (
                              <div
                                key={report.bookingId}
                                style={{
                                  padding: '12px',
                                  background: '#fff3e0',
                                  borderRadius: '6px',
                                  fontSize: '13px'
                                }}
                              >
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                  {report.startAt.substring(11, 16)} | {report.contactName} | {report.boatName}
                                </div>
                                <div style={{ color: '#666' }}>
                                  缺少：
                                  {report.needsCoachReport && <span style={{ marginLeft: '4px', color: '#f57c00' }}>教練回報</span>}
                                  {report.needsCoachReport && report.needsDriverReport && <span> + </span>}
                                  {report.needsDriverReport && <span style={{ marginLeft: '4px', color: '#f57c00' }}>駕駛回報</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 工作統計 */}
        {!loading && activeTab === 'work-stats' && (
          <div>
            {workStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                😔 沒有找到相關資料
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {workStats.map(stats => (
                  <div
                    key={stats.coachId}
                    style={{
                      ...getCardStyle(isMobile),
                      borderLeft: '4px solid #2196F3'
                    }}
                  >
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                      {stats.coachName}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                      {/* 教練工作 */}
                      <div style={{ padding: '16px', background: '#e3f2fd', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1976d2' }}>
                          🎓 教練工作
                        </h4>
                        <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                          <div>預約數：{stats.coachBookings} 筆</div>
                          <div>教學時數：{stats.coachMinutes} 分鐘</div>
                          <div>學員數：{stats.coachStudents} 人</div>
                          {Object.keys(stats.paymentMethods).length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{ fontWeight: '600', marginBottom: '4px' }}>收費方式：</div>
                              {Object.entries(stats.paymentMethods).map(([method, count]) => (
                                <div key={method} style={{ marginLeft: '8px', fontSize: '13px' }}>
                                  • {method === 'cash' ? '現金' : 
                                     method === 'transfer' ? '匯款' : 
                                     method === 'balance' ? '扣儲值' : 
                                     method === 'voucher' ? '票券' : 
                                     method === 'designated_paid' ? '指定（需收費）' : 
                                     method === 'designated_free' ? '指定（不需收費）' : method}: {count} 筆
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 駕駛工作 */}
                      <div style={{ padding: '16px', background: '#e8f5e9', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#2e7d32' }}>
                          🚤 駕駛工作
                        </h4>
                        <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                          <div>預約數：{stats.driverBookings} 筆</div>
                          <div>駕駛時數：{stats.driverMinutes} 分鐘</div>
                          <div>平均剩餘油量：{stats.avgFuelRemaining.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: 數據分析 */}
        {!loading && activeTab === 'data-analysis' && (
          <div>
            {workStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                😔 沒有找到相關資料
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 總覽卡片 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
                    📊 當日總覽
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>總教學時數</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {workStats.reduce((sum, s) => sum + s.coachMinutes, 0)} 分
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>總駕駛時數</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {workStats.reduce((sum, s) => sum + s.driverMinutes, 0)} 分
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>總學員數</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {workStats.reduce((sum, s) => sum + s.coachStudents, 0)} 人
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>平均油量</div>
                      <div style={{ fontSize: '24px', fontWeight: '700' }}>
                        {(workStats.reduce((sum, s) => sum + s.avgFuelRemaining, 0) / workStats.length).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* 教練工作量排行 */}
                <div style={{ ...getCardStyle(isMobile) }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                    🏆 教練工作量排行
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[...workStats]
                      .sort((a, b) => b.coachMinutes - a.coachMinutes)
                      .map((stats, index) => {
                        const maxMinutes = Math.max(...workStats.map(s => s.coachMinutes))
                        const percentage = maxMinutes > 0 ? (stats.coachMinutes / maxMinutes) * 100 : 0
                        
                        return (
                          <div key={stats.coachId}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                              <span style={{ fontWeight: '600' }}>
                                {index + 1}. {stats.coachName}
                              </span>
                              <span style={{ color: '#666' }}>
                                {stats.coachMinutes} 分 ({stats.coachBookings} 筆)
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e0e0e0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#2196F3',
                                transition: 'width 0.3s'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* 收費方式分布 */}
                <div style={{ ...getCardStyle(isMobile) }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                    💰 收費方式分布
                  </h3>
                  {(() => {
                    const allPayments: { [key: string]: number } = {}
                    workStats.forEach(stats => {
                      Object.entries(stats.paymentMethods).forEach(([method, count]) => {
                        allPayments[method] = (allPayments[method] || 0) + count
                      })
                    })
                    
                    const total = Object.values(allPayments).reduce((sum, count) => sum + count, 0)
                    
                    const methodLabels: { [key: string]: string } = {
                      'cash': '現金',
                      'transfer': '匯款',
                      'balance': '扣儲值',
                      'voucher': '票券',
                      'designated_paid': '指定（需收費）',
                      'designated_free': '指定（不需收費）'
                    }
                    
                    const colors = ['#4caf50', '#2196F3', '#ff9800', '#9c27b0', '#f44336', '#607d8b']
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(allPayments).map(([method, count], index) => {
                          const percentage = (count / total) * 100
                          
                          return (
                            <div key={method}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                                <span style={{ fontWeight: '600' }}>
                                  {methodLabels[method] || method}
                                </span>
                                <span style={{ color: '#666' }}>
                                  {count} 筆 ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: '8px',
                                background: '#e0e0e0',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${percentage}%`,
                                  height: '100%',
                                  background: colors[index % colors.length],
                                  transition: 'width 0.3s'
                                }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* 油量狀況 */}
                <div style={{ ...getCardStyle(isMobile) }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                    ⛽ 油量狀況
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {workStats
                      .filter(s => s.driverBookings > 0)
                      .sort((a, b) => a.avgFuelRemaining - b.avgFuelRemaining)
                      .map(stats => {
                        const fuelColor = stats.avgFuelRemaining < 30 ? '#f44336' : 
                                         stats.avgFuelRemaining < 60 ? '#ff9800' : '#4caf50'
                        
                        return (
                          <div key={stats.coachId}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                              <span style={{ fontWeight: '600' }}>
                                {stats.coachName}
                              </span>
                              <span style={{ color: fuelColor, fontWeight: '600' }}>
                                平均剩餘 {stats.avgFuelRemaining.toFixed(1)}%
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              background: '#e0e0e0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${stats.avgFuelRemaining}%`,
                                height: '100%',
                                background: fuelColor,
                                transition: 'width 0.3s'
                              }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* 匯出按鈕 */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => exportData()}
                    style={{
                      ...getButtonStyle('primary'),
                      padding: '12px 32px',
                      fontSize: '16px'
                    }}
                  >
                    📥 匯出數據報表
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
