import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle, getLabelStyle } from '../../styles/designSystem'
import { getLocalDateString } from '../../utils/date'
import { useToast } from '../../components/ui'

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  boat_name: string
  coaches: Coach[]
  drivers: Coach[]
  has_participant_report: boolean
  has_driver_report: boolean
}

interface ParticipantReport {
  id: number
  booking_id: number
  participant_name: string
  duration_min: number
  payment_method: string
  lesson_type: string
  reported_at: string
  booking_start_at: string
  booking_contact_name: string
  boat_name: string
}

export function MyReport() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [coachId, setCoachId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  
  // 待回報相關
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [reportFilter, setReportFilter] = useState<'all' | 'reported' | 'unreported'>('all')
  
  // 回報記錄相關
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [historyRecords, setHistoryRecords] = useState<ParticipantReport[]>([])

  // 載入教練資訊
  useEffect(() => {
    const loadCoachInfo = async () => {
      if (!user?.email) return
      
      setCheckingAuth(true)

      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('user_email', user.email)
        .single()

      if (error || !data) {
        console.error('載入教練資訊失敗:', error)
        toast.error('載入失敗，請重新整理頁面')
        setCheckingAuth(false)
        return
      }

      setCoachId(data.id)
      setCheckingAuth(false)
    }

    loadCoachInfo()
  }, [user?.email])

  // 載入待回報預約
  useEffect(() => {
    if (!coachId || activeTab !== 'pending') return
    loadPendingBookings()
  }, [coachId, activeTab])

  // 載入回報記錄
  useEffect(() => {
    if (!coachId || activeTab !== 'history') return
    loadHistoryRecords()
  }, [coachId, activeTab, selectedMonth])

  const loadPendingBookings = async () => {
    if (!coachId) return
    
    setLoading(true)
    try {
      // 查詢最近 30 天內已結束的預約
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = getLocalDateString(thirtyDaysAgo) + 'T00:00:00'
      const now = new Date().toISOString()

      // 1. 查詢作為教練的預約
      const { data: coachBookings, error: coachError } = await supabase
        .from('booking_coaches')
        .select(`
          booking_id,
          bookings!inner(
            id, start_at, duration_min, contact_name, status,
            boats(name)
          )
        `)
        .eq('coach_id', coachId)
        .eq('bookings.status', 'confirmed')
        .gte('bookings.start_at', startDate)
        .lte('bookings.start_at', now)

      if (coachError) throw coachError

      // 2. 查詢作為駕駛的預約
      const { data: driverBookings, error: driverError } = await supabase
        .from('booking_drivers')
        .select(`
          booking_id,
          bookings!inner(
            id, start_at, duration_min, contact_name, status,
            boats(name)
          )
        `)
        .eq('driver_id', coachId)
        .eq('bookings.status', 'confirmed')
        .gte('bookings.start_at', startDate)
        .lte('bookings.start_at', now)

      if (driverError) throw driverError

      // 合併預約 ID（去重）
      const bookingIds = new Set<number>()
      coachBookings?.forEach(cb => bookingIds.add(cb.booking_id))
      driverBookings?.forEach(db => bookingIds.add(db.booking_id))

      if (bookingIds.size === 0) {
        setPendingBookings([])
        setLoading(false)
        return
      }

      // 3. 查詢這些預約的完整資訊
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id, start_at, duration_min, contact_name,
          boats(name)
        `)
        .in('id', Array.from(bookingIds))
        .order('start_at', { ascending: false })

      if (bookingsError) throw bookingsError

      // 4. 查詢每個預約的教練、駕駛和回報狀態
      const bookingsWithDetails = await Promise.all(
        (bookingsData || []).map(async (booking: any) => {
          // 查詢教練
          const { data: coaches } = await supabase
            .from('booking_coaches')
            .select('coach_id, coaches(id, name)')
            .eq('booking_id', booking.id)

          // 查詢駕駛
          const { data: drivers } = await supabase
            .from('booking_drivers')
            .select('driver_id, coaches(id, name)')
            .eq('booking_id', booking.id)

          // 查詢該教練是否已回報參與者
          const { data: participantReports } = await supabase
            .from('booking_participants')
            .select('id')
            .eq('booking_id', booking.id)
            .eq('coach_id', coachId)
            .is('is_deleted', false)

          // 查詢該教練是否已回報駕駛時數
          const { data: driverReport } = await supabase
            .from('coach_reports')
            .select('id')
            .eq('booking_id', booking.id)
            .eq('coach_id', coachId)
            .not('driver_duration_min', 'is', null)

          return {
            id: booking.id,
            start_at: booking.start_at,
            duration_min: booking.duration_min,
            contact_name: booking.contact_name,
            boat_name: booking.boats?.name || '',
            coaches: coaches?.map((c: any) => ({
              id: c.coaches.id,
              name: c.coaches.name
            })) || [],
            drivers: drivers?.map((d: any) => ({
              id: d.coaches.id,
              name: d.coaches.name
            })) || [],
            has_participant_report: (participantReports?.length || 0) > 0,
            has_driver_report: (driverReport?.length || 0) > 0
          }
        })
      )

      // 過濾掉已結束的預約
      const validBookings = bookingsWithDetails.filter(b => {
        const bookingEnd = new Date(new Date(b.start_at).getTime() + b.duration_min * 60000)
        return bookingEnd <= new Date()
      })

      setPendingBookings(validBookings)
    } catch (error) {
      console.error('載入待回報預約失敗:', error)
      toast.error('載入預約失敗')
    } finally {
      setLoading(false)
    }
  }

  const loadHistoryRecords = async () => {
    if (!coachId) return
    
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01T00:00:00`
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`

      const { data, error } = await supabase
        .from('booking_participants')
        .select(`
          id,
          booking_id,
          participant_name,
          duration_min,
          payment_method,
          lesson_type,
          reported_at,
          bookings!inner(
            start_at,
            contact_name,
            boats(name)
          )
        `)
        .eq('coach_id', coachId)
        .is('is_deleted', false)
        .gte('bookings.start_at', startDate)
        .lte('bookings.start_at', endDateStr)
        .order('reported_at', { ascending: false })

      if (error) throw error

      const records = (data || []).map((record: any) => ({
        id: record.id,
        booking_id: record.booking_id,
        participant_name: record.participant_name,
        duration_min: record.duration_min,
        payment_method: record.payment_method,
        lesson_type: record.lesson_type,
        reported_at: record.reported_at,
        booking_start_at: record.bookings.start_at,
        booking_contact_name: record.bookings.contact_name,
        boat_name: record.bookings.boats?.name || ''
      }))

      setHistoryRecords(records)
    } catch (error) {
      console.error('載入回報記錄失敗:', error)
      toast.error('載入回報記錄失敗')
    } finally {
      setLoading(false)
    }
  }

  const getFilteredPendingBookings = () => {
    if (reportFilter === 'all') return pendingBookings
    
    return pendingBookings.filter(booking => {
      const isCoach = booking.coaches.some(c => c.id === coachId)
      const isDriver = booking.drivers.some(d => d.id === coachId)
      
      // 判斷是否已回報
      const hasReported = (isCoach && booking.has_participant_report) || 
                         (isDriver && booking.has_driver_report)
      
      if (reportFilter === 'reported') return hasReported
      if (reportFilter === 'unreported') return !hasReported
      return true
    })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'free': '免費',
      'cash': '現金',
      'credit_card': '信用卡',
      'bank_transfer': '轉帳',
      'member_hours': '會員時數',
      'gift_hours': '贈送時數'
    }
    return labels[method] || method
  }

  const getLessonTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'designated_paid': '指定需收費',
      'designated_free': '指定不需收費',
      'undesignated': '不指定'
    }
    return labels[type] || type
  }

  const filteredBookings = getFilteredPendingBookings()
  const unreportedCount = pendingBookings.filter(b => {
    const isCoach = b.coaches.some(c => c.id === coachId)
    const isDriver = b.drivers.some(d => d.id === coachId)
    return !((isCoach && b.has_participant_report) || (isDriver && b.has_driver_report))
  }).length

  // 檢查權限中
  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <PageHeader 
          user={user} 
          title="教練回報"
          showBaoLink={false}
        />
        <div style={{ 
          flex: 1, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: '#999'
        }}>
          檢查權限中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="教練回報"
        showBaoLink={false}
      />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '0',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: activeTab === 'pending' ? 'white' : 'transparent',
              color: activeTab === 'pending' ? '#2196f3' : '#999',
              border: 'none',
              borderBottom: activeTab === 'pending' ? '3px solid #2196f3' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            📋 待回報
            {unreportedCount > 0 && (
              <span style={{
                background: '#ff9800',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                {unreportedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: activeTab === 'history' ? 'white' : 'transparent',
              color: activeTab === 'history' ? '#4caf50' : '#999',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #4caf50' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📊 回報記錄
          </button>
        </div>

        {/* 待回報 Tab */}
        {activeTab === 'pending' && (
          <div style={{
            ...getCardStyle(isMobile),
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0
          }}>
            {/* 篩選按鈕 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>篩選</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setReportFilter('all')}
                  style={{
                    padding: '10px 20px',
                    background: reportFilter === 'all' ? '#2196f3' : 'white',
                    color: reportFilter === 'all' ? 'white' : '#666',
                    border: '2px solid',
                    borderColor: reportFilter === 'all' ? '#2196f3' : '#e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  全部
                </button>
                <button
                  onClick={() => setReportFilter('unreported')}
                  style={{
                    padding: '10px 20px',
                    background: reportFilter === 'unreported' ? '#ff9800' : 'white',
                    color: reportFilter === 'unreported' ? 'white' : '#666',
                    border: '2px solid',
                    borderColor: reportFilter === 'unreported' ? '#ff9800' : '#e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  未回報
                </button>
                <button
                  onClick={() => setReportFilter('reported')}
                  style={{
                    padding: '10px 20px',
                    background: reportFilter === 'reported' ? '#4caf50' : 'white',
                    color: reportFilter === 'reported' ? 'white' : '#666',
                    border: '2px solid',
                    borderColor: reportFilter === 'reported' ? '#4caf50' : '#e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  已回報
                </button>
              </div>
            </div>

            {/* 預約列表 */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : filteredBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                沒有待回報的預約
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredBookings.map(booking => {
                  const isCoach = booking.coaches.some(c => c.id === coachId)
                  const isDriver = booking.drivers.some(d => d.id === coachId)
                  const hasReported = (isCoach && booking.has_participant_report) || 
                                     (isDriver && booking.has_driver_report)

                  return (
                    <div
                      key={booking.id}
                      style={{
                        padding: '16px',
                        background: 'white',
                        border: '2px solid',
                        borderColor: hasReported ? '#4caf50' : '#ff9800',
                        borderRadius: '8px',
                        borderLeft: `6px solid ${hasReported ? '#4caf50' : '#ff9800'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                            {formatDateTime(booking.start_at)} | {booking.boat_name} ({booking.duration_min}分)
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {booking.contact_name}
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 12px',
                          background: hasReported ? '#4caf50' : '#ff9800',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          {hasReported ? '已回報' : '未回報'}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
                        {isCoach && <span>👨‍🏫 教練</span>}
                        {isCoach && isDriver && <span> · </span>}
                        {isDriver && <span>🚤 駕駛</span>}
                      </div>
                      
                      <button
                        onClick={() => {
                          // 導航到回報頁面
                          window.location.href = `/coach-report?date=${booking.start_at.split('T')[0]}`
                        }}
                        style={{
                          marginTop: '12px',
                          padding: '8px 16px',
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        {hasReported ? '查看回報' : '立即回報'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 回報記錄 Tab */}
        {activeTab === 'history' && (
          <div style={{
            ...getCardStyle(isMobile),
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0
          }}>
            {/* 月份選擇 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>月份</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 記錄列表 */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : historyRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                本月沒有回報記錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historyRecords.map(record => (
                  <div
                    key={record.id}
                    style={{
                      padding: '16px',
                      background: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                      {formatDateTime(record.booking_start_at)} | {record.boat_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      預約人：{record.booking_contact_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      參與者：{record.participant_name} ({record.duration_min}分)
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      付款方式：{getPaymentMethodLabel(record.payment_method)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      課程類型：{getLessonTypeLabel(record.lesson_type)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      回報時間：{new Date(record.reported_at).toLocaleString('zh-TW')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

