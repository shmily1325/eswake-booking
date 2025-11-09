import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getCardStyle, getInputStyle, getLabelStyle, getTextStyle } from '../styles/designSystem'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
  drivers: string[]  // 指定的駕駛 ID 列表
  has_coach_report?: boolean
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface Participant {
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
}

interface CoachCheckProps {
  user: User
}

export function CoachCheck({ user }: CoachCheckProps) {
  const { isMobile } = useResponsive()
  
  // 教練選擇
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  
  // 預約列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  
  // 回報對話框
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  
  // 駕駛回報
  const [fuelAmount, setFuelAmount] = useState('')
  const [drivingDuration, setDrivingDuration] = useState('')
  
  // 參與者回報
  const [participants, setParticipants] = useState<Participant[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberSearchTerms, setMemberSearchTerms] = useState<string[]>([])
  const [showMemberDropdowns, setShowMemberDropdowns] = useState<boolean[]>([])
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCoaches()
    loadMembers()
  }, [])

  useEffect(() => {
    if (selectedCoachId) {
      loadBookings()
    } else {
      setBookings([])
    }
  }, [selectedCoachId])

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      setCoaches(data)
    }
  }

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname, phone')
      .eq('status', 'active')
      .order('name')

    if (data) {
      setMembers(data)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    try {
      // 查詢該教練的所有預約
      const { data: coachBookings } = await supabase
        .from('booking_coaches')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)

      if (!coachBookings || coachBookings.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      const bookingIds = coachBookings.map(cb => cb.booking_id)

      // 查詢預約詳情
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          contact_name,
          notes,
          boat_id,
          boats:boat_id(name, color)
        `)
        .in('id', bookingIds)
        .eq('status', 'confirmed')
        .order('start_at', { ascending: false })

      if (!bookingsData) {
        setBookings([])
        setLoading(false)
        return
      }

      // 查詢教練資訊
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds)

      // 查詢駕駛資訊
      const { data: driversData } = await supabase
        .from('booking_drivers')
        .select('booking_id, driver_id')
        .in('booking_id', bookingIds)

      // 查詢該教練是否已回報
      const { data: reportsData } = await supabase
        .from('coach_reports')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)
        .in('booking_id', bookingIds)

      const reportedBookingIds = new Set(reportsData?.map(r => r.booking_id) || [])

      // 組裝資料
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        const bookingCoaches = coachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coaches)
          .filter(Boolean) || []
        
        const bookingDrivers = driversData
          ?.filter((bd: any) => bd.booking_id === booking.id)
          .map((bd: any) => bd.driver_id) || []
        
        return {
          ...booking,
          coaches: bookingCoaches,
          drivers: bookingDrivers,
          has_coach_report: reportedBookingIds.has(booking.id)
        }
      })

      setBookings(bookingsWithCoaches)
    } catch (err) {
      console.error('載入預約失敗:', err)
    } finally {
      setLoading(false)
    }
  }

  const openReportDialog = (booking: Booking) => {
    setSelectedBooking(booking)
    setFuelAmount('')
    setDrivingDuration('')
    setParticipants([{
      member_id: null,
      participant_name: '',
      duration_min: 60,
      payment_method: 'cash'
    }])
    setMemberSearchTerms([''])
    setShowMemberDropdowns([false])
    setError('')
    setSuccess('')
    setReportDialogOpen(true)
  }

  const closeReportDialog = () => {
    setReportDialogOpen(false)
    setSelectedBooking(null)
  }

  const addParticipant = () => {
    setParticipants([...participants, {
      member_id: null,
      participant_name: '',
      duration_min: 60,
      payment_method: 'cash'
    }])
    setMemberSearchTerms([...memberSearchTerms, ''])
    setShowMemberDropdowns([...showMemberDropdowns, false])
  }

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
    setMemberSearchTerms(memberSearchTerms.filter((_, i) => i !== index))
    setShowMemberDropdowns(showMemberDropdowns.filter((_, i) => i !== index))
  }

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const selectMember = (index: number, member: Member) => {
    const updated = [...participants]
    updated[index] = {
      ...updated[index],
      member_id: member.id,
      participant_name: member.name
    }
    setParticipants(updated)
    
    const updatedSearchTerms = [...memberSearchTerms]
    updatedSearchTerms[index] = member.name
    setMemberSearchTerms(updatedSearchTerms)
    
    const updatedDropdowns = [...showMemberDropdowns]
    updatedDropdowns[index] = false
    setShowMemberDropdowns(updatedDropdowns)
  }

  const getFilteredMembers = (searchTerm: string) => {
    if (!searchTerm) return []
    const term = searchTerm.toLowerCase()
    return members.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.nickname?.toLowerCase().includes(term) ||
      m.phone?.includes(term)
    )
  }

  const handleSubmit = async () => {
    if (!selectedBooking || !selectedCoachId) return

    // 驗證
    if (!fuelAmount || !drivingDuration) {
      setError('請填寫油量和駕駛時數')
      return
    }

    const hasInvalidParticipant = participants.some(p => 
      !p.participant_name || !p.duration_min || !p.payment_method
    )
    if (hasInvalidParticipant) {
      setError('請完整填寫所有參與者資訊')
      return
    }

    setSaving(true)
    setError('')

    try {
      // 1. 插入教練駕駛回報
      const { error: reportError } = await supabase
        .from('coach_reports')
        .insert({
          booking_id: selectedBooking.id,
          coach_id: selectedCoachId,
          fuel_amount: parseFloat(fuelAmount),
          driving_duration_min: parseInt(drivingDuration)
        })

      if (reportError) throw reportError

      // 2. 插入參與者記錄
      const participantsToInsert = participants.map(p => ({
        booking_id: selectedBooking.id,
        coach_id: selectedCoachId,
        member_id: p.member_id,
        participant_name: p.participant_name,
        duration_min: p.duration_min,
        payment_method: p.payment_method
      }))

      const { error: participantsError } = await supabase
        .from('booking_participants')
        .insert(participantsToInsert)

      if (participantsError) throw participantsError

      setSuccess('✅ 回報成功！')
      setTimeout(() => {
        closeReportDialog()
        loadBookings() // 重新載入列表
      }, 1500)
    } catch (err: any) {
      setError(err.message || '回報失敗')
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (dateTimeStr: string) => {
    const [date, time] = dateTimeStr.substring(0, 16).split('T')
    const [, month, day] = date.split('-')
    return `${month}/${day} ${time}`
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <PageHeader user={user} title="教練回報" />
      
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ ...getTextStyle('h1', isMobile), marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl }}>📋 教練回報</h1>

        {/* 教練選擇 */}
        <div style={{ ...getCardStyle(isMobile) }}>
          <label style={{ ...getLabelStyle(isMobile) }}>
            選擇教練
          </label>
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(e.target.value)}
            style={{
              ...getInputStyle(isMobile),
              background: 'white'
            }}
          >
            <option value="">-- 請選擇教練 --</option>
            {coaches.map(coach => (
              <option key={coach.id} value={coach.id}>{coach.name}</option>
            ))}
          </select>
        </div>

        {/* 預約列表 */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>載入中...</div>}
        
        {!loading && selectedCoachId && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled }}>
            暫無預約記錄
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
            {bookings.map(booking => (
              <div
                key={booking.id}
                style={{
                  ...getCardStyle(isMobile),
                  marginBottom: 0,
                  borderLeft: `4px solid ${booking.boats?.color || designSystem.colors.text.disabled}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: designSystem.spacing.md }}>
                  <div>
                    <div style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: 'bold', marginBottom: designSystem.spacing.xs }}>
                      {booking.contact_name}
                    </div>
                    <div style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary }}>
                      🚤 {booking.boats?.name || '未知'} | ⏱️ {booking.duration_min}分鐘
                    </div>
                    <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.disabled, marginTop: designSystem.spacing.xs }}>
                      📅 {formatDateTime(booking.start_at)}
                    </div>
                    {booking.coaches.length > 1 && (
                      <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.warning, marginTop: designSystem.spacing.xs }}>
                        👥 多教練: {booking.coaches.map(c => c.name).join('、')}
                      </div>
                    )}
                  </div>
                  
                  {booking.has_coach_report ? (
                    <div style={{
                      ...getButtonStyle('success', 'small', isMobile),
                      cursor: 'default'
                    }}>
                      ✓ 已回報
                    </div>
                  ) : (
                    <button
                      onClick={() => openReportDialog(booking)}
                      style={{
                        ...getButtonStyle('primary', 'medium', isMobile)
                      }}
                    >
                      回報
                    </button>
                  )}
                </div>
                
                {booking.notes && (
                  <div style={{ 
                    ...getTextStyle('bodySmall', isMobile), 
                    color: designSystem.colors.text.secondary, 
                    padding: designSystem.spacing.sm, 
                    background: designSystem.colors.background.hover, 
                    borderRadius: designSystem.borderRadius.md, 
                    marginTop: designSystem.spacing.sm 
                  }}>
                    📝 {booking.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* 回報對話框 */}
      {reportDialogOpen && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          overflowY: 'auto',
          padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl
        }}>
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.lg,
            maxWidth: '500px',
            width: '100%',
            margin: isMobile ? `0 ${designSystem.spacing.md}` : '0 auto',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
          }}>
            {/* 標題 */}
            <div style={{
              padding: designSystem.spacing.xl,
              borderBottom: `1px solid ${designSystem.colors.border}`,
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1
            }}>
              <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0 }}>
                📝 教練回報
              </h2>
              <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginTop: designSystem.spacing.xs }}>
                {selectedBooking.contact_name} | {selectedBooking.boats?.name}
              </div>
            </div>

            {/* 內容 */}
            <div style={{ padding: designSystem.spacing.xl }}>
              {error && (
                <div style={{
                  padding: designSystem.spacing.md,
                  background: '#ffebee',
                  color: designSystem.colors.danger,
                  borderRadius: designSystem.borderRadius.md,
                  marginBottom: designSystem.spacing.lg,
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  padding: designSystem.spacing.md,
                  background: '#e8f5e9',
                  color: designSystem.colors.success,
                  borderRadius: designSystem.borderRadius.md,
                  marginBottom: designSystem.spacing.lg,
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  {success}
                </div>
              )}

              {/* 駕駛回報部分 - 只有沒指定駕駛或當前教練是指定駕駛時才顯示 */}
              {(() => {
                const hasDrivers = selectedBooking.drivers && selectedBooking.drivers.length > 0
                const needReportDriver = hasDrivers
                  ? selectedBooking.drivers.includes(selectedCoachId)  // 有指定駕駛：只有指定的人回報
                  : true  // 沒指定駕駛：所有教練都回報
                
                return needReportDriver ? (
                  <div style={{ marginBottom: designSystem.spacing.xl, padding: designSystem.spacing.lg, background: '#e3f2fd', borderRadius: designSystem.borderRadius.md }}>
                    <h3 style={{ ...getTextStyle('h3', isMobile), margin: `0 0 ${designSystem.spacing.lg} 0`, color: designSystem.colors.info }}>
                      🚤 駕駛回報
                    </h3>
                
                <div style={{ marginBottom: designSystem.spacing.md }}>
                  <label style={{ ...getLabelStyle(isMobile) }}>
                    油量（公升）<span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={fuelAmount}
                    onChange={(e) => setFuelAmount(e.target.value)}
                    placeholder="例如: 25.5"
                    style={{
                      ...getInputStyle(isMobile)
                    }}
                  />
                </div>

                <div>
                  <label style={{ ...getLabelStyle(isMobile) }}>
                    駕駛時數（分鐘）<span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={drivingDuration}
                    onChange={(e) => setDrivingDuration(e.target.value)}
                    placeholder="例如: 60"
                    style={{
                      ...getInputStyle(isMobile)
                    }}
                  />
                </div>
              </div>
                ) : null
              })()}

              {/* 參與者回報部分 */}
              <div style={{ marginBottom: designSystem.spacing.lg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: designSystem.spacing.md }}>
                  <h3 style={{ ...getTextStyle('h3', isMobile), margin: 0 }}>
                    👥 參與者回報
                  </h3>
                  <button
                    onClick={addParticipant}
                    style={{
                      ...getButtonStyle('success', 'small', isMobile)
                    }}
                  >
                    + 新增參與者
                  </button>
                </div>

                {participants.map((participant, index) => (
                  <div key={index} style={{
                    padding: designSystem.spacing.lg,
                    background: designSystem.colors.background.hover,
                    borderRadius: designSystem.borderRadius.md,
                    marginBottom: designSystem.spacing.md,
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: designSystem.spacing.md }}>
                      <strong style={{ ...getTextStyle('body', isMobile) }}>參與者 {index + 1}</strong>
                      {participants.length > 1 && (
                        <button
                          onClick={() => removeParticipant(index)}
                          style={{
                            ...getButtonStyle('danger', 'small', isMobile)
                          }}
                        >
                          刪除
                        </button>
                      )}
                    </div>

                    {/* 會員搜尋 */}
                    <div style={{ marginBottom: designSystem.spacing.md, position: 'relative' }}>
                      <label style={{ ...getLabelStyle(isMobile) }}>
                        姓名<span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={memberSearchTerms[index] || participant.participant_name}
                        onChange={(e) => {
                          const updatedSearchTerms = [...memberSearchTerms]
                          updatedSearchTerms[index] = e.target.value
                          setMemberSearchTerms(updatedSearchTerms)
                          
                          // 如果使用者手動輸入，清空 member_id 並更新姓名
                          updateParticipant(index, 'participant_name', e.target.value)
                          if (participant.member_id) {
                            updateParticipant(index, 'member_id', null)
                          }
                        }}
                        onFocus={() => {
                          const updatedDropdowns = [...showMemberDropdowns]
                          updatedDropdowns[index] = true
                          setShowMemberDropdowns(updatedDropdowns)
                        }}
                        placeholder="搜尋會員或手動輸入..."
                        style={{
                          ...getInputStyle(isMobile),
                          border: participant.member_id ? `2px solid ${designSystem.colors.success}` : `1px solid ${designSystem.colors.border}`
                        }}
                      />

                      {/* 會員下拉 */}
                      {showMemberDropdowns[index] && getFilteredMembers(memberSearchTerms[index]).length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: '150px',
                          overflowY: 'auto',
                          background: 'white',
                          border: `1px solid ${designSystem.colors.border}`,
                          borderRadius: designSystem.borderRadius.md,
                          marginTop: designSystem.spacing.xs,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 100
                        }}>
                          {getFilteredMembers(memberSearchTerms[index]).map(member => (
                            <div
                              key={member.id}
                              onClick={() => selectMember(index, member)}
                              style={{
                                padding: designSystem.spacing.sm,
                                cursor: 'pointer',
                                borderBottom: `1px solid ${designSystem.colors.background.hover}`,
                                fontSize: getTextStyle('bodySmall', isMobile).fontSize
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = designSystem.colors.background.hover}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              <div style={{ fontWeight: 'bold' }}>
                                {member.name}
                                {member.nickname && <span style={{ color: designSystem.colors.text.secondary, fontWeight: 'normal' }}> ({member.nickname})</span>}
                              </div>
                              {member.phone && <div style={{ fontSize: getTextStyle('caption', isMobile).fontSize, color: designSystem.colors.text.disabled }}>📱 {member.phone}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 時數 */}
                    <div style={{ marginBottom: designSystem.spacing.md }}>
                      <label style={{ ...getLabelStyle(isMobile) }}>
                        時數（分鐘）<span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={participant.duration_min}
                        onChange={(e) => updateParticipant(index, 'duration_min', parseInt(e.target.value) || 0)}
                        style={{
                          ...getInputStyle(isMobile)
                        }}
                      />
                    </div>

                    {/* 收費方式 */}
                    <div>
                      <label style={{ ...getLabelStyle(isMobile) }}>
                        收費方式<span style={{ color: 'red' }}>*</span>
                      </label>
                      <select
                        value={participant.payment_method}
                        onChange={(e) => updateParticipant(index, 'payment_method', e.target.value)}
                        style={{
                          ...getInputStyle(isMobile),
                          background: 'white'
                        }}
                      >
                        <option value="cash">現金</option>
                        <option value="transfer">匯款</option>
                        <option value="deduct">扣儲值</option>
                        <option value="voucher">票券</option>
                        <option value="designated_paid">指定（需收費）</option>
                        <option value="designated_free">指定（不需收費）</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部按鈕 */}
            <div style={{
              padding: `${designSystem.spacing.lg} ${designSystem.spacing.xl}`,
              borderTop: `1px solid ${designSystem.colors.border}`,
              display: 'flex',
              gap: designSystem.spacing.md,
              position: 'sticky',
              bottom: 0,
              background: 'white'
            }}>
              <button
                onClick={closeReportDialog}
                disabled={saving}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  flex: 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? '提交中...' : '確認提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
