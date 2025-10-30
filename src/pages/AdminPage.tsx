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
  const [copied, setCopied] = useState(false)
  
  // 可編輯的文字模板
  const [greetingText, setGreetingText] = useState('Ming你好\n提醒你，明天有者這些')
  const [headerText, setHeaderText] = useState('阿壽教練')
  const [footerText, setFooterText] = useState('由於近期天氣變化較大，請務必在「前一日」確認是否有新氣象狀況\n另也了在進前先收費預價信用卡！\n再再麻煩我們維護這些！謝謝！\n明天見囉😊\n\n提醒囉，萬壽我取與門提醒我們\n幫你都會傳播場兩滑\n\n準時後壽再算真計算好價格\n也自行不能後，煩請配合👍')
  
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
  
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  
  const getArrivalTime = (dateString: string): string => {
    const date = new Date(dateString)
    date.setMinutes(date.getMinutes() - 30)
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  
  const generateMessage = (): string => {
    let message = greetingText + '\n\n'
    message += headerText + '\n'
    
    // 處理所有預約，避免重複
    const processedBookings = new Set<string>()
    const bookingsList: Array<{ arrivalTime: string; startTime: string }> = []
    
    bookings.forEach((booking) => {
      // 創建唯一 key 來避免重複處理相同的預約
      const bookingKey = `${booking.boat_id}-${booking.student}-${booking.start_at}-${booking.duration_min}`
      
      if (!processedBookings.has(bookingKey)) {
        processedBookings.add(bookingKey)
        
        const startTime = formatTime(booking.start_at)
        const arrivalTime = getArrivalTime(booking.start_at)
        
        bookingsList.push({ arrivalTime, startTime })
      }
    })
    
    // 按時間排序並顯示
    bookingsList
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach(({ arrivalTime, startTime }) => {
        message += `${arrivalTime}抵達\n`
        message += `${startTime}下水\n\n`
      })
    
    message += footerText
    
    return message
  }
  
  const handleCopy = () => {
    const message = generateMessage()
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
          
          <div style={{ marginBottom: isMobile ? '12px' : '15px' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#555'
            }}>
              開頭問候語
            </label>
            <textarea
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              style={{
                width: '100%',
                minHeight: isMobile ? '80px' : '60px',
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
          
          <div style={{ marginBottom: isMobile ? '12px' : '15px' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#555'
            }}>
              預約列表標題
            </label>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '8px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: isMobile ? '15px' : '14px',
                touchAction: 'manipulation',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#555'
            }}>
              結尾注意事項
            </label>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{
                width: '100%',
                minHeight: isMobile ? '200px' : '150px',
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
        </div>

        {/* Preview */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: isMobile ? '15px' : '20px',
          marginBottom: isMobile ? '10px' : '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMobile ? '12px' : '15px',
            gap: '10px'
          }}>
            <h2 style={{
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              color: '#34495e',
              margin: 0
            }}>
              預覽訊息
            </h2>
            <button
              onClick={handleCopy}
              style={{
                padding: isMobile ? '10px 16px' : '8px 16px',
                background: copied ? '#28a745' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: isMobile ? '15px' : '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.2s',
                touchAction: 'manipulation',
                whiteSpace: 'nowrap'
              }}
            >
              {copied ? '✓ 已複製' : '📋 複製訊息'}
            </button>
          </div>
          
          <div style={{
            background: '#f8f9fa',
            padding: isMobile ? '12px' : '15px',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            whiteSpace: 'pre-wrap',
            fontSize: isMobile ? '14px' : '14px',
            lineHeight: '1.6',
            color: '#333',
            fontFamily: 'inherit',
            maxHeight: isMobile ? '400px' : 'none',
            overflowY: isMobile ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch'
          }}>
            {generateMessage()}
          </div>
          
          {bookings.length === 0 && !loading && (
            <div style={{
              marginTop: isMobile ? '12px' : '15px',
              padding: isMobile ? '12px' : '15px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              color: '#856404',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              ⚠️ 選擇的日期沒有預約記錄
            </div>
          )}
        </div>

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
                const startTime = formatTime(booking.start_at)
                const arrivalTime = getArrivalTime(booking.start_at)
                
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

