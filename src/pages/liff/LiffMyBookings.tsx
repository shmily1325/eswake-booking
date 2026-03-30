import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { useToast } from '../../components/ui'
import { triggerHaptic } from '../../utils/haptic'
import type { Booking, Member, Transaction, TabType } from './types'
import {
  ErrorView,
  LoadingSkeleton,
  BindingForm,
  LiffHeader,
  LiffTabs,
  BookingsList,
  BalanceView,
  MemberProfileView,
  TransactionModal,
  LiffStyles,
  LiffExpiryBanner
} from './components'
import { buildLiffExpiryBannerLines } from './liffExpiryAlerts'

const LIFF_MEMBER_SELECT =
  'id, name, nickname, phone, birthday, membership_type, membership_partner_id, membership_end_date, board_slot_number, board_expiry_date, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours'

const LIFF_INIT_MAX_ATTEMPTS = 3
const LIFF_INIT_RETRY_DELAYS_MS = [400, 800]

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function unknownErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** 第一次從 LINE 開進來是 navigate；自動 reload 後變成 reload，避免無限迴圈。等同使用者「按兩次連結」裡的第二次。 */
function isFirstDocumentLoadThisNavigation(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'reload') return false
    return true
  } catch {
    return true
  }
}

/** 久未開啟時 LINE WebView 與原生橋接尚未就緒，liff.init 常短暫失敗；重試可大幅減少「Unable to load client features」。 */
async function initLiffSdk(liffId: string): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < LIFF_INIT_MAX_ATTEMPTS; attempt++) {
    try {
      await liff.init({ liffId })
      return
    } catch (e) {
      lastErr = e
      if (attempt < LIFF_INIT_MAX_ATTEMPTS - 1) {
        const delay = LIFF_INIT_RETRY_DELAYS_MS[attempt] ?? 600
        console.warn(`LIFF init 第 ${attempt + 1} 次失敗，${delay}ms 後重試`, e)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

async function enrichMemberForLiff(raw: Record<string, unknown>): Promise<Member> {
  const r = raw as {
    id: string
    name: string
    nickname: string | null
    phone: string | null
    birthday?: string | null
    membership_type?: string | null
    membership_partner_id?: string | null
    membership_end_date?: string | null
    board_slot_number?: string | null
    board_expiry_date?: string | null
    balance?: number | null
    vip_voucher_amount?: number | null
    designated_lesson_minutes?: number | null
    boat_voucher_g23_minutes?: number | null
    boat_voucher_g21_panther_minutes?: number | null
    gift_boat_hours?: number | null
  }

  const boardsRes = await supabase
    .from('board_storage')
    .select('id, slot_number, start_date, expires_at')
    .eq('member_id', r.id)
    .eq('status', 'active')
    .order('slot_number', { ascending: true })

  if (boardsRes.error) {
    console.warn('LIFF 置板查詢失敗（將僅顯示會員表備用欄位）:', boardsRes.error.message)
  }

  const board_slots = (boardsRes.error ? [] : boardsRes.data ?? []).map(b => ({
    id: b.id,
    slot_number: b.slot_number,
    start_date: b.start_date,
    expires_at: b.expires_at
  }))

  let partner: Member['partner'] = null
  if (r.membership_type === 'dual' && r.membership_partner_id) {
    const partnerRes = await supabase
      .from('members')
      .select('name, nickname')
      .eq('id', r.membership_partner_id)
      .single()
    if (partnerRes.error) {
      console.warn('LIFF 雙人配對會員查詢失敗:', partnerRes.error.message)
    } else if (partnerRes.data) {
      partner = { name: partnerRes.data.name, nickname: partnerRes.data.nickname }
    }
  }

  return {
    id: r.id,
    name: r.name,
    nickname: r.nickname,
    phone: r.phone,
    birthday: r.birthday ?? undefined,
    membership_type: r.membership_type ?? null,
    membership_partner_id: r.membership_partner_id ?? null,
    membership_end_date: r.membership_end_date ?? null,
    board_slot_number: r.board_slot_number ?? null,
    board_expiry_date: r.board_expiry_date ?? null,
    board_slots,
    partner,
    balance: r.balance ?? undefined,
    vip_voucher_amount: r.vip_voucher_amount ?? undefined,
    designated_lesson_minutes: r.designated_lesson_minutes ?? undefined,
    boat_voucher_g23_minutes: r.boat_voucher_g23_minutes ?? undefined,
    boat_voucher_g21_panther_minutes: r.boat_voucher_g21_panther_minutes ?? undefined,
    gift_boat_hours: r.gift_boat_hours ?? undefined,
  }
}

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
  // 預設「我的預約」：最常使用；Tab 列亦將此分頁置左方便點選
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

  const expiryBannerLines = useMemo(() => buildLiffExpiryBannerLines(member), [member])

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

      await initLiffSdk(liffId)

      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await liff.getProfile()
      setLineUserId(profile.userId)

      // 查詢綁定資訊
      await checkBinding(profile.userId)
    } catch (err: unknown) {
      console.error('LIFF 初始化失敗:', err)
      const msg = unknownErrorMessage(err, '')
      if (msg.includes('Unable to load client features') && isFirstDocumentLoadThisNavigation()) {
        console.warn('LIFF 冷啟動失敗，自動重新載入一次（等同再開一次連結）')
        window.location.reload()
        return
      }
      setError(unknownErrorMessage(err, 'LIFF 初始化失敗'))
      setLoading(false)
    }
  }

  useEffect(() => {
    void initLiff()
    // 僅掛載時初始化 LIFF；避免依賴整包 handler 造成重複 init
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  const checkBinding = async (userId: string) => {
    try {
      // 查詢 line_bindings 表
      const { data: binding } = await supabase
        .from('line_bindings')
        .select(`member_id, members(${LIFF_MEMBER_SELECT})`)
        .eq('line_user_id', userId)
        .eq('status', 'active')
        .single()

      if (binding && binding.members) {
        const memberData = binding.members as Record<string, unknown>
        setMember(await enrichMemberForLiff(memberData))
        await loadBookings(memberData.id as string)
      } else {
        setShowBindingForm(true)
        setLoading(false)
      }
    } catch (err: unknown) {
      console.error('查詢綁定失敗:', err)
      setShowBindingForm(true)
      setLoading(false)
    }
  }

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

        type StaffJoin = { booking_id: number; coaches: { name: string } | null }
        const coachRows = (coachData ?? []) as unknown as StaffJoin[]
        const driverRows = (driverData ?? []) as unknown as StaffJoin[]

        const formattedBookings: Booking[] = bookingsData.map(booking => ({
          ...booking,
          coaches: coachRows.filter(c => c.booking_id === booking.id).map(c => c.coaches).filter(Boolean) as {
            name: string
          }[],
          drivers: driverRows.filter(d => d.booking_id === booking.id).map(d => d.coaches).filter(Boolean) as {
            name: string
          }[]
        }))

        setBookings(formattedBookings)
      } else {
        setBookings([])
      }

      setLoading(false)
    } catch (err: unknown) {
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
        .select(`member_id, members(${LIFF_MEMBER_SELECT})`)
        .eq('line_user_id', lineUserId)
        .eq('status', 'active')
        .single()

      if (binding && binding.members) {
        const memberData = binding.members as Record<string, unknown>
        setMember(await enrichMemberForLiff(memberData))
        await loadBookings(memberData.id as string)
        toast.success('資料已更新')
      }
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
        .select(LIFF_MEMBER_SELECT)
        .eq('id', memberData.id)
        .single()
      
      if (fullMemberData) {
        setMember(await enrichMemberForLiff(fullMemberData as Record<string, unknown>))
      } else {
        setMember(await enrichMemberForLiff(memberData as unknown as Record<string, unknown>))
      }
      
      setShowBindingForm(false)
      await loadBookings(memberData.id)
    } catch (err: unknown) {
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
    return (
      <ErrorView
        error={error}
        onRetry={() => {
          window.location.reload()
        }}
      />
    )
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

      {/* Content（順序與 LiffTabs：預約 → 儲值 → 會員） */}
      <div style={{ padding: '16px' }}>
        {member && expiryBannerLines.length > 0 && (
          <LiffExpiryBanner
            lines={expiryBannerLines}
            isOnProfileTab={activeTab === 'profile'}
            onOpenProfile={() => {
              triggerHaptic('light')
              setActiveTab('profile')
            }}
          />
        )}
        {activeTab === 'bookings' && (
          <BookingsList
            bookings={bookings}
            formatDate={formatDate}
            getArrivalTime={getArrivalTime}
            getStartTime={getStartTime}
            getEndTime={getEndTime}
          />
        )}

        {activeTab === 'balance' && member && (
          <BalanceView
            member={member}
            onCategoryClick={handleCategoryClick}
          />
        )}

        {activeTab === 'profile' && member && (
          <MemberProfileView member={member} />
        )}
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

