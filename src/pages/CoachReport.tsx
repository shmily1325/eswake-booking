import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'
import { getDisplayContactName } from '../utils/bookingFormat'
import { isFacility } from '../utils/facility'
import { getLocalDateString } from '../utils/date'

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
  coach_id?: string | null
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
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
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
    // 回報系統顯示所有教練（包含已停用但排除已歸檔），因為需要查看歷史數據
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, status')
      .neq('status', 'archived')
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
          booking_members(member_id, members:member_id(id, name, nickname)),
          boats (name, color)
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at')
      
      if (bookingsError) throw bookingsError
      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }
      
      const bookingIds = bookingsData.map(b => b.id)
      
      // 並行載入所有相關資料（大幅提升速度）
      const [
        { data: allCoachesData },
        { data: allDriversData },
        { data: allCoachReports },
        { data: allParticipants }
      ] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coach_id, coaches(id, name)')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_drivers')
          .select('booking_id, driver_id, coaches(id, name)')
          .in('booking_id', bookingIds),
        supabase
          .from('coach_reports')
          .select('*')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_participants')
          .select('*')
          .in('booking_id', bookingIds)
      ])
      
      // 組裝資料
      const bookingsWithDetails: Booking[] = bookingsData.map(booking => {
        const coaches = allCoachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coaches)
          .filter(Boolean) || []
        
        const drivers = allDriversData
          ?.filter((bd: any) => bd.booking_id === booking.id)
          .map((bd: any) => bd.coaches)
          .filter(Boolean) || []
        
        const coachReport = allCoachReports?.find((cr: any) => cr.booking_id === booking.id)
        
        const participants = allParticipants?.filter((p: any) => p.booking_id === booking.id) || []
        
        return {
          ...booking,
          boats: Array.isArray(booking.boats) && booking.boats.length > 0 ? booking.boats[0] : null,
          coaches,
          drivers,
          coach_report: coachReport || undefined,
          participants
        }
      })
      
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
    const boatName = booking.boats?.name
    const isFacilityBooking = isFacility(boatName)
    
    const isCoach = booking.coaches.some(c => c.id === coachId)
    const isExplicitDriver = booking.drivers.some(d => d.id === coachId)
    const hasNoDriver = booking.drivers.length === 0
    const isImplicitDriver = isCoach && hasNoDriver // 教練兼駕駛
    
    // 判斷這個人需要回報什麼
    const needsCoachReport = isCoach
    // 彈簧床等設施不需要駕駛回報
    const needsDriverReport = isFacilityBooking ? false : (isExplicitDriver || isImplicitDriver)
    
    if (needsCoachReport && needsDriverReport) {
      return 'both'
    } else if (needsCoachReport) {
      return 'coach'
    } else if (needsDriverReport) {
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
    const boatName = booking.boats?.name
    const isFacilityBooking = isFacility(boatName)
    
    let type: 'coach' | 'driver' | 'both' | null = null
    
    if (selectedCoachId === 'all') {
      // 判斷這個預約需要什麼類型的回報
      const hasCoaches = booking.coaches.length > 0
      
      if (isFacilityBooking) {
        // 彈簧床等設施只需要教練回報，不需要駕駛回報
        type = hasCoaches ? 'coach' : null
      } else if (hasCoaches) {
        // 有教練 = 需要教練回報 + 駕駛回報
        type = 'both'
      } else {
        // 沒有教練 = 只需要駕駛回報
        type = 'driver'
      }
    } else {
      type = getReportType(booking, selectedCoachId)
    }
    
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
      // 載入這筆預約的所有會員
      loadBookingMembers(booking.id, booking.duration_min)
    }
  }

  // 載入預約的會員資訊（排除已被其他教練回報的會員）
  const loadBookingMembers = async (bookingId: number, defaultDuration: number) => {
    try {
      const booking = bookings.find(b => b.id === bookingId)
      
      // 1. 載入預約的所有會員
      const { data: bookingMembersData } = await supabase
        .from('booking_members')
        .select('member_id, members(id, name)')
        .eq('booking_id', bookingId)

      // 2. 載入已被其他教練回報的參與者（會員和非會員）
      const { data: reportedParticipants } = await supabase
        .from('booking_participants')
        .select('member_id, participant_name, coach_id')
        .eq('booking_id', bookingId)
        .not('coach_id', 'is', null)

      // 3. 找出已被其他教練回報的會員 ID 和姓名
      const reportedMemberIds = new Set<string>()
      const reportedNames = new Set<string>()
      if (reportedParticipants) {
        reportedParticipants.forEach(rp => {
          // 排除當前教練自己的回報
          if (rp.coach_id !== selectedCoachId) {
            if (rp.member_id) {
              reportedMemberIds.add(rp.member_id)
            }
            if (rp.participant_name) {
              reportedNames.add(rp.participant_name.trim())
            }
          }
        })
      }

      // 4. 過濾掉已被其他教練回報的會員
      const availableMembers = (bookingMembersData || []).filter(
        (bm: any) => !reportedMemberIds.has(bm.member_id)
      )

      // 5. 建立參與者列表
      const participants: any[] = []
      
      // 5.1 加入可用的會員
      availableMembers.forEach((bm: any) => {
        const member = bm.members
        participants.push({
          member_id: bm.member_id,
          participant_name: (member?.nickname || member?.name) || '未知',
          duration_min: defaultDuration,
          payment_method: 'cash'
        })
      })

      // 5.2 檢查預約人是否是非會員且未被回報
      if (booking?.contact_name) {
        // 分析 contact_name 中的所有名字
        const contactNames = booking.contact_name.split(',').map(n => n.trim()).filter(Boolean)
        
        for (const contactName of contactNames) {
          // 檢查是否匹配任何會員的暱稱或姓名
          const isContactMember = (bookingMembersData || []).some(
            (bm: any) => {
              const member = bm.members
              return member && (member.nickname === contactName || member.name === contactName)
            }
          )
          const isContactReported = reportedNames.has(contactName)
          
          // 如果不是會員，且未被其他教練回報，則加入列表
          if (!isContactMember && !isContactReported) {
            participants.push({
              member_id: null,
              participant_name: contactName,
              duration_min: defaultDuration,
              payment_method: 'cash'
            })
          }
        }
      }

      // 6. 設定參與者列表
      if (participants.length > 0) {
        setParticipants(participants)
      } else {
        // 所有人都已被其他教練回報，提供空白欄位讓教練確認或新增
        setParticipants([{
          member_id: null,
          participant_name: '',
          duration_min: defaultDuration,
          payment_method: 'cash'
        }])
      }
    } catch (error) {
      console.error('載入會員資訊失敗:', error)
      // 發生錯誤時使用預約人姓名
      const booking = bookings.find(b => b.id === bookingId)
      setParticipants([{
        member_id: null,
        participant_name: booking ? getDisplayContactName(booking) : '',
        duration_min: defaultDuration,
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
    
    // 過濾掉空白的參與者（允許教練確認「沒有客人」）
    const validParticipants = participants.filter(p => p.participant_name.trim())
    
    // 驗證有效的參與者
    for (const p of validParticipants) {
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
      
      // 只插入有效的參與者記錄（有姓名的）
      if (validParticipants.length > 0) {
        const participantsToInsert = validParticipants.map(p => ({
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
      }
      
      // 無論是否有參與者，都視為已回報（教練確認了沒有客人）
      alert(validParticipants.length > 0 
        ? '教練回報已儲存' 
        : '已確認無客人，回報已儲存')
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
              選擇教練（請選擇您自己）
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              flexWrap: 'wrap',
              maxHeight: isMobile ? '200px' : '150px',
              overflowY: 'auto',
              padding: '8px',
              background: '#f9f9f9',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              {coaches.map(coach => (
                <button
                  key={coach.id}
                  onClick={() => setSelectedCoachId(coach.id)}
                  style={{
                    padding: '10px 16px',
                    border: selectedCoachId === coach.id ? '2px solid #2196f3' : '1px solid #ddd',
                    borderRadius: '8px',
                    background: selectedCoachId === coach.id ? '#e3f2fd' : 'white',
                    color: selectedCoachId === coach.id ? '#1976d2' : '#333',
                    fontWeight: selectedCoachId === coach.id ? '600' : '400',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                    minWidth: isMobile ? '0' : '80px'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCoachId !== coach.id) {
                      e.currentTarget.style.background = '#f5f5f5'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCoachId !== coach.id) {
                      e.currentTarget.style.background = 'white'
                    }
                  }}
                >
                  {coach.name}
                </button>
              ))}
            </div>
            {selectedCoachId === 'all' && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#fff3e0',
                border: '1px solid #ffb74d',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#e65100'
              }}>
                ⚠️ 請先選擇您的教練身份才能進行回報
              </div>
            )}
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
              
              // 當選擇「全部教練」時，計算已回報的教練數量
              let reportedCoachesCount = 0
              let totalCoachesCount = booking.coaches.length
              if (selectedCoachId === 'all' && booking.participants) {
                const reportedCoachIds = new Set(booking.participants.map(p => p.coach_id))
                reportedCoachesCount = reportedCoachIds.size
              }
              
              const hasDriverReport = !!booking.coach_report
              
              const canReport = selectedCoachId !== 'all'
              
              return (
                <div
                  key={booking.id}
                  style={{
                    ...getCardStyle(isMobile),
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                    cursor: canReport ? 'pointer' : 'not-allowed',
                    opacity: canReport ? 1 : 0.6,
                    transition: 'all 0.2s'
                  }}
                  onClick={() => canReport && startReport(booking)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', marginBottom: '4px' }}>
                        {booking.start_at.substring(11, 16)} | {getDisplayContactName(booking)}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {booking.boats?.name} • {booking.duration_min}分
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {/* 選擇特定教練時，顯示該教練的回報狀態 */}
                      {selectedCoachId !== 'all' && (type === 'coach' || type === 'both') ? (
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
                      
                      {/* 選擇「全部教練」時，顯示已回報教練數量 */}
                      {selectedCoachId === 'all' && totalCoachesCount > 0 ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: reportedCoachesCount === totalCoachesCount ? '#e8f5e9' : reportedCoachesCount > 0 ? '#fff9c4' : '#fff3e0',
                          color: reportedCoachesCount === totalCoachesCount ? '#2e7d32' : reportedCoachesCount > 0 ? '#f57f17' : '#f57c00',
                          fontWeight: '600'
                        }}>
                          教練 {reportedCoachesCount}/{totalCoachesCount}
                        </span>
                      ) : null}
                      
                      {/* 駕駛回報狀態（全部教練或特定教練，但彈簧床等設施不需要） */}
                      {!isFacility(booking.boats?.name) && (
                        (selectedCoachId !== 'all' && (type === 'driver' || type === 'both')) || 
                        (selectedCoachId === 'all')
                      ) ? (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: hasDriverReport ? '#e8f5e9' : '#fff3e0',
                          color: hasDriverReport ? '#2e7d32' : '#f57c00',
                          fontWeight: '600'
                        }}>
                          駕駛 {hasDriverReport ? '✓' : '未回報'}
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
                {reportingBooking.start_at.substring(11, 16)} | {getDisplayContactName(reportingBooking)}
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
                
                {/* 提示訊息 */}
                <div style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                  border: '1px solid #90caf9',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1565c0',
                  lineHeight: '1.6'
                }}>
                  💡 <strong>提示：</strong>
                  {participants.length === 1 && !participants[0].participant_name ? (
                    <span>所有會員已被其他教練回報。若無其他客人，可直接提交確認；若有非會員客人，請新增客人資料。</span>
                  ) : (
                    <span>已自動帶入尚未被其他教練回報的會員。若有非會員客人，請點擊「+ 新增客人」。</span>
                  )}
                </div>
                
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
                      
                      {/* 會員/非會員標記 */}
                      <div style={{ marginBottom: '8px' }}>
                        {participant.member_id ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            👤 會員
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: '#f5f5f5',
                            color: '#666',
                            border: '1px dashed #ccc',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            非會員
                          </span>
                        )}
                      </div>
                      
                      <input
                        type="text"
                        value={participant.participant_name}
                        onChange={(e) => {
                          updateParticipant(index, 'participant_name', e.target.value)
                          setMemberSearchTerm(e.target.value)
                          handleSearchChange(e.target.value)
                        }}
                        onClick={(e) => e.stopPropagation()}
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
                              <div>
                                <span style={{ fontWeight: '500' }}>{member.nickname || member.name}</span>
                                {member.nickname && <span style={{ color: '#999', marginLeft: '6px' }}>({member.name})</span>}
                              </div>
                              {member.phone && <div style={{ color: '#999', fontSize: '12px', marginTop: '2px' }}>{member.phone}</div>}
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
                        onClick={(e) => e.stopPropagation()}
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

