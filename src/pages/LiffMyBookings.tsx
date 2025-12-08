import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import liff from '@line/liff'
import { getLocalDateString, getLocalTimestamp } from '../utils/date'
import { useToast } from '../components/ui'
import { triggerHaptic } from '../utils/haptic'
// import { logBookingDeletion } from '../utils/auditLog' // 暫時隱藏取消預約功能

interface Booking {
  id: number
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
  balance?: number
  vip_voucher_amount?: number
  designated_lesson_minutes?: number
  boat_voucher_g23_minutes?: number
  boat_voucher_g21_panther_minutes?: number
  gift_boat_hours?: number
}

interface Transaction {
  id: number
  transaction_date: string
  category: string
  adjust_type: string | null
  transaction_type: string
  amount: number | null
  minutes: number | null
  description: string
  notes: string | null
}

type TabType = 'bookings' | 'balance' | 'cancel'

export function LiffMyBookings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [showBindingForm, setShowBindingForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [binding, setBinding] = useState(false)
  const [bindingError, setBindingError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('bookings')
  
  // 交易記錄彈出框
  const [showTransactions, setShowTransactions] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionCache, setTransactionCache] = useState<Record<string, Transaction[]>>({})
  
  // 刷新狀態
  const [refreshing, setRefreshing] = useState(false)
  
  // 友好日期顯示
  const formatFriendlyDate = (dateStr: string) => {
    const today = getLocalDateString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = getLocalDateString(yesterday)
    
    if (dateStr === today) return '今天'
    if (dateStr === yesterdayStr) return '昨天'
    
    // 顯示月/日
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

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

      // 強制清除快取：添加版本號
      const version = '20251208-001'
      console.log('🚀 LIFF 版本:', version)

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
        .select('member_id, members(id, name, nickname, phone, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours)')
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

  /* 暫時隱藏取消預約功能
  const handleCancelBooking = async (bookingId: number) => {
    try {
      triggerHaptic('warning')
      
      if (!member) {
        toast.error('無法取得會員資訊')
        return
      }

      // 先查詢完整的預約資訊，以便記錄到審計日誌
      const { data: bookingData, error: fetchError } = await supabase
        .from('bookings')
        .select('id, contact_name, start_at, duration_min, boats:boat_id(name)')
        .eq('id', bookingId)
        .single()

      if (fetchError || !bookingData) {
        throw new Error('無法取得預約資訊')
      }

      // 記錄到審計日誌（使用會員名稱作為填表人）
      await logBookingDeletion({
        userEmail: `line:${lineUserId}`, // LINE 用戶的識別
        studentName: bookingData.contact_name || member.name,
        boatName: (bookingData.boats as any)?.name || '未知',
        startTime: bookingData.start_at,
        durationMin: bookingData.duration_min,
        filledBy: member.name // 使用會員名稱作為填表人
      })

      // 刪除預約
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)

      if (error) throw error

      triggerHaptic('success')
      toast.success('預約已取消')
      // 重新載入預約列表
      await loadBookings(member.id)
    } catch (err: any) {
      console.error('取消預約失敗:', err)
      triggerHaptic('error')
      toast.error('取消預約失敗：' + err.message)
    }
  }
  */

  const loadBookings = async (memberId: string) => {
    try {
      const today = getLocalDateString()

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

  // 刷新資料
  const handleRefresh = async () => {
    if (!lineUserId || refreshing) return
    
    setRefreshing(true)
    triggerHaptic('light')
    
    // 清除交易記錄快取
    setTransactionCache({})
    
    try {
      // 重新查詢會員資料
      const { data: binding } = await supabase
        .from('line_bindings')
        .select('member_id, members(id, name, nickname, phone, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours)')
        .eq('line_user_id', lineUserId)
        .eq('status', 'active')
        .single()

      if (binding && binding.members) {
        const memberData = binding.members as any
        setMember(memberData)
        await loadBookings(memberData.id)
        toast.success('資料已更新')
      }
    } catch (err: any) {
      console.error('刷新失敗:', err)
      toast.error('刷新失敗')
    } finally {
      setRefreshing(false)
    }
  }

  const loadTransactions = async (memberId: string, category: string, forceRefresh = false) => {
    // 檢查快取
    const cacheKey = `${memberId}_${category}`
    if (!forceRefresh && transactionCache[cacheKey]) {
      setTransactions(transactionCache[cacheKey])
      return
    }
    
    setLoadingTransactions(true)
    try {
      // 計算兩個月前的日期
      const twoMonthsAgo = new Date()
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
      const twoMonthsAgoStr = getLocalDateString(twoMonthsAgo)

      // 查詢該類別的交易記錄
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', memberId)
        .eq('category', category)
        .gte('transaction_date', twoMonthsAgoStr)
        .order('transaction_date', { ascending: false })

      if (error) throw error

      const result = data || []
      setTransactions(result)
      // 存入快取
      setTransactionCache(prev => ({ ...prev, [cacheKey]: result }))
    } catch (err: any) {
      console.error('載入交易記錄失敗:', err)
      toast.error('載入交易記錄失敗')
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleCategoryClick = (category: string) => {
    if (!member) return
    triggerHaptic('light')
    setSelectedCategory(category)
    setShowTransactions(true)
    loadTransactions(member.id, category)
  }

  const handleBinding = async () => {
    if (!phone || !lineUserId) return

    triggerHaptic('medium')
    setBinding(true)
    setBindingError(null)
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
        toast.error('無法查詢會員資料，請稍後再試')
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
        triggerHaptic('error')
        setBindingError('找不到此手機號碼的會員資料')
        setBinding(false)
        return
      }

      // 創建綁定
      const { error: bindError } = await supabase
        .from('line_bindings')
        .upsert({
          line_user_id: lineUserId,
          member_id: memberData.id,
          phone: memberData.phone,
          status: 'active',
          completed_at: getLocalTimestamp(),
          created_at: getLocalTimestamp()
        }, {
          onConflict: 'line_user_id'
        })

      if (bindError) {
        triggerHaptic('error')
        toast.error('綁定失敗：' + bindError.message)
        setBinding(false)
        return
      }

      // 更新會員生日
      if (birthYear && birthMonth && birthDay) {
        const birthday = `${birthYear}-${birthMonth}-${birthDay}`
        const { error: updateError } = await supabase
          .from('members')
          .update({ birthday })
          .eq('id', memberData.id)
        
        if (updateError) {
          console.error('更新生日失敗:', updateError)
        }
      }

      // 綁定成功
      triggerHaptic('success')
      setMember(memberData)
      setShowBindingForm(false)
      await loadBookings(memberData.id)
    } catch (err: any) {
      console.error('綁定失敗:', err)
      toast.error('綁定失敗')
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
        background: '#f5f5f5',
        padding: '16px'
      }}>
        {/* 頭部骨架屏 */}
        <div style={{ marginBottom: '20px' }}>
          <div className="skeleton-pulse" style={{ 
            width: '150px', 
            height: '28px', 
            background: '#e0e0e0', 
            borderRadius: '6px',
            marginBottom: '12px'
          }} />
          <div className="skeleton-pulse" style={{ 
            width: '100%', 
            height: '48px', 
            background: 'white', 
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }} />
        </div>

        {/* 預約列表骨架屏 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i}
            className="skeleton-pulse"
            style={{
              background: 'white',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div className="skeleton-pulse" style={{ width: '60px', height: '18px', background: '#e0e0e0', borderRadius: '4px' }} />
              <div className="skeleton-pulse" style={{ flex: 1, height: '18px', background: '#e0e0e0', borderRadius: '4px' }} />
            </div>
            <div className="skeleton-pulse" style={{ width: '80%', height: '16px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '8px' }} />
            <div className="skeleton-pulse" style={{ width: '60%', height: '14px', background: '#f0f0f0', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    )
  }

  // 綁定表單
  if (showBindingForm) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
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
            <p style={{
              fontSize: '11px',
              color: '#999',
              margin: '8px 0 0',
              fontFamily: 'monospace'
            }}>
              v20251208-002
            </p>
          </div>

          {/* 錯誤提示 */}
          {bindingError && (
            <div style={{
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '14px', color: '#cf1322', marginBottom: '8px', fontWeight: '600' }}>
                ❌ {bindingError}
              </div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                如果您確定手機號碼正確，請直接<strong>私訊官方帳號</strong>告知您的手機號碼，我們會協助您完成綁定！
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
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
              onChange={(e) => {
                setPhone(e.target.value)
                setBindingError(null)
              }}
              placeholder="請輸入您的手機號碼"
              style={{
                width: '100%',
                padding: '14px',
                border: bindingError ? '2px solid #ff4d4f' : '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#5a5a5a'}
              onBlur={(e) => e.target.style.borderColor = bindingError ? '#ff4d4f' : '#e0e0e0'}
            />
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginTop: '6px'
            }}>
              例如：0912345678
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#555',
              marginBottom: '8px'
            }}>
              生日
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* 年 */}
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                style={{
                  flex: 1.2,
                  padding: '14px 8px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: 'white',
                  color: birthYear ? '#333' : '#999'
                }}
              >
                <option value="">年</option>
                {Array.from({ length: 100 }, (_, i) => {
                  const year = new Date().getFullYear() - i
                  return <option key={year} value={year}>{year}</option>
                })}
              </select>
              {/* 月 */}
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: 'white',
                  color: birthMonth ? '#333' : '#999'
                }}
              >
                <option value="">月</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}月</option>
                ))}
              </select>
              {/* 日 */}
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                style={{
                  flex: 1,
                  padding: '14px 8px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: 'white',
                  color: birthDay ? '#333' : '#999'
                }}
              >
                <option value="">日</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}日</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleBinding}
            disabled={binding || !phone || !birthYear || !birthMonth || !birthDay}
            style={{
              width: '100%',
              padding: '14px',
              background: binding || !phone || !birthYear || !birthMonth || !birthDay
                ? '#ccc' 
                : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: binding || !phone || !birthYear || !birthMonth || !birthDay ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s',
              marginBottom: '16px'
            }}
            onMouseDown={(e) => {
              if (!binding && phone && birthYear && birthMonth && birthDay) {
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
            • 請輸入您的手機與生日<br/>
            • 綁定後可查看預約紀錄與儲值紀錄
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
        paddingTop: 'calc(20px + var(--safe-area-inset-top, 0px))',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span style={{
                fontSize: '18px',
                display: 'inline-block',
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }}>
                🔄
              </span>
            </button>
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
        </div>
        <div style={{
          fontSize: '14px',
          opacity: 0.9
        }}>
          {member?.nickname || member?.name} 您好！
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        position: 'sticky',
        top: 'var(--safe-area-inset-top, 0px)',
        zIndex: 10
      }}>
        <button
          onClick={() => {
            triggerHaptic('light')
            setActiveTab('bookings')
          }}
          style={{
            flex: 1,
            padding: '16px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'bookings' ? '#5a5a5a' : '#999',
            fontWeight: activeTab === 'bookings' ? '600' : '400',
            fontSize: '15px',
            cursor: 'pointer',
            borderBottom: activeTab === 'bookings' ? '3px solid #5a5a5a' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          📅 我的預約
        </button>
        <button
          onClick={() => {
            triggerHaptic('light')
            setActiveTab('balance')
          }}
          style={{
            flex: 1,
            padding: '16px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'balance' ? '#5a5a5a' : '#999',
            fontWeight: activeTab === 'balance' ? '600' : '400',
            fontSize: '15px',
            cursor: 'pointer',
            borderBottom: activeTab === 'balance' ? '3px solid #5a5a5a' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          💰 查儲值
        </button>
        {/* 暫時隱藏取消預約功能
        <button
          onClick={() => {
            triggerHaptic('light')
            setActiveTab('cancel')
          }}
          style={{
            flex: 1,
            padding: '16px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'cancel' ? '#5a5a5a' : '#999',
            fontWeight: activeTab === 'cancel' ? '600' : '400',
            fontSize: '15px',
            cursor: 'pointer',
            borderBottom: activeTab === 'cancel' ? '3px solid #5a5a5a' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          ❌ 取消預約
        </button>
        */}
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Tab: 我的預約 */}
        {activeTab === 'bookings' && (
          <>
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
          </>
        )}

        {/* Tab: 查儲值 */}
        {activeTab === 'balance' && member && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              💰 我的儲值
            </h2>

            {/* 提示 */}
            <div style={{
              padding: '10px 12px',
              background: '#fff9e6',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '13px',
              color: '#856404',
              border: '1px solid #ffeaa7'
            }}>
              💡 點擊任一項目查看交易明細
            </div>

            {/* 儲值數據 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              {/* 儲值餘額 */}
              <div 
                onClick={() => handleCategoryClick('balance')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #52c41a',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  💰 儲值餘額
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#52c41a' }}>
                  ${member.balance || 0}
                </div>
              </div>

              {/* VIP票券 */}
              <div 
                onClick={() => handleCategoryClick('vip_voucher')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #9c27b0',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  💎 VIP票券
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#9c27b0' }}>
                  ${member.vip_voucher_amount || 0}
                </div>
              </div>

              {/* 指定課 */}
              <div 
                onClick={() => handleCategoryClick('designated_lesson')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #faad14',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  📚 指定課
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#faad14' }}>
                  {member.designated_lesson_minutes || 0}分
                </div>
              </div>

              {/* G23船券 */}
              <div 
                onClick={() => handleCategoryClick('boat_voucher_g23')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #1890ff',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  🚤 G23船券
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff' }}>
                  {member.boat_voucher_g23_minutes || 0}分
                </div>
              </div>

              {/* G21/黑豹 */}
              <div 
                onClick={() => handleCategoryClick('boat_voucher_g21_panther')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #13c2c2',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  ⛵ G21/黑豹
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#13c2c2' }}>
                  {member.boat_voucher_g21_panther_minutes || 0}分
                </div>
              </div>

              {/* 贈送大船 */}
              <div 
                onClick={() => handleCategoryClick('gift_boat')}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #eb2f96',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  🎁 贈送大船
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#eb2f96' }}>
                  {member.gift_boat_hours || 0}分
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 暫時隱藏取消預約功能
        {activeTab === 'cancel' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ❌ 取消預約
            </h2>
            
            <div style={{
              background: '#fff3cd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              border: '1px solid #ffc107'
            }}>
              <div style={{ fontSize: '14px', color: '#856404', lineHeight: '1.6' }}>
                ⚠️ 注意事項：<br/>
                • 只能取消 24 小時後的預約<br/>
                • 取消後無法復原<br/>
                • 如有疑問請聯絡我們
              </div>
            </div>

            {bookings.length === 0 ? (
              <div style={{
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                  目前沒有可取消的預約
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
                  const startTime = new Date(booking.start_at)
                  const now = new Date()
                  const hoursDiff = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                  const canCancel = hoursDiff > 24
                  const coachNames = booking.coaches.map(c => c.name).join('、') || '未指定'
                  
                  return (
                    <div
                      key={booking.id}
                      style={{
                        background: canCancel ? 'white' : '#f5f5f5',
                        borderRadius: '12px',
                        padding: '16px',
                        border: `2px solid ${canCancel ? booking.boats?.color || '#1976d2' : '#e0e0e0'}`,
                        opacity: canCancel ? 1 : 0.6
                      }}
                    >
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        {formatDate(booking.start_at)}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                        🚤 {booking.boats?.name} · 🎓 {coachNames}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                        ⏱️ {booking.duration_min} 分鐘
                      </div>
                      {canCancel ? (
                        <button
                          onClick={() => {
                            if (confirm(`確定要取消這個預約嗎？\n\n${formatDate(booking.start_at)}\n${booking.boats?.name}\n\n此操作無法復原！`)) {
                              handleCancelBooking(booking.id)
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          取消此預約
                        </button>
                      ) : (
                        <div style={{
                          padding: '12px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: '#999',
                          textAlign: 'center'
                        }}>
                          ⏰ 距離預約時間少於 24 小時，無法線上取消
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        */}
      </div>

      {/* 交易記錄彈出框 */}
      {showTransactions && (
        <div
          onClick={() => setShowTransactions(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 9999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '70vh',
              background: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              overflowY: 'auto',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* 標題欄 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
                {getCategoryLabel(selectedCategory)} 交易記錄
              </h3>
              <button
                onClick={() => setShowTransactions(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#999',
                  cursor: 'pointer',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* 交易列表 */}
            {loadingTransactions ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                最近兩個月無交易記錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    style={{
                      padding: '14px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${transaction.adjust_type === 'increase' || transaction.transaction_type === 'charge' ? '#52c41a' : '#ff4d4f'}`
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {formatFriendlyDate(transaction.transaction_date)}
                      </div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: transaction.adjust_type === 'increase' || transaction.transaction_type === 'charge' ? '#52c41a' : '#ff4d4f'
                      }}>
                        {(transaction.adjust_type === 'increase' || transaction.transaction_type === 'charge') ? '+' : '-'}
                        {getCategoryUnit(selectedCategory) === '元' ? '$' : ''}
                        {Math.abs(transaction.amount || transaction.minutes || 0)}
                        {getCategoryUnit(selectedCategory) === '分' ? '分' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                      {transaction.description}
                    </div>
                    {transaction.notes && (
                      <div style={{ fontSize: '13px', color: '#999' }}>
                        備註：{transaction.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '20px',
        paddingBottom: 'calc(20px + var(--safe-area-inset-bottom, 0px))',
        textAlign: 'center',
        color: '#999',
        fontSize: '12px'
      }}>
        ES Wake 預約系統 © {new Date().getFullYear()}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          .skeleton-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
    </div>
  )
}

// 輔助函數：獲取類別標籤
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'balance': '💰 儲值餘額',
    'vip_voucher': '💎 VIP票券',
    'designated_lesson': '📚 指定課',
    'boat_voucher_g23': '🚤 G23船券',
    'boat_voucher_g21_panther': '⛵ G21/黑豹',
    'gift_boat': '🎁 贈送大船'
  }
  return labels[category] || category
}

// 輔助函數：獲取類別單位
function getCategoryUnit(category: string): string {
  if (category === 'balance' || category === 'vip_voucher') {
    return '元'
  }
  return '分'
}

