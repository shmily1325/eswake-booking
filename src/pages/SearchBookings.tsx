import { useState, useEffect } from 'react'
import { useAuthUser } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { Footer } from '../components/Footer'
import { formatBookingsForLine, getDisplayContactName } from '../utils/bookingFormat'
import { useToast, ToastContainer } from '../components/ui'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { BatchEditBookingDialog } from '../components/BatchEditBookingDialog'
import { BatchDeleteConfirmDialog } from '../components/BatchDeleteConfirmDialog'
import { isEditorAsync } from '../utils/auth'
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

interface Boat {
  id: number
  name: string
  color: string
}

interface Coach {
  id: string
  name: string
}

interface SearchBookingsProps {
  isEmbedded?: boolean
}

type SearchTab = 'member' | 'boat' | 'coach'

export function SearchBookings({ isEmbedded = false }: SearchBookingsProps) {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  // Tab 切換
  const [activeTab, setActiveTab] = useState<SearchTab>('member')
  
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
  
  // 船隻搜尋相關狀態
  const [boats, setBoats] = useState<Boat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState<number | null>(null)
  const [boatStartDate, setBoatStartDate] = useState('')
  const [boatEndDate, setBoatEndDate] = useState('')
  
  // 教練搜尋相關狀態
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [coachStartDate, setCoachStartDate] = useState('')
  const [coachEndDate, setCoachEndDate] = useState('')
  
  // 編輯對話框狀態
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<FullBooking | null>(null)
  const [loadingBookingId, setLoadingBookingId] = useState<number | null>(null)
  
  // 批次選擇模式
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<number>>(new Set())
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  
  // 小編權限（只有小編可以編輯和批次修改）
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

  useEffect(() => {
    loadMembers()
    loadBoats()
    loadCoaches()
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

  const loadBoats = async () => {
    const { data, error } = await supabase
      .from('boats')
      .select('id, name, color')
      .eq('is_active', true)
      .order('id')
    
    if (error) {
      console.error('載入船隻失敗:', error)
    }
    
    if (data) {
      setBoats(data)
    }
  }

  const loadCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    if (error) {
      console.error('載入教練失敗:', error)
    }
    
    if (data) {
      setCoaches(data)
    }
  }

  // 快速日期選擇輔助函數
  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // 船隻查詢的快速日期選擇
  const setBoatQuickDateRange = (type: 'today' | 'tomorrow') => {
    const today = new Date()
    let targetDate: Date

    if (type === 'today') {
      targetDate = today
    } else {
      targetDate = new Date(today)
      targetDate.setDate(today.getDate() + 1)
    }

    setBoatStartDate(formatDate(targetDate))
    setBoatEndDate(formatDate(targetDate))
  }

  // 教練查詢的快速日期選擇
  const setCoachQuickDateRange = (type: 'today' | 'tomorrow') => {
    const today = new Date()
    let targetDate: Date

    if (type === 'today') {
      targetDate = today
    } else {
      targetDate = new Date(today)
      targetDate.setDate(today.getDate() + 1)
    }

    setCoachStartDate(formatDate(targetDate))
    setCoachEndDate(formatDate(targetDate))
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
      
      // 步驟 1: 並行查詢匹配的預約 ID（從兩個來源）
      const [memberResult, bookingResult] = await Promise.all([
        // 從 booking_members 查詢會員名稱
        supabase
          .from('booking_members')
          .select('booking_id, members:member_id!inner(name)')
          .ilike('members.name', `%${searchTerm}%`),
        // 從 bookings 表查詢 contact_name
        supabase
          .from('bookings')
          .select('id')
          .ilike('contact_name', `%${searchTerm}%`)
      ])
      
      // 合併找到的預約 ID
      const bookingIds = new Set<number>()
      memberResult.data?.forEach(item => bookingIds.add(item.booking_id))
      bookingResult.data?.forEach(item => bookingIds.add(item.id))
      
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

  // 船隻預約搜尋
  const handleBoatSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBoatId) {
      toast.error('請選擇船隻')
      return
    }
    
    setLoading(true)
    setHasSearched(true)
    setCopySuccess(false)

    try {
      const MAX_RESULTS = 100
      
      // 步驟 1: 查詢該船的預約（如有日期區間則篩選，否則只顯示未來預約）
      let detailQuery = supabase
        .from('bookings')
        .select('id, start_at, duration_min, contact_name, notes, activity_types, status, boats:boat_id(name, color)')
        .eq('boat_id', selectedBoatId)
      
      if (boatStartDate && boatEndDate) {
        // 有設定日期區間
        detailQuery = detailQuery
          .gte('start_at', `${boatStartDate}T00:00:00`)
          .lte('start_at', `${boatEndDate}T23:59:59`)
      } else {
        // 沒有設定日期區間，預設只顯示未來預約
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        detailQuery = detailQuery.gte('start_at', `${todayStr}T00:00:00`)
      }
      
      const bookingsResult = await detailQuery.order('start_at', { ascending: true }).limit(MAX_RESULTS)

      if (bookingsResult.error) {
        console.error('Error fetching bookings:', bookingsResult.error)
        setBookings([])
        return
      }
      
      if (!bookingsResult.data || bookingsResult.data.length === 0) {
        setBookings([])
        return
      }

      const bookingIds = bookingsResult.data.map(b => b.id)
      
      // 步驟 2: 並行查詢教練和會員資訊
      const [coachesResult, membersResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_members')
          .select('booking_id, member_id, members:member_id(id, name, nickname)')
          .in('booking_id', bookingIds)
      ])

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

  // 教練預約搜尋
  const handleCoachSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCoachId) {
      toast.error('請選擇教練')
      return
    }
    
    setLoading(true)
    setHasSearched(true)
    setCopySuccess(false)

    try {
      const MAX_RESULTS = 100
      
      // 步驟 1: 查詢該教練的預約（透過 booking_coaches 表）
      let bookingCoachesQuery = supabase
        .from('booking_coaches')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)
      
      const bookingCoachesResult = await bookingCoachesQuery

      if (bookingCoachesResult.error) {
        console.error('Error fetching booking coaches:', bookingCoachesResult.error)
        setBookings([])
        return
      }

      if (!bookingCoachesResult.data || bookingCoachesResult.data.length === 0) {
        setBookings([])
        return
      }

      const bookingIds = bookingCoachesResult.data.map(bc => bc.booking_id)

      // 步驟 2: 查詢這些預約的詳細資料
      let detailQuery = supabase
        .from('bookings')
        .select('id, start_at, duration_min, contact_name, notes, activity_types, status, boats:boat_id(name, color)')
        .in('id', bookingIds)
      
      if (coachStartDate && coachEndDate) {
        // 有設定日期區間
        detailQuery = detailQuery
          .gte('start_at', `${coachStartDate}T00:00:00`)
          .lte('start_at', `${coachEndDate}T23:59:59`)
      } else {
        // 沒有設定日期區間，預設只顯示未來預約
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        detailQuery = detailQuery.gte('start_at', `${todayStr}T00:00:00`)
      }
      
      const bookingsResult = await detailQuery.order('start_at', { ascending: true }).limit(MAX_RESULTS)

      if (bookingsResult.error) {
        console.error('Error fetching bookings:', bookingsResult.error)
        setBookings([])
        return
      }
      
      if (!bookingsResult.data || bookingsResult.data.length === 0) {
        setBookings([])
        return
      }

      const finalBookingIds = bookingsResult.data.map(b => b.id)

      // 步驟 3: 並行查詢教練和會員資訊
      const [coachesResult, membersResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', finalBookingIds),
        supabase
          .from('booking_members')
          .select('booking_id, member_id, members:member_id(id, name, nickname)')
          .in('booking_id', finalBookingIds)
      ])

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
    
    // 根據搜尋模式決定標題
    if (activeTab === 'boat') {
      const boatName = boats.find(b => b.id === selectedBoatId)?.name || '船隻'
      const dateRange = boatStartDate === boatEndDate 
        ? boatStartDate 
        : `${boatStartDate} ~ ${boatEndDate}`
      return formatBookingsForLine(bookings, `${boatName} ${dateRange}`)
    }
    if (activeTab === 'coach') {
      const coachName = coaches.find(c => c.id === selectedCoachId)?.name || '教練'
      const dateRange = coachStartDate === coachEndDate 
        ? coachStartDate 
        : `${coachStartDate} ~ ${coachEndDate}`
      return formatBookingsForLine(bookings, `${coachName} ${dateRange}`)
    }
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
    if (activeTab === 'member' && searchName.trim()) {
      handleSearch(fakeEvent)
    } else if (activeTab === 'boat' && selectedBoatId) {
      handleBoatSearch(fakeEvent)
    } else if (activeTab === 'coach' && selectedCoachId) {
      handleCoachSearch(fakeEvent)
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
    if (activeTab === 'member' && searchName.trim()) {
      handleSearch(fakeEvent)
    } else if (activeTab === 'boat' && selectedBoatId) {
      handleBoatSearch(fakeEvent)
    } else if (activeTab === 'coach' && selectedCoachId) {
      handleCoachSearch(fakeEvent)
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

      {/* Tab 切換 */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '15px',
        background: 'white',
        borderRadius: '12px',
        padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <button
          type="button"
          data-track="search_tab_member"
          onClick={() => {
            setActiveTab('member')
            setBookings([])
            setHasSearched(false)
            setSelectionMode(false)
            setSelectedBookingIds(new Set())
          }}
          style={{
            flex: 1,
            padding: '12px 10px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'member' ? '#5a5a5a' : 'transparent',
            color: activeTab === 'member' ? 'white' : '#666',
          }}
        >
          {isMobile ? '預約人' : '👤 預約人'}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('boat')
            setBookings([])
            setHasSearched(false)
            setSelectionMode(false)
            setSelectedBookingIds(new Set())
          }}
          style={{
            flex: 1,
            padding: '12px 10px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'boat' ? '#5a5a5a' : 'transparent',
            color: activeTab === 'boat' ? 'white' : '#666',
          }}
        >
          {isMobile ? '船' : '🚤 船'}
        </button>
        <button
          type="button"
          data-track="search_tab_coach"
          onClick={() => {
            setActiveTab('coach')
            setBookings([])
            setHasSearched(false)
            setSelectionMode(false)
            setSelectedBookingIds(new Set())
          }}
          style={{
            flex: 1,
            padding: '12px 10px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'coach' ? '#5a5a5a' : 'transparent',
            color: activeTab === 'coach' ? 'white' : '#666',
          }}
        >
          {isMobile ? '教練' : '🎓 教練'}
        </button>
      </div>

      {/* Search Form */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        {/* 會員搜尋表單 */}
        {activeTab === 'member' && (
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
                  e.target.style.borderColor = '#5a5a5a'
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
                  paddingRight: searchName ? '44px' : '16px',
                  fontSize: isMobile ? '16px' : '15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
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
                    background: '#dee2e6',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    color: '#495057',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#adb5bd'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#dee2e6'}
                >
                  ✕
                </button>
              )}
            </div>
            
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
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#495057',
              }}>
                📅 日期區間
                {(startDate || endDate) 
                  ? <span style={{ color: '#5a5a5a', marginLeft: '4px' }}>(已設定)</span>
                  : <span style={{ color: '#868e96', marginLeft: '4px', fontSize: '12px' }}>(不設定則顯示未來預約)</span>
                }
              </span>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  style={{
                    padding: '4px 10px',
                    border: 'none',
                    background: '#dc3545',
                    color: 'white',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
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
                <span style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>從</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    padding: '10px',
                    border: startDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: startDate ? '#f0f7ff' : 'white',
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
                <span style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>到</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    padding: '10px',
                    border: endDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: endDate ? '#f0f7ff' : 'white',
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
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              background: (!loading && searchName.trim()) ? 'white' : '#f5f5f5',
              color: (!loading && searchName.trim()) ? '#666' : '#999',
              border: (!loading && searchName.trim()) ? '2px solid #e0e0e0' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: (!loading && searchName.trim()) ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              transition: 'transform 0.1s'
            }}
            onTouchStart={(e) => !loading && searchName.trim() && (e.currentTarget.style.transform = 'scale(0.98)')}
            onTouchEnd={(e) => !loading && searchName.trim() && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </form>
        )}

        {/* 船隻搜尋表單 */}
        {activeTab === 'boat' && (
        <form onSubmit={handleBoatSearch}>
          {/* 船隻選擇 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              選擇船隻
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {boats.map(boat => (
                <button
                  key={boat.id}
                  type="button"
                  onClick={() => setSelectedBoatId(boat.id)}
                  style={{
                    padding: '10px 16px',
                    border: selectedBoatId === boat.id ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                    borderRadius: '20px',
                    background: selectedBoatId === boat.id ? '#f0f0f0' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: boat.color || '#ccc',
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: selectedBoatId === boat.id ? '600' : '500',
                    color: selectedBoatId === boat.id ? '#5a5a5a' : '#333'
                  }}>
                    {boat.name}
                  </span>
                </button>
              ))}
            </div>
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
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#495057',
              }}>
                📅 日期區間
                {(boatStartDate || boatEndDate) 
                  ? <span style={{ color: '#5a5a5a', marginLeft: '4px' }}>(已設定)</span>
                  : <span style={{ color: '#868e96', marginLeft: '4px', fontSize: '12px' }}>(不設定則顯示未來預約)</span>
                }
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setBoatQuickDateRange('today')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    background: 'white',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057',
                    minHeight: '36px',
                  }}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => setBoatQuickDateRange('tomorrow')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    background: 'white',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057',
                    minHeight: '36px',
                  }}
                >
                  明天
                </button>
                {(boatStartDate || boatEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setBoatStartDate(''); setBoatEndDate(''); }}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: '#dc3545',
                      color: 'white',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      minHeight: '36px',
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              alignItems: 'center',
              width: '100%',
            }}>
              <input
                type="date"
                value={boatStartDate}
                onChange={(e) => setBoatStartDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px 10px',
                  border: boatStartDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: boatStartDate ? '#f0f7ff' : 'white',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '14px', color: '#999', flexShrink: 0 }}>→</span>
              <input
                type="date"
                value={boatEndDate}
                onChange={(e) => setBoatEndDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px 10px',
                  border: boatEndDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: boatEndDate ? '#f0f7ff' : 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            data-track="search_submit_boat"
            disabled={loading || !selectedBoatId}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              background: (!loading && selectedBoatId) ? 'white' : '#f5f5f5',
              color: (!loading && selectedBoatId) ? '#666' : '#999',
              border: (!loading && selectedBoatId) ? '2px solid #e0e0e0' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: (!loading && selectedBoatId) ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              transition: 'transform 0.1s'
            }}
            onTouchStart={(e) => !loading && selectedBoatId && (e.currentTarget.style.transform = 'scale(0.98)')}
            onTouchEnd={(e) => !loading && selectedBoatId && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </form>
        )}

        {/* 教練搜尋表單 */}
        {activeTab === 'coach' && (
        <form onSubmit={handleCoachSearch}>
          {/* 教練選擇 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              選擇教練
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {coaches.map(coach => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => setSelectedCoachId(coach.id)}
                  style={{
                    padding: '10px 16px',
                    border: selectedCoachId === coach.id ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                    borderRadius: '20px',
                    background: selectedCoachId === coach.id ? '#f0f0f0' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{
                    fontSize: '14px',
                    fontWeight: selectedCoachId === coach.id ? '600' : '500',
                    color: selectedCoachId === coach.id ? '#5a5a5a' : '#333'
                  }}>
                    {coach.name}
                  </span>
                </button>
              ))}
            </div>
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
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#495057',
              }}>
                📅 日期區間
                {(coachStartDate || coachEndDate) 
                  ? <span style={{ color: '#5a5a5a', marginLeft: '4px' }}>(已設定)</span>
                  : <span style={{ color: '#868e96', marginLeft: '4px', fontSize: '12px' }}>(不設定則顯示未來預約)</span>
                }
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCoachQuickDateRange('today')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    background: 'white',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057',
                    minHeight: '36px',
                  }}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => setCoachQuickDateRange('tomorrow')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dee2e6',
                    background: 'white',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057',
                    minHeight: '36px',
                  }}
                >
                  明天
                </button>
                {(coachStartDate || coachEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setCoachStartDate(''); setCoachEndDate(''); }}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: '#dc3545',
                      color: 'white',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      minHeight: '36px',
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              alignItems: 'center',
              width: '100%',
            }}>
              <input
                type="date"
                value={coachStartDate}
                onChange={(e) => setCoachStartDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px 10px',
                  border: coachStartDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: coachStartDate ? '#f0f7ff' : 'white',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '14px', color: '#999', flexShrink: 0 }}>→</span>
              <input
                type="date"
                value={coachEndDate}
                onChange={(e) => setCoachEndDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px 10px',
                  border: coachEndDate ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: coachEndDate ? '#f0f7ff' : 'white',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            data-track="search_submit_coach"
            disabled={loading || !selectedCoachId}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              background: (!loading && selectedCoachId) ? 'white' : '#f5f5f5',
              color: (!loading && selectedCoachId) ? '#666' : '#999',
              border: (!loading && selectedCoachId) ? '2px solid #e0e0e0' : '2px solid #ddd',
              borderRadius: '8px',
              cursor: (!loading && selectedCoachId) ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              transition: 'transform 0.1s'
            }}
            onTouchStart={(e) => !loading && selectedCoachId && (e.currentTarget.style.transform = 'scale(0.98)')}
            onTouchEnd={(e) => !loading && selectedCoachId && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </form>
        )}
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
                  padding: '10px 12px',
                  background: '#5a5a5a',
                  borderRadius: '8px',
                }}>
                  {/* 左側：已選數量 */}
                  <div style={{
                    fontSize: '14px',
                    color: 'white',
                    fontWeight: '500',
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
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '5px',
                        cursor: 'pointer',
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
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ 修改
                        </button>
                        <button
                          data-track="search_batch_delete"
                          onClick={() => setBatchDeleteDialogOpen(true)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ 刪除
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={toggleSelectionMode}
                      style={{
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: 'transparent',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '5px',
                        cursor: 'pointer',
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
                    fontSize: '14px',
                    color: '#666',
                  }}>
                    找到 <strong style={{ color: '#5a5a5a' }}>{bookings.length}</strong> 筆預約
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
                          padding: isMobile ? '6px 8px' : '6px 10px',
                          border: '1px solid #dee2e6',
                          background: 'white',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '500',
                          color: '#495057',
                        }}
                      >
                        {sortOrder === 'asc' ? '⬆️ 近→遠' : '⬇️ 遠→近'}
                      </button>

                      {/* 過去預約切換 */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: isMobile ? '12px' : '13px',
                        color: '#666',
                        padding: isMobile ? '6px 8px' : '6px 10px',
                        background: showPastBookings ? '#f0f0f0' : 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px',
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
                            accentColor: '#5a5a5a',
                          }}
                        />
                        {isMobile ? '已結束' : '顯示已結束'}
                      </label>

                      {/* 批次選擇 - 只有小編可見 */}
                      {isEditor && (
                        <button
                          data-track="search_batch_toggle"
                          onClick={toggleSelectionMode}
                          style={{
                            padding: isMobile ? '6px 8px' : '6px 10px',
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: '500',
                            background: 'white',
                            color: '#495057',
                            border: '1px solid #dee2e6',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ☑️ 批次
                        </button>
                      )}

                      {/* 複製 LINE 格式按鈕 - 只在預約人頁面顯示 */}
                      {activeTab === 'member' && (
                        <button
                          data-track="search_copy"
                          onClick={handleCopyToClipboard}
                          style={{
                            padding: isMobile ? '6px 8px' : '6px 10px',
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: '500',
                            background: copySuccess ? '#28a745' : '#5a5a5a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {copySuccess ? '✓ 已複製' : '📋 複製'}
                        </button>
                      )}
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
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderLeft: '4px solid #e9ecef',
                  }}
                >
                  {/* 標題骨架 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div
                        style={{
                          width: '120px',
                          height: '20px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                      <div
                        style={{
                          width: '180px',
                          height: '16px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: '50px',
                        height: '24px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '4px',
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
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
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
                      if (selectionMode && isEditor) {
                        toggleBookingSelection(booking.id, e)
                      } else if (!isLoadingThis && !selectionMode) {
                        // 所有人都可以編輯預約
                        handleBookingClick(booking.id)
                      }
                    }}
                    style={{
                      padding: '16px',
                      backgroundColor: isSelected ? '#f5f5f5' : (isLoadingThis ? '#f8f9fa' : 'white'),
                      borderRadius: '8px',
                      boxShadow: isSelected ? '0 2px 8px rgba(90,90,90,0.25)' : '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${isSelected ? '#5a5a5a' : (booking.boats?.color || '#ccc')}`,
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
                        e.currentTarget.style.boxShadow = isSelected ? '0 2px 8px rgba(90,90,90,0.25)' : '0 2px 4px rgba(0,0,0,0.1)'
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
                              backgroundColor: isSelected ? '#5a5a5a' : 'white',
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
                        {/* 載入中提示 */}
                        {!selectionMode && isLoadingThis && (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#5a5a5a',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                          }}>
                            載入中...
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
    </div>
  )
}

