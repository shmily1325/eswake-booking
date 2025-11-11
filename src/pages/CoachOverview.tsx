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
    } else if (activeTab === 'work-stats') {
      loadWorkStats()
    }
  }, [activeTab, selectedDate, selectedCoachId])

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
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      // 載入預約
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          contact_name,
          boat_id,
          boats (name)
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at')

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

          const isCoach = coachBookingIds.includes(bookingId)
          const isDriver = driverBookingIds.includes(bookingId)
          const hasNoDriver = !driversResult.data?.some(bd => bd.booking_id === bookingId)
          const isImplicitDriver = isCoach && hasNoDriver

          const needsCoachReport = isCoach
          const needsDriverReport = isDriver || isImplicitDriver

          const hasCoachReport = participantsResult.data?.some(
            p => p.booking_id === bookingId && p.coach_id === coach.id
          )
          const hasDriverReport = coachReportsResult.data?.some(
            cr => cr.booking_id === bookingId && cr.coach_id === coach.id
          )

          if (hasCoachReport) coachReported++
          if (hasDriverReport) driverReported++

          if ((needsCoachReport && !hasCoachReport) || (needsDriverReport && !hasDriverReport)) {
            missingReports.push({
              bookingId,
              startAt: booking.start_at,
              contactName: booking.contact_name,
              boatName: (booking.boats as any)?.name || '未知',
              needsCoachReport: needsCoachReport && !hasCoachReport,
              needsDriverReport: needsDriverReport && !hasDriverReport
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

  const loadWorkStats = async () => {
    setLoading(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      // 載入預約
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
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
          flexDirection: isMobile ? 'column' : 'row',
          gap: '16px',
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: '#666' }}>
              日期
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ flex: 1 }}>
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
          <div style={{
            ...getCardStyle(isMobile),
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>數據分析功能</div>
            <div style={{ fontSize: '14px' }}>圖表功能開發中...</div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
