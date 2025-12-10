import { useState, useEffect } from 'react'
import { useAuthUser } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { Footer } from '../components/Footer'
import { formatBookingsForLine, getDisplayContactName } from '../utils/bookingFormat'
import { useToast } from '../components/ui'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { BatchEditBookingDialog } from '../components/BatchEditBookingDialog'
import type { Booking as FullBooking } from '../types/booking'

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
  const [searchName, setSearchName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  // 簡化的篩選邏輯：固定為未來預約
  const [onlyToday, setOnlyToday] = useState(false) // 是否只顯示今日新增
  const [copySuccess, setCopySuccess] = useState(false)
  
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
    // 不要在這裡清空 bookings，避免顯示「沒有找到」的閃爍

    try {
      const now = new Date()
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
      
      // 步驟 1: 從多個來源查詢匹配的預約 ID
      // 1.1 從 booking_members 查詢會員名稱
      const memberQuery = supabase
        .from('booking_members')
        .select('booking_id, members:member_id!inner(name)')
        .ilike('members.name', `%${searchName.trim()}%`)
      
      // 1.2 從 bookings 表查詢 contact_name（備選方案）
      const bookingQuery = supabase
        .from('bookings')
        .select('id')
        .ilike('contact_name', `%${searchName.trim()}%`)
      
      const [memberResult, bookingResult] = await Promise.all([
        memberQuery,
        bookingQuery
      ])
      
      console.log('搜尋結果 - 會員:', memberResult.data)
      console.log('搜尋結果 - contact_name:', bookingResult.data)
      
      // 合併找到的預約 ID
      const bookingIds = new Set<number>()
      memberResult.data?.forEach(item => bookingIds.add(item.booking_id))
      bookingResult.data?.forEach(item => bookingIds.add(item.id))
      
      console.log('找到的預約 IDs:', Array.from(bookingIds))
      
      if (bookingIds.size === 0) {
        console.log('沒有找到任何預約 ID')
        setBookings([])
        setLoading(false)
        return
      }
      
      // 步驟 2: 查詢這些預約的詳細資訊
      let query = supabase
        .from('bookings')
        .select('*, boats:boat_id(name, color), booking_members(member_id, members:member_id(id, name, nickname))')
        .in('id', Array.from(bookingIds))
      
      // 固定為未來預約
      query = query.gte('start_at', nowStr)
      
      // 如果勾選「只顯示今日新增」
      if (onlyToday) {
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
        
        // 篩選今日創建的預約（created_at 不為空且在今天範圍內）
        query = query
          .not('created_at', 'is', null)
          .gte('created_at', `${todayDate}T00:00:00`)
          .lt('created_at', `${tomorrowDate}T00:00:00`)
      }
      
      // 執行預約查詢（未來預約按時間升序排列）
      const bookingsResult = await query.order('start_at', { ascending: true })

      console.log('預約詳細查詢結果:', bookingsResult.data)
      console.log('查詢錯誤:', bookingsResult.error)

      if (bookingsResult.error) {
        console.error('Error fetching bookings:', bookingsResult.error)
        console.error('Error details:', bookingsResult.error.details, bookingsResult.error.hint)
        setBookings([])
      } else if (bookingsResult.data && bookingsResult.data.length > 0) {
        // 同時查詢教練信息（重要：立即發起查詢而不是等待）
        const bookingIds = bookingsResult.data.map(b => b.id)
        const coachesResult = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds)

        if (coachesResult.error) {
          console.error('Error fetching coaches:', coachesResult.error)
        }

        // 合併教練信息
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

        const bookingsWithCoaches = bookingsResult.data.map(booking => ({
          ...booking,
          coaches: coachesByBooking[booking.id] || []
        }))

        setBookings(bookingsWithCoaches as Booking[])
      } else {
        setBookings([])
      }
    } catch (err) {
      console.error('Search error:', err)
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
    
    // 直接使用搜尋的名字作為標題
    return formatBookingsForLine(bookings, `${searchName}的預約`)
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
    if (searchName.trim()) {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent
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
    if (searchName.trim()) {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent
      handleSearch(fakeEvent)
    }
  }

  return (
    <div style={{ 
      padding: isEmbedded ? '0' : '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: isEmbedded ? 'auto' : '100vh',
      backgroundColor: isEmbedded ? 'transparent' : '#f5f5f5',
    }}>
      {!isEmbedded && <PageHeader title="🔍 預約查詢" user={user} />}

      {/* Search Form */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              預約人
            </label>
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
                e.target.style.borderColor = '#007bff'
              }}
              onBlur={(e) => {
                setTimeout(() => setShowMemberDropdown(false), 200)
                e.target.style.borderColor = '#e0e0e0'
              }}
              placeholder="搜尋會員或直接輸入姓名"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: isMobile ? '16px' : '15px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            />
            
            {showMemberDropdown && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: '500', color: '#333' }}>
                      {member.nickname || member.name}
                      {member.nickname && <span style={{ color: '#999', fontWeight: 'normal', marginLeft: '6px' }}>({member.name})</span>}
                    </div>
                    {member.phone && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        📱 {member.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 篩選選項：固定為未來預約 */}
          <div style={{ marginBottom: '20px' }}>
            {/* 今日新增 checkbox */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: onlyToday ? '#d4edda' : '#f8f9fa',
              borderRadius: '8px',
              cursor: 'pointer',
              border: onlyToday ? '2px solid #28a745' : '1px solid #e9ecef',
              transition: 'all 0.2s',
            }}>
              <input
                type="checkbox"
                checked={onlyToday}
                onChange={(e) => setOnlyToday(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: onlyToday ? '#28a745' : '#495057',
              }}>
                只顯示今日新增
              </span>
            </label>
          </div>

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              background: !loading ? 'white' : '#f5f5f5',
              color: !loading ? '#666' : '#999',
              border: !loading ? '2px solid #e0e0e0' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: !loading ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              transition: 'transform 0.1s'
            }}
            onTouchStart={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
            onTouchEnd={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div>
          {/* 只在非加载状态时显示结果统计 */}
          {!loading && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '16px',
                color: '#666',
                fontWeight: '500',
              }}>
                找到 {bookings.length} 筆預約
                {selectionMode && selectedBookingIds.size > 0 && (
                  <span style={{ color: '#007bff', marginLeft: '8px' }}>
                    （已選 {selectedBookingIds.size} 筆）
                  </span>
                )}
              </div>
              
              {bookings.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 選擇模式切換 */}
                  <button
                    onClick={toggleSelectionMode}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      background: selectionMode ? '#6c757d' : '#f8f9fa',
                      color: selectionMode ? 'white' : '#495057',
                      border: selectionMode ? 'none' : '1px solid #dee2e6',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {selectionMode ? '✕ 取消選擇' : '☑️ 批次選擇'}
                  </button>

                  {/* 選擇模式下的操作按鈕 */}
                  {selectionMode && (
                    <>
                      <button
                        onClick={selectedBookingIds.size === bookings.length ? deselectAll : selectAll}
                        style={{
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          background: '#f8f9fa',
                          color: '#495057',
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {selectedBookingIds.size === bookings.length ? '取消全選' : '全選'}
                      </button>
                      
                      {selectedBookingIds.size > 0 && (
                        <button
                          onClick={() => setBatchEditDialogOpen(true)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          ✏️ 批次修改 ({selectedBookingIds.size})
                        </button>
                      )}
                    </>
                  )}

                  {/* 複製 LINE 格式按鈕 */}
                  {!selectionMode && (
                    <button
                      onClick={handleCopyToClipboard}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: copySuccess ? '#28a745' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {copySuccess ? '✓ 已複製' : '📋 複製 LINE 格式'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 加载状态显示 */}
          {loading && (
            <div style={{
              padding: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#666',
              fontSize: '16px',
              marginBottom: '16px',
            }}>
              🔍 搜尋中...
            </div>
          )}

          {!loading && bookings.length === 0 ? (
            <div style={{
              padding: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#999',
              fontSize: '16px',
            }}>
              😔 沒有找到相關預約記錄
            </div>
          ) : bookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map((booking) => {
                const isPast = isPastBooking(booking.start_at)
                const isLoadingThis = loadingBookingId === booking.id
                const isSelected = selectedBookingIds.has(booking.id)
                return (
                  <div
                    key={booking.id}
                    onClick={(e) => {
                      if (selectionMode) {
                        toggleBookingSelection(booking.id, e)
                      } else if (!isLoadingThis) {
                        handleBookingClick(booking.id)
                      }
                    }}
                    style={{
                      padding: '16px',
                      backgroundColor: isSelected ? '#e3f2fd' : (isLoadingThis ? '#f8f9fa' : 'white'),
                      borderRadius: '8px',
                      boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${isSelected ? '#007bff' : (booking.boats?.color || '#ccc')}`,
                      opacity: isPast ? 0.7 : 1,
                      cursor: isLoadingThis ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoadingThis && !selectionMode) {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectionMode) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : '0 2px 4px rgba(0,0,0,0.1)'
                      }
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
                              borderRadius: '4px',
                              border: isSelected ? 'none' : '2px solid #dee2e6',
                              backgroundColor: isSelected ? '#007bff' : 'white',
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
                              <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                            )}
                          </div>
                        )}
                        <div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#000',
                            marginBottom: '4px',
                          }}>
                            {getDisplayContactName(booking)}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#666',
                          }}>
                            {formatDateTime(booking.start_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!selectionMode && isLoadingThis && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                          }}>
                            載入中...
                          </span>
                        )}
                        {!selectionMode && !isLoadingThis && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#e9ecef',
                            color: '#495057',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                          }}>
                            ✏️ 編輯
                          </span>
                        )}
                        {isPast && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
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
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: '#666' }}>🚤 船隻：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.boats?.name || '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>🎓 教練：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.coaches && booking.coaches.length > 0
                            ? booking.coaches.map(c => c.name).join(' / ')
                            : '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>⏱️ 時長：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.duration_min} 分
                        </span>
                      </div>
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div>
                          <span style={{ color: '#666' }}>🏄 活動：</span>
                          <span style={{ fontWeight: '500', color: '#000' }}>
                            {booking.activity_types.join(' + ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {booking.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#666',
                      }}>
                        📝 {booking.notes}
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
      />
    </div>
  )
}

