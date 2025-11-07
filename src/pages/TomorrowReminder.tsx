import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { Footer } from '../components/Footer'

interface TomorrowReminderProps {
  user: User
}

interface Booking {
  id: string
  boat_id: number
  contact_name: string
  start_at: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  boats?: { id: number; name: string; color: string } | null
  coaches?: { id: string; name: string }[]
}

export function TomorrowReminder({ user }: TomorrowReminderProps) {
  const { isMobile } = useResponsive()
  // 智能選擇日期：凌晨 03:00 前顯示今天，之後顯示明天
  const getDefaultDate = () => {
    const now = new Date()
    const hour = now.getHours()
    
    if (hour < 3) {
      // 凌晨 00:00 - 02:59，顯示今天
      return getLocalDateString(now)
    } else {
      // 03:00 之後，顯示明天
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
  
  // 天氣警告開關（持久化）
  const [includeWeatherWarning, setIncludeWeatherWarning] = useState(() => {
    const saved = localStorage.getItem('includeWeatherWarning')
    return saved !== null ? JSON.parse(saved) : true
  })
  
  // 可編輯文字模板（持久化）
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
  
  // 保存到 localStorage
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
      // 獲取當天預約
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`
      
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .order('start_at', { ascending: true })
      
      // 獲取每個預約的教練信息
      if (bookingsData && bookingsData.length > 0) {
        const bookingIds = bookingsData.map((b: any) => b.id)
        const { data: bookingCoachesData } = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds)
        
        // 合併教練信息
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
        
        // 將教練信息添加到預約中
        bookingsData.forEach((booking: any) => {
          booking.coaches = coachesByBooking[booking.id] || []
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
  
  // 获取所有学生列表
  const getStudentList = (): string[] => {
    const students = new Set<string>()
    bookings.forEach(booking => students.add(booking.contact_name))
    return Array.from(students).sort()
  }
  
  // 为特定学生生成消息
  const generateMessageForStudent = (studentName: string): string => {
    // 获取该学生的所有预约
    const studentBookings = bookings.filter(b => b.contact_name === studentName)
    
    let message = `${studentName}你好\n提醒你，明天有預約\n\n`
    
    // 按教练分组
    const coachBookings = new Map<string, Booking[]>()
    studentBookings.forEach(booking => {
      const coachNames = booking.coaches && booking.coaches.length > 0
        ? booking.coaches.map(c => c.name).join(' / ')
        : '未指定'
      
      if (!coachBookings.has(coachNames)) {
        coachBookings.set(coachNames, [])
      }
      coachBookings.get(coachNames)!.push(booking)
    })
    
    // 为每个教练生成时间列表
    coachBookings.forEach((bookings, coachName) => {
      message += `${coachName}教練\n`
      
      // 去重并排序（同一时间的预约只显示一次）
      const uniqueTimes = new Map<string, Booking>()
      bookings.forEach(booking => {
        const key = `${booking.start_at}-${booking.duration_min}`
        if (!uniqueTimes.has(key)) {
          uniqueTimes.set(key, booking)
        }
      })
      
      // 按时间排序（純字符串比較）
      const sortedBookings = Array.from(uniqueTimes.values()).sort((a, b) => {
        const aTime = a.start_at.substring(0, 16)
        const bTime = b.start_at.substring(0, 16)
        return aTime.localeCompare(bTime)
      })
      
      sortedBookings.forEach(booking => {
        const arrivalTime = getArrivalTimeNoColon(booking.start_at)
        const startTime = formatTimeNoColon(booking.start_at)
        message += `${arrivalTime}抵達\n`
        message += `${startTime}下水\n\n`
      })
    })
    
    // 天氣警告（可選）
    if (includeWeatherWarning) {
      message += weatherWarning + '\n\n'
    }
    
    // 結尾提醒
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
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '18px' : '20px',
            color: 'white',
            fontWeight: '600'
          }}>
            {isMobile ? '⏰ 明日提醒' : '⏰ 小編專區 - 明日提醒'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/"
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                whiteSpace: 'nowrap'
              }}
            >
              ← HOME
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Date Selector */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: isMobile ? '15px' : '20px',
          marginBottom: isMobile ? '10px' : '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: isMobile ? '10px 12px' : '8px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: isMobile ? '15px' : '14px',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '100%' : '200px',
              touchAction: 'manipulation'
            }}
          />
          {loading && (
            <span style={{ 
              marginLeft: isMobile ? '0' : '10px', 
              marginTop: isMobile ? '8px' : '0',
              display: isMobile ? 'block' : 'inline',
              color: '#666', 
              fontSize: isMobile ? '13px' : '14px' 
            }}>
              載入中...
            </span>
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
              學生提醒訊息 ({getStudentList().length} 位學生)
            </h2>
            
            <div style={{
              display: 'grid',
              gap: isMobile ? '10px' : '12px'
            }}>
              {getStudentList().map((studentName) => {
                const isExpanded = selectedStudent === studentName
                const isCopied = copiedStudent === studentName
                const studentBookings = bookings.filter(b => b.contact_name === studentName)
                
                // 计算去重后的预约数量
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
                    {/* Student Header */}
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
                  
                  // 直接使用 booking.coaches 數組
                  const allCoaches = booking.coaches && booking.coaches.length > 0
                    ? booking.coaches.map(c => c.name).join(' / ')
                    : '未指定'
                  
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
                          {allCoaches} · {booking.boats?.name} · {booking.duration_min}分
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

