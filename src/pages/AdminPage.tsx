import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface AdminPageProps {
  user: User
}

interface Booking {
  id: string
  boat_id: number
  coach_id: string | null
  student: string
  start_at: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  boats?: { id: number; name: string; color: string } | null
  coaches?: { id: string; name: string } | null
}

interface Coach {
  id: string
  name: string
}

export function AdminPage({ user }: AdminPageProps) {
  const { isMobile } = useResponsive()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
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
      // 獲取教練列表
      const { data: coachesData } = await supabase
        .from('coaches')
        .select('*')
      setCoaches(coachesData || [])
      
      // 獲取當天預約
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`
      
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color), coaches:coach_id(id, name)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .order('start_at', { ascending: true })
      
      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const getCoachName = (coachId: string | null): string => {
    if (!coachId) return '未指定'
    const coach = coaches.find(c => c.id === coachId)
    return coach ? coach.name : coachId
  }
  
  const formatTimeNoColon = (dateString: string): string => {
    const date = new Date(dateString)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}${minutes}`
  }
  
  const getArrivalTimeNoColon = (dateString: string): string => {
    const date = new Date(dateString)
    date.setMinutes(date.getMinutes() - 30)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}${minutes}`
  }
  
  // 获取所有学生列表
  const getStudentList = (): string[] => {
    const students = new Set<string>()
    bookings.forEach(booking => students.add(booking.student))
    return Array.from(students).sort()
  }
  
  // 为特定学生生成消息
  const generateMessageForStudent = (studentName: string): string => {
    // 获取该学生的所有预约
    const studentBookings = bookings.filter(b => b.student === studentName)
    
    let message = `${studentName}你好\n提醒你，明天有預約\n\n`
    
    // 按教练分组
    const coachBookings = new Map<string, Booking[]>()
    studentBookings.forEach(booking => {
      const coachName = getCoachName(booking.coach_id)
      if (!coachBookings.has(coachName)) {
        coachBookings.set(coachName, [])
      }
      coachBookings.get(coachName)!.push(booking)
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
      
      // 按时间排序
      const sortedBookings = Array.from(uniqueTimes.values()).sort((a, b) => 
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )
      
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
          background: 'white',
          borderRadius: '8px',
          padding: isMobile ? '12px' : '15px',
          marginBottom: isMobile ? '10px' : '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: isMobile ? '8px' : '10px',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? '16px' : '18px',
            color: '#000',
            fontWeight: '600'
          }}>
            {isMobile ? '小編專區' : '小編專區 - 每日提醒'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/"
              style={{
                padding: isMobile ? '8px 12px' : '6px 12px',
                background: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: isMobile ? '14px' : '13px',
                border: '1px solid #dee2e6',
                whiteSpace: 'nowrap',
                touchAction: 'manipulation'
              }}
            >
              ← 回主頁
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
              <span>包含天氣警告</span>
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
                const studentBookings = bookings.filter(b => b.student === studentName)
                
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
                          {studentBookings.length} 個預約
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
        {bookings.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: isMobile ? '15px' : '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                
                // 找出同一時間的所有教練
                const sameTimeBookings = bookings.filter(b => 
                  b.boat_id === booking.boat_id &&
                  b.student === booking.student &&
                  b.start_at === booking.start_at &&
                  b.duration_min === booking.duration_min
                )
                const allCoaches = sameTimeBookings.map(b => 
                  getCoachName(b.coach_id)
                ).filter((name, idx, self) => self.indexOf(name) === idx).join(' / ')
                
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
                        {booking.student}
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
        )}
      </div>
    </div>
  )
}

