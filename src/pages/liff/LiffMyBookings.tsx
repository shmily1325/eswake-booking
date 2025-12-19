import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { useToast } from '../../components/ui'
import { triggerHaptic } from '../../utils/haptic'
// import { logBookingDeletion } from '../../utils/auditLog' // 暫時隱藏取消預約功能

import type { Booking, Member, Transaction, TabType } from './types'
import {
  ErrorView,
  LoadingSkeleton,
  BindingForm,
  LiffHeader,
  LiffTabs,
  BookingsList,
  BalanceView,
  TransactionModal,
  LiffStyles
} from './components'

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
      const version = '20251208-002'
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
        // 並行查詢教練和駕駛資訊（優化：原本是順序執行，現在同時執行節省網路延遲）
        const [{ data: coachData }, { data: driverData }] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id)),
          supabase
            .from('booking_drivers')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id))
        ])

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
        const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
        console.log('📅 準備更新生日:', birthday, '會員ID:', memberData.id)
        
        const { data: updateData, error: updateError } = await supabase
          .from('members')
          .update({ birthday })
          .eq('id', memberData.id)
          .select()
        
        if (updateError) {
          console.error('❌ 更新生日失敗:', updateError)
          // 不阻擋綁定流程，但記錄錯誤
          toast.error('生日更新失敗，請稍後在會員資料中手動更新')
        } else {
          console.log('✅ 生日更新成功:', updateData)
        }
      }

      // 綁定成功 - 重新載入完整的會員資料（包含儲值欄位）
      triggerHaptic('success')
      
      const { data: fullMemberData } = await supabase
        .from('members')
        .select('id, name, nickname, phone, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours')
        .eq('id', memberData.id)
        .single()
      
      if (fullMemberData) {
        setMember({
          id: fullMemberData.id,
          name: fullMemberData.name,
          nickname: fullMemberData.nickname,
          phone: fullMemberData.phone,
          balance: fullMemberData.balance ?? undefined,
          vip_voucher_amount: fullMemberData.vip_voucher_amount ?? undefined,
          designated_lesson_minutes: fullMemberData.designated_lesson_minutes ?? undefined,
          boat_voucher_g23_minutes: fullMemberData.boat_voucher_g23_minutes ?? undefined,
          boat_voucher_g21_panther_minutes: fullMemberData.boat_voucher_g21_panther_minutes ?? undefined,
          gift_boat_hours: fullMemberData.gift_boat_hours ?? undefined,
        })
      } else {
        setMember(memberData)
      }
      
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
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  const getEndTime = (startAt: string, duration: number) => {
    const start = new Date(startAt)
    const end = new Date(start.getTime() + duration * 60000)
    return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 取得抵達時間（提前30分鐘）
  const getArrivalTime = (startAt: string) => {
    const start = new Date(startAt)
    const arrival = new Date(start.getTime() - 30 * 60000)
    return `${arrival.getHours().toString().padStart(2, '0')}:${arrival.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 取得下水時間
  const getStartTime = (startAt: string) => {
    const start = new Date(startAt)
    return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`
  }

  // 錯誤頁面
  if (error) {
    return <ErrorView error={error} />
  }

  // 載入中
  if (loading) {
    return <LoadingSkeleton />
  }

  // 綁定表單
  if (showBindingForm) {
    return (
      <BindingForm
        phone={phone}
        setPhone={setPhone}
        birthYear={birthYear}
        setBirthYear={setBirthYear}
        birthMonth={birthMonth}
        setBirthMonth={setBirthMonth}
        birthDay={birthDay}
        setBirthDay={setBirthDay}
        binding={binding}
        bindingError={bindingError}
        setBindingError={setBindingError}
        onSubmit={handleBinding}
      />
    )
  }

  // 預約列表
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* Header */}
      <LiffHeader
        member={member}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Tabs */}
      <LiffTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Tab: 我的預約 */}
        {activeTab === 'bookings' && (
          <BookingsList
            bookings={bookings}
            formatDate={formatDate}
            getArrivalTime={getArrivalTime}
            getStartTime={getStartTime}
            getEndTime={getEndTime}
          />
        )}

        {/* Tab: 查儲值 */}
        {activeTab === 'balance' && member && (
          <BalanceView
            member={member}
            onCategoryClick={handleCategoryClick}
          />
        )}

        {/* 暫時隱藏取消預約功能 */}
      </div>

      {/* 交易記錄彈出框 */}
      <TransactionModal
        show={showTransactions}
        onClose={() => setShowTransactions(false)}
        category={selectedCategory}
        transactions={transactions}
        loading={loadingTransactions}
        formatFriendlyDate={formatFriendlyDate}
      />

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

      <LiffStyles />
    </div>
  )
}

