import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { RepeatBookingDialog } from '../components/RepeatBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString, getWeekdayText } from '../utils/date'
import { Footer } from '../components/Footer'
import { getButtonStyle } from '../styles/designSystem'
import { useToast, ToastContainer, BookingListSkeleton } from '../components/ui'
import { TodayOverview } from '../components/TodayOverview'
import { DailyStaffDisplay } from '../components/DailyStaffDisplay'
import { DayViewMobileHeader } from '../components/DayViewMobileHeader'
import { VirtualizedBookingList } from '../components/VirtualizedBookingList'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { injectAnimationStyles } from '../utils/animations'
import { isEditorAsync, hasViewAccess } from '../utils/auth'
import { sortBoatsByDisplayOrder } from '../utils/boatUtils'
import {
  mapBoatUnavailableRowsToBlocks,
  type BoatUnavailableBlock,
  type BoatUnavailableRow,
} from '../utils/boatUnavailableDay'
import {
  mapRestrictionViewRowsToBlocks,
  type RestrictionDayBlock,
  type RestrictionViewRow,
} from '../utils/restrictionDayBlocks'
import { BoatUnavailableDaySummary } from '../components/BoatUnavailableDaySummary'
import { trackClickDedupedWithin } from '../utils/trackClick'
// import { checkGlobalRestriction } from '../utils/restriction'

import type { Boat, Booking as BaseBooking, Coach } from '../types/booking'

interface DayViewBooking extends BaseBooking {
  boats: Boat | null
  coaches?: Coach[]
  drivers?: Coach[]
  booking_members?: { member_id: string; members?: { id: string; name: string; nickname: string | null } | null }[]
  // activity_types inherited from BaseBooking
  // schedule_notes inherited from BaseBooking
}

// Alias for internal use to match component state
type Booking = DayViewBooking

export function DayView() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || getLocalDateString()
  const { isMobile } = useResponsive()

  // 權限檢查：需要一般權限
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const canAccess = await hasViewAccess(user)
        if (!canAccess) {
          toast.error('您沒有權限訪問此頁面')
          navigate('/')
        }
      }
    }
    checkAccess()
  }, [user, navigate, toast])

  // 注入動畫樣式
  useEffect(() => {
    injectAnimationStyles()
  }, [])

  // 進入今日預約頁（單一 icon_id；短時間去重緩解 Strict Mode dev 雙次 effect）
  useEffect(() => {
    if (!user?.email) return
    trackClickDedupedWithin('day_view_open', user.email)
  }, [user?.email])

  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [conflictedIds, setConflictedIds] = useState<Set<number>>(new Set())
	const [conflictReasons, setConflictReasons] = useState<Map<number, string>>(new Map())
  const [boatUnavailableBlocks, setBoatUnavailableBlocks] = useState<BoatUnavailableBlock[]>([])
  const [restrictionDayBlocks, setRestrictionDayBlocks] = useState<RestrictionDayBlock[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [selectedTime, setSelectedTime] = useState('')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  // 小編權限（只有小編可以使用重複預約）
  const [isEditor, setIsEditor] = useState(false)
  
  useEffect(() => {
    const checkEditorPermission = async () => {
      if (user) {
        const hasPermission = await isEditorAsync(user)
        setIsEditor(hasPermission)
      }
    }
    checkEditorPermission()
  }, [user])

  const changeDate = (offset: number) => {
    const [year, month, day] = dateParam.split('-').map(Number)
    const currentDate = new Date(year, month - 1, day)
    currentDate.setDate(currentDate.getDate() + offset)
    const newDate = getLocalDateString(currentDate)
    setSearchParams({ date: newDate })
  }

  const goToToday = () => {
    const today = getLocalDateString()
    setSearchParams({ date: today })
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (next === dateParam) return
    setSearchParams({ date: next })
    if (user?.email) {
      trackClickDedupedWithin(`day_date_pick:${next}`, user.email)
    }
  }

  const fetchData = async () => {
    const isInitialLoad = boats.length === 0
    setLoading(true)

    try {
      // 並行查詢船隻與預約，兩者互相獨立
      const [boatsResult, bookingsResult] = await Promise.all([
        supabase.from('boats').select('*').order('id'),
        supabase
          .from('bookings')
          .select(`*, boats(*), booking_members(member_id, members(id, name, nickname))`)
          .gte('start_at', `${dateParam}T00:00:00`)
          .lt('start_at', `${dateParam}T23:59:59`)
          .order('start_at')
      ])

      const { data: boatsData, error: boatsError } = boatsResult
      const { data: bookingsData, error: bookingsError } = bookingsResult

      if (boatsError) {
        console.error('Error fetching boats:', boatsError)
        setLoading(false)
        return
      }

      if (isInitialLoad) {
        const sortedBoats = sortBoatsByDisplayOrder(boatsData || [])
        setBoats(sortedBoats)
      }

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
        setLoading(false)
        return
      }

      // 驗證資料完整性
      if (bookingsData) {
        bookingsData.forEach((booking, idx) => {
          if (!booking) {
            console.error(`[DayView] Booking at index ${idx} is null/undefined`)
          } else if (!booking.id) {
            console.error(`[DayView] Booking at index ${idx} has no id:`, booking)
          }
        })
      }

      await fetchBookingsWithCoaches(bookingsData || [])
    } catch (error) {
      console.error('Error in fetchData:', error)
      toast.error('載入資料時發生錯誤：' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookingsWithCoaches = async (bookingsData: any[]) => {
    if (bookingsData.length === 0) {
      setBookings([])
      computeConflicts([]).catch(err => console.error('computeConflicts error:', err))
      return
    }

    // 過濾掉 null/undefined 的 booking，並提取 ID
    const validBookings = bookingsData.filter(b => {
      if (!b) {
        console.warn('[fetchBookingsWithCoaches] Found null booking')
        return false
      }
      if (!b.id) {
        console.warn('[fetchBookingsWithCoaches] Booking without id:', b)
        return false
      }
      return true
    })

    const bookingIds = validBookings.map(b => b.id)

    // 優化：並行查詢教練和駕駛,只查詢必要欄位
    // 註：有 booking_coaches 記錄 = 指定教練
    const [coachesResult, driversResult] = await Promise.all([
      supabase
        .from('booking_coaches')
        .select('booking_id, coach_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds),
      supabase
        .from('booking_drivers')
        .select('booking_id, driver_id, coaches:driver_id(id, name)')
        .in('booking_id', bookingIds)
    ])

    if (coachesResult.error) {
      console.error('Error fetching booking coaches:', coachesResult.error)
    }
    if (driversResult.error) {
      console.error('Error fetching booking drivers:', driversResult.error)
    }

    // 使用 Map 提升查找效能（O(1) vs O(n)）
    const coachesByBooking = new Map<number, Coach[]>()
    const driversByBooking = new Map<number, Coach[]>()

    // 建立教練映射（使用 for-of 比 forEach 快）
    const coachData = coachesResult.data || []
    for (let i = 0; i < coachData.length; i++) {
      const item = coachData[i]
      // 安全檢查：確保 item 和 coaches 都不是 null
      if (!item || !item.booking_id) continue
      const coach = (item as any).coaches
      if (coach && coach.id) {
        const coaches = coachesByBooking.get(item.booking_id)
        if (coaches) {
          coaches.push(coach)
        } else {
          coachesByBooking.set(item.booking_id, [coach])
        }
      }
    }

    // 建立駕駛映射
    const driverData = driversResult.data || []
    for (let i = 0; i < driverData.length; i++) {
      const item = driverData[i]
      // 安全檢查：確保 item 和 coaches 都不是 null
      if (!item || !item.booking_id) continue
      const driver = (item as any).coaches
      if (driver && driver.id) {
        const drivers = driversByBooking.get(item.booking_id)
        if (drivers) {
          drivers.push(driver)
        } else {
          driversByBooking.set(item.booking_id, [driver])
        }
      }
    }

    // 組裝資料（避免不必要的陣列操作，並過濾 null）
    const bookingsWithCoaches = bookingsData
      .filter(booking => booking && booking.id)  // 確保 booking 不是 null
      .map(booking => {
        const coaches = coachesByBooking.get(booking.id) || []
        const drivers = driversByBooking.get(booking.id) || []

        // 深度清理：確保 coaches 和 drivers 陣列中沒有 null
        const cleanCoaches = coaches.filter((c): c is Coach => {
          if (!c || !c.id || !c.name) {
            console.warn(`[fetchBookingsWithCoaches] Removing invalid coach from booking ${booking.id}:`, c)
            return false
          }
          return true
        })

        const cleanDrivers = drivers.filter((d): d is Coach => {
          if (!d || !d.id || !d.name) {
            console.warn(`[fetchBookingsWithCoaches] Removing invalid driver from booking ${booking.id}:`, d)
            return false
          }
          return true
        })

        return {
          ...booking,
          coaches: cleanCoaches,
          drivers: cleanDrivers
        }
      })

    setBookings(bookingsWithCoaches)

    // 異步計算衝突（教練/駕駛衝突 + 全域限制）
    computeConflicts(bookingsWithCoaches).catch(err => console.error('computeConflicts error:', err))
  }

  // 當組件掛載或日期參數改變時，載入資料
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam])
  // 計算當日衝突：
  // 1) 教練/駕駛跨船重疊時段
  // 2) 與全域限制（公告）重疊
  const computeConflicts = async (dayBookings: Booking[]) => {
    try {
      const conflictSet = new Set<number>()
			const reasons = new Map<number, string>()

      // 1) 教練/駕駛重疊
      type Span = { start: number; end: number; bookingId: number; boatId: number }
      const personToSpans = new Map<string, Span[]>()
			const personIdToName = new Map<string, string>()

      for (const bk of dayBookings) {
        const start = new Date(bk.start_at)
        const startMin = start.getHours() * 60 + start.getMinutes()
        const endMin = startMin + bk.duration_min

        const addSpan = (personId: string) => {
          if (!personToSpans.has(personId)) personToSpans.set(personId, [])
          personToSpans.get(personId)!.push({ start: startMin, end: endMin, bookingId: bk.id, boatId: bk.boat_id })
        }

				for (const c of bk.coaches || []) { addSpan(c.id); if (c.name) personIdToName.set(c.id, c.name) }
				for (const d of bk.drivers || []) { addSpan(d.id); if (d.name) personIdToName.set(d.id, d.name) }
      }

			for (const [personId, spans] of personToSpans) {
        spans.sort((a, b) => a.start - b.start)
        for (let i = 0; i < spans.length; i++) {
          for (let j = i + 1; j < spans.length; j++) {
            const a = spans[i], b = spans[j]
            if (b.start >= a.end) break
            if (a.boatId !== b.boatId) {
              conflictSet.add(a.bookingId)
              conflictSet.add(b.bookingId)
							const name = personIdToName.get(personId) || '人員'
							const toTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
							const overlapText = `${name} 時間重疊 ${toTime(Math.max(a.start, b.start))}-${toTime(Math.min(a.end, b.end))}`
							if (!reasons.has(a.bookingId)) reasons.set(a.bookingId, overlapText)
							if (!reasons.has(b.bookingId)) reasons.set(b.bookingId, overlapText)
            }
          }
        }
      }

      // 2) 全域限制（公告） - 單次抓取當日限制後本地比對
      const targetDate = dateParam
      const { data: restrictionData, error: restrictionError } = await (supabase as any)
        .from('reservation_restrictions_with_announcement_view')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', targetDate)
        .gte('end_date', targetDate)

      if (!restrictionError && restrictionData && restrictionData.length > 0) {
        const resBlocks = mapRestrictionViewRowsToBlocks(
          targetDate,
          restrictionData as RestrictionViewRow[]
        )
        setRestrictionDayBlocks(resBlocks)

        for (const bk of dayBookings) {
          const start = new Date(bk.start_at)
          const startMin = start.getHours() * 60 + start.getMinutes()
          const endMin = startMin + bk.duration_min
          const hit = resBlocks.find(r => !(endMin <= r.startMin || startMin >= r.endMin))
          if (hit) {
            conflictSet.add(bk.id)
            const msg = hit.content?.trim()
            if (msg && !reasons.has(bk.id)) {
              reasons.set(bk.id, msg)
            } else if (!reasons.has(bk.id)) {
              reasons.set(bk.id, '受公告限制')
            }
          }
        }
      } else {
        setRestrictionDayBlocks([])
      }

      // 3) 船隻維修/停用 - 依當日單次抓取，依船別本地比對
      const { data: boatUnavailableData, error: boatUnavailableError } = await supabase
        .from('boat_unavailable_dates')
        .select('boat_id, start_date, start_time, end_date, end_time, reason, is_active')
        .eq('is_active', true)
        .lte('start_date', targetDate)
        .gte('end_date', targetDate)

      if (!boatUnavailableError && boatUnavailableData && boatUnavailableData.length > 0) {
        const blocks = mapBoatUnavailableRowsToBlocks(
          targetDate,
          boatUnavailableData as BoatUnavailableRow[]
        )
        setBoatUnavailableBlocks(blocks)

        for (const bk of dayBookings) {
          const start = new Date(bk.start_at)
          const startMin = start.getHours() * 60 + start.getMinutes()
          const endMin = startMin + bk.duration_min
          const hit = blocks.find(b => b.boatId === bk.boat_id && !(endMin <= b.startMin || startMin >= b.endMin))
          if (hit) {
            conflictSet.add(bk.id)
            if (hit.reason && !reasons.has(bk.id)) {
              reasons.set(bk.id, `維修：${hit.reason}`)
            } else if (!reasons.has(bk.id)) {
              reasons.set(bk.id, '維修/停用中')
            }
          }
        }
      } else {
        setBoatUnavailableBlocks([])
      }

      setConflictedIds(conflictSet)
			setConflictReasons(reasons)
    } catch (e) {
      console.error('Failed to compute conflicts:', e)
      setConflictedIds(new Set())
			setConflictReasons(new Map())
      setBoatUnavailableBlocks([])
      setRestrictionDayBlocks([])
    }
  }

  // 計算未排班數量（與排班頁面邏輯一致）
  const unassignedCount = useMemo(() => {
    return bookings.filter(booking => {
      const hasCoach = booking.coaches && booking.coaches.length > 0
      const hasDriver = booking.drivers && booking.drivers.length > 0
      const requiresDriver = booking.requires_driver === true
      
      // 未排班條件：
      // 1. 標記需要駕駛但沒有駕駛
      if (requiresDriver && !hasDriver) {
        return true
      }
      // 2. 既沒有教練也沒有駕駛
      if (!hasCoach && !hasDriver) {
        return true
      }
      return false
    }).length
  }, [bookings])

  const handleCellClick = (_boatId: number, _timeSlot: string, booking?: Booking) => {
    if (booking) {
      setSelectedBooking(booking)
      setEditDialogOpen(true)
    } else {
      // 不預設船隻和時間，讓用戶自己填
      // 但帶入當前選擇的日期
      setSelectedBoatId(0)
      const now = new Date()
      const currentHour = String(now.getHours()).padStart(2, '0')
      const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
      setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
      setDialogOpen(true)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        {/* 頭部骨架屏 */}
        <div style={{ 
          background: 'white', 
          padding: isMobile ? '16px' : '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            maxWidth: '1400px', 
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            {!isMobile && <div style={{ width: '120px', height: '40px', background: '#e0e0e0', borderRadius: '8px' }} />}
            <div style={{ width: isMobile ? '200px' : '300px', height: '40px', background: '#e0e0e0', borderRadius: '8px' }} />
            <div style={{ width: '100px', height: '40px', background: '#e0e0e0', borderRadius: '8px' }} />
          </div>
        </div>

        {/* 內容區骨架屏 */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '16px' : '20px' }}>
          <BookingListSkeleton count={8} isMobile={isMobile} />
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div 
        style={{
          padding: isMobile ? '12px' : '20px',
          height: 'auto',
          minHeight: isMobile ? '100vh' : 'auto',
          backgroundColor: '#f8f9fa',
          position: 'relative',
          overflow: 'visible',
          display: isMobile ? 'block' : 'flex',
          flexDirection: isMobile ? undefined : 'column',
        }}
      >
        <PageHeader 
          title="📅 預約列表" 
          user={user} 
        />


        {/* 手機版：兩行佈局 */}
        {isMobile ? (
          <DayViewMobileHeader
            date={dateParam}
            onDateChange={handleDateInputChange}
            onPrevDate={() => changeDate(-1)}
            onNextDate={() => changeDate(1)}
            onGoToToday={goToToday}
            showCoachAssignment={isEditor}
          />
        ) : (
          /* 桌面版：單行佈局 */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}>
            <button
            data-track="day_prev"
              onClick={() => changeDate(-1)}
              style={{
                ...getButtonStyle('outline', 'medium', false),
                padding: '8px 12px',
                fontSize: '14px',
              }}
            >
              ←
            </button>
            <input
              type="date"
              value={dateParam}
              onChange={handleDateInputChange}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                fontSize: '16px', // 16px 防止 iOS 縮放
              }}
            />
            {/* 星期幾顯示 - 獨立顯示 */}
            <span style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#f8f9fa',
              color: '#495057',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
            }}>
              {getWeekdayText(dateParam)}
            </span>
            <button
              data-track="day_next"
              onClick={() => changeDate(1)}
              style={{
                ...getButtonStyle('outline', 'medium', false),
                padding: '8px 12px',
                fontSize: '14px',
              }}
            >
              →
            </button>
            <button
              data-track="day_today"
              onClick={goToToday}
              style={{
                ...getButtonStyle('secondary', 'medium', false),
                minWidth: '100px',
                boxSizing: 'border-box'
              }}
            >
              今天
            </button>

            {/* 排班按鈕 - 只有小編可見 */}
            {isEditor && (
              <Link
                data-track="day_to_assignment"
                to={`/coach-assignment?date=${dateParam}`}
                style={{
                  ...getButtonStyle('secondary', 'medium', false),
                  textDecoration: 'none',
                  minWidth: '100px',
                  boxSizing: 'border-box'
                }}
              >
                排班
              </Link>
            )}
          </div>
        )}

        {/* 今日總覽卡片 - 僅電腦版顯示 */}
        {!isMobile && !loading && bookings.length > 0 && (
          <TodayOverview bookings={bookings} isMobile={isMobile} />
        )}

        {/* 當天可上班人員 - 電腦版：在今日總覽下方 */}
        {!isMobile && !loading && (
          <DailyStaffDisplay date={dateParam} isMobile={isMobile} unassignedCount={unassignedCount} />
        )}
        {!isMobile && !loading && (
          <BoatUnavailableDaySummary
            blocks={boatUnavailableBlocks}
            boats={boats}
            isMobile={isMobile}
            restrictionBlocks={restrictionDayBlocks}
          />
        )}

        <>
            {isMobile && !loading && (
              <>
                <DailyStaffDisplay date={dateParam} isMobile={isMobile} unassignedCount={unassignedCount} />
                <BoatUnavailableDaySummary
                  blocks={boatUnavailableBlocks}
                  boats={boats}
                  isMobile={isMobile}
                  restrictionBlocks={restrictionDayBlocks}
                />
              </>
            )}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '16px'
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #e9ecef',
                display: 'flex',
                gap: '8px',
              }}>
                <button
                  data-track="day_new_booking"
                  onClick={() => {
                    setSelectedBoatId(0)
                    const now = new Date()
                    const currentHour = String(now.getHours()).padStart(2, '0')
                    const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
                    setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
                    setDialogOpen(true)
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    borderTop: '2px dashed #ddd',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#007bff',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onTouchStart={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                  onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onTouchCancel={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  + 新增預約
                </button>
                {/* 重複預約按鈕 - 只有小編可見 */}
                {isEditor && (
                  <button
                    data-track="day_repeat_booking"
                    onClick={() => {
                      setSelectedBoatId(0)
                      const now = new Date()
                      const currentHour = String(now.getHours()).padStart(2, '0')
                      const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
                      setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
                      setRepeatDialogOpen(true)
                    }}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      borderTop: '2px dashed #ffc107',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#f57c00',
                      fontSize: '15px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3cd'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onTouchStart={(e) => e.currentTarget.style.backgroundColor = '#ffe082'}
                    onTouchEnd={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onTouchCancel={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🔁 重複預約
                  </button>
                )}
              </div>
            </div>

            <VirtualizedBookingList
              boats={boats}
              bookings={bookings}
              isMobile={isMobile}
              onBookingClick={handleCellClick}
              conflictedBookingIds={conflictedIds}
							conflictReasons={conflictReasons}
              boatUnavailableBlocks={boatUnavailableBlocks}
              restrictionDayBlocks={restrictionDayBlocks}
            />

            {/* 預約規則說明 */}
            <div style={{
              padding: isMobile ? '16px' : '20px',
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e9ecef',
              borderRadius: '0 0 8px 8px',
              textAlign: 'center',
              marginTop: '16px',
            }}>
              <div style={{
                fontWeight: '600',
                marginBottom: '12px',
                color: '#495057',
                fontSize: isMobile ? '13px' : '14px'
              }}>
                📋 預約規則
              </div>
              <div style={{
                display: 'inline-block',
                textAlign: 'left',
                fontSize: isMobile ? '12px' : '13px',
                color: '#6c757d',
                lineHeight: '1.8',
              }}>
                <div>• 船跟船間隔至少 15 分鐘；彈簧床場地可接續使用；陸上課程可重疊預約（同一時段可多筆）</div>
                <div>• 教練一律在課程結束後預留 15 分鐘緩衝</div>
                <div>• 彈簧床、陸上課程一律必須指定教練；其他船隻 08:00 前必須指定</div>
                <div>• 需先指定教練才能勾選需要駕駛，彈簧床、陸上課程不需要駕駛</div>
              </div>
            </div>
        </>

        {/* FAB 浮動新增按鈕 */}
        <button
              data-track="day_new_booking_fab"
              onClick={() => {
                setSelectedBoatId(0)
                const now = new Date()
                const currentHour = String(now.getHours()).padStart(2, '0')
                const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
                setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
                setDialogOpen(true)
              }}
              style={{
                position: 'fixed',
                bottom: isMobile ? '20px' : '30px',
                right: isMobile ? '20px' : '30px',
                width: isMobile ? '56px' : '64px',
                height: isMobile ? '56px' : '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                fontSize: isMobile ? '28px' : '32px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              +
            </button>

        <NewBookingDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSuccess={fetchData}
          defaultBoatId={selectedBoatId}
          defaultStartTime={selectedTime}
          user={user}
        />

        <RepeatBookingDialog
          isOpen={repeatDialogOpen}
          onClose={() => setRepeatDialogOpen(false)}
          onSuccess={fetchData}
          defaultBoatId={selectedBoatId}
          defaultStartTime={selectedTime}
          user={user}
        />

        <EditBookingDialog
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false)
            setSelectedBooking(null)
          }}
          onSuccess={fetchData}
          booking={selectedBooking as any}
          user={user}
        />

        <Footer />
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      </div >
    </ErrorBoundary>
  )
}
