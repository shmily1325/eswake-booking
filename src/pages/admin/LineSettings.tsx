import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp, getWeekdayText } from '../../utils/date'
import { useToast, ToastContainer } from '../../components/ui'
import { designSystem, getCardStyle } from '../../styles/designSystem'

interface Booking {
  id: number
  boat_id: number
  contact_name: string
  start_at: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  boats?: { id: number; name: string; color: string } | null
  coaches?: { id: string; name: string }[]
}

interface BindingStats {
  total: number
  bound: number
  rate: number
}

export function LineSettings() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  // 日期 - 參照 TomorrowReminder 的邏輯
  const getDefaultDate = () => {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 3) {
      return getLocalDateString(now)
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return getLocalDateString(tomorrow)
    }
  }
  
  const [selectedDate, setSelectedDate] = useState(getDefaultDate())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [sendingStudent, setSendingStudent] = useState<string | null>(null)
  const [sentStudents, setSentStudents] = useState<Set<string>>(new Set())
  
  // LINE 綁定資料
  const [bindingStats, setBindingStats] = useState<BindingStats | null>(null)
  const [boundMembersList, setBoundMembersList] = useState<any[]>([])
  const [unboundMembers, setUnboundMembers] = useState<any[]>([])
  const [showBindingList, setShowBindingList] = useState<'bound' | 'unbound' | null>(null)
  
  // 文字模板 - 參照 TomorrowReminder
  const [includeWeatherWarning, setIncludeWeatherWarning] = useState(() => {
    const saved = localStorage.getItem('includeWeatherWarning')
    return saved !== null ? JSON.parse(saved) : true
  })
  
  const [weatherWarning, setWeatherWarning] = useState(() => {
    return localStorage.getItem('weatherWarning') || `由於近期天氣變化較大，請務必在『啟程前』
透過官方訊息與我們確認最新天氣狀況
別忘了在出發前查收最新訊息哦！`
  })
  
  const [footerText, setFooterText] = useState(() => {
    return localStorage.getItem('footerText') || `再麻煩幫我們準時抵達哦！謝謝！
明天見哦😊
抵達時 再麻煩幫我按開門鍵提醒教練們幫你開啟停車場鐵閘門 
進來後再麻煩幫我停黃色停車格 
白色的不能停 煩請配合🙏`
  })
  
  const [showSettings, setShowSettings] = useState(false)

  // 進階設定
  const [enabled, setEnabled] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [reminderTime, setReminderTime] = useState('19:00')
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)
  
  useEffect(() => {
    localStorage.setItem('includeWeatherWarning', JSON.stringify(includeWeatherWarning))
  }, [includeWeatherWarning])
  
  useEffect(() => {
    localStorage.setItem('weatherWarning', weatherWarning)
  }, [weatherWarning])
  
  useEffect(() => {
    localStorage.setItem('footerText', footerText)
  }, [footerText])
  
  useEffect(() => {
    fetchData()
    loadLineBindings()
    loadSystemSettings()
  }, [selectedDate])
  
  const loadSystemSettings = async () => {
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

  const loadLineBindings = async () => {
    try {
      // 查詢所有 LINE 綁定
      const { data: bindings } = await supabase
        .from('line_bindings')
        .select('member_id, line_user_id, phone, members:member_id(id, name, nickname, phone)')
        .eq('status', 'active')
      
      // 建立會員綁定列表（包含 line_user_id）
      const boundList: any[] = []
      bindings?.forEach(b => {
        if (b.members) {
          const member = b.members as any
          // ✅ 將 line_user_id 一起存入 boundList
          boundList.push({ ...member, line_user_id: b.line_user_id })
        }
      })
      setBoundMembersList(boundList)
      
      // 統計
      const { data: allMembers } = await supabase
        .from('members')
        .select('id')
        .eq('status', 'active')
      
      const total = allMembers?.length || 0
      const bound = bindings?.length || 0
      setBindingStats({
        total,
        bound,
        rate: total > 0 ? Math.round((bound / total) * 100) : 0
      })
      
      // 未綁定會員
      const boundIds = bindings?.map(b => b.member_id).filter(Boolean) || []
      const { data: unbound } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .eq('status', 'active')
        .not('id', 'in', `(${boundIds.length > 0 ? boundIds.join(',') : 'null'})`)
        .order('name')
      setUnboundMembers(unbound || [])
    } catch (error) {
      console.error('載入綁定失敗:', error)
    }
  }
  
  // 參照 TomorrowReminder 的 fetchData
  const fetchData = async () => {
    setLoading(true)
    setSentStudents(new Set()) // 重置發送狀態
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`
      
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .or('is_coach_practice.is.null,is_coach_practice.eq.false')
        .order('start_at', { ascending: true })
      
      if (bookingsData && bookingsData.length > 0) {
        const bookingIds = bookingsData.map((b: any) => b.id)
        
        // 查詢教練資料
        const { data: bookingCoachesData } = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds)
        
        const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of bookingCoachesData || []) {
          const bookingId = item.booking_id
          const coach = (item as any).coaches
          if (coach) {
            if (!coachesByBooking[bookingId]) {
              coachesByBooking[bookingId] = []
            }
            coachesByBooking[bookingId].push(coach)
          }
        }
        
        // 查詢會員資料
        const { data: bookingMembersData } = await supabase
          .from('booking_members')
          .select('booking_id, members:member_id(id, name, nickname)')
          .in('booking_id', bookingIds)
        
        const membersByBooking: { [key: number]: any[] } = {}
        for (const item of bookingMembersData || []) {
          const bookingId = item.booking_id
          const member = (item as any).members
          if (member) {
            if (!membersByBooking[bookingId]) {
              membersByBooking[bookingId] = []
            }
            membersByBooking[bookingId].push(member)
          }
        }
        
        // 組合資料並更新 contact_name
        bookingsData.forEach((booking: any) => {
          booking.coaches = coachesByBooking[booking.id] || []
          
          const members = membersByBooking[booking.id] || []
          if (members.length > 0) {
            const originalNames = booking.contact_name.split(',').map((n: string) => n.trim())
            
            if (members.length === originalNames.length) {
              booking.contact_name = members.map(m => m.nickname || m.name).join(', ')
            } else {
              const updatedNames: string[] = []
              const processedMemberIds = new Set<string>()
              
              originalNames.forEach((name: string) => {
                const matchedMember = members.find(m => {
                  if (name === m.name || name === m.nickname) return true
                  const nameParts = name.split('/').map(p => p.trim())
                  if (nameParts.some(part => part === m.name || part === m.nickname)) return true
                  return false
                })
                
                if (matchedMember && !processedMemberIds.has(matchedMember.id)) {
                  updatedNames.push(matchedMember.nickname || matchedMember.name)
                  processedMemberIds.add(matchedMember.id)
                } else if (!matchedMember) {
                  updatedNames.push(name)
                }
              })
              
              members.forEach(m => {
                if (!processedMemberIds.has(m.id)) {
                  updatedNames.push(m.nickname || m.name)
                }
              })
              
              if (updatedNames.length > 0) {
                booking.contact_name = updatedNames.join(', ')
              }
            }
          }
        })
      }
      
      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 時間格式化 - 參照 TomorrowReminder
  const formatTimeNoColon = (dateString: string): string => {
    const datetime = dateString.substring(0, 16)
    const [, timeStr] = datetime.split('T')
    const [hours, minutes] = timeStr.split(':')
    return `${hours}${minutes}`
  }
  
  const getArrivalTimeNoColon = (dateString: string): string => {
    const datetime = dateString.substring(0, 16)
    const [, timeStr] = datetime.split('T')
    const [hour, minute] = timeStr.split(':').map(Number)
    const totalMinutes = hour * 60 + minute - 30
    const arrivalHour = Math.floor(totalMinutes / 60)
    const arrivalMinute = totalMinutes % 60
    return `${arrivalHour.toString().padStart(2, '0')}${arrivalMinute.toString().padStart(2, '0')}`
  }
  
  // 取得學員列表 - 參照 TomorrowReminder
  const getStudentList = (): string[] => {
    const students = new Set<string>()
    bookings.forEach(booking => {
      const names = booking.contact_name.split(',').map(n => n.trim())
      names.forEach(name => students.add(name))
    })
    return Array.from(students).sort()
  }
  
  // 生成訊息 - 參照 TomorrowReminder
  const generateMessageForStudent = (studentName: string): string => {
    const studentBookings = bookings
      .filter(b => {
        const names = b.contact_name.split(',').map(n => n.trim())
        return names.includes(studentName)
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
    
    let message = `${studentName}你好\n提醒你，明天有預約\n\n`
    
    let previousCoachNames = ''
    let boatCount = 0
    
    studentBookings.forEach((booking, index) => {
      const coachNames = booking.coaches && booking.coaches.length > 0
        ? booking.coaches.map(c => c.name).join('/')
        : '未指定'
      const startTime = formatTimeNoColon(booking.start_at)
      const boatName = booking.boats?.name || ''
      const isFacility = boatName.includes('彈簧床')
      
      if (!isFacility) {
        boatCount++
      }
      
      if (index === 0) {
        const arrivalTime = getArrivalTimeNoColon(booking.start_at)
        message += `${coachNames}教練\n`
        message += `${arrivalTime}抵達\n`
        if (isFacility) {
          message += `${startTime}彈簧床\n`
        } else {
          message += `${startTime}下水\n`
        }
        previousCoachNames = coachNames
      } else {
        if (!isFacility && boatCount >= 2) {
          const shipLabel = boatCount === 2 ? '第二船' : boatCount === 3 ? '第三船' : `第${boatCount}船`
          message += `\n${shipLabel}\n`
        }
        
        if (coachNames === previousCoachNames) {
          if (isFacility) {
            message += `${startTime}彈簧床\n`
          } else {
            message += `${startTime}下水\n`
          }
        } else {
          message += `${coachNames}教練\n`
          if (isFacility) {
            message += `${startTime}彈簧床\n`
          } else {
            message += `${startTime}下水\n`
          }
          previousCoachNames = coachNames
        }
      }
    })
    
    message += '\n'
    
    if (includeWeatherWarning) {
      message += weatherWarning + '\n\n'
    }
    
    message += footerText
    
    return message
  }
  
  // 檢查學員是否有 LINE 綁定
  const getStudentLineInfo = (studentName: string): { hasLine: boolean; lineUserId?: string } => {
    // ✅ 直接從 boundMembersList 中查找（現在包含 line_user_id）
    const boundMember = boundMembersList.find(m => 
      m.name === studentName || m.nickname === studentName
    )
    if (boundMember && boundMember.line_user_id) {
      return { hasLine: true, lineUserId: boundMember.line_user_id }
    }
    return { hasLine: false }
  }
  
  // 複製訊息
  const handleCopy = (message: string) => {
    navigator.clipboard.writeText(message).then(() => {
      toast.success('已複製到剪貼簿')
    })
  }
  
  // 發送 LINE 訊息
  const handleSendLine = async (studentName: string, message: string) => {
    const lineInfo = getStudentLineInfo(studentName)
    console.log('📤 發送 LINE:', { studentName, lineInfo, messageLength: message.length })
    
    if (!lineInfo.hasLine || !lineInfo.lineUserId) {
      toast.error('此會員未綁定 LINE')
      return
    }
    
    setSendingStudent(studentName)
    try {
      const requestBody = {
        lineUserId: lineInfo.lineUserId,
        message
      }
      console.log('📤 Request body:', requestBody)
      
      const response = await fetch('/api/line-send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      const result = await response.json()
      console.log('📤 Response:', result)
      if (result.success) {
        toast.success(`✅ 已發送給 ${studentName}`)
        setSentStudents(prev => new Set(prev).add(studentName))
      } else {
        console.error('❌ 發送失敗:', result)
        toast.error('發送失敗：' + (result.error || '未知錯誤'))
      }
    } catch (err: any) {
      console.error('發送失敗:', err)
      toast.error('發送失敗：' + err.message)
    } finally {
      setSendingStudent(null)
    }
  }

  const handleSaveSettings = async () => {
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
  
  const lineGreen = '#06C755'
  const students = getStudentList()

  return (
    <div style={{
      minHeight: '100vh',
      background: designSystem.colors.background.main,
      padding: isMobile ? '12px' : '20px'
    }}>
      <PageHeader title="LINE 提醒中心" user={user} showBaoLink={true} />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 綁定統計 - 簡化版 */}
        <div style={getCardStyle(isMobile)}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '15px', color: designSystem.colors.text.primary }}>
                📊 LINE 綁定率
              </span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: lineGreen }}>
                {bindingStats?.bound || 0} / {bindingStats?.total || 0}
              </span>
              <span style={{ fontSize: '14px', color: designSystem.colors.text.secondary }}>
                ({bindingStats?.rate || 0}%)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowBindingList(showBindingList === 'bound' ? null : 'bound')}
                style={{
                  padding: '6px 12px',
                  background: showBindingList === 'bound' ? designSystem.colors.success[50] : designSystem.colors.background.main,
                  border: `1px solid ${showBindingList === 'bound' ? designSystem.colors.success[500] : designSystem.colors.border.main}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: showBindingList === 'bound' ? designSystem.colors.success[700] : designSystem.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                ✅ 已綁定 ({bindingStats?.bound || 0})
              </button>
              <button
                onClick={() => setShowBindingList(showBindingList === 'unbound' ? null : 'unbound')}
                style={{
                  padding: '6px 12px',
                  background: showBindingList === 'unbound' ? designSystem.colors.danger[50] : designSystem.colors.background.main,
                  border: `1px solid ${showBindingList === 'unbound' ? designSystem.colors.danger[500] : designSystem.colors.border.main}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: showBindingList === 'unbound' ? designSystem.colors.danger[700] : designSystem.colors.text.secondary,
                  cursor: 'pointer'
                }}
              >
                ❌ 未綁定 ({unboundMembers.length})
              </button>
            </div>
          </div>

          {showBindingList === 'bound' && boundMembersList.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: designSystem.colors.success[50],
              borderRadius: '8px',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {boundMembersList.map((m: any) => (
                  <span key={m.id} style={{ 
                    fontSize: '13px', 
                    padding: '4px 10px',
                    background: 'white',
                    borderRadius: '12px',
                    color: designSystem.colors.success[700]
                  }}>
                    ✅ {m.nickname || m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {showBindingList === 'unbound' && unboundMembers.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: designSystem.colors.danger[50],
              borderRadius: '8px',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {unboundMembers.map(m => (
                  <span key={m.id} style={{ 
                    fontSize: '13px', 
                    padding: '4px 10px',
                    background: 'white',
                    borderRadius: '12px',
                    color: designSystem.colors.danger[700]
                  }}>
                    {m.nickname || m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 日期選擇 */}
        <div style={getCardStyle(isMobile)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: designSystem.colors.text.primary }}>
              選擇日期
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <span style={{
              padding: '6px 12px',
              background: designSystem.colors.background.main,
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              color: designSystem.colors.text.secondary
            }}>
              {getWeekdayText(selectedDate)}
            </span>
            {loading && <span style={{ color: designSystem.colors.text.secondary }}>載入中...</span>}
          </div>
        </div>

        {/* 文字模板 */}
        <div style={getCardStyle(isMobile)}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: designSystem.colors.text.primary }}>
            編輯文字模板
          </h3>
          
          <div style={{ 
            marginBottom: '16px',
            padding: '12px',
            background: designSystem.colors.background.main,
            borderRadius: '6px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={includeWeatherWarning}
                onChange={(e) => setIncludeWeatherWarning(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              🌥️ 包含天氣警告
            </label>
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: designSystem.colors.text.secondary }}>
              天氣警告文字
            </label>
            <textarea
              value={weatherWarning}
              onChange={(e) => setWeatherWarning(e.target.value)}
              disabled={!includeWeatherWarning}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: '6px',
                fontSize: '16px', // 16px 防止 iOS 縮放
                resize: 'vertical',
                opacity: includeWeatherWarning ? 1 : 0.5
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: designSystem.colors.text.secondary }}>
              結尾提醒文字
            </label>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '10px',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* 學員訊息列表 */}
        {bookings.length === 0 && !loading ? (
          <div style={getCardStyle(isMobile)}>
            <div style={{ padding: '40px 20px', textAlign: 'center', color: designSystem.colors.text.secondary }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
              <div>選擇的日期沒有預約記錄</div>
            </div>
          </div>
        ) : (
          <div style={getCardStyle(isMobile)}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: designSystem.colors.text.primary }}>
              預約人提醒訊息 ({students.length} 位)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {students.map((studentName) => {
                const isExpanded = selectedStudent === studentName
                const lineInfo = getStudentLineInfo(studentName)
                const isSent = sentStudents.has(studentName)
                const isSending = sendingStudent === studentName
                
                const studentBookings = bookings.filter(b => {
                  const names = b.contact_name.split(',').map(n => n.trim())
                  return names.includes(studentName)
                })
                
                return (
                  <div
                    key={studentName}
                    style={{
                      border: `1px solid ${designSystem.colors.border.main}`,
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      onClick={() => setSelectedStudent(isExpanded ? null : studentName)}
                      style={{
                        padding: '14px 16px',
                        background: isExpanded ? designSystem.colors.background.main : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '600', color: designSystem.colors.text.primary }}>
                            {studentName}
                          </span>
                          {isSent ? (
                            <span style={{ fontSize: '12px', padding: '2px 8px', background: designSystem.colors.info[50], color: designSystem.colors.info[700], borderRadius: '10px' }}>
                              📤 已發送
                            </span>
                          ) : lineInfo.hasLine ? (
                            <span style={{ fontSize: '12px', padding: '2px 8px', background: designSystem.colors.success[50], color: designSystem.colors.success[700], borderRadius: '10px' }}>
                              ✅ 已綁定
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', padding: '2px 8px', background: designSystem.colors.danger[50], color: designSystem.colors.danger[700], borderRadius: '10px' }}>
                              ❌ 未綁定
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>
                          {studentBookings.length} 個預約
                        </div>
                      </div>
                      <span style={{
                        fontSize: '16px',
                        color: designSystem.colors.text.secondary,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: '0.2s'
                      }}>
                        ▼
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ padding: '16px', borderTop: `1px solid ${designSystem.colors.border.main}`, background: 'white' }}>
                        <div style={{
                          background: designSystem.colors.background.main,
                          padding: '12px',
                          borderRadius: '6px',
                          whiteSpace: 'pre-wrap',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          marginBottom: '12px',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {generateMessageForStudent(studentName)}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {lineInfo.hasLine && !isSent && (
                            <button
                              onClick={() => handleSendLine(studentName, generateMessageForStudent(studentName))}
                              disabled={isSending}
                              style={{
                                flex: 1,
                                padding: '12px',
                                background: isSending ? designSystem.colors.border.main : lineGreen,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: isSending ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isSending ? '發送中...' : '📤 發送 LINE'}
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(generateMessageForStudent(studentName))}
                            style={{
                              flex: 1,
                              padding: '12px',
                              background: designSystem.colors.primary[500],
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            📋 複製訊息
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 進階設定 */}
        <div style={getCardStyle(isMobile)}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '100%',
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: designSystem.colors.text.primary,
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>⚙️ LINE API 設定</span>
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
            <div style={{ marginTop: '16px' }}>
              <div style={{ padding: '12px', background: designSystem.colors.background.main, borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>啟用自動提醒</div>
                    <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary }}>每日自動發送</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: enabled ? lineGreen : designSystem.colors.border.main,
                      borderRadius: '28px', transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute', height: '22px', width: '22px',
                        left: enabled ? '25px' : '3px', bottom: '3px',
                        background: 'white', borderRadius: '50%', transition: '0.3s'
                      }} />
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ padding: '12px', background: designSystem.colors.background.main, borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>⏰ 提醒時間</div>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  style={{ padding: '8px 12px', border: `1px solid ${designSystem.colors.border.main}`, borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ padding: '12px', background: designSystem.colors.background.main, borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>🔑 Access Token</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="LINE Channel Access Token"
                    style={{ width: '100%', padding: '10px', paddingRight: '70px', border: `1px solid ${designSystem.colors.border.main}`, borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '13px',
                      color: designSystem.colors.primary[500],
                      cursor: 'pointer',
                      padding: '4px 8px'
                    }}
                  >
                    {showToken ? '隱藏' : '顯示'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: saving ? designSystem.colors.border.main : designSystem.gradients.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? '儲存中...' : '💾 儲存設定'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
