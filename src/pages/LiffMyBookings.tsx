import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import liff from '@line/liff'

interface Booking {
  id: string
  start_at: string
  duration_min: number
  boats: { name: string; color: string } | null
  coaches: { name: string }[]
  drivers: { name: string }[]
  activity_types: string[] | null
  notes: string | null
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

export function LiffMyBookings() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [showBindingForm, setShowBindingForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [binding, setBinding] = useState(false)

  useEffect(() => {
    initLiff()
  }, [])

  const initLiff = async () => {
    try {
      const liffId = import.meta.env.VITE_LIFF_ID
      if (!liffId) {
        setError('LIFF ID 未設置')
        setLoading(false)
        return
      }

      await liff.init({ liffId })

      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await liff.getProfile()
      setLineUserId(profile.userId)

      // 查詢綁定資訊
      await checkBinding(profile.userId)
    } catch (err: any) {
      console.error('LIFF 初始化失敗:', err)
      setError(err.message || 'LIFF 初始化失敗')
      setLoading(false)
    }
  }

  const checkBinding = async (userId: string) => {
    try {
      // 查詢 line_bindings 表
      const { data: binding } = await supabase
        .from('line_bindings')
        .select('member_id, members(id, name, nickname, phone)')
        .eq('line_user_id', userId)
        .eq('status', 'active')
        .single()

      if (binding && binding.members) {
        const memberData = binding.members as any
        setMember(memberData)
        await loadBookings(memberData.id)
      } else {
        setShowBindingForm(true)
        setLoading(false)
      }
    } catch (err: any) {
      console.error('查詢綁定失敗:', err)
      setShowBindingForm(true)
      setLoading(false)
    }
  }

  const loadBookings = async (memberId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // 查詢該會員的預約（透過 booking_members）
      const { data: bookingMembers } = await supabase
        .from('booking_members')
        .select('booking_id')
        .eq('member_id', memberId)

      if (!bookingMembers || bookingMembers.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      const bookingIds = bookingMembers.map(bm => bm.booking_id)

      // 查詢預約詳情
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          activity_types,
          notes,
          boats:boat_id(name, color)
        `)
        .in('id', bookingIds)
        .gte('start_at', `${today}T00:00:00`)
        .order('start_at', { ascending: true })

      if (bookingsData && bookingsData.length > 0) {
        // 查詢教練資訊
        const { data: coachData } = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingsData.map(b => b.id))

        // 查詢駕駛資訊
        const { data: driverData } = await supabase
          .from('booking_drivers')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingsData.map(b => b.id))

        // 組合資料
        const formattedBookings = bookingsData.map((booking: any) => {
          const coaches = coachData
            ?.filter(c => c.booking_id === booking.id)
            .map(c => (c as any).coaches)
            .filter(Boolean) || []

          const drivers = driverData
            ?.filter(d => d.booking_id === booking.id)
            .map(d => (d as any).coaches)
            .filter(Boolean) || []

          return {
            ...booking,
            coaches,
            drivers
          }
        })

        setBookings(formattedBookings)
      } else {
        setBookings([])
      }

      setLoading(false)
    } catch (err: any) {
      console.error('載入預約失敗:', err)
      setError('載入預約失敗')
      setLoading(false)
    }
  }

  const handleBinding = async () => {
    if (!phone || !lineUserId) return

    setBinding(true)
    try {
      // 清理電話號碼：移除所有非數字字符
      const cleanPhone = phone.replace(/\D/g, '')
      console.log('🔍 輸入的電話號碼:', phone)
      console.log('🔍 清理後的電話:', cleanPhone)
      
      // 查詢會員：嘗試多種格式
      const { data: allMembers, error: queryError } = await supabase
        .from('members')
        .select('id, name, nickname, phone, status')
      
      console.log('📊 查詢結果:', allMembers)
      console.log('❌ 查詢錯誤:', queryError)
      
      if (!allMembers || allMembers.length === 0) {
        alert('❌ 無法查詢會員資料，請稍後再試')
        setBinding(false)
        return
      }
      
      // 尋找匹配的會員（比對清理後的電話號碼）
      const memberData = allMembers.find(m => {
        const dbPhone = m.phone?.replace(/\D/g, '') || ''
        console.log(`🔍 比對: ${m.name} - DB: ${m.phone} (${dbPhone}) vs 輸入: ${cleanPhone}`)
        return dbPhone === cleanPhone && m.status === 'active'
      })

      console.log('✅ 找到的會員:', memberData)

      if (!memberData) {
        alert('❌ 找不到此電話號碼的會員資料\n請確認：\n1. 電話號碼正確\n2. 會員狀態為 active')
        setBinding(false)
        return
      }

      // 創建綁定
      const { error: bindingError } = await supabase
        .from('line_bindings')
        .upsert({
          line_user_id: lineUserId,
          member_id: memberData.id,
          phone: memberData.phone,
          status: 'active',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'line_user_id'
        })

      if (bindingError) {
        alert('❌ 綁定失敗：' + bindingError.message)
        setBinding(false)
        return
      }

      // 綁定成功
      setMember(memberData)
      setShowBindingForm(false)
      await loadBookings(memberData.id)
    } catch (err: any) {
      console.error('綁定失敗:', err)
      alert('❌ 綁定失敗')
    } finally {
      setBinding(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (${weekday}) ${hours}:${minutes}`
  }

  const getEndTime = (startAt: string, duration: number) => {
    const start = new Date(startAt)
    const end = new Date(start.getTime() + duration * 60000)
    return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', color: '#d32f2f', fontWeight: '600', marginBottom: '8px' }}>
            發生錯誤
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e0e0e0',
            borderTop: '4px solid #5a5a5a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <div style={{ fontSize: '16px' }}>載入中...</div>
        </div>
      </div>
    )
  }

  // 綁定表單
  if (showBindingForm) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px 24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <img 
              src="/logo_circle (black).png" 
              alt="ES Wake Logo" 
              style={{ 
                width: '80px', 
                height: '80px', 
                marginBottom: '16px',
                objectFit: 'contain'
              }} 
            />
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#333',
              margin: '0 0 8px'
            }}>
              ES Wake 預約查詢
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#666',
              margin: 0
            }}>
              首次使用需要綁定您的電話號碼
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px'
            }}>
              手機號碼
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="請輸入您的手機號碼"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginTop: '6px'
            }}>
              例如：0912345678
            </div>
          </div>

          <button
            onClick={handleBinding}
            disabled={binding || !phone}
            style={{
              width: '100%',
              padding: '14px',
              background: binding || !phone 
                ? '#ccc' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: binding || !phone ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s',
              marginBottom: '16px'
            }}
            onMouseDown={(e) => {
              if (!binding && phone) {
                (e.target as HTMLElement).style.transform = 'scale(0.98)'
              }
            }}
            onMouseUp={(e) => {
              (e.target as HTMLElement).style.transform = 'scale(1)'
            }}
          >
            {binding ? '綁定中...' : '開始綁定'}
          </button>

          <div style={{
            background: '#f8f9fa',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#666',
            lineHeight: '1.6'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#555' }}>
              💡 綁定說明
            </div>
            • 請輸入您在系統中註冊的手機號碼<br/>
            • 綁定後可查看您的預約記錄<br/>
            • 未來將自動收到預約提醒
          </div>
        </div>
      </div>
    )
  }

  // 預約列表
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        padding: '20px',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0
          }}>
            我的預約
          </h1>
          <img 
            src="/logo_circle (white).png" 
            alt="ES Wake Logo" 
            style={{ 
              width: '40px', 
              height: '40px',
              objectFit: 'contain'
            }} 
          />
        </div>
        <div style={{
          fontSize: '14px',
          opacity: 0.9
        }}>
          {member?.nickname || member?.name} 您好！
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {bookings.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '60px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
              目前沒有預約
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              您目前沒有即將到來的預約
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {bookings.map((booking) => {
              const coachNames = booking.coaches.map(c => c.name).join('、') || '未指定'
              const driverNames = booking.drivers.map(d => d.name).join('、')
              
              return (
                <div
                  key={booking.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    borderLeft: `4px solid ${booking.boats?.color || '#1976d2'}`
                  }}
                >
                  {/* 日期時間 */}
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>📅</span>
                    <span>{formatDate(booking.start_at)}</span>
                  </div>

                  {/* 船隻 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      background: booking.boats?.color || '#1976d2'
                    }} />
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#555' }}>
                      {booking.boats?.name || '未指定'}
                    </span>
                  </div>

                  {/* 時長 */}
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    ⏱️ {booking.duration_min} 分鐘
                    <span style={{ color: '#999', marginLeft: '8px' }}>
                      (結束時間: {getEndTime(booking.start_at, booking.duration_min)})
                    </span>
                  </div>

                  {/* 教練 */}
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: driverNames ? '8px' : '0'
                  }}>
                    🎓 教練：{coachNames}
                  </div>

                  {/* 駕駛 */}
                  {driverNames && (
                    <div style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '8px'
                    }}>
                      🚤 駕駛：{driverNames}
                    </div>
                  )}

                  {/* 活動類型 */}
                  {booking.activity_types && booking.activity_types.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '12px'
                    }}>
                      {booking.activity_types.map((type, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 10px',
                            background: '#e3f2fd',
                            color: '#1976d2',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 備註 */}
                  {booking.notes && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#555',
                      lineHeight: '1.5'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>📝 備註</div>
                      {booking.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#999',
        fontSize: '12px'
      }}>
        ES Wake 預約系統 © 2024
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

