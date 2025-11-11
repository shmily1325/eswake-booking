import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'

interface Coach {
  id: string
  name: string
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  requires_driver: boolean
  boats: { name: string; color: string } | null
  coaches: Coach[]
  drivers: Coach[]
  coach_report?: {
    fuel_amount: number
    driver_duration_min: number
    reported_at: string
  }
  participants?: Participant[]
}

interface Participant {
  id?: number
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  notes?: string
}

interface CoachReportProps {
  user: User
}

const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]

export function CoachReport({ user }: CoachReportProps) {
  const { isMobile } = useResponsive()
  
  // 日期和教練篩選
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all')
  const [coaches, setCoaches] = useState<Coach[]>([])
  
  // 預約列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  
  // 回報表單
  const [reportingBookingId, setReportingBookingId] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'coach' | 'driver' | 'both'>('coach')
  
  // 駕駛回報
  const [driverDuration, setDriverDuration] = useState<number>(0)
  const [fuelAmount, setFuelAmount] = useState<number>(100)
  
  // 教練回報
  const [participants, setParticipants] = useState<Participant[]>([])
  
  // 會員搜尋
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const { 
    filteredMembers,
    handleSearchChange
  } = useMemberSearch()

  // 載入教練列表
  useEffect(() => {
    loadCoaches()
  }, [])

  // 載入預約列表
  useEffect(() => {
    if (selectedDate) {
      loadBookings()
    }
  }, [selectedDate, selectedCoachId])

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

  const loadBookings = async () => {
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
          duration_min,
          contact_name,
          notes,
          boat_id,
          requires_driver,
          boats (name, color)
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at')
      
      if (bookingsError) throw bookingsError
      
      const bookingsWithDetails: Booking[] = []
      
      for (const booking of bookingsData || []) {
        // 載入教練
        const { data: coachesData } = await supabase
          .from('booking_coaches')
          .select('coach_id, coaches(id, name)')
          .eq('booking_id', booking.id)
        
        const coaches = coachesData?.map((bc: any) => bc.coaches).filter(Boolean) || []
        
        // 載入駕駛
        const { data: driversData } = await supabase
          .from('booking_drivers')
          .select('driver_id, coaches(id, name)')
          .eq('booking_id', booking.id)
        
        const drivers = driversData?.map((bd: any) => bd.coaches).filter(Boolean) || []
        
        // 載入駕駛回報
        const { data: coachReportData } = await supabase
          .from('coach_reports')
          .select('*')
          .eq('booking_id', booking.id)
          .maybeSingle()
        
        // 載入教練回報（參與者）
        const { data: participantsData } = await supabase
          .from('booking_participants')
          .select('*')
          .eq('booking_id', booking.id)
        
        bookingsWithDetails.push({
          ...booking,
          boats: Array.isArray(booking.boats) && booking.boats.length > 0 ? booking.boats[0] : null,
          coaches,
          drivers,
          coach_report: coachReportData || undefined,
          participants: participantsData || []
        })
      }
      
      // 篩選教練
      let filteredBookings = bookingsWithDetails
      if (selectedCoachId !== 'all') {
        filteredBookings = bookingsWithDetails.filter(booking => {
          const isCoach = booking.coaches.some(c => c.id === selectedCoachId)
          const isDriver = booking.drivers.some(d => d.id === selectedCoachId)
          const isCoachAsDriver = booking.coaches.some(c => c.id === selectedCoachId) && booking.drivers.length === 0
          return isCoach || isDriver || isCoachAsDriver
        })
      }
      
      setBookings(filteredBookings)
    } catch (error) {
      console.error('載入預約失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 判斷需要回報的類型
  const getReportType = (booking: Booking, coachId: string): 'coach' | 'driver' | 'both' | null => {
    const isCoach = booking.coaches.some(c => c.id === coachId)
    const isDriver = booking.drivers.some(d => d.id === coachId)
    const isCoachAsDriver = isCoach && booking.drivers.length === 0
    
    if (isCoach && (isDriver || isCoachAsDriver)) {
      return 'both'
    } else if (isCoach) {
      return 'coach'
    } else if (isDriver || isCoachAsDriver) {
      return 'driver'
    }
    return null
  }

  // 判斷是否已回報
  const getReportStatus = (booking: Booking, coachId: string) => {
    const type = getReportType(booking, coachId)
    if (!type) return { hasCoachReport: false, hasDriverReport: false }
    
    const hasCoachReport = booking.participants && booking.participants.length > 0 && 
      booking.coaches.some(c => c.id === coachId)
    const hasDriverReport = !!booking.coach_report
    
    return { hasCoachReport, hasDriverReport }
  }

  // 開始回報
  const startReport = (booking: Booking) => {
    const type = selectedCoachId === 'all' 
      ? 'coach' // 預設教練回報
      : getReportType(booking, selectedCoachId)
    
    if (!type) return
    
    setReportingBookingId(booking.id)
    setReportType(type)
    
    // 初始化駕駛回報
    if (booking.coach_report) {
      setDriverDuration(booking.coach_report.driver_duration_min)
      setFuelAmount(booking.coach_report.fuel_amount)
    } else {
      setDriverDuration(booking.duration_min)
      setFuelAmount(100)
    }
    
    // 初始化教練回報
    if (booking.participants && booking.participants.length > 0) {
      setParticipants(booking.participants)
    } else {
      // 預設帶入預約人
      setParticipants([{
        member_id: null,
        participant_name: booking.contact_name,
        duration_min: booking.duration_min,
        payment_method: 'cash'
      }])
    }
  }

  // 提交駕駛回報
  const submitDriverReport = async (bookingId: number) => {
    if (!selectedCoachId || selectedCoachId === 'all') {
      alert('請選擇教練')
      return
    }
    
    if (fuelAmount < 0 || fuelAmount > 100) {
      alert('油量必須在 0-100 之間')
      return
    }
    
    try {
      const now = new Date()
      const reported_at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const { error } = await supabase
        .from('coach_reports')
        .upsert({
          booking_id: bookingId,
          coach_id: selectedCoachId,
          fuel_amount: fuelAmount,
          driver_duration_min: driverDuration,
          reported_at
        }, {
          onConflict: 'booking_id,coach_id'
        })
      
      if (error) throw error
      
      alert('駕駛回報已儲存')
      loadBookings()
    } catch (error) {
      console.error('提交駕駛回報失敗:', error)
      alert('提交失敗，請重試')
    }
  }

  // 提交教練回報
  const submitCoachReport = async (bookingId: number) => {
    if (!selectedCoachId || selectedCoachId === 'all') {
      alert('請選擇教練')
      return
    }
    
    // 驗證
    for (const p of participants) {
      if (!p.participant_name.trim()) {
        alert('請填寫客人姓名')
        return
      }
      if (p.duration_min <= 0) {
        alert('時數必須大於 0')
        return
      }
    }
    
    try {
      const now = new Date()
      const created_at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      // 刪除舊的參與者記錄
      await supabase
        .from('booking_participants')
        .delete()
        .eq('booking_id', bookingId)
        .eq('coach_id', selectedCoachId)
      
      // 插入新的參與者記錄
      const participantsToInsert = participants.map(p => ({
        booking_id: bookingId,
        coach_id: selectedCoachId,
        member_id: p.member_id,
        participant_name: p.participant_name,
        duration_min: p.duration_min,
        payment_method: p.payment_method,
        notes: p.notes || null,
        created_at
      }))
      
      const { error } = await supabase
        .from('booking_participants')
        .insert(participantsToInsert)
      
      if (error) throw error
      
      alert('教練回報已儲存')
      loadBookings()
    } catch (error) {
      console.error('提交教練回報失敗:', error)
      alert('提交失敗，請重試')
    }
  }

  // 提交回報
  const submitReport = async () => {
    if (!reportingBookingId) return
    
    try {
      if (reportType === 'driver') {
        await submitDriverReport(reportingBookingId)
      } else if (reportType === 'coach') {
        await submitCoachReport(reportingBookingId)
      } else if (reportType === 'both') {
        await submitDriverReport(reportingBookingId)
        await submitCoachReport(reportingBookingId)
      }
      
      setReportingBookingId(null)
    } catch (error) {
      console.error('提交回報失敗:', error)
    }
  }

  // 新增參與者
  const addParticipant = () => {
    setParticipants([...participants, {
      member_id: null,
      participant_name: '',
      duration_min: 60,
      payment_method: 'cash'
    }])
  }

  // 刪除參與者
  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  // 更新參與者
  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  // 選擇會員
  const selectMember = (index: number, member: Member) => {
    updateParticipant(index, 'member_id', member.id)
    updateParticipant(index, 'participant_name', member.name)
    setMemberSearchTerm('')
  }

  const reportingBooking = bookings.find(b => b.id === reportingBookingId)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="教練回報"
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
            <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
              日期
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={getInputStyle(isMobile)}
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
              教練篩選
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={getInputStyle(isMobile)}
            >
              <option value="all">全部教練</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 預約列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            😔 沒有找到預約記錄
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookings.map(booking => {
              const status = selectedCoachId !== 'all' 
                ? getReportStatus(booking, selectedCoachId)
                : { hasCoachReport: false, hasDriverReport: false }
              
              const type = selectedCoachId !== 'all'
                ? getReportType(booking, selectedCoachId)
                : null
              
              return (
                <div
                  key={booking.id}
                  style={{
                    ...getCardStyle(isMobile),
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => startReport(booking)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', marginBottom: '4px' }}>
                        {booking.start_at.substring(11, 16)} | {booking.contact_name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {booking.boats?.name} • {booking.duration_min}分
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {type === 'coach' || type === 'both' ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: status.hasCoachReport ? '#e8f5e9' : '#fff3e0',
                          color: status.hasCoachReport ? '#2e7d32' : '#f57c00',
                          fontWeight: '600'
                        }}>
                          教練 {status.hasCoachReport ? '✓' : '未回報'}
                        </span>
                      ) : null}
                      
                      {type === 'driver' || type === 'both' ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: status.hasDriverReport ? '#e8f5e9' : '#fff3e0',
                          color: status.hasDriverReport ? '#2e7d32' : '#f57c00',
                          fontWeight: '600'
                        }}>
                          駕駛 {status.hasDriverReport ? '✓' : '未回報'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  
                  {booking.coaches.length > 0 && (
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      🎓 {booking.coaches.map(c => c.name).join('、')}
                    </div>
                  )}
                  
                  {booking.drivers.length > 0 && (
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      🚤 {booking.drivers.map(d => d.name).join('、')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 回報對話框 */}
      {reportingBookingId && reportingBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '16px' : '24px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: isMobile ? '20px' : '32px'
          }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: isMobile ? '20px' : '24px' }}>
              回報預約
            </h2>
            
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {reportingBooking.start_at.substring(11, 16)} | {reportingBooking.contact_name}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {reportingBooking.boats?.name} • {reportingBooking.duration_min}分
              </div>
            </div>

            {/* 駕駛回報 */}
            {(reportType === 'driver' || reportType === 'both') && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#2196F3' }}>
                  🚤 駕駛回報
                </h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                    實際駕駛時數（分鐘）*
                  </label>
                  <input
                    type="number"
                    value={driverDuration}
                    onChange={(e) => setDriverDuration(Number(e.target.value))}
                    min="0"
                    style={getInputStyle(isMobile)}
                  />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                    剩餘油量（%）* (0-100)
                  </label>
                  <input
                    type="number"
                    value={fuelAmount}
                    onChange={(e) => setFuelAmount(Number(e.target.value))}
                    min="0"
                    max="100"
                    style={getInputStyle(isMobile)}
                  />
                </div>
              </div>
            )}

            {/* 教練回報 */}
            {(reportType === 'coach' || reportType === 'both') && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#4caf50' }}>
                  🎓 教練回報
                </h3>
                
                {participants.map((participant, index) => (
                  <div key={index} style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: '#f9f9f9',
                    borderRadius: '8px',
                    position: 'relative'
                  }}>
                    {participants.length > 1 && (
                      <button
                        onClick={() => removeParticipant(index)}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        刪除
                      </button>
                    )}
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                        客人姓名 *
                      </label>
                      <input
                        type="text"
                        value={participant.participant_name}
                        onChange={(e) => {
                          updateParticipant(index, 'participant_name', e.target.value)
                          setMemberSearchTerm(e.target.value)
                          handleSearchChange(e.target.value)
                        }}
                        placeholder="輸入客人姓名或搜尋會員"
                        style={getInputStyle(isMobile)}
                      />
                      
                      {/* 會員搜尋結果 */}
                      {memberSearchTerm && filteredMembers.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          background: 'white',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          maxHeight: '200px',
                          overflow: 'auto',
                          position: 'relative',
                          zIndex: 10
                        }}>
                          {filteredMembers.map((member: Member) => (
                            <div
                              key={member.id}
                              onClick={() => selectMember(index, member)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {member.name}
                              {member.phone && <span style={{ color: '#999', marginLeft: '8px' }}>({member.phone})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                        實際時數（分鐘）*
                      </label>
                      <input
                        type="number"
                        value={participant.duration_min}
                        onChange={(e) => updateParticipant(index, 'duration_min', Number(e.target.value))}
                        min="0"
                        style={getInputStyle(isMobile)}
                      />
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                        收費方式 *
                      </label>
                      <select
                        value={participant.payment_method}
                        onChange={(e) => updateParticipant(index, 'payment_method', e.target.value)}
                        style={getInputStyle(isMobile)}
                      >
                        {PAYMENT_METHODS.map(method => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={addParticipant}
                  style={{
                    ...getButtonStyle('secondary'),
                    width: '100%'
                  }}
                >
                  ➕ 新增客人
                </button>
              </div>
            )}

            {/* 按鈕 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setReportingBookingId(null)}
                style={{
                  ...getButtonStyle('secondary'),
                  flex: 1
                }}
              >
                取消
              </button>
              <button
                onClick={submitReport}
                style={{
                  ...getButtonStyle('primary'),
                  flex: 1
                }}
              >
                提交回報
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

