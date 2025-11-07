import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  status: string
  boats: { name: string; color: string } | null
  coaches: { name: string }[]
  has_report: boolean
  participant_count: number
  reported_participants?: { participant_name: string; duration_min: number; is_designated: boolean }[]
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
}

interface Participant {
  id?: string
  member_id: string | null
  participant_name: string
  duration_min: number
  is_designated: boolean
  member?: Member
}

interface CoachCheckProps {
  user: User
}

export function CoachCheck({ user }: CoachCheckProps) {
  const { isMobile } = useResponsive()
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCoaches()
    loadMembers()
  }, [])

  useEffect(() => {
    if (selectedCoachId) {
      loadBookings()
    }
  }, [selectedCoachId])

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name')
      .order('name')
    
    if (data) {
      setCoaches(data)
    }
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, nickname, phone, balance, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_minutes')
      .eq('status', 'active')
      .order('name')

    if (!error && data) {
      setMembers(data)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    try {
      // 先找出這個教練的所有預約 ID
      const { data: coachBookings } = await supabase
        .from('booking_coaches')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)

      const bookingIds = (coachBookings || []).map(b => b.booking_id)
      
      if (bookingIds.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      // 查詢這些預約的詳細資料
      const bookingsResult = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          contact_name,
          notes,
          status,
          boat_id
        `)
        .in('id', bookingIds)
        .order('start_at', { ascending: true })

      if (bookingsResult.error) throw bookingsResult.error

      // 並行查詢船隻、教練和參與者資料
      const [boatResult, coachResult, participantResult] = await Promise.all([
        supabase
          .from('boats')
          .select('id, name, color')
          .in('id', (bookingsResult.data || []).filter(b => b.boat_id).map(b => b.boat_id)),
        
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingIds),
        
        supabase
          .from('booking_participants')
          .select('booking_id, participant_name, duration_min, is_designated')
          .in('booking_id', bookingIds)
      ])

      // 處理船隻資料
      const boatsById: Record<string, { name: string; color: string }> = {}
      boatResult.data?.forEach(boat => {
        boatsById[boat.id] = { name: boat.name, color: boat.color }
      })

      // 處理教練資料
      const coachesByBooking: Record<number, { name: string }[]> = {}
      coachResult.data?.forEach(item => {
        if (!coachesByBooking[item.booking_id]) {
          coachesByBooking[item.booking_id] = []
        }
          const coach = (item as any).coaches
          if (coach) {
          coachesByBooking[item.booking_id].push(coach)
        }
      })

      // 處理參與者資料
      const participantsByBooking: Record<number, { participant_name: string; duration_min: number; is_designated: boolean }[]> = {}
      participantResult.data?.forEach(p => {
        if (!participantsByBooking[p.booking_id]) {
          participantsByBooking[p.booking_id] = []
        }
        participantsByBooking[p.booking_id].push({
          participant_name: p.participant_name,
          duration_min: p.duration_min,
          is_designated: p.is_designated
        })
      })

      // 合併資料並過濾已結束的預約
        const now = new Date()
      const bookingsWithData = (bookingsResult.data || [])
        .map(booking => {
          // 計算預約結束時間
          const startTime = new Date(booking.start_at)
          const endTime = new Date(startTime.getTime() + booking.duration_min * 60000)
          
          return {
            ...booking,
            boats: booking.boat_id ? boatsById[booking.boat_id] || null : null,
            coaches: coachesByBooking[booking.id] || [],
            has_report: (participantsByBooking[booking.id]?.length || 0) > 0,
            participant_count: participantsByBooking[booking.id]?.length || 0,
            reported_participants: participantsByBooking[booking.id] || [],
            isFinished: endTime < now
          }
        })
        .filter(booking => booking.isFinished)

      setBookings(bookingsWithData as Booking[])
    } catch (error) {
      console.error('載入預約失敗:', error)
      alert('載入預約失敗')
    } finally {
      setLoading(false)
    }
  }

  const openReportDialog = async (booking: Booking) => {
    setSelectedBooking(booking)
    
    // Load existing participants
    const { data, error } = await supabase
      .from('booking_participants')
      .select('*')
      .eq('booking_id', booking.id)

    if (!error && data && data.length > 0) {
      setParticipants(data.map(p => ({
        id: p.id,
        member_id: p.member_id,
        participant_name: p.participant_name,
        duration_min: p.duration_min || 0,
        is_designated: p.is_designated || false
      })))
    } else {
      // 查詢預約人是否為會員
      const { data: memberData } = await supabase
        .from('members')
        .select('id, name, nickname, phone, balance, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_minutes')
        .eq('status', 'active')
        .or(`name.eq.${booking.contact_name},nickname.cs.{${booking.contact_name}}`)
        .limit(1)
      
      const matchedMember = memberData?.[0] as Member | undefined
      
      setParticipants([{
        member_id: matchedMember?.id || null,
        participant_name: booking.contact_name,
        duration_min: booking.duration_min,
        is_designated: false,
        member: matchedMember
      }])
    }
    
    setReportDialogOpen(true)
  }

  const addParticipant = (member: Member | null, name?: string) => {
    setParticipants([...participants, {
      member_id: member?.id || null,
      participant_name: member?.name || name || '',
      duration_min: selectedBooking?.duration_min || 60,
      is_designated: false,
      member: member || undefined
    }])
    setMemberSearchTerm('')
  }

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const handleSaveReport = async () => {
    if (!selectedBooking) return
    if (participants.length === 0) {
      alert('請至少添加一位參與者')
      return
    }

    setSaving(true)
    try {
      // Delete existing participants
      await supabase
        .from('booking_participants')
        .delete()
        .eq('booking_id', selectedBooking.id)

      // Insert new participants
      const { error } = await supabase
        .from('booking_participants')
        .insert(participants.map(p => ({
          booking_id: selectedBooking.id,
          member_id: p.member_id,
          participant_name: p.participant_name,
          duration_min: p.duration_min,
          is_designated: p.is_designated,
          boat_fee_duration_min: null,
          boat_fee_type: null,
          designated_fee_duration_min: p.is_designated ? p.duration_min : null,
          designated_fee_type: p.is_designated ? 'designated_lesson' : null,
          notes: null
        })))

      if (error) throw error
      setReportDialogOpen(false)
      setSelectedBooking(null)
      setParticipants([])
      loadBookings()
    } catch (error) {
      console.error('回報失敗:', error)
      alert('❌ 回報失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    m.nickname?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    m.phone?.includes(memberSearchTerm)
  ).slice(0, 10)

  const formatTime = (isoString: string) => {
    const time = isoString.substring(11, 16)
    return time
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}/${day}`
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: isMobile ? '12px' : '20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PageHeader title="✅ 教練回報" user={user} />

        {/* Date Selector */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
            fontSize: '14px',
            color: '#666',
              fontWeight: '500'
            }}>
            選擇教練
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                width: '100%',
              padding: isMobile ? '14px' : '12px',
              fontSize: isMobile ? '16px' : '15px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                boxSizing: 'border-box',
              backgroundColor: 'white',
              cursor: 'pointer'
              }}
            >
              <option value="">請選擇教練</option>
              {coaches.map(coach => (
              <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
          </div>

        {/* Statistics */}
        {bookings.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{
              background: 'white',
              padding: '15px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>總預約</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
                {bookings.length}
              </div>
            </div>
            <div style={{
              background: 'white',
              padding: '15px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>已回報</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>
                {bookings.filter(b => b.has_report).length}
              </div>
            </div>
            <div style={{
              background: 'white',
              padding: '15px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>未回報</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>
                {bookings.filter(b => !b.has_report).length}
              </div>
            </div>
          </div>
        )}

        {/* Bookings List */}
          <div style={{
            background: 'white',
          borderRadius: '12px',
            padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                載入中...
              </div>
            )}

            {!loading && bookings.length === 0 && selectedCoachId && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              😔 該教練暫無預約
              </div>
            )}
            
            {!loading && !selectedCoachId && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              請先選擇教練
              </div>
            )}

            {!loading && bookings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    style={{
                      padding: '16px',
                    background: booking.has_report ? '#f8f9fa' : 'white',
                      borderRadius: '8px',
                    border: `2px solid ${booking.has_report ? '#28a745' : '#e0e0e0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => openReportDialog(booking)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: isMobile ? '16px' : '18px',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        {formatDate(booking.start_at)} {formatTime(booking.start_at)} / {booking.duration_min}分 / {booking.contact_name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        🚤 {booking.boats?.name || '未指定'} 
                        {booking.coaches.length > 0 && ` / 👨‍🏫 ${booking.coaches.map(c => c.name).join(', ')}`}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 10px',
                      background: booking.has_report ? '#d4edda' : '#fff3cd',
                      color: booking.has_report ? '#155724' : '#856404',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      {booking.has_report ? `✅ 已回報 (${booking.participant_count}人)` : '⚠️ 未回報'}
                    </div>
                      </div>
                      
                      {/* 顯示回報資訊 */}
                      {booking.has_report && booking.reported_participants && booking.reported_participants.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid #dee2e6',
                          fontSize: isMobile ? '13px' : '14px',
                          color: '#495057'
                        }}>
                          {booking.reported_participants.map((p, idx) => (
                            <div key={idx} style={{ 
                              marginBottom: idx < booking.reported_participants!.length - 1 ? '4px' : '0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span>👤 {p.participant_name}</span>
                              <span style={{ color: '#666' }}>• {p.duration_min}分</span>
                              {p.is_designated && <span style={{ color: '#28a745', fontWeight: 'bold' }}>• ✅指定</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
              ))}
                        </div>
                      )}
                      </div>
                    </div>

      {/* Report Dialog */}
      {reportDialogOpen && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '0' : '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '12px 12px 0 0' : '12px',
            maxWidth: isMobile ? '100%' : '700px',
            width: '100%',
            maxHeight: isMobile ? '95vh' : '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            {/* Dialog Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  回報預約
                </h2>
                <button
                  onClick={() => {
                    setReportDialogOpen(false)
                    setSelectedBooking(null)
                    setParticipants([])
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>
                      <div style={{
                marginTop: '10px',
                        padding: '10px',
                background: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                {formatTime(selectedBooking.start_at)} / {selectedBooking.duration_min}分 / 
                {selectedBooking.boats?.name || '未指定'} / {selectedBooking.contact_name}
              </div>
            </div>

            {/* Participants List */}
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>參與者</h3>
              
              {participants.map((participant, index) => (
                <div
                  key={index}
                  style={{
                    padding: isMobile ? '12px' : '15px',
                    background: 'white',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    border: '2px solid #e0e0e0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }}
                >
                  {/* Header: Name + Delete */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '10px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <span>👤 {participant.participant_name}</span>
                        {participant.member_id ? (
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            background: '#e7f3ff',
                            color: '#007bff',
                            borderRadius: '4px',
                            fontWeight: 'normal'
                          }}>
                            會員
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            background: '#f8f9fa',
                            color: '#666',
                            borderRadius: '4px',
                            fontWeight: 'normal'
                          }}>
                            非會員
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeParticipant(index)}
                      style={{
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      刪除
                    </button>
                  </div>

                  {/* Duration Quick Select */}
                  <div style={{ marginBottom: '10px' }}>
                          <label style={{
                            display: 'block',
                      fontSize: '14px', 
                      fontWeight: '500', 
                      marginBottom: '6px' 
                    }}>
                      ⏱️ 時長（分鐘）
                    </label>
                    <div style={{ 
                      display: 'flex', 
                      gap: '6px', 
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}>
                      {[20, 30, 60, 90].map(min => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => updateParticipant(index, 'duration_min', min)}
                          style={{
                            padding: isMobile ? '10px 16px' : '8px 14px',
                            border: participant.duration_min === min ? '2px solid #007bff' : '1px solid #dee2e6',
                            background: participant.duration_min === min ? '#e7f3ff' : 'white',
                            borderRadius: '6px',
                            fontSize: isMobile ? '15px' : '14px',
                            fontWeight: participant.duration_min === min ? 'bold' : 'normal',
                            color: participant.duration_min === min ? '#007bff' : '#495057',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {min}
                        </button>
                      ))}
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#666',
                        margin: '0 4px'
                      }}>或</span>
                      <input
                        type="number"
                        value={participant.duration_min}
                        onChange={(e) => updateParticipant(index, 'duration_min', parseInt(e.target.value) || 0)}
                        style={{
                          width: isMobile ? '70px' : '60px',
                          padding: isMobile ? '10px 8px' : '8px 6px',
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          fontSize: isMobile ? '15px' : '14px',
                          textAlign: 'center'
                        }}
                      />
                    </div>
                  </div>

                  {/* Is Designated */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    background: participant.is_designated ? '#e8f5e9' : '#f8f9fa',
                    border: `2px solid ${participant.is_designated ? '#4caf50' : '#e0e0e0'}`,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={participant.is_designated}
                      onChange={(e) => updateParticipant(index, 'is_designated', e.target.checked)}
                      style={{ 
                        width: isMobile ? '18px' : '16px',
                        height: isMobile ? '18px' : '16px',
                        marginRight: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontSize: isMobile ? '15px' : '14px', fontWeight: '500' }}>
                      ✅ 指定課
                    </span>
                          </label>
                </div>
              ))}

              {/* Add Participant Buttons */}
              <div style={{ marginTop: '15px' }}>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                          <input
                            type="text"
                    value={memberSearchTerm}
                            onChange={(e) => {
                      setMemberSearchTerm(e.target.value)
                      setShowMemberDropdown(true)
                            }}
                    onFocus={() => setShowMemberDropdown(true)}
                    placeholder="搜尋會員姓名/暱稱..."
                            style={{
                              width: '100%',
                      padding: '10px',
                      border: '2px solid #667eea',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  
                  {showMemberDropdown && filteredMembers.length > 0 && memberSearchTerm && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      background: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      marginTop: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 1000
                    }}>
                      {filteredMembers.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => {
                            addParticipant(member)
                            setShowMemberDropdown(false)
                          }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{ fontWeight: 'bold' }}>
                            {member.name}
                            {member.nickname && <span style={{ color: '#666', fontWeight: 'normal' }}> ({member.nickname})</span>}
                      </div>
                          {member.phone && (
                            <div style={{ fontSize: '13px', color: '#999' }}>
                              📱 {member.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
                </div>

                <button
                  onClick={() => {
                    const name = prompt('輸入非會員姓名：')
                    if (name && name.trim()) {
                      addParticipant(null, name.trim())
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'white',
                    color: '#667eea',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  + 新增非會員
                </button>
              </div>
            </div>

            {/* Dialog Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              position: 'sticky',
              bottom: 0,
              background: 'white',
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setReportDialogOpen(false)
                  setSelectedBooking(null)
                  setParticipants([])
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '15px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveReport}
                disabled={saving || participants.length === 0}
                style={{
                  flex: 2,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: saving || participants.length === 0 ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  cursor: saving || participants.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold'
                }}
              >
                {saving ? '儲存中...' : '✅ 確認回報'}
              </button>
            </div>
          </div>
          </div>
        )}

      {/* Footer */}
      <Footer />
    </div>
  )
}
