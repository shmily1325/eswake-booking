import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle, getLabelStyle } from '../../styles/designSystem'
import { useToast } from '../../components/ui'
import { CoachReport } from './CoachReport'


interface ParticipantReport {
  id: number | string
  booking_id: number
  type: 'teaching' | 'driving'
  participant_name?: string
  duration_min: number
  payment_method?: string
  lesson_type?: string
  reported_at: string
  booking_start_at: string
  booking_contact_name: string
  booking_duration_min?: number
  boat_name: string
}

interface MonthlyStats {
  teachingMinutes: number
  teachingCount: number
  drivingMinutes: number
  drivingCount: number
}

export function MyReport() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report')
  const [coachId, setCoachId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  
  
  // 回報記錄相關
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [historyRecords, setHistoryRecords] = useState<ParticipantReport[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    teachingMinutes: 0,
    teachingCount: 0,
    drivingMinutes: 0,
    drivingCount: 0
  })

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


  // 載入回報記錄
  useEffect(() => {
    if (!coachId || activeTab !== 'history') return
    loadHistoryRecords()
  }, [coachId, activeTab, selectedMonth])


  const loadHistoryRecords = async () => {
    if (!coachId) return
    
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01T00:00:00`
      const endDate = new Date(parseInt(year), parseInt(month), 0)
      const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`

      // 查詢教學明細（參與者）
      const { data: participantData, error: participantError } = await supabase
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
        .order('bookings.start_at', { ascending: false })

      if (participantError) throw participantError

      // 查詢駕駛明細
      const { data: driverData, error: driverError } = await supabase
        .from('coach_reports')
        .select(`
          id,
          booking_id,
          driver_duration_min,
          created_at,
          bookings!inner(
            start_at,
            contact_name,
            duration_min,
            boats(name)
          )
        `)
        .eq('coach_id', coachId)
        .not('driver_duration_min', 'is', null)
        .gte('bookings.start_at', startDate)
        .lte('bookings.start_at', endDateStr)
        .order('bookings.start_at', { ascending: false })

      if (driverError) throw driverError

      const records = (participantData || []).map((record: any) => ({
        id: record.id,
        booking_id: record.booking_id,
        type: 'teaching' as const,
        participant_name: record.participant_name,
        duration_min: record.duration_min,
        payment_method: record.payment_method,
        lesson_type: record.lesson_type,
        reported_at: record.reported_at,
        booking_start_at: record.bookings.start_at,
        booking_contact_name: record.bookings.contact_name,
        boat_name: record.bookings.boats?.name || ''
      }))

      const driverRecords = (driverData || []).map((record: any) => ({
        id: `driver-${record.id}`,
        booking_id: record.booking_id,
        type: 'driving' as const,
        duration_min: record.driver_duration_min,
        reported_at: record.created_at,
        booking_start_at: record.bookings.start_at,
        booking_contact_name: record.bookings.contact_name,
        booking_duration_min: record.bookings.duration_min,
        boat_name: record.bookings.boats?.name || ''
      }))

      // 合併並按時間排序
      const allRecords = [...records, ...driverRecords].sort((a, b) => 
        new Date(b.booking_start_at).getTime() - new Date(a.booking_start_at).getTime()
      )

      // 計算統計數據
      const teachingMinutes = records.reduce((sum, r) => sum + r.duration_min, 0)
      const drivingMinutes = driverRecords.reduce((sum, r) => sum + r.duration_min, 0)

      setMonthlyStats({
        teachingMinutes,
        teachingCount: records.length,
        drivingMinutes,
        drivingCount: driverRecords.length
      })

      setHistoryRecords(allRecords as any)
    } catch (error) {
      console.error('載入回報記錄失敗:', error)
      toast.error('載入回報記錄失敗')
    } finally {
      setLoading(false)
    }
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
            onClick={() => setActiveTab('report')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: activeTab === 'report' ? 'white' : 'transparent',
              color: activeTab === 'report' ? '#2196f3' : '#999',
              border: 'none',
              borderBottom: activeTab === 'report' ? '3px solid #2196f3' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📝 回報
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
            📊 細帳
          </button>
        </div>


        {/* 回報 Tab - 嵌入 CoachReport */}
        {activeTab === 'report' && coachId && (
          <div style={{ margin: '-24px' }}>
            <CoachReport autoFilterByUser={true} embedded={true} />
          </div>
        )}

        {/* 細帳 Tab */}
        {activeTab === 'history' && (
          <div style={{
            ...getCardStyle(isMobile),
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0
          }}>
            {/* 月份選擇 */}
            <div style={{ marginBottom: '24px' }}>
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

            {/* 統計圖表 */}
            {!loading && (monthlyStats.teachingMinutes > 0 || monthlyStats.drivingMinutes > 0) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '20px',
                marginBottom: '24px'
              }}>
                {/* 教學時數對比 */}
                <div style={{
                  padding: '20px',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: '16px',
                    borderLeft: '4px solid #2196f3',
                    paddingLeft: '12px'
                  }}>
                    🎓 教學時數對比
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        教學
                      </span>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {monthlyStats.teachingMinutes}分 ({monthlyStats.teachingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '32px',
                      background: '#e3f2fd',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: '#2196f3',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {monthlyStats.teachingMinutes}分
                      </div>
                    </div>
                  </div>
                </div>

                {/* 駕駛時數對比 */}
                <div style={{
                  padding: '20px',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: '16px',
                    borderLeft: '4px solid #4caf50',
                    paddingLeft: '12px'
                  }}>
                    🚤 駕駛時數對比
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        駕駛
                      </span>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {monthlyStats.drivingMinutes}分 ({monthlyStats.drivingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '32px',
                      background: '#e8f5e9',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: '#4caf50',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {monthlyStats.drivingMinutes}分
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                      borderRadius: '8px',
                      borderLeft: `4px solid ${record.type === 'teaching' ? '#2196f3' : '#4caf50'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>
                          {formatDateTime(record.booking_start_at)} | {record.boat_name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                          {record.booking_contact_name}
                        </div>
                        {record.type === 'teaching' ? (
                          <div style={{ fontSize: '13px', color: '#333' }}>
                            {record.participant_name} · {record.duration_min}分 · {getPaymentMethodLabel(record.payment_method || '')} · {getLessonTypeLabel(record.lesson_type || '')}
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#333' }}>
                            駕駛 · {record.duration_min}分
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        background: record.type === 'teaching' ? '#e3f2fd' : '#e8f5e9',
                        color: record.type === 'teaching' ? '#1565c0' : '#2e7d32',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}>
                        {record.type === 'teaching' ? '🎓 教學' : '🚤 駕駛'}
                      </div>
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

