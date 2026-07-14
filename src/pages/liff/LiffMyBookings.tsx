import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import {
  addDaysToDate,
  addMinutesToTime,
  getLocalTimestamp,
  getVenueDateString,
  parseDbTimestamp,
} from '../../utils/date'
import { useToast } from '../../components/ui'
import { triggerHaptic } from '../../utils/haptic'
import type { Booking, Member, Transaction, TabType } from './types'
import {
  ErrorView,
  BindingForm,
  LiffHeader,
  LiffTabs,
  BookingsList,
  ShopOrdersList,
  BalanceView,
  MemberProfileView,
  TransactionModal,
  LiffStyles,
  LiffExpiryBanner,
  TabPanelSkeleton,
} from './components'
import { buildLiffExpiryBannerLines } from './liffExpiryAlerts'
import { liffTrack, liffTrackFlushQueueNow } from './track'
import { fetchLiffShopOrders, type LiffShopOrder } from './liffShopOrders'
import { useRouteDocumentMeta } from '../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../lib/routeOgMeta'
import { BrandCopyrightBlock } from '../../components/BrandCopyrightBlock'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { LIFF_THEME } from './liffUiStyles'
import { LiffBootScreen } from './LiffBootScreen'
import {
  enrichMemberForLiff,
  ensureLiffLoggedIn,
  initLiffSdk,
  isFirstDocumentLoadThisNavigation,
  liteMemberFromRow,
  LIFF_MEMBER_SELECT,
  unknownErrorMessage,
} from './liffMemberShared'

function startMemberBackgroundLoads(
  memberId: string,
  memberData: Record<string, unknown>,
  handlers: {
    setMember: (m: Member) => void
    setBookingsLoading: (v: boolean) => void
    setMemberEnriching: (v: boolean) => void
    loadBookings: (id: string) => Promise<void>
    loadShopOrders: (id: string, silent: boolean) => Promise<void>
  },
) {
  handlers.setBookingsLoading(true)
  handlers.setMemberEnriching(true)
  handlers.setMember(liteMemberFromRow(memberData))

  void handlers.loadBookings(memberId).finally(() => handlers.setBookingsLoading(false))

  void enrichMemberForLiff(memberData)
    .then(handlers.setMember)
    .catch(err => {
      console.warn('LIFF 會員資料 enrichment 失敗（沿用基本資料）:', err)
    })
    .finally(() => handlers.setMemberEnriching(false))

  void handlers.loadShopOrders(memberId, true)
}

export function LiffMyBookings() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff'])
  const toast = useToast()
  const [bootLoading, setBootLoading] = useState(true)
  const [bootLabel, setBootLabel] = useState('連接 LINE…')
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [memberEnriching, setMemberEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [shopOrders, setShopOrders] = useState<LiffShopOrder[]>([])
  const [loadingShopOrders, setLoadingShopOrders] = useState(false)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null)
  const [showBindingForm, setShowBindingForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [binding, setBinding] = useState(false)
  const [bindingError, setBindingError] = useState<string | null>(null)
  // 預設「預約」分頁：最常使用；Tab 列亦將此分頁置左方便點選
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
    const today = getVenueDateString()
    const yesterday = addDaysToDate(today, -1)

    if (dateStr === today) return '今天'
    if (dateStr === yesterday) return '昨天'

    const normalized = dateStr.includes('T') ? parseDbTimestamp(dateStr).date : dateStr
    const [, month, day] = normalized.split('-')
    return `${Number(month)}/${Number(day)}`
  }

  const expiryBannerLines = useMemo(() => buildLiffExpiryBannerLines(member), [member])

  const loadShopOrders = async (memberId: string, silent = false) => {
    setLoadingShopOrders(true)
    try {
      setShopOrders(await fetchLiffShopOrders(memberId))
    } catch (err: unknown) {
      console.error('載入商品訂單失敗:', err)
      if (!silent) toast.error('載入商品訂單失敗')
      setShopOrders([])
    } finally {
      setLoadingShopOrders(false)
    }
  }

  const loadBookings = async (memberId: string) => {
    try {
      const today = getVenueDateString()

      const { data: bookingMembers } = await supabase
        .from('booking_members')
        .select('booking_id')
        .eq('member_id', memberId)

      if (!bookingMembers?.length) {
        setBookings([])
        return
      }

      const bookingIds = bookingMembers.map(bm => bm.booking_id)

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

      if (bookingsData?.length) {
        const [{ data: coachData }, { data: driverData }] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id)),
          supabase
            .from('booking_drivers')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id)),
        ])

        type StaffJoin = { booking_id: number; coaches: { name: string } | null }
        const coachRows = (coachData ?? []) as unknown as StaffJoin[]
        const driverRows = (driverData ?? []) as unknown as StaffJoin[]

        setBookings(bookingsData.map(booking => ({
          ...booking,
          coaches: coachRows.filter(c => c.booking_id === booking.id).map(c => c.coaches).filter(Boolean) as { name: string }[],
          drivers: driverRows.filter(d => d.booking_id === booking.id).map(d => d.coaches).filter(Boolean) as { name: string }[],
        })))
      } else {
        setBookings([])
      }
    } catch (err: unknown) {
      console.error('載入預約失敗:', err)
      toast.error('載入預約失敗')
      setBookings([])
    }
  }

  const checkBinding = async (userId: string, displayName: string | null) => {
    try {
      const { data: binding } = await supabase
        .from('line_bindings')
        .select(`member_id, members(${LIFF_MEMBER_SELECT})`)
        .eq('line_user_id', userId)
        .eq('status', 'active')
        .single()

      if (binding?.members) {
        const memberData = binding.members as Record<string, unknown>
        const memberId = memberData.id as string
        setBootLoading(false)
        startMemberBackgroundLoads(memberId, memberData, {
          setMember,
          setBookingsLoading,
          setMemberEnriching,
          loadBookings,
          loadShopOrders,
        })
        liffTrack({
          icon_id: 'liff_open',
          line_user_id: userId,
          member_id: memberId,
          extras: { display_name: displayName ?? undefined, member_name: (memberData.name as string) ?? undefined },
        })
      } else {
        setShowBindingForm(true)
        setBootLoading(false)
        liffTrack({
          icon_id: 'liff_open',
          line_user_id: userId,
          extras: { display_name: displayName ?? undefined },
        })
      }
    } catch (err: unknown) {
      console.error('查詢綁定失敗:', err)
      setShowBindingForm(true)
      setBootLoading(false)
    }
  }

  const initLiff = async () => {
    try {
      const liffId = import.meta.env.VITE_LIFF_ID
      if (!liffId) {
        setError('LIFF ID 未設置')
        setBootLoading(false)
        return
      }

      setBootLabel('連接 LINE…')
      await initLiffSdk(liffId)

      const loginResult = await ensureLiffLoggedIn()
      if (loginResult !== 'logged_in') return

      setBootLabel('確認會員…')
      const profile = await liff.getProfile()
      setLineUserId(profile.userId)
      setLineDisplayName(profile.displayName ?? null)
      void liffTrackFlushQueueNow()

      await checkBinding(profile.userId, profile.displayName ?? null)
    } catch (err: unknown) {
      console.error('LIFF 初始化失敗:', err)
      const msg = unknownErrorMessage(err, '')
      if (msg.includes('Unable to load client features') && isFirstDocumentLoadThisNavigation()) {
        console.warn('LIFF 冷啟動失敗，自動重新載入一次（等同再開一次連結）')
        window.location.reload()
        return
      }
      setError(unknownErrorMessage(err, 'LIFF 初始化失敗'))
      setBootLoading(false)
    }
  }

  useEffect(() => {
    void initLiff()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  const refreshShopOrders = useCallback(async () => {
    if (!member?.id) return
    triggerHaptic('light')
    await loadShopOrders(member.id, true)
    toast.success('訂單已更新')
  }, [member?.id, toast])

  // 刷新資料
  const handleRefresh = async () => {
    if (!lineUserId || refreshing) return
    
    setRefreshing(true)
    setBookingsLoading(true)
    triggerHaptic('light')
    liffTrack({ icon_id: 'liff_refresh', line_user_id: lineUserId, member_id: member?.id })
    
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
        const memberId = memberData.id as string
        const [enrichedMember] = await Promise.all([
          enrichMemberForLiff(memberData),
          loadBookings(memberId),
          loadShopOrders(memberId, true),
        ])
        setMember(enrichedMember)
        toast.success('資料已更新')
      }
    } catch (err: unknown) {
      console.error('刷新失敗:', err)
      toast.error('刷新失敗')
    } finally {
      setRefreshing(false)
      setBookingsLoading(false)
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
      const twoMonthsAgoStr = addDaysToDate(getVenueDateString(), -60)

      // 查詢該類別的交易記錄
      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, category, adjust_type, transaction_type, amount, minutes, description, notes')
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
    liffTrack({ icon_id: `liff_category_click:${category}`, line_user_id: lineUserId, member_id: member.id })
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
      // 查詢會員：嘗試多種格式
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, name, nickname, phone, status')
      
      if (!allMembers || allMembers.length === 0) {
        toast.error('無法查詢會員資料，請稍後再試')
        setBinding(false)
        return
      }
      
      // 尋找匹配的會員（比對清理後的電話號碼）
      const memberData = allMembers.find(m => {
        const dbPhone = m.phone?.replace(/\D/g, '') || ''
        return dbPhone === cleanPhone && m.status === 'active'
      })

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
        const { error: updateError } = await supabase
          .from('members')
          .update({ birthday })
          .eq('id', memberData.id)
          .select()
        
        if (updateError) {
          console.error('❌ 更新生日失敗:', updateError)
          // 不阻擋綁定流程，但記錄錯誤
          toast.error('生日更新失敗，請稍後在會員資料中手動更新')
        } else {
        }
      }

      // 綁定成功 - 重新載入完整的會員資料（包含儲值欄位）
      triggerHaptic('success')

      const { data: fullMemberData } = await supabase
        .from('members')
        .select(LIFF_MEMBER_SELECT)
        .eq('id', memberData.id)
        .single()

      const dataForEnrich = (fullMemberData ?? memberData) as Record<string, unknown>
      setShowBindingForm(false)
      startMemberBackgroundLoads(memberData.id, dataForEnrich, {
        setMember,
        setBookingsLoading,
        setMemberEnriching,
        loadBookings,
        loadShopOrders,
      })
      liffTrack({ icon_id: 'liff_bind_success', line_user_id: lineUserId, member_id: memberData.id })
    } catch (err: unknown) {
      console.error('綁定失敗:', err)
      toast.error('綁定失敗')
    } finally {
      setBinding(false)
    }
  }

  const formatDate = (dateString: string) => {
    const { date } = parseDbTimestamp(dateString.length >= 16 ? dateString : `${dateString}T00:00:00`)
    const [, month, day] = date.split('-').map(Number)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const [y, mo, d] = date.split('-').map(Number)
    const weekday = weekdays[new Date(y, mo - 1, d).getDay()]
    return `週${weekday} · ${month}/${day}`
  }

  const getEndTime = (startAt: string, duration: number) =>
    addMinutesToTime(parseDbTimestamp(startAt).time, duration)

  const getArrivalTime = (startAt: string) =>
    addMinutesToTime(parseDbTimestamp(startAt).time, -30)

  const getStartTime = (startAt: string) => parseDbTimestamp(startAt).time

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
  if (bootLoading) {
    return <LiffBootScreen label={bootLabel} />
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

  // 已通過綁定閘道但會員資料尚未就緒（極短暫過渡）
  if (!member) {
    return <LiffBootScreen label="載入會員資料…" />
  }

  // 會員專區主畫面
  return (
    <div style={{
      minHeight: '100vh',
      background: ES_BRAND.pageBg
    }}>
      {/* Header */}
      <LiffHeader
        member={member}
        lineDisplayName={lineDisplayName}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Tabs */}
      <LiffTabs
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
          if (lineUserId) {
            liffTrack({ icon_id: `liff_tab_${tab}`, line_user_id: lineUserId, member_id: member?.id })
          }
        }}
      />

      {/* Content（順序：預約 → 儲值 → 商品 → 會員） */}
      <div style={{ padding: '22px 18px 10px' }}>
        {member && expiryBannerLines.length > 0 && activeTab !== 'profile' && (
          <LiffExpiryBanner
            lines={expiryBannerLines}
            onOpenProfile={() => {
              triggerHaptic('light')
              setActiveTab('profile')
            }}
          />
        )}
        <div key={activeTab} className="liff-tab-panel">
          {activeTab === 'bookings' && (
            <BookingsList
              bookings={bookings}
              loading={bookingsLoading}
              viewerMemberName={member?.nickname?.trim() || member?.name?.trim() || ''}
              formatDate={formatDate}
              getArrivalTime={getArrivalTime}
              getStartTime={getStartTime}
              getEndTime={getEndTime}
            />
          )}

          {activeTab === 'orders' && (
            <ShopOrdersList
              orders={shopOrders}
              loading={loadingShopOrders}
              onRefresh={member ? refreshShopOrders : undefined}
            />
          )}

          {activeTab === 'balance' && member && (
            <BalanceView
              member={member}
              onCategoryClick={handleCategoryClick}
            />
          )}

          {activeTab === 'profile' && memberEnriching && (
            <TabPanelSkeleton rows={5} />
          )}
          {activeTab === 'profile' && !memberEnriching && member && (
            <MemberProfileView member={member} />
          )}
        </div>
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
      <BrandCopyrightBlock
        subtitle={ES_BRAND.memberAreaLabel}
        style={{
          padding: '28px 20px 20px',
          paddingBottom: 'calc(20px + var(--safe-area-inset-bottom, 0px))',
          textAlign: 'center',
          color: LIFF_THEME.mutedLight,
          fontSize: '12px',
        }}
      />

      <LiffStyles />
    </div>
  )
}

