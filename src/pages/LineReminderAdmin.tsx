import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { useToast, ToastContainer } from '../components/ui'
import { getLocalDateString } from '../utils/date'

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

export function LineReminderAdmin() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [bookings, setBookings] = useState<BookingWithMembers[]>([])
  const [stats, setStats] = useState<BindingStats | null>(null)
  const [unboundMembers, setUnboundMembers] = useState<any[]>([])
  const [showUnbound, setShowUnbound] = useState(false)
  const [lastSentResult, setLastSentResult] = useState<{ sent: number; time: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 取得明天日期
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = getLocalDateString(tomorrow)

      // 查詢明天的預約
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
        setLoading(false)
        await loadStats()
        return
      }

      const bookingIds = bookingsData.map(b => b.id)

      // 查詢預約會員
      const { data: bookingMembers } = await supabase
        .from('booking_members')
        .select('booking_id, member_id, members:member_id(id, name, nickname, phone)')
        .in('booking_id', bookingIds)

      // 查詢教練
      const { data: bookingCoaches } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(name)')
        .in('booking_id', bookingIds)

      // 查詢 LINE 綁定
      const memberIds = bookingMembers?.map(bm => (bm.members as any)?.id).filter(Boolean) || []
      const { data: lineBindings } = await supabase
        .from('line_bindings')
        .select('member_id, line_user_id')
        .eq('status', 'active')
        .in('member_id', memberIds)

      // 組合資料
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
      await loadStats()
    } catch (err) {
      console.error('載入失敗:', err)
      toast.error('載入失敗')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // 統計綁定狀況
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
    } catch (err) {
      console.error('載入統計失敗:', err)
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
      const response = await fetch('/api/line-reminder', {
        method: 'GET'
      })
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

  // 統計
  const totalMembers = bookings.flatMap(b => b.members).length
  const membersWithLine = bookings.flatMap(b => b.members.filter(m => m.has_line)).length
  const membersWithoutLine = totalMembers - membersWithLine

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: '#f5f5f5' }}>
      <PageHeader title="📢 LINE 提醒管理" user={user} />

      {/* 綁定統計卡片 */}
      {stats && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
            📊 LINE 綁定統計
          </h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.bound_members}</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>已綁定</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.total_active_members}</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>總會員</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.binding_rate}%</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>綁定率</div>
            </div>
          </div>
          <button
            onClick={() => setShowUnbound(!showUnbound)}
            style={{
              marginTop: '12px',
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {showUnbound ? '隱藏' : '查看'} 未綁定會員 ({stats.total_active_members - stats.bound_members})
          </button>

          {showUnbound && unboundMembers.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {unboundMembers.map(m => (
                <div key={m.id} style={{ fontSize: '13px', padding: '4px 0' }}>
                  {m.nickname || m.name} {m.phone && `(${m.phone})`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 明日預約區塊 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            📅 明日預約 ({tomorrowDisplay})
          </h2>
          <button
            onClick={loadData}
            style={{
              padding: '6px 12px',
              background: '#f5f5f5',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🔄 重新載入
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌴</div>
            <div>明天沒有預約</div>
          </div>
        ) : (
          <>
            {/* 統計摘要 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '16px',
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '8px',
              flexWrap: 'wrap'
            }}>
              <div>
                <span style={{ color: '#666' }}>預約數：</span>
                <strong>{bookings.length}</strong>
              </div>
              <div>
                <span style={{ color: '#666' }}>會員數：</span>
                <strong>{totalMembers}</strong>
              </div>
              <div>
                <span style={{ color: '#4caf50' }}>✅ 可發送：</span>
                <strong style={{ color: '#4caf50' }}>{membersWithLine}</strong>
              </div>
              <div>
                <span style={{ color: '#f44336' }}>❌ 未綁定：</span>
                <strong style={{ color: '#f44336' }}>{membersWithoutLine}</strong>
              </div>
            </div>

            {/* 預約列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map(booking => (
                <div
                  key={booking.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    borderLeft: `4px solid ${booking.boat_color}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>
                      {formatTime(booking.start_at)} - {booking.boat_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {booking.duration_min}分鐘
                    </div>
                  </div>
                  {booking.coaches.length > 0 && (
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                      🎓 教練：{booking.coaches.join('、')}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {booking.members.map(member => (
                      <div
                        key={member.id}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '13px',
                          background: member.has_line ? '#e8f5e9' : '#ffebee',
                          color: member.has_line ? '#2e7d32' : '#c62828',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
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
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              {lastSentResult && (
                <div style={{
                  marginBottom: '12px',
                  padding: '8px 16px',
                  background: '#e8f5e9',
                  borderRadius: '6px',
                  color: '#2e7d32',
                  fontSize: '13px'
                }}>
                  ✅ 上次發送：{lastSentResult.time}，已發送 {lastSentResult.sent} 則提醒
                </div>
              )}
              <button
                onClick={handleSendReminders}
                disabled={sending || membersWithLine === 0}
                style={{
                  padding: '14px 32px',
                  background: sending || membersWithLine === 0 ? '#ccc' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: sending || membersWithLine === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {sending ? '發送中...' : `🚀 發送明日提醒 (${membersWithLine} 人)`}
              </button>
              {membersWithoutLine > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#f44336' }}>
                  ⚠️ 有 {membersWithoutLine} 位會員未綁定 LINE，無法收到提醒
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

