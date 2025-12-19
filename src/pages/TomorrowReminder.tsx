import { useState, useEffect } from 'react'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString, getWeekdayText } from '../utils/date'
import { Footer } from '../components/Footer'

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

export function TomorrowReminder() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  
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
  const [copiedStudent, setCopiedStudent] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  
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
  }, [selectedDate])
  
  const fetchData = async () => {
    setLoading(true)
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
        
        // ✅ 新增：查詢會員資料以獲取最新的暱稱
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
        
        // ✅ 組合教練和會員資料，並更新 contact_name 為最新暱稱
        bookingsData.forEach((booking: any) => {
          booking.coaches = coachesByBooking[booking.id] || []
          
          // ✅ 如果有會員資料，智能更新名稱：保留訪客，更新會員
          const members = membersByBooking[booking.id] || []
          if (members.length > 0) {
            const originalNames = booking.contact_name.split(',').map((n: string) => n.trim())
            
            // 策略：如果名字數量 = 會員數量，直接全部替換（純會員預約）
            if (members.length === originalNames.length) {
              booking.contact_name = members.map(m => m.nickname || m.name).join(', ')
            } else {
              // 混合預約：需要區分會員和訪客
              const updatedNames: string[] = []
              const processedMemberIds = new Set<string>()
              
              originalNames.forEach((name: string) => {
                // 嘗試匹配會員（完全匹配或部分匹配）
                const matchedMember = members.find(m => {
                  // 完全匹配
                  if (name === m.name || name === m.nickname) return true
                  // 部分匹配：處理 "Ingrid/Joanna" 這種複合名稱
                  const nameParts = name.split('/').map(p => p.trim())
                  if (nameParts.some(part => part === m.name || part === m.nickname)) return true
                  return false
                })
                
                if (matchedMember && !processedMemberIds.has(matchedMember.id)) {
                  // 找到會員：用最新暱稱
                  updatedNames.push(matchedMember.nickname || matchedMember.name)
                  processedMemberIds.add(matchedMember.id)
                } else if (!matchedMember) {
                  // 不是會員：保留訪客名字
                  updatedNames.push(name)
                }
              })
              
              // 確保所有會員都出現（防止遺漏）
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
          // 如果沒有會員資料，保持原始的 contact_name（純訪客）
        })
      }
      
      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatTimeNoColon = (dateString: string): string => {
    // 純字符串處理
    const datetime = dateString.substring(0, 16) // "2025-11-01T13:55"
    const [, timeStr] = datetime.split('T')
    const [hours, minutes] = timeStr.split(':')
    return `${hours}${minutes}`
  }
  
  const getArrivalTimeNoColon = (dateString: string): string => {
    // 純字符串處理，提前30分鐘
    const datetime = dateString.substring(0, 16)
    const [, timeStr] = datetime.split('T')
    const [hour, minute] = timeStr.split(':').map(Number)
    const totalMinutes = hour * 60 + minute - 30
    const arrivalHour = Math.floor(totalMinutes / 60)
    const arrivalMinute = totalMinutes % 60
    return `${arrivalHour.toString().padStart(2, '0')}${arrivalMinute.toString().padStart(2, '0')}`
  }
  
  // ✅ 改為以單一會員為主軸
  const getStudentList = (): string[] => {
    const students = new Set<string>()
    bookings.forEach(booking => {
      // 拆分會員名字（用逗號分隔）
      const names = booking.contact_name.split(',').map(n => n.trim())
      names.forEach(name => students.add(name))
    })
    return Array.from(students).sort()
  }
  
  const generateMessageForStudent = (studentName: string): string => {
    // ✅ 找出所有包含此會員的預約
    const studentBookings = bookings
      .filter(b => {
        const names = b.contact_name.split(',').map(n => n.trim())
        return names.includes(studentName)
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at)) // 按時間排序
    
    let message = `${studentName}你好\n提醒你，明天有預約\n\n`
    
    let previousCoachNames = ''
    let boatCount = 0  // 只計算真正的船（不含彈簧床）
    
    // ✅ 按順序處理每個預約
    studentBookings.forEach((booking, index) => {
      const hasCoach = booking.coaches && booking.coaches.length > 0
      const coachNames = hasCoach
        ? booking.coaches!.map(c => c.name).join('/')
        : ''
      const startTime = formatTimeNoColon(booking.start_at)
      const boatName = booking.boats?.name || ''
      const isFacility = boatName.includes('彈簧床')
      
      // 如果不是彈簧床，船次計數增加
      if (!isFacility) {
        boatCount++
      }
      
      if (index === 0) {
        // 第一個預約：教練 + 抵達時間 + 下水時間（或彈簧床）
        const arrivalTime = getArrivalTimeNoColon(booking.start_at)
        if (hasCoach) {
          message += `${coachNames}教練\n`
        }
        message += `${arrivalTime}抵達\n`
        if (isFacility) {
          message += `${startTime}彈簧床\n`
        } else {
          message += `${startTime}下水\n`
        }
        previousCoachNames = coachNames
      } else {
        // 第二個預約之後
        // 如果當前是船（不是彈簧床）且船次 >= 2，空一行並標註船次
        if (!isFacility && boatCount >= 2) {
          const shipLabel = boatCount === 2 ? '第二船' : boatCount === 3 ? '第三船' : `第${boatCount}船`
          message += `\n${shipLabel}\n`
        }
        
        // 檢查是否同一個教練（空字串也視為相同，避免重複顯示空內容）
        if (coachNames === previousCoachNames) {
          // 同一個教練：只顯示時間，不顯示教練名稱
          if (isFacility) {
            message += `${startTime}彈簧床\n`
          } else {
            message += `${startTime}下水\n`
          }
        } else {
          // 不同教練：顯示教練名稱 + 時間（如果有教練才顯示）
          if (hasCoach) {
            message += `${coachNames}教練\n`
          }
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
  
  const handleCopyForStudent = (studentName: string) => {
    const message = generateMessageForStudent(studentName)
    navigator.clipboard.writeText(message).then(() => {
      setCopiedStudent(studentName)
      setTimeout(() => setCopiedStudent(null), 2000)
    })
  }
  
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: isMobile ? '10px' : '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <PageHeader title="⏰ 明日提醒" user={user} />

        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: isMobile ? '15px' : '20px',
          marginBottom: isMobile ? '10px' : '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <label style={{
            display: 'block',
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '600',
            marginBottom: '8px',
            color: '#333'
          }}>
            選擇日期
          </label>
          {isMobile ? (
            // 手機版：和預約查詢一樣的樣式
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  touchAction: 'manipulation'
                }}
              />
              {/* 星期幾徽章 */}
              <span style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#5a5a5a',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {getWeekdayText(selectedDate)}
              </span>
              {loading && (
                <span style={{ color: '#666', fontSize: '13px', flexShrink: 0 }}>載入中...</span>
              )}
            </div>
          ) : (
            // 電腦版：簡潔樣式
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '10px 14px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              />
              {/* 星期幾徽章 */}
              <span style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#5a5a5a',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
              }}>
                {getWeekdayText(selectedDate)}
              </span>
              {loading && (
                <span style={{ 
                  color: '#666', 
                  fontSize: '14px' 
                }}>
                  載入中...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Text Templates */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: isMobile ? '15px' : '20px',
          marginBottom: isMobile ? '10px' : '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: isMobile ? '15px' : '16px',
            fontWeight: '600',
            color: '#34495e',
            marginBottom: isMobile ? '12px' : '15px'
          }}>
            編輯文字模板
          </h2>
          
          {/* 天氣警告開關 */}
          <div style={{ 
            marginBottom: isMobile ? '15px' : '18px',
            padding: isMobile ? '12px' : '14px',
            background: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '14px',
              fontWeight: '500',
              gap: '10px'
            }}>
              <input
                type="checkbox"
                checked={includeWeatherWarning}
                onChange={(e) => setIncludeWeatherWarning(e.target.checked)}
                style={{
                  width: isMobile ? '18px' : '16px',
                  height: isMobile ? '18px' : '16px',
                  cursor: 'pointer'
                }}
              />
              <span>🌥️ 包含天氣警告</span>
            </label>
          </div>
          
          {/* 天氣警告文字 */}
          <div style={{ marginBottom: isMobile ? '12px' : '15px' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#555'
            }}>
              天氣警告文字
            </label>
            <textarea
              value={weatherWarning}
              onChange={(e) => setWeatherWarning(e.target.value)}
              style={{
                width: '100%',
                minHeight: isMobile ? '100px' : '80px',
                padding: isMobile ? '12px' : '10px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: isMobile ? '15px' : '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                touchAction: 'manipulation',
                boxSizing: 'border-box',
                opacity: includeWeatherWarning ? 1 : 0.5
              }}
              disabled={!includeWeatherWarning}
            />
          </div>
          
          {/* 結尾提醒文字 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#555'
            }}>
              結尾提醒文字
            </label>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{
                width: '100%',
                minHeight: isMobile ? '180px' : '140px',
                padding: isMobile ? '12px' : '10px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: isMobile ? '15px' : '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                touchAction: 'manipulation',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{
            marginTop: isMobile ? '12px' : '15px',
            padding: isMobile ? '10px' : '12px',
            background: '#e8f5e9',
            borderRadius: '4px',
            fontSize: isMobile ? '12px' : '13px',
            color: '#2e7d32',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✓</span>
            <span>您的修改會自動保存，下次打開時繼續使用</span>
          </div>
        </div>

        {/* Student Messages List */}
        {bookings.length === 0 && !loading ? (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: isMobile ? '15px' : '20px',
            marginBottom: isMobile ? '10px' : '15px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              padding: isMobile ? '30px 15px' : '40px 20px',
              textAlign: 'center',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📅</div>
              <div style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '500' }}>
                選擇的日期沒有預約記錄
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: isMobile ? '15px' : '20px',
            marginBottom: isMobile ? '10px' : '15px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              color: '#34495e',
              marginBottom: isMobile ? '12px' : '15px'
            }}>
              預約人提醒訊息 ({getStudentList().length} 位)
            </h2>
            
            <div style={{
              display: 'grid',
              gap: isMobile ? '10px' : '12px'
            }}>
              {getStudentList().map((studentName) => {
                const isExpanded = selectedStudent === studentName
                const isCopied = copiedStudent === studentName
                // ✅ 修改：查找包含此會員的所有預約
                const studentBookings = bookings.filter(b => {
                  const names = b.contact_name.split(',').map(n => n.trim())
                  return names.includes(studentName)
                })
                
                const uniqueBookingKeys = new Set<string>()
                studentBookings.forEach(b => {
                  const key = `${b.boat_id}-${b.start_at}-${b.duration_min}`
                  uniqueBookingKeys.add(key)
                })
                const uniqueBookingCount = uniqueBookingKeys.size
                
                return (
                  <div
                    key={studentName}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div
                      onClick={() => setSelectedStudent(isExpanded ? null : studentName)}
                      style={{
                        padding: isMobile ? '14px' : '16px',
                        background: isExpanded ? '#f8f9fa' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: isMobile ? '15px' : '16px',
                          fontWeight: '600',
                          color: '#333',
                          marginBottom: '4px'
                        }}>
                          {studentName}
                        </div>
                        <div style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#666'
                        }}>
                          {uniqueBookingCount} 個預約
                        </div>
                      </div>
                      
                      <div style={{
                        fontSize: isMobile ? '20px' : '18px',
                        color: '#999',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}>
                        ▼
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{
                        padding: isMobile ? '14px' : '16px',
                        borderTop: '1px solid #e0e0e0',
                        background: 'white'
                      }}>
                        {/* Preview Message */}
                        <div style={{
                          background: '#f8f9fa',
                          padding: isMobile ? '12px' : '14px',
                          borderRadius: '6px',
                          border: '1px solid #dee2e6',
                          whiteSpace: 'pre-wrap',
                          fontSize: isMobile ? '13px' : '14px',
                          lineHeight: '1.6',
                          color: '#333',
                          fontFamily: 'inherit',
                          marginBottom: isMobile ? '12px' : '14px',
                          maxHeight: isMobile ? '300px' : '400px',
                          overflowY: 'auto',
                          WebkitOverflowScrolling: 'touch'
                        }}>
                          {generateMessageForStudent(studentName)}
                        </div>
                        
                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyForStudent(studentName)}
                          style={{
                            width: '100%',
                            padding: isMobile ? '12px' : '10px',
                            background: isCopied ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: isMobile ? '15px' : '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            touchAction: 'manipulation',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>{isCopied ? '✓' : '📋'}</span>
                          <span>{isCopied ? '已複製' : '複製訊息'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Booking List */}
        {bookings.length > 0 && (() => {
          return (
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: isMobile ? '15px' : '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h2 style={{
                fontSize: isMobile ? '15px' : '16px',
                fontWeight: '600',
                color: '#34495e',
                marginBottom: isMobile ? '12px' : '15px'
              }}>
                當日預約明細 ({bookings.length} 筆)
              </h2>
              
              <div style={{
                display: 'grid',
                gap: isMobile ? '8px' : '10px'
              }}>
                {bookings.map((booking) => {
                  const startTime = formatTimeNoColon(booking.start_at)
                  const arrivalTime = getArrivalTimeNoColon(booking.start_at)
                  
                  // 直接使用 booking.coaches 數組（如果沒有教練就不顯示）
                  const allCoaches = booking.coaches && booking.coaches.length > 0
                    ? booking.coaches.map(c => c.name).join(' / ')
                    : ''
                  
                  return (
                    <div
                      key={booking.id}
                      style={{
                        padding: isMobile ? '10px' : '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        display: isMobile ? 'flex' : 'grid',
                        flexDirection: isMobile ? 'column' : undefined,
                        gridTemplateColumns: isMobile ? undefined : 'auto 1fr auto',
                        gap: isMobile ? '8px' : '12px',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        fontSize: isMobile ? '13px' : '14px'
                      }}
                    >
                      <div style={{ color: '#666' }}>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: isMobile ? '14px' : undefined }}>
                          {arrivalTime} 抵達
                        </div>
                        <div style={{ fontSize: isMobile ? '12px' : '12px', marginTop: '2px' }}>
                          {startTime} 下水
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontWeight: '600', color: '#333', fontSize: isMobile ? '14px' : undefined }}>
                          {booking.contact_name}
                        </div>
                        <div style={{ fontSize: isMobile ? '12px' : '12px', color: '#666', marginTop: '2px' }}>
                          {allCoaches ? `${allCoaches} · ` : ''}{booking.boats?.name} · {booking.duration_min}分
                        </div>
                      </div>
                      
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div style={{
                          fontSize: isMobile ? '11px' : '11px',
                          padding: '3px 8px',
                          background: '#e3f2fd',
                          borderRadius: '3px',
                          color: '#1976d2',
                          fontWeight: '600',
                          alignSelf: isMobile ? 'flex-start' : undefined
                        }}>
                          {booking.activity_types.join(' + ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <Footer />
      </div>
    </div>
  )
}

