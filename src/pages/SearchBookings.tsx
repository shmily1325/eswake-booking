import { useState, useEffect, useMemo } from 'react'
import { useAuthUser } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { Footer } from '../components/Footer'
import { PageShell } from '../components/PageShell'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getBookingCardStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
import { formatBookingsForLine, getDisplayContactName } from '../utils/bookingFormat'
import { useToast, ToastContainer } from '../components/ui'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { BatchEditBookingDialog } from '../components/BatchEditBookingDialog'
import { BatchDeleteConfirmDialog } from '../components/BatchDeleteConfirmDialog'
import { hasEditorFeatureAsync } from '../utils/auth'
import type { Booking as FullBooking } from '../types/booking'
import {
  memberIdsMatchingKeyword,
  formatSelectedMemberHint,
} from '../utils/searchBookingMemberQuery'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  activity_types: string[] | null
  status: string
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
  booking_members?: Array<{
    member_id: string
    members: { id: string; name: string; nickname?: string | null } | null
  }>
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface SearchBookingsProps {
  isEmbedded?: boolean
}

export function SearchBookings({ isEmbedded = false }: SearchBookingsProps) {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  // 會員搜尋相關狀態
  const [searchName, setSearchName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [copySuccess, setCopySuccess] = useState(false)

  // 日期區間篩選
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 排序選項
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // 過去預約顯示
  const [showPastBookings, setShowPastBookings] = useState(true)

  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // 編輯對話框狀態
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<FullBooking | null>(null)
  const [loadingBookingId, setLoadingBookingId] = useState<number | null>(null)

  // 批次選擇模式
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<number>>(new Set())
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)

  const [canSearchBatch, setCanSearchBatch] = useState(false)

  const selectedMember = useMemo(
    () => (selectedMemberId ? members.find(m => m.id === selectedMemberId) ?? null : null),
    [selectedMemberId, members],
  )

  useEffect(() => {
    const check = async () => {
      if (!user) return
      setCanSearchBatch(await hasEditorFeatureAsync(user, 'can_search_batch'))
    }
    check()
  }, [user])

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname, phone')
      .eq('status', 'active')
      .order('name')

    if (data) {
      setMembers(data)
    }
  }

  useEffect(() => {
    if (searchName.trim()) {
      const filtered = members.filter(m =>
        m.name.toLowerCase().includes(searchName.toLowerCase()) ||
        m.nickname?.toLowerCase().includes(searchName.toLowerCase()) ||
        m.phone?.includes(searchName)
      )
      setFilteredMembers(filtered)
      setShowMemberDropdown(filtered.length > 0 && !selectedMemberId)
    } else {
      setFilteredMembers([])
      setShowMemberDropdown(false)
    }
  }, [searchName, members, selectedMemberId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchName.trim()) {
      return
    }

    setLoading(true)
    setHasSearched(true)
    setCopySuccess(false)

    try {
      const now = new Date()
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
      const searchTerm = searchName.trim()

      // 最大返回數量限制，避免返回過多資料造成卡頓
      const MAX_RESULTS = 100

      // 步驟 1: 查詢匹配的預約 ID
      const bookingIds = new Set<number>()

      if (selectedMemberId) {
        // 已從下拉選定會員：僅查此 member_id
        const { data: memberLinks } = await supabase
          .from('booking_members')
          .select('booking_id')
          .eq('member_id', selectedMemberId)
        memberLinks?.forEach(item => bookingIds.add(item.booking_id))
      } else {
        // 關鍵字模式：會員（姓名／暱稱／電話）+ contact_name（含訪客）
        const matchedMemberIds = memberIdsMatchingKeyword(members, searchTerm)
        const memberBookingPromise = matchedMemberIds.length > 0
          ? supabase
              .from('booking_members')
              .select('booking_id')
              .in('member_id', matchedMemberIds)
          : Promise.resolve({ data: [] as { booking_id: number }[], error: null })

        const [memberResult, bookingResult] = await Promise.all([
          memberBookingPromise,
          supabase
            .from('bookings')
            .select('id')
            .ilike('contact_name', `%${searchTerm}%`),
        ])

        memberResult.data?.forEach(item => bookingIds.add(item.booking_id))
        bookingResult.data?.forEach(item => bookingIds.add(item.id))
      }

      if (bookingIds.size === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      // 步驟 2: 建構詳細查詢（帶日期篩選）
      let detailQuery = supabase
        .from('bookings')
        .select('id, start_at, duration_min, contact_name, notes, activity_types, status, boats:boat_id(name, color)')
        .in('id', Array.from(bookingIds))

      // 日期區間篩選
      if (startDate) {
        detailQuery = detailQuery.gte('start_at', `${startDate}T00:00:00`)
      } else {
        detailQuery = detailQuery.gte('start_at', nowStr)
      }

      if (endDate) {
        detailQuery = detailQuery.lte('start_at', `${endDate}T23:59:59`)
      }

      // 步驟 3: 並行執行三個查詢（預約詳情 + 教練 + 會員）
      // 這是主要優化點：原本是順序執行，現在改為並行
      const idsArray = Array.from(bookingIds)

      const [bookingsResult, coachesResult, membersResult] = await Promise.all([
        detailQuery.order('start_at', { ascending: true }).limit(MAX_RESULTS),
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', idsArray),
        supabase
          .from('booking_members')
          .select('booking_id, member_id, members:member_id(id, name, nickname)')
          .in('booking_id', idsArray)
      ])

      if (bookingsResult.error) {
        console.error('Error fetching bookings:', bookingsResult.error)
        setBookings([])
        return
      }

      if (!bookingsResult.data || bookingsResult.data.length === 0) {
        setBookings([])
        return
      }

      // 建構教練對照表
      const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
      for (const item of coachesResult.data || []) {
        const bookingId = item.booking_id
        const coach = (item as any).coaches
        if (coach) {
          if (!coachesByBooking[bookingId]) {
            coachesByBooking[bookingId] = []
          }
          coachesByBooking[bookingId].push(coach)
        }
      }

      // 建構會員對照表
      const membersByBooking: { [key: number]: any[] } = {}
      for (const item of membersResult.data || []) {
        const bookingId = item.booking_id
        if (!membersByBooking[bookingId]) {
          membersByBooking[bookingId] = []
        }
        membersByBooking[bookingId].push(item)
      }

      // 合併所有資料
      const finalBookings = bookingsResult.data.map(booking => ({
        ...booking,
        coaches: coachesByBooking[booking.id] || [],
        booking_members: membersByBooking[booking.id] || []
      }))

      setBookings(finalBookings as Booking[])
    } catch (err) {
      console.error('Search error:', err)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (isoString: string) => {
    // 純字符串處理（避免時區問題）
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const [dateStr, timeStr] = datetime.split('T')
    const [year, month, day] = dateStr.split('-')

    // 計算星期幾（英文縮寫）
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = weekdays[date.getDay()]

    return `${year}/${month}/${day}(${weekday}) ${timeStr}`
  }

  const isPastBooking = (isoString: string) => {
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return datetime < nowStr
  }

  // 生成 LINE 格式的文字（簡化版）
  const generateLineMessage = () => {
    if (bookings.length === 0) return ''
    return formatBookingsForLine(bookings, `${searchName}的預約`)
  }

  // 清除搜尋
  const handleClearSearch = () => {
    setSearchName('')
    setSelectedMemberId(null)
    setBookings([])
    setHasSearched(false)
  }

  const handleCopyToClipboard = async () => {
    const message = generateLineMessage()
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('複製失敗，請手動複製')
    }
  }

  // 載入完整預約資料並打開編輯對話框
  const handleBookingClick = async (bookingId: number) => {
    setLoadingBookingId(bookingId)
    try {
      // 並行查詢所有資料（比順序執行快 3-4 倍）
      const [bookingResult, coachesResult, driversResult, membersResult] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, boats:boat_id(*)')
          .eq('id', bookingId)
          .single(),
        supabase
          .from('booking_coaches')
          .select('coaches:coach_id(*)')
          .eq('booking_id', bookingId),
        supabase
          .from('booking_drivers')
          .select('coaches:driver_id(*)')
          .eq('booking_id', bookingId),
        supabase
          .from('booking_members')
          .select('member_id')
          .eq('booking_id', bookingId),
      ])

      if (bookingResult.error) throw bookingResult.error

      // 組合完整資料
      const fullBooking: FullBooking = {
        ...bookingResult.data,
        coaches: coachesResult.data?.map(c => (c as any).coaches).filter(Boolean) || [],
        drivers: driversResult.data?.map(d => (d as any).coaches).filter(Boolean) || [],
        booking_members: membersResult.data || [],
      }

      setSelectedBookingForEdit(fullBooking)
      setEditDialogOpen(true)
    } catch (err) {
      console.error('載入預約資料失敗:', err)
      toast.error('載入預約資料失敗')
    } finally {
      setLoadingBookingId(null)
    }
  }

  // 編輯成功後重新搜尋
  const handleEditSuccess = () => {
    setEditDialogOpen(false)
    setSelectedBookingForEdit(null)
    // 重新執行搜尋
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    if (searchName.trim()) {
      handleSearch(fakeEvent)
    }
  }

  // 批次選擇相關函數
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // 關閉選擇模式時清空選擇
      setSelectedBookingIds(new Set())
    }
    setSelectionMode(!selectionMode)
  }

  const toggleBookingSelection = (bookingId: number, e: React.MouseEvent) => {
    e.stopPropagation() // 防止觸發卡片的 onClick
    const newSet = new Set(selectedBookingIds)
    if (newSet.has(bookingId)) {
      newSet.delete(bookingId)
    } else {
      newSet.add(bookingId)
    }
    setSelectedBookingIds(newSet)
  }

  const selectAll = () => {
    const allIds = new Set(bookings.map(b => b.id))
    setSelectedBookingIds(allIds)
  }

  const deselectAll = () => {
    setSelectedBookingIds(new Set())
  }

  // 批次編輯成功後
  const handleBatchEditSuccess = () => {
    setBatchEditDialogOpen(false)
    setSelectedBookingIds(new Set())
    setSelectionMode(false)
    // 重新執行搜尋
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    if (searchName.trim()) {
      handleSearch(fakeEvent)
    }
  }

  return (
    <PageShell
      variant="dashboard"
      mobilePadding={isEmbedded ? '0' : '12px'}
      desktopPadding={isEmbedded ? '0' : '20px'}
      outerStyle={isEmbedded ? { minHeight: 'auto', background: 'transparent' } : undefined}
      contentStyle={isEmbedded ? { flex: 'unset' } : undefined}
    >
      {!isEmbedded && <PageHeader title="預約查詢" user={user} />}

      {/* Search Form */}
      <div style={{
        background: designSystem.colors.background.card,
        borderRadius: designSystem.borderRadius.lg,
        padding: isMobile ? '16px' : '24px',
        marginBottom: '15px',
        boxShadow: designSystem.shadows.xs,
        border: `1px solid ${designSystem.colors.border.light}`,
      }}>
        {/* 會員搜尋表單 */}
        <form onSubmit={handleSearch}>
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{ ...getLabelStyle(isMobile), color: designSystem.colors.text.secondary }}>
              預約人
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value)
                  setSelectedMemberId(null)
                }}
                onFocus={(e) => {
                  if (filteredMembers.length > 0) {
                    setShowMemberDropdown(true)
                  }
                  e.target.style.borderColor = designSystem.colors.primary[500]
                }}
                onBlur={(e) => {
                  setTimeout(() => setShowMemberDropdown(false), 200)
                  e.target.style.borderColor = designSystem.colors.border.main
                }}
                placeholder="搜尋會員或直接輸入姓名"
                required
                style={{
                  ...getInputStyle(isMobile),
                  paddingRight: searchName ? '44px' : '16px',
                  boxSizing: 'border-box',
                }}
              />
              {/* 清除按鈕 */}
              {searchName && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '24px',
                    height: '24px',
                    padding: 0,
                    border: 'none',
                    background: designSystem.colors.background.hover,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: getFontSize('body', isMobile),
                    color: designSystem.colors.text.secondary,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = designSystem.colors.secondary[200]}
                  onMouseLeave={(e) => e.currentTarget.style.background = designSystem.colors.background.hover}
                >
                  ✕
                </button>
              )}
            </div>

            {selectedMember && (
              <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginTop: '6px' }}>
                已選：{formatSelectedMemberHint(selectedMember)} · 僅顯示此會員預約
              </div>
            )}

            {showMemberDropdown && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: designSystem.colors.background.card,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.md,
                marginTop: '4px',
                boxShadow: designSystem.shadows.sm,
                zIndex: 1000
              }}>
                {filteredMembers.map(member => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSearchName(member.nickname || member.name)
                      setSelectedMemberId(member.id)
                      setShowMemberDropdown(false)
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = designSystem.colors.background.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = designSystem.colors.background.card}
                    onTouchStart={(e) => e.currentTarget.style.backgroundColor = designSystem.colors.background.hover}
                    onTouchEnd={(e) => e.currentTarget.style.backgroundColor = designSystem.colors.background.card}
                    onTouchCancel={(e) => e.currentTarget.style.backgroundColor = designSystem.colors.background.card}
                  >
                    <div style={{ fontWeight: '500', color: designSystem.colors.text.primary }}>
                      {member.nickname || member.name}
                      {member.nickname && <span style={{ color: designSystem.colors.text.disabled, fontWeight: 'normal', marginLeft: '6px' }}>({member.name})</span>}
                    </div>
                    {member.phone && (
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginTop: '2px' }}>
                        {member.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 日期區間篩選 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: getFontSize('body', isMobile),
                fontWeight: '600',
                color: designSystem.colors.text.primary,
              }}>
                日期區間
                {(startDate || endDate)
                  ? <span style={{ color: designSystem.colors.text.secondary, marginLeft: '4px' }}>(已設定)</span>
                  : <span style={{ color: designSystem.colors.text.disabled, marginLeft: '4px', fontSize: getFontSize('bodySmall', isMobile) }}>(不設定則顯示未來預約)</span>
                }
              </span>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  style={{
                    ...getButtonStyle('outline', 'small', isMobile),
                    padding: '4px 10px',
                  }}
                >
                  清除
                </button>
              )}
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '8px',
              alignItems: isMobile ? 'stretch' : 'center',
              width: '100%',
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
              }}>
                <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, flexShrink: 0 }}>從</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    ...getInputStyle(isMobile),
                    flex: 1,
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
              }}>
                <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, flexShrink: 0 }}>到</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    ...getInputStyle(isMobile),
                    flex: 1,
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            data-track="search_submit_member"
            disabled={loading || !searchName.trim()}
            style={{
              ...getButtonStyle('primary', 'medium', isMobile),
              width: '100%',
              opacity: (!loading && searchName.trim()) ? 1 : 0.5,
              cursor: (!loading && searchName.trim()) ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? '搜尋中...' : '搜尋'}
          </button>
        </form>

      </div>

      {/* Results */}
      {hasSearched && (
        <div>
          {/* 只在非載入狀態時顯示結果統計和操作列 */}
          {!loading && (
            <>
              {/* 選擇模式：獨立的操作工具列 */}
              {selectionMode && bookings.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '12px 14px',
                  background: designSystem.colors.background.card,
                  border: `1px solid ${designSystem.colors.border.main}`,
                  borderRadius: designSystem.borderRadius.lg,
                  boxShadow: designSystem.shadows.xs,
                }}>
                  {/* 左側：已選數量 */}
                  <div style={{
                    fontSize: getFontSize('body', isMobile),
                    color: designSystem.colors.text.primary,
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  }}>
                    已選 {selectedBookingIds.size} / {bookings.length}
                  </div>

                  {/* 右側：操作按鈕 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <button
                      data-track="search_select_all"
                      onClick={selectedBookingIds.size === bookings.length ? deselectAll : selectAll}
                      style={{
                        ...getButtonStyle('outline', 'small', isMobile),
                        padding: '6px 10px',
                      }}
                    >
                      {selectedBookingIds.size === bookings.length ? '取消全選' : '全選'}
                    </button>

                    {selectedBookingIds.size > 0 && (
                      <>
                        <button
                          data-track="search_batch_edit"
                          onClick={() => setBatchEditDialogOpen(true)}
                          style={{
                            ...getButtonStyle('secondary', 'small', isMobile),
                            padding: '6px 10px',
                          }}
                        >
                          修改
                        </button>
                        <button
                          data-track="search_batch_delete"
                          onClick={() => setBatchDeleteDialogOpen(true)}
                          style={{
                            ...getButtonStyle('danger', 'small', isMobile),
                            padding: '6px 10px',
                          }}
                        >
                          刪除
                        </button>
                      </>
                    )}

                    <button
                      onClick={toggleSelectionMode}
                      style={{
                        ...getButtonStyle('ghost', 'small', isMobile),
                        padding: '6px 10px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* 非選擇模式：一般操作列 */}
              {!selectionMode && (
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}>
                  {/* 第一行/左側：結果統計 */}
                  <div style={{
                    fontSize: getFontSize('body', isMobile),
                    color: designSystem.colors.text.secondary,
                  }}>
                    找到 <strong style={{ color: designSystem.colors.text.primary }}>{bookings.length}</strong> 筆預約
                  </div>

                  {/* 第二行/右側：操作按鈕 */}
                  {bookings.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      {/* 排序按鈕 */}
                      <button
                        data-track="search_sort"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        style={{
                          ...getButtonStyle('outline', 'small', isMobile),
                          padding: isMobile ? '6px 8px' : '6px 10px',
                        }}
                      >
                        {sortOrder === 'asc' ? '近→遠' : '遠→近'}
                      </button>

                      {/* 過去預約切換 */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.secondary,
                        padding: isMobile ? '6px 8px' : '6px 10px',
                        background: showPastBookings ? designSystem.colors.background.hover : designSystem.colors.background.card,
                        border: `1px solid ${showPastBookings ? designSystem.colors.primary[500] : designSystem.colors.border.main}`,
                        borderRadius: designSystem.borderRadius.sm,
                        whiteSpace: 'nowrap',
                      }}>
                        <input
                          type="checkbox"
                          checked={showPastBookings}
                          onChange={(e) => setShowPastBookings(e.target.checked)}
                          style={{
                            width: '14px',
                            height: '14px',
                            cursor: 'pointer',
                            accentColor: designSystem.colors.primary[500],
                          }}
                        />
                        {isMobile ? '已結束' : '顯示已結束'}
                      </label>

                      {/* 批次選擇 - 只有小編可見 */}
                      {canSearchBatch && (
                        <button
                          data-track="search_batch_toggle"
                          onClick={toggleSelectionMode}
                          style={{
                            ...getButtonStyle('outline', 'small', isMobile),
                            padding: isMobile ? '6px 8px' : '6px 10px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          批次
                        </button>
                      )}

                      {/* 複製 LINE 格式按鈕 */}
                      <button
                        data-track="search_copy"
                        onClick={handleCopyToClipboard}
                        style={{
                          ...getButtonStyle(copySuccess ? 'success' : 'primary', 'small', isMobile),
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {copySuccess ? '已複製' : '複製'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: '16px',
                    backgroundColor: designSystem.colors.background.card,
                    borderRadius: designSystem.borderRadius.lg,
                    boxShadow: designSystem.shadows.xs,
                    border: `1px solid ${designSystem.colors.border.light}`,
                  }}
                >
                  {/* 標題骨架 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div
                        style={{
                          width: '120px',
                          height: '20px',
                          backgroundColor: designSystem.colors.secondary[100],
                          borderRadius: designSystem.borderRadius.sm,
                          marginBottom: '8px',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                      <div
                        style={{
                          width: '180px',
                          height: '16px',
                          backgroundColor: designSystem.colors.secondary[100],
                          borderRadius: designSystem.borderRadius.sm,
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: '50px',
                        height: '24px',
                        backgroundColor: designSystem.colors.secondary[100],
                        borderRadius: designSystem.borderRadius.sm,
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                  {/* 內容骨架 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {[1, 2, 3, 4].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: '100px',
                          height: '14px',
                          backgroundColor: designSystem.colors.secondary[100],
                          borderRadius: designSystem.borderRadius.sm,
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
              `}</style>
            </div>
          )}

          {!loading && bookings.length === 0 ? (
            <div style={{
              ...getEmptyStateStyle(isMobile),
              backgroundColor: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
              boxShadow: designSystem.shadows.xs,
            }}>
              沒有找到相關預約記錄
            </div>
          ) : bookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings
                // 過濾過去預約
                .filter(booking => showPastBookings || !isPastBooking(booking.start_at))
                // 排序
                .sort((a, b) => {
                  const comparison = a.start_at.localeCompare(b.start_at)
                  return sortOrder === 'asc' ? comparison : -comparison
                })
                .map((booking) => {
                const isPast = isPastBooking(booking.start_at)
                const isLoadingThis = loadingBookingId === booking.id
                const isSelected = selectedBookingIds.has(booking.id)
                return (
                  <div
                    key={booking.id}
                    onClick={(e) => {
                      if (selectionMode && canSearchBatch) {
                        toggleBookingSelection(booking.id, e)
                      } else if (!isLoadingThis && !selectionMode) {
                        // 所有人都可以編輯預約
                        handleBookingClick(booking.id)
                      }
                    }}
                    style={{
                      ...getBookingCardStyle(
                        isSelected ? designSystem.colors.primary[500] : (booking.boats?.color || designSystem.colors.border.dark),
                        isMobile,
                        !isLoadingThis && !selectionMode
                      ),
                      padding: '16px',
                      opacity: isPast ? 0.7 : 1,
                      cursor: isLoadingThis ? 'wait' : 'pointer',
                      position: 'relative',
                    }}
                    onTouchStart={(e) => {
                      if (!isLoadingThis && !selectionMode) {
                        e.currentTarget.style.transform = 'scale(0.99)'
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    onTouchCancel={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        {/* 選擇模式下的 Checkbox */}
                        {selectionMode && (
                          <div
                            onClick={(e) => toggleBookingSelection(booking.id, e)}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: designSystem.borderRadius.sm,
                              border: isSelected ? 'none' : `2px solid ${designSystem.colors.border.main}`,
                              backgroundColor: isSelected ? designSystem.colors.primary[500] : designSystem.colors.background.card,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                              marginTop: '2px',
                              transition: 'all 0.2s',
                            }}
                          >
                            {isSelected && (
                              <span style={{ color: 'white', fontSize: getFontSize('body', isMobile), fontWeight: 'bold' }}>✓</span>
                            )}
                          </div>
                        )}
                        <div>
                          <div style={{
                            fontSize: getFontSize('h3', isMobile),
                            fontWeight: '600',
                            color: designSystem.colors.text.primary,
                            marginBottom: '4px',
                          }}>
                            {getDisplayContactName(booking)}
                          </div>
                          <div style={{
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.secondary,
                          }}>
                            {formatDateTime(booking.start_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* 載入中提示 */}
                        {!selectionMode && isLoadingThis && (
                          <span style={{
                            ...getBadgeStyle('info'),
                          }}>
                            載入中...
                          </span>
                        )}
                        {isPast && (
                          <span style={{
                            ...getBadgeStyle('default'),
                          }}>
                            已結束
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      fontSize: getFontSize('body', isMobile),
                    }}>
                      <div>
                        <span style={{ color: designSystem.colors.text.secondary }}>船隻：</span>
                        <span style={{ fontWeight: '500', color: designSystem.colors.text.primary }}>
                          {booking.boats?.name || '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: designSystem.colors.text.secondary }}>教練：</span>
                        <span style={{ fontWeight: '500', color: designSystem.colors.text.primary }}>
                          {booking.coaches && booking.coaches.length > 0
                            ? booking.coaches.map(c => c.name).join(' / ')
                            : '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: designSystem.colors.text.secondary }}>時長：</span>
                        <span style={{ fontWeight: '500', color: designSystem.colors.text.primary }}>
                          {booking.duration_min} 分
                        </span>
                      </div>
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div>
                          <span style={{ color: designSystem.colors.text.secondary }}>活動：</span>
                          <span style={{ fontWeight: '500', color: designSystem.colors.text.primary }}>
                            {booking.activity_types.join(' + ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {booking.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: designSystem.colors.background.hover,
                        borderRadius: designSystem.borderRadius.md,
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.secondary,
                      }}>
                        {booking.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      )}

      {!isEmbedded && <Footer />}

      {/* 編輯預約對話框 */}
      {selectedBookingForEdit && user && (
        <EditBookingDialog
          // 用 booking.id 當 key，dialog 開著時切換到另一筆預約會強制 remount，
          // 避免 useBookingForm 內表單 state 殘留上一筆預約的教練/會員/時間
          key={selectedBookingForEdit.id}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false)
            setSelectedBookingForEdit(null)
          }}
          onSuccess={handleEditSuccess}
          booking={selectedBookingForEdit}
          user={user}
        />
      )}

      {/* 批次編輯對話框 */}
      <BatchEditBookingDialog
        isOpen={batchEditDialogOpen}
        onClose={() => setBatchEditDialogOpen(false)}
        onSuccess={handleBatchEditSuccess}
        bookingIds={Array.from(selectedBookingIds)}
        user={user}
      />

      {/* 批次刪除確認對話框 */}
      <BatchDeleteConfirmDialog
        isOpen={batchDeleteDialogOpen}
        onClose={() => setBatchDeleteDialogOpen(false)}
        onSuccess={handleBatchEditSuccess}
        bookingIds={Array.from(selectedBookingIds)}
        user={user}
      />

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </PageShell>
  )
}
