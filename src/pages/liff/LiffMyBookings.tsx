import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import {
  addDaysToDate,
  addMinutesToTime,
  getVenueDateString,
  parseDbTimestamp,
} from '../../utils/date'
import { ToastContainer, useToast } from '../../components/ui'
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
import { buildLiffShareUrl, getCurrentLiffDeepLinkSuffix } from './liffUrl'
import {
  bindLiffMember,
  ensureLiffLoggedIn,
  fetchLiffMemberBootstrap,
  initLiffSdk,
  fetchLiffMemberTransactions,
  unknownErrorMessage,
} from './liffMemberShared'

function startMemberBackgroundLoads(
  member: Member,
  lineUserId: string,
  handlers: {
    setMember: (m: Member) => void
    setBookingsLoading: (v: boolean) => void
    setMemberEnriching: (v: boolean) => void
    setShopOrders: (orders: LiffShopOrder[]) => void
    loadBookings: (id: string) => Promise<void>
    loadShopOrders: (id: string, silent: boolean) => Promise<void>
  },
  initialShopOrders?: LiffShopOrder[],
) {
  handlers.setBookingsLoading(true)
  handlers.setMemberEnriching(false)
  handlers.setMember(member)
  void handlers.loadBookings(member.id).finally(() => handlers.setBookingsLoading(false))
  if (initialShopOrders) {
    handlers.setShopOrders(initialShopOrders)
  } else {
    void handlers.loadShopOrders(lineUserId, true)
  }
}

export function LiffMyBookings() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff'])
  const toast = useToast()
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined
  const liffOpenUrl = liffId
    ? buildLiffShareUrl(liffId, getCurrentLiffDeepLinkSuffix())
    : null
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

  const loadShopOrders = useCallback(async (userId: string, silent = false) => {
    setLoadingShopOrders(true)
    try {
      setShopOrders(await fetchLiffShopOrders(userId))
    } catch (err: unknown) {
      console.error('載入商品訂單失敗:', err)
      if (!silent) toast.error('載入商品訂單失敗')
      setShopOrders([])
    } finally {
      setLoadingShopOrders(false)
    }
  }, [toast])

  const loadBookings = async (memberId: string) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const today = getVenueDateString()

      const { data: bookingMembers } = await supabase
        .from('booking_members')
        .select('booking_id')
        .eq('member_id', memberId)
        .abortSignal(controller.signal)

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
        .abortSignal(controller.signal)

      if (bookingsData?.length) {
        const [{ data: coachData }, { data: driverData }] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id))
            .abortSignal(controller.signal),
          supabase
            .from('booking_drivers')
            .select('booking_id, coaches:coach_id(name)')
            .in('booking_id', bookingsData.map(b => b.id))
            .abortSignal(controller.signal),
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
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      toast.error(isTimeout ? '載入預約逾時，請稍後重試' : '載入預約失敗')
      setBookings([])
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const checkBinding = async (userId: string, displayName: string | null) => {
    try {
      const bootstrap = await fetchLiffMemberBootstrap<LiffShopOrder>()
      const boundMember = bootstrap.member
      if (boundMember) {
        setBootLoading(false)
        startMemberBackgroundLoads(boundMember, userId, {
          setMember,
          setBookingsLoading,
          setMemberEnriching,
          setShopOrders,
          loadBookings,
          loadShopOrders,
        }, bootstrap.orders)
        liffTrack({
          icon_id: 'liff_open',
          line_user_id: userId,
          member_id: boundMember.id,
          extras: { display_name: displayName ?? undefined, member_name: boundMember.name },
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
      setError(unknownErrorMessage(err, '會員資料載入失敗'))
      setBootLoading(false)
    }
  }

  const initLiff = async () => {
    setError(null)
    setBootLoading(true)
    try {
      if (!liffId) {
        setError('LIFF ID 未設置')
        setBootLoading(false)
        return
      }

      setBootLabel('連接 LINE…')
      await initLiffSdk(liffId)

      const loginResult = await ensureLiffLoggedIn()
      if (loginResult === 'login_redirect') {
        setBootLabel('正在前往 LINE 登入…')
        return
      }

      setBootLabel('確認會員…')
      const profile = await liff.getProfile()
      setLineUserId(profile.userId)
      setLineDisplayName(profile.displayName ?? null)
      void liffTrackFlushQueueNow()

      await checkBinding(profile.userId, profile.displayName ?? null)
    } catch (err: unknown) {
      console.error('LIFF 初始化失敗:', err)
      setError(unknownErrorMessage(err, 'LIFF 初始化失敗'))
      setBootLoading(false)
    }
  }

  useEffect(() => {
    void initLiff()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  const refreshShopOrders = useCallback(async () => {
    if (!lineUserId) return
    triggerHaptic('light')
    await loadShopOrders(lineUserId, true)
    toast.success('訂單已更新')
  }, [lineUserId, loadShopOrders, toast])

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
      const bootstrap = await fetchLiffMemberBootstrap<LiffShopOrder>()
      const refreshedMember = bootstrap.member
      if (refreshedMember) {
        await loadBookings(refreshedMember.id)
        setMember(refreshedMember)
        setShopOrders(bootstrap.orders)
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

      if (!lineUserId) throw new Error('缺少 LINE 使用者識別')
      const result = await fetchLiffMemberTransactions(lineUserId, category, twoMonthsAgoStr)
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
      const birthday = birthYear && birthMonth && birthDay
        ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
        : null
      const boundMember = await bindLiffMember(lineUserId, phone, birthday)

      triggerHaptic('success')
      setShowBindingForm(false)
      startMemberBackgroundLoads(boundMember, lineUserId, {
        setMember,
        setBookingsLoading,
        setMemberEnriching,
        setShopOrders,
        loadBookings,
        loadShopOrders,
      })
      liffTrack({ icon_id: 'liff_bind_success', line_user_id: lineUserId, member_id: boundMember.id })
    } catch (err: unknown) {
      console.error('綁定失敗:', err)
      const message = unknownErrorMessage(err, '綁定失敗')
      setBindingError(message)
      toast.error(message)
    } finally {
      setBinding(false)
    }
  }

  const formatDate = (dateString: string) => {
    const { date } = parseDbTimestamp(dateString.length >= 16 ? dateString : `${dateString}T00:00:00`)
    const [, month, day] = date.split('-').map(Number)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const [y, mo, d] = date.split('-').map(Number)
    const weekday = weekdays[new Date(y, mo - 1, d).getDay()]
    return `${month}/${day} · ${weekday}`
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
          void initLiff()
        }}
      />
    )
  }

  // 載入中
  if (bootLoading) {
    return <LiffBootScreen label={bootLabel} onRetry={() => void initLiff()} liffOpenUrl={liffOpenUrl} />
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
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

