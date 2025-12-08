import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalTimestamp, getLocalDateString } from '../../utils/date'
import { useToast } from '../../components/ui'

interface BookingWithMembers {
  id: number
  start_at: string
  duration_min: number
  boat_name: string
  boat_color: string
  coaches: string[]
  members: {
    id: string
    name: string
    nickname: string | null
    phone: string | null
    has_line: boolean
    line_user_id?: string
  }[]
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
  const [sending, setSending] = useState(false)
  
  const [enabled, setEnabled] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [reminderTime, setReminderTime] = useState('19:00')
  
  const [stats, setStats] = useState<BindingStats | null>(null)
  const [bookings, setBookings] = useState<BookingWithMembers[]>([])
  const [unboundMembers, setUnboundMembers] = useState<any[]>([])
  const [showUnbound, setShowUnbound] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [lastSentResult, setLastSentResult] = useState<{ sent: number; time: string } | null>(null)

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

      // 查詢未綁定會員
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
        const members = bookingMembers
          ?.filter(bm => bm.booking_id === booking.id)
          .map(bm => {
            const member = bm.members as any
            const binding = lineBindings?.find(lb => lb.member_id === member?.id)
            return {
              id: member?.id,
              name: member?.name,
              nickname: member?.nickname,
              phone: member?.phone,
              has_line: !!binding,
              line_user_id: binding?.line_user_id
            }
          })
          .filter(m => m.id) || []

        const coaches = bookingCoaches
          ?.filter(bc => bc.booking_id === booking.id)
          .map(bc => (bc.coaches as any)?.name)
          .filter(Boolean) || []

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

  const handleSendReminders = async () => {
    if (sending) return

    const membersWithLine = bookings.flatMap(b => b.members.filter(m => m.has_line))
    if (membersWithLine.length === 0) {
      toast.error('沒有可發送的會員（都未綁定 LINE）')
      return
    }

    if (!confirm(`確定要發送明日提醒給 ${membersWithLine.length} 位會員嗎？`)) {
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/line-reminder', { method: 'GET' })
      const result = await response.json()

      if (result.success) {
        toast.success(`✅ 已發送 ${result.sent} 則提醒`)
        setLastSentResult({
          sent: result.sent,
          time: new Date().toLocaleTimeString('zh-TW')
        })
      } else if (result.message) {
        toast.info(result.message)
      } else {
        toast.error('發送失敗：' + (result.error || '未知錯誤'))
      }
    } catch (err: any) {
      console.error('發送失敗:', err)
      toast.error('發送失敗：' + err.message)
    } finally {
      setSending(false)
    }
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

  // LINE Brand Color
  const lineGreen = '#06C755'
  const lineGreenDark = '#00B14F'

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
      }}>
        <PageHeader title="LINE 提醒中心" user={user} showBaoLink={true} />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '60vh',
          color: 'white',
          fontSize: '18px'
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid rgba(255,255,255,0.2)',
            borderTop: `3px solid ${lineGreen}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '12px'
          }} />
          載入中...
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      padding: isMobile ? '12px' : '20px'
    }}>
      <PageHeader title="LINE 提醒中心" user={user} showBaoLink={true} />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 頂部統計卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, #06C755 0%, #00B14F 100%)',
          borderRadius: '20px',
          padding: isMobile ? '20px' : '28px',
          marginBottom: '20px',
          boxShadow: '0 10px 40px rgba(6, 199, 85, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* 裝飾背景 */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '200px',
            height: '200px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30%',
            left: '10%',
            width: '150px',
            height: '150px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%'
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                💬
              </div>
              <div>
                <h2 style={{ margin: 0, color: 'white', fontSize: '22px', fontWeight: '700' }}>
                  LINE 綁定統計
                </h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                  會員 LINE 通知綁定狀態
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: isMobile ? '32px' : '40px', fontWeight: '800', color: 'white' }}>
                  {stats?.bound_members || 0}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
                  已綁定
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: isMobile ? '32px' : '40px', fontWeight: '800', color: 'white' }}>
                  {stats?.total_active_members || 0}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
                  總會員
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: isMobile ? '32px' : '40px', fontWeight: '800', color: 'white' }}>
                  {stats?.binding_rate || 0}%
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
                  綁定率
                </div>
              </div>
            </div>

            {/* 進度條 */}
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '10px',
              height: '12px',
              overflow: 'hidden',
              marginBottom: '16px'
            }}>
              <div style={{
                width: `${stats?.binding_rate || 0}%`,
                height: '100%',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '10px',
                transition: 'width 0.5s ease'
              }} />
            </div>

            {/* 未綁定會員按鈕 */}
            <button
              onClick={() => setShowUnbound(!showUnbound)}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {showUnbound ? '🔼 隱藏' : '🔽 查看'} 未綁定會員 
              <span style={{
                background: 'rgba(255,255,255,0.3)',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {(stats?.total_active_members || 0) - (stats?.bound_members || 0)} 人
              </span>
            </button>

            {showUnbound && unboundMembers.length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
                  gap: '8px' 
                }}>
                  {unboundMembers.map(m => (
                    <div key={m.id} style={{ 
                      fontSize: '13px', 
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white'
                    }}>
                      ❌ {m.nickname || m.name}
                      {m.phone && <span style={{ opacity: 0.7, marginLeft: '8px' }}>({m.phone})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 明日預約區塊 */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: isMobile ? '20px' : '28px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                📅
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                  明日預約
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                  {tomorrowDisplay}
                </p>
              </div>
            </div>
            <button
              onClick={loadTomorrowBookings}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 重新載入
            </button>
          </div>

          {bookings.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌴</div>
              <div style={{ fontSize: '18px' }}>明天沒有預約</div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>好好休息吧！</div>
            </div>
          ) : (
            <>
              {/* 統計摘要 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
                    {bookings.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>預約數</div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>
                    {totalMembers}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>會員數</div>
                </div>
                <div style={{
                  background: 'rgba(76, 175, 80, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid rgba(76, 175, 80, 0.3)'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#4caf50' }}>
                    {membersWithLine}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(76, 175, 80, 0.9)' }}>✅ 可發送</div>
                </div>
                <div style={{
                  background: 'rgba(244, 67, 54, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid rgba(244, 67, 54, 0.3)'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#f44336' }}>
                    {membersWithoutLine}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(244, 67, 54, 0.9)' }}>❌ 未綁定</div>
                </div>
              </div>

              {/* 預約列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.map(booking => (
                  <div
                    key={booking.id}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '14px',
                      padding: '16px',
                      borderLeft: `4px solid ${booking.boat_color}`,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px'
                    }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '16px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.15)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}>
                          {formatTime(booking.start_at)}
                        </span>
                        <span style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          background: booking.boat_color,
                          borderRadius: '3px'
                        }} />
                        {booking.boat_name}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'rgba(255,255,255,0.5)',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}>
                        {booking.duration_min} 分鐘
                      </div>
                    </div>
                    {booking.coaches.length > 0 && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'rgba(255,255,255,0.6)', 
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        🎓 {booking.coaches.join('、')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {booking.members.map(member => (
                        <div
                          key={member.id}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '500',
                            background: member.has_line 
                              ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0.2) 100%)'
                              : 'linear-gradient(135deg, rgba(244, 67, 54, 0.3) 0%, rgba(244, 67, 54, 0.2) 100%)',
                            border: member.has_line 
                              ? '1px solid rgba(76, 175, 80, 0.5)'
                              : '1px solid rgba(244, 67, 54, 0.5)',
                            color: member.has_line ? '#81c784' : '#e57373',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {member.has_line ? '✅' : '❌'}
                          {member.nickname || member.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 發送按鈕 */}
              <div style={{
                marginTop: '24px',
                padding: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                textAlign: 'center'
              }}>
                {lastSentResult && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px 20px',
                    background: 'rgba(76, 175, 80, 0.2)',
                    borderRadius: '10px',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                    color: '#81c784',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    ✅ 上次發送：{lastSentResult.time}，已發送 {lastSentResult.sent} 則提醒
                  </div>
                )}
                <button
                  onClick={handleSendReminders}
                  disabled={sending || membersWithLine === 0}
                  style={{
                    padding: '16px 40px',
                    background: sending || membersWithLine === 0 
                      ? 'rgba(255,255,255,0.1)' 
                      : `linear-gradient(135deg, ${lineGreen} 0%, ${lineGreenDark} 100%)`,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '17px',
                    fontWeight: '700',
                    cursor: sending || membersWithLine === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: sending || membersWithLine === 0 
                      ? 'none' 
                      : '0 8px 30px rgba(6, 199, 85, 0.4)',
                    transition: 'all 0.3s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  {sending ? (
                    <>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      發送中...
                    </>
                  ) : (
                    <>🚀 發送明日提醒 ({membersWithLine} 人)</>
                  )}
                </button>
                {membersWithoutLine > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '13px', 
                    color: '#e57373',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}>
                    ⚠️ 有 {membersWithoutLine} 位會員未綁定 LINE，無法收到提醒
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 設定區塊（可收合） */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '100%',
              padding: '20px 24px',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                ⚙️
              </span>
              <div>
                <div>進階設定</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>
                  Access Token、提醒時間等
                </div>
              </div>
            </div>
            <span style={{ 
              fontSize: '20px',
              transition: 'transform 0.3s',
              transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▼
            </span>
          </button>

          {showSettings && (
            <div style={{ padding: '0 24px 24px' }}>
              {/* 功能開關 */}
              <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: 'white', fontSize: '15px', fontWeight: '600' }}>
                      啟用自動提醒
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>
                      每日自動發送明日預約提醒
                    </div>
                  </div>
                  <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '56px',
                    height: '30px',
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
                      background: enabled ? lineGreen : 'rgba(255,255,255,0.2)',
                      borderRadius: '30px',
                      transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: '24px',
                        width: '24px',
                        left: enabled ? '28px' : '3px',
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

              {/* 提醒時間 */}
              <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ color: 'white', fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
                  ⏰ 提醒發送時間
                </div>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '16px'
                  }}
                />
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '8px' }}>
                  每天此時間發送隔日預約提醒
                </div>
              </div>

              {/* Access Token */}
              <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ color: 'white', fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
                  🔑 LINE Channel Access Token
                </div>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="貼上你的 Channel Access Token"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <a 
                  href="https://developers.line.biz/console/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '10px',
                    color: lineGreen,
                    fontSize: '14px',
                    textDecoration: 'none'
                  }}
                >
                  ↗ 前往 LINE Developers Console
                </a>
              </div>

              {/* 儲存按鈕 */}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: saving 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 8px 30px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s'
                }}
              >
                {saving ? '儲存中...' : '💾 儲存設定'}
              </button>
            </div>
          )}
        </div>

        {/* 使用說明 */}
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          marginBottom: '20px'
        }}>
          <h4 style={{ 
            margin: '0 0 12px', 
            fontSize: '15px', 
            color: '#ffc107',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💡 會員如何綁定 LINE？
          </h4>
          <div style={{ fontSize: '14px', color: 'rgba(255, 193, 7, 0.9)', lineHeight: '1.8' }}>
            1. 會員掃描官方帳號 QR Code 加入好友<br/>
            2. 在聊天室發送「<strong>綁定 手機號碼</strong>」（例：綁定 0912345678）<br/>
            3. 系統會自動比對會員資料完成綁定<br/>
            4. 綁定成功後，即可收到預約提醒通知
          </div>
        </div>
      </div>

      <Footer />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.4);
        }
        input::-webkit-calendar-picker-indicator {
          filter: invert(1);
        }
      `}</style>
    </div>
  )
}
