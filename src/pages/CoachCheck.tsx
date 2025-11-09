import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
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
  // 教练选择
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  
  // 预约列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  
  // 回报对话框
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  
  // 驾驶回报
  const [fuelAmount, setFuelAmount] = useState('')
  const [drivingDuration, setDrivingDuration] = useState('')
  
  // 参与者回报
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
      // 查詢该教练的所有预约
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

      // 查詢预约详情
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

      // 查詢教练信息
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds)

      // 查詢该教练是否已回报
      const { data: reportsData } = await supabase
        .from('coach_reports')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)
        .in('booking_id', bookingIds)

      const reportedBookingIds = new Set(reportsData?.map(r => r.booking_id) || [])

      // 组装数据
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        const bookingCoaches = coachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coaches)
          .filter(Boolean) || []
        
        return {
          ...booking,
          coaches: bookingCoaches,
          has_coach_report: reportedBookingIds.has(booking.id)
        }
      })

      setBookings(bookingsWithCoaches)
    } catch (err) {
      console.error('加载预约失败:', err)
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

    // 验证
    if (!fuelAmount || !drivingDuration) {
      setError('请填写油量和驾驶时数')
      return
    }

    const hasInvalidParticipant = participants.some(p => 
      !p.participant_name || !p.duration_min || !p.payment_method
    )
    if (hasInvalidParticipant) {
      setError('请完整填写所有参与者信息')
      return
    }

    setSaving(true)
    setError('')

    try {
      // 1. 插入教练驾驶回报
      const { error: reportError } = await supabase
        .from('coach_reports')
        .insert({
          booking_id: selectedBooking.id,
          coach_id: selectedCoachId,
          fuel_amount: parseFloat(fuelAmount),
          driving_duration_min: parseInt(drivingDuration)
        })

      if (reportError) throw reportError

      // 2. 插入参与者记录
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

      setSuccess('✅ 回报成功！')
      setTimeout(() => {
        closeReportDialog()
        loadBookings() // 重新加载列表
      }, 1500)
    } catch (err: any) {
      setError(err.message || '回报失败')
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader user={user} title="教练回报" />
      
      <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📋 教练回报</h1>

        {/* 教练选择 */}
        <div style={{ marginBottom: '20px', background: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>
            选择教练
          </label>
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: 'white'
            }}
          >
            <option value="">-- 请选择教练 --</option>
            {coaches.map(coach => (
              <option key={coach.id} value={coach.id}>{coach.name}</option>
            ))}
          </select>
        </div>

        {/* 预约列表 */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>加载中...</div>}
        
        {!loading && selectedCoachId && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无预约记录
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookings.map(booking => (
              <div
                key={booking.id}
                style={{
                  background: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${booking.boats?.color || '#999'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                      {booking.contact_name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      🚤 {booking.boats?.name || '未知'} | ⏱️ {booking.duration_min}分钟
                    </div>
                    <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
                      📅 {formatDateTime(booking.start_at)}
                    </div>
                    {booking.coaches.length > 1 && (
                      <div style={{ fontSize: '13px', color: '#ff9800', marginTop: '4px' }}>
                        👥 多教练: {booking.coaches.map(c => c.name).join('、')}
                      </div>
                    )}
                  </div>
                  
                  {booking.has_coach_report ? (
                    <div style={{
                      padding: '6px 12px',
                      background: '#4caf50',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      ✓ 已回报
                    </div>
                  ) : (
                    <button
                      onClick={() => openReportDialog(booking)}
                      style={{
                        padding: '8px 16px',
                        background: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      回报
                    </button>
                  )}
                </div>
                
                {booking.notes && (
                  <div style={{ fontSize: '13px', color: '#666', padding: '8px', background: '#f9f9f9', borderRadius: '6px', marginTop: '8px' }}>
                    📝 {booking.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* 回报对话框 */}
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
          padding: '20px 0'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            margin: '0 16px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
          }}>
            {/* 标题 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #eee',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                📝 教练回报
              </h2>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                {selectedBooking.contact_name} | {selectedBooking.boats?.name}
              </div>
            </div>

            {/* 内容 */}
            <div style={{ padding: '20px' }}>
              {error && (
                <div style={{
                  padding: '12px',
                  background: '#ffebee',
                  color: '#c62828',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  padding: '12px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  {success}
                </div>
              )}

              {/* 驾驶回报部分 */}
              <div style={{ marginBottom: '24px', padding: '16px', background: '#e3f2fd', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1976d2' }}>
                  🚤 驾驶回报
                </h3>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                    油量（公升）<span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={fuelAmount}
                    onChange={(e) => setFuelAmount(e.target.value)}
                    placeholder="例如: 25.5"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                    驾驶时数（分钟）<span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={drivingDuration}
                    onChange={(e) => setDrivingDuration(e.target.value)}
                    placeholder="例如: 60"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* 参与者回报部分 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                    👥 参与者回报
                  </h3>
                  <button
                    onClick={addParticipant}
                    style={{
                      padding: '6px 12px',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    + 添加参与者
                  </button>
                </div>

                {participants.map((participant, index) => (
                  <div key={index} style={{
                    padding: '16px',
                    background: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '14px', color: '#333' }}>参与者 {index + 1}</strong>
                      {participants.length > 1 && (
                        <button
                          onClick={() => removeParticipant(index)}
                          style={{
                            padding: '4px 8px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          删除
                        </button>
                      )}
                    </div>

                    {/* 会员搜索 */}
                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                        姓名<span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={memberSearchTerms[index] || participant.participant_name}
                        onChange={(e) => {
                          const updatedSearchTerms = [...memberSearchTerms]
                          updatedSearchTerms[index] = e.target.value
                          setMemberSearchTerms(updatedSearchTerms)
                          
                          // 如果用户手动输入，清空 member_id 并更新姓名
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
                        placeholder="搜索会员或手动输入..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '15px',
                          borderRadius: '6px',
                          border: participant.member_id ? '2px solid #4caf50' : '1px solid #ddd',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* 会员下拉 */}
                      {showMemberDropdowns[index] && getFilteredMembers(memberSearchTerms[index]).length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: '150px',
                          overflowY: 'auto',
                          background: 'white',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          marginTop: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 100
                        }}>
                          {getFilteredMembers(memberSearchTerms[index]).map(member => (
                            <div
                              key={member.id}
                              onClick={() => selectMember(index, member)}
                              style={{
                                padding: '10px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                fontSize: '14px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              <div style={{ fontWeight: 'bold' }}>
                                {member.name}
                                {member.nickname && <span style={{ color: '#666', fontWeight: 'normal' }}> ({member.nickname})</span>}
                              </div>
                              {member.phone && <div style={{ fontSize: '12px', color: '#999' }}>📱 {member.phone}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 时数 */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                        时数（分钟）<span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={participant.duration_min}
                        onChange={(e) => updateParticipant(index, 'duration_min', parseInt(e.target.value) || 0)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '15px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* 收费方式 */}
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                        收费方式<span style={{ color: 'red' }}>*</span>
                      </label>
                      <select
                        value={participant.payment_method}
                        onChange={(e) => updateParticipant(index, 'payment_method', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '15px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="cash">现金</option>
                        <option value="transfer">汇款</option>
                        <option value="deduct">扣储值</option>
                        <option value="voucher">票券</option>
                        <option value="designated_paid">指定（需收费）</option>
                        <option value="designated_free">指定（不需收费）</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部按钮 */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: '12px',
              position: 'sticky',
              bottom: 0,
              background: 'white'
            }}>
              <button
                onClick={closeReportDialog}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: saving ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {saving ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


