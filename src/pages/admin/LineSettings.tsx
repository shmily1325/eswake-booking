import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalTimestamp, getLocalDateString } from '../../utils/date'
import { useToast } from '../../components/ui'
import { designSystem, getCardStyle } from '../../styles/designSystem'

interface MemberReminder {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  has_line: boolean
  line_user_id?: string
  message: string
  sent?: boolean
}

interface BookingWithMembers {
  id: number
  start_at: string
  duration_min: number
  boat_name: string
  boat_color: string
  coaches: string[]
  members: MemberReminder[]
}

interface BindingStats {
  total_active_members: number
  bound_members: number
  binding_rate: number
}

export function LineSettings() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingMember, setSendingMember] = useState<string | null>(null)
  
  const [enabled, setEnabled] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [reminderTime, setReminderTime] = useState('19:00')
  
  const [stats, setStats] = useState<BindingStats | null>(null)
  const [bookings, setBookings] = useState<BookingWithMembers[]>([])
  const [unboundMembers, setUnboundMembers] = useState<any[]>([])
  const [showUnbound, setShowUnbound] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedBooking, setExpandedBooking] = useState<number | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadSettings(), loadStats(), loadTomorrowBookings()])
    setLoading(false)
  }

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['line_reminder_enabled', 'line_channel_access_token', 'line_reminder_time'])

      if (data) {
        data.forEach(item => {
          if (item.setting_key === 'line_reminder_enabled') {
            setEnabled(item.setting_value === 'true')
          } else if (item.setting_key === 'line_channel_access_token') {
            setAccessToken(item.setting_value || '')
          } else if (item.setting_key === 'line_reminder_time') {
            setReminderTime(item.setting_value || '19:00')
          }
        })
      }
    } catch (error) {
      console.error('載入設置失敗:', error)
    }
  }

  const loadStats = async () => {
    try {
      const { data: allMembers } = await supabase
        .from('members')
        .select('id')
        .eq('status', 'active')
        .in('membership_type', ['general', 'dual'])

      const { data: boundMembers } = await supabase
        .from('line_bindings')
        .select('member_id')
        .eq('status', 'active')

      const total = allMembers?.length || 0
      const bound = boundMembers?.length || 0

      setStats({
        total_active_members: total,
        bound_members: bound,
        binding_rate: total > 0 ? Math.round((bound / total) * 100) : 0
      })

      const boundIds = boundMembers?.map(b => b.member_id) || []
      const { data: unbound } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .eq('status', 'active')
        .in('membership_type', ['general', 'dual'])
        .not('id', 'in', `(${boundIds.length > 0 ? boundIds.join(',') : 'null'})`)
        .order('name')

      setUnboundMembers(unbound || [])
    } catch (error) {
      console.error('載入統計失敗:', error)
    }
  }

  // 生成提醒訊息
  const generateMessage = (memberName: string, booking: any) => {
    const [date, time] = booking.start_at.split('T')
    const [, month, day] = date.split('-')
    const dateStr = `${month}/${day}`
    const timeStr = time.substring(0, 5)
    const coaches = booking.coaches?.join('、') || '未指定'
    
    return `🌊 明日預約提醒

${memberName} 您好！
📅 明天 ${dateStr} ${timeStr}
🚤 ${booking.boat_name}
👨‍🏫 教練：${coaches}
⏱️ 時長：${booking.duration_min}分鐘

請提前10分鐘到場 🏄`
  }

  const loadTomorrowBookings = async () => {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = getLocalDateString(tomorrow)

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          boats:boat_id(name, color)
        `)
        .gte('start_at', `${tomorrowStr}T00:00:00`)
        .lte('start_at', `${tomorrowStr}T23:59:59`)
        .or('is_coach_practice.is.null,is_coach_practice.eq.false')
        .order('start_at', { ascending: true })

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        return
      }

      const bookingIds = bookingsData.map(b => b.id)

      const { data: bookingMembers } = await supabase
        .from('booking_members')
        .select('booking_id, member_id, members:member_id(id, name, nickname, phone)')
        .in('booking_id', bookingIds)

      const { data: bookingCoaches } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(name)')
        .in('booking_id', bookingIds)

      const memberIds = bookingMembers?.map(bm => (bm.members as any)?.id).filter(Boolean) || []
      const { data: lineBindings } = await supabase
        .from('line_bindings')
        .select('member_id, line_user_id')
        .eq('status', 'active')
        .in('member_id', memberIds)

      const formattedBookings: BookingWithMembers[] = bookingsData.map(booking => {
        const coaches = bookingCoaches
          ?.filter(bc => bc.booking_id === booking.id)
          .map(bc => (bc.coaches as any)?.name)
          .filter(Boolean) || []

        const bookingInfo = {
          start_at: booking.start_at,
          duration_min: booking.duration_min,
          boat_name: (booking.boats as any)?.name || '未指定',
          coaches
        }

        const members = bookingMembers
          ?.filter(bm => bm.booking_id === booking.id)
          .map(bm => {
            const member = bm.members as any
            const binding = lineBindings?.find(lb => lb.member_id === member?.id)
            const memberName = member?.nickname || member?.name || '會員'
            return {
              id: member?.id,
              name: member?.name,
              nickname: member?.nickname,
              phone: member?.phone,
              has_line: !!binding,
              line_user_id: binding?.line_user_id,
              message: generateMessage(memberName, bookingInfo),
              sent: false
            }
          })
          .filter(m => m.id) || []

        return {
          id: booking.id,
          start_at: booking.start_at,
          duration_min: booking.duration_min,
          boat_name: (booking.boats as any)?.name || '未指定',
          boat_color: (booking.boats as any)?.color || '#666',
          coaches,
          members
        }
      })

      setBookings(formattedBookings)
    } catch (error) {
      console.error('載入預約失敗:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = [
        { setting_key: 'line_reminder_enabled', setting_value: enabled.toString() },
        { setting_key: 'line_channel_access_token', setting_value: accessToken },
        { setting_key: 'line_reminder_time', setting_value: reminderTime }
      ]

      for (const update of updates) {
        await supabase
          .from('system_settings')
          .update({ 
            setting_value: update.setting_value,
            updated_by: user.id,
            updated_at: getLocalTimestamp()
          })
          .eq('setting_key', update.setting_key)
      }

      toast.success('設置已儲存')
    } catch (error) {
      console.error('儲存失敗:', error)
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // 更新單一會員的訊息
  const updateMemberMessage = (bookingId: number, memberId: string, newMessage: string) => {
    setBookings(prev => prev.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          members: b.members.map(m => 
            m.id === memberId ? { ...m, message: newMessage } : m
          )
        }
      }
      return b
    }))
  }

  // 複製訊息
  const copyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message)
      toast.success('已複製到剪貼簿')
    } catch {
      toast.error('複製失敗')
    }
  }

  // 發送單一會員的提醒
  const sendToMember = async (bookingId: number, member: MemberReminder) => {
    if (!member.has_line || !member.line_user_id) {
      toast.error('此會員未綁定 LINE')
      return
    }

    setSendingMember(member.id)
    try {
      const response = await fetch('/api/line-send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: member.line_user_id,
          message: member.message
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(`✅ 已發送給 ${member.nickname || member.name}`)
        // 標記為已發送
        setBookings(prev => prev.map(b => {
          if (b.id === bookingId) {
            return {
              ...b,
              members: b.members.map(m => 
                m.id === member.id ? { ...m, sent: true } : m
              )
            }
          }
          return b
        }))
      } else {
        toast.error('發送失敗：' + (result.error || '未知錯誤'))
      }
    } catch (err: any) {
      console.error('發送失敗:', err)
      toast.error('發送失敗：' + err.message)
    } finally {
      setSendingMember(null)
    }
  }

  // 一鍵發送所有已綁定會員
  const sendAllBound = async () => {
    const boundMembers = bookings.flatMap(b => 
      b.members.filter(m => m.has_line && !m.sent).map(m => ({ bookingId: b.id, member: m }))
    )
    
    if (boundMembers.length === 0) {
      toast.info('沒有需要發送的會員')
      return
    }

    if (!confirm(`確定要發送提醒給 ${boundMembers.length} 位會員嗎？`)) {
      return
    }

    let sentCount = 0
    for (const { bookingId, member } of boundMembers) {
      try {
        const response = await fetch('/api/line-send-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId: member.line_user_id,
            message: member.message
          })
        })
        
        const result = await response.json()
        if (result.success) {
          sentCount++
          setBookings(prev => prev.map(b => {
            if (b.id === bookingId) {
              return {
                ...b,
                members: b.members.map(m => 
                  m.id === member.id ? { ...m, sent: true } : m
                )
              }
            }
            return b
          }))
        }
      } catch (err) {
        console.error('發送失敗:', err)
      }
    }

    toast.success(`✅ 已發送 ${sentCount}/${boundMembers.length} 則提醒`)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDisplay = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()} (${['日', '一', '二', '三', '四', '五', '六'][tomorrow.getDay()]})`

  const totalMembers = bookings.flatMap(b => b.members).length
  const membersWithLine = bookings.flatMap(b => b.members.filter(m => m.has_line)).length
  const membersWithoutLine = totalMembers - membersWithLine
  const sentCount = bookings.flatMap(b => b.members.filter(m => m.sent)).length

  const lineGreen = '#06C755'

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: designSystem.colors.background.main,
        padding: isMobile ? '12px' : '20px'
      }}>
        <PageHeader title="LINE 提醒中心" user={user} showBaoLink={true} />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '60vh',
          color: designSystem.colors.text.secondary,
          fontSize: '16px'
        }}>
          載入中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: designSystem.colors.background.main,
      padding: isMobile ? '12px' : '20px'
    }}>
      <PageHeader title="LINE 提醒中心" user={user} showBaoLink={true} />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 綁定統計卡片 */}
        <div style={{
          ...getCardStyle(isMobile),
          background: `linear-gradient(135deg, ${lineGreen} 0%, #00B14F 100%)`,
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>
              📊 LINE 綁定統計
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '700' }}>
                  {stats?.bound_members || 0}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>已綁定</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '700' }}>
                  {stats?.total_active_members || 0}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>總會員</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '28px' : '36px', fontWeight: '700' }}>
                  {stats?.binding_rate || 0}%
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>綁定率</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '6px',
              height: '8px',
              overflow: 'hidden',
              marginBottom: '12px'
            }}>
              <div style={{
                width: `${stats?.binding_rate || 0}%`,
                height: '100%',
                background: 'white',
                borderRadius: '6px',
                transition: 'width 0.3s'
              }} />
            </div>

            <button
              onClick={() => setShowUnbound(!showUnbound)}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {showUnbound ? '▲ 隱藏' : '▼ 查看'} 未綁定會員 ({(stats?.total_active_members || 0) - (stats?.bound_members || 0)} 人)
            </button>

            {showUnbound && unboundMembers.length > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '8px',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
                  gap: '6px' 
                }}>
                  {unboundMembers.map(m => (
                    <div key={m.id} style={{ 
                      fontSize: '13px', 
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '4px'
                    }}>
                      {m.nickname || m.name}
                      {m.phone && <span style={{ opacity: 0.7, marginLeft: '6px' }}>({m.phone})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 明日預約區塊 */}
        <div style={getCardStyle(isMobile)}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: designSystem.colors.text.primary }}>
              📅 明日預約 ({tomorrowDisplay})
            </h3>
            <button
              onClick={loadTomorrowBookings}
              style={{
                padding: '6px 12px',
                background: designSystem.colors.background.main,
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                color: designSystem.colors.text.secondary
              }}
            >
              🔄 重新載入
            </button>
          </div>

          {bookings.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: designSystem.colors.text.secondary
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌴</div>
              <div>明天沒有預約</div>
            </div>
          ) : (
            <>
              {/* 統計摘要 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <div style={{
                  background: designSystem.colors.background.main,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: designSystem.colors.text.primary }}>
                    {bookings.length}
                  </div>
                  <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>預約數</div>
                </div>
                <div style={{
                  background: designSystem.colors.background.main,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: designSystem.colors.text.primary }}>
                    {totalMembers}
                  </div>
                  <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>會員數</div>
                </div>
                <div style={{
                  background: designSystem.colors.success[50],
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: designSystem.colors.success[700] }}>
                    {membersWithLine}
                  </div>
                  <div style={{ fontSize: '12px', color: designSystem.colors.success[700] }}>✅ 可發送</div>
                </div>
                <div style={{
                  background: designSystem.colors.danger[50],
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: designSystem.colors.danger[700] }}>
                    {membersWithoutLine}
                  </div>
                  <div style={{ fontSize: '12px', color: designSystem.colors.danger[700] }}>❌ 未綁定</div>
                </div>
                <div style={{
                  background: designSystem.colors.info[50],
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: designSystem.colors.info[700] }}>
                    {sentCount}
                  </div>
                  <div style={{ fontSize: '12px', color: designSystem.colors.info[700] }}>📤 已發送</div>
                </div>
              </div>

              {/* 一鍵發送按鈕 */}
              {membersWithLine > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={sendAllBound}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: lineGreen,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(6, 199, 85, 0.3)'
                    }}
                  >
                    🚀 一鍵發送所有已綁定會員 ({membersWithLine - sentCount} 待發送)
                  </button>
                </div>
              )}

              {/* 預約列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.map(booking => (
                  <div
                    key={booking.id}
                    style={{
                      background: designSystem.colors.background.main,
                      borderRadius: '10px',
                      padding: '14px',
                      borderLeft: `4px solid ${booking.boat_color}`
                    }}
                  >
                    {/* 預約標題 */}
                    <div 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedBooking(expandedBooking === booking.id ? null : booking.id)}
                    >
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '15px',
                        color: designSystem.colors.text.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{
                          background: 'white',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          border: `1px solid ${designSystem.colors.border.main}`
                        }}>
                          {formatTime(booking.start_at)}
                        </span>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          background: booking.boat_color,
                          borderRadius: '2px'
                        }} />
                        {booking.boat_name}
                        <span style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>
                          ({booking.duration_min}分)
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '14px',
                        color: designSystem.colors.text.secondary,
                        transform: expandedBooking === booking.id ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: '0.2s'
                      }}>
                        ▼
                      </span>
                    </div>
                    
                    {booking.coaches.length > 0 && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: designSystem.colors.text.secondary, 
                        marginTop: '6px'
                      }}>
                        🎓 {booking.coaches.join('、')}
                      </div>
                    )}

                    {/* 會員標籤列表 */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {booking.members.map(member => (
                        <div
                          key={member.id}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            fontWeight: '500',
                            background: member.sent 
                              ? designSystem.colors.info[50]
                              : member.has_line 
                                ? designSystem.colors.success[50] 
                                : designSystem.colors.danger[50],
                            color: member.sent
                              ? designSystem.colors.info[700]
                              : member.has_line 
                                ? designSystem.colors.success[700] 
                                : designSystem.colors.danger[700],
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {member.sent ? '📤' : member.has_line ? '✅' : '❌'}
                          {member.nickname || member.name}
                        </div>
                      ))}
                    </div>

                    {/* 展開的會員詳細 */}
                    {expandedBooking === booking.id && (
                      <div style={{ marginTop: '16px', borderTop: `1px solid ${designSystem.colors.border.light}`, paddingTop: '16px' }}>
                        {booking.members.map(member => (
                          <div
                            key={member.id}
                            style={{
                              background: 'white',
                              borderRadius: '8px',
                              padding: '12px',
                              marginBottom: '10px',
                              border: `1px solid ${designSystem.colors.border.main}`
                            }}
                          >
                            {/* 會員名稱 */}
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '10px'
                            }}>
                              <div style={{ 
                                fontWeight: '600', 
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                {member.sent ? '📤' : member.has_line ? '✅' : '❌'}
                                {member.nickname || member.name}
                                {member.phone && (
                                  <span style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>
                                    ({member.phone})
                                  </span>
                                )}
                                {member.sent && (
                                  <span style={{ 
                                    fontSize: '11px', 
                                    background: designSystem.colors.info[50],
                                    color: designSystem.colors.info[700],
                                    padding: '2px 8px',
                                    borderRadius: '10px'
                                  }}>
                                    已發送
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 訊息預覽/編輯 */}
                            <textarea
                              value={member.message}
                              onChange={(e) => updateMemberMessage(booking.id, member.id, e.target.value)}
                              style={{
                                width: '100%',
                                minHeight: '120px',
                                padding: '10px',
                                border: `1px solid ${designSystem.colors.border.main}`,
                                borderRadius: '6px',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit'
                              }}
                            />

                            {/* 操作按鈕 */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              {member.has_line && !member.sent && (
                                <button
                                  onClick={() => sendToMember(booking.id, member)}
                                  disabled={sendingMember === member.id}
                                  style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: sendingMember === member.id ? designSystem.colors.border.main : lineGreen,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: sendingMember === member.id ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {sendingMember === member.id ? '發送中...' : '📤 發送 LINE'}
                                </button>
                              )}
                              <button
                                onClick={() => copyMessage(member.message)}
                                style={{
                                  flex: 1,
                                  padding: '10px',
                                  background: designSystem.colors.secondary[100],
                                  color: designSystem.colors.text.primary,
                                  border: `1px solid ${designSystem.colors.border.main}`,
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                📋 複製訊息
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 設定區塊 */}
        <div style={getCardStyle(isMobile)}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: designSystem.colors.text.primary,
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <span>⚙️ 進階設定</span>
            <span style={{ 
              fontSize: '14px',
              color: designSystem.colors.text.secondary,
              transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: '0.2s'
            }}>
              ▼
            </span>
          </button>

          {showSettings && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                padding: '16px',
                background: designSystem.colors.background.main,
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: designSystem.colors.text.primary }}>
                      啟用自動提醒
                    </div>
                    <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary, marginTop: '2px' }}>
                      每日自動發送明日預約提醒
                    </div>
                  </div>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '50px',
                    height: '28px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: enabled ? lineGreen : designSystem.colors.border.main,
                      borderRadius: '28px',
                      transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: '22px',
                        width: '22px',
                        left: enabled ? '25px' : '3px',
                        bottom: '3px',
                        background: 'white',
                        borderRadius: '50%',
                        transition: '0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </span>
                  </label>
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: designSystem.colors.background.main,
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: designSystem.colors.text.primary, marginBottom: '10px' }}>
                  ⏰ 提醒發送時間
                </div>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: `2px solid ${designSystem.colors.border.main}`,
                    borderRadius: '6px',
                    fontSize: '15px'
                  }}
                />
                <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary, marginTop: '6px' }}>
                  每天此時間發送隔日預約提醒
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: designSystem.colors.background.main,
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: designSystem.colors.text.primary, marginBottom: '10px' }}>
                  🔑 LINE Channel Access Token
                </div>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="貼上你的 Channel Access Token"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: `2px solid ${designSystem.colors.border.main}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <a 
                  href="https://developers.line.biz/console/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    color: lineGreen,
                    fontSize: '13px',
                    textDecoration: 'none'
                  }}
                >
                  ↗ 前往 LINE Developers Console
                </a>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: saving ? designSystem.colors.border.main : designSystem.gradients.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? '儲存中...' : '💾 儲存設定'}
              </button>
            </div>
          )}
        </div>

        {/* 使用說明 */}
        <div style={{
          ...getCardStyle(isMobile),
          background: designSystem.colors.warning[50],
          border: `1px solid ${designSystem.colors.warning[500]}`
        }}>
          <h4 style={{ 
            margin: '0 0 10px', 
            fontSize: '14px', 
            color: designSystem.colors.warning[700]
          }}>
            💡 會員如何綁定 LINE？
          </h4>
          <div style={{ fontSize: '13px', color: designSystem.colors.warning[700], lineHeight: '1.7' }}>
            1. 會員掃描官方帳號 QR Code 加入好友<br/>
            2. 在聊天室發送「<strong>綁定 手機號碼</strong>」（例：綁定 0912345678）<br/>
            3. 系統會自動比對會員資料完成綁定<br/>
            4. 綁定成功後，即可收到預約提醒通知
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
