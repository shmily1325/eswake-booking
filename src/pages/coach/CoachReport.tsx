import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { CoachReportFormDialog } from '../../components/CoachReportFormDialog'
import { useResponsive } from '../../hooks/useResponsive'
import { useMemberSearch } from '../../hooks/useMemberSearch'
import { getCardStyle } from '../../styles/designSystem'
import { Button, useToast, ToastContainer } from '../../components/ui'
import { isFacility } from '../../utils/facility'
import { getLocalDateString, getLocalTimestamp, getWeekdayText } from '../../utils/date'
import { extractDate, extractTime } from '../../utils/formatters'
import { getDisplayContactName } from '../../utils/bookingFormat'
import { splitAndDeduplicateNames } from '../../utils/memberUtils'
import {
  calculateIsTeaching,
  calculateParticipantStatus
} from '../../utils/participantValidation'
import {
  assembleBookingsWithRelations,
  extractAvailableCoaches,
  filterBookingsByCoach,
  filterUnreportedBookings,
  fetchBookingRelations
} from '../../utils/bookingDataHelpers'
import type {
  Coach,
  Booking,
  Participant
} from '../../types/booking'
import type { Database } from '../../types/supabase'

interface MemberSearchResult {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' }
]

const LESSON_TYPES = [
  { value: 'undesignated', label: '不指定' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]

interface CoachReportProps {
  autoFilterByUser?: boolean // 是否自動根據登入用戶篩選教練
  embedded?: boolean // 是否嵌入在其他頁面中（隱藏 PageHeader）
  defaultViewMode?: 'date' | 'unreported' // 預設視圖模式
  hideInternalTabs?: boolean // 是否隱藏內部的 tab 切換
}

export function CoachReport({ 
  autoFilterByUser = false, 
  embedded = false,
  defaultViewMode = 'unreported',
  hideInternalTabs = false
}: CoachReportProps = {}) {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  
  // 日期和教練篩選
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all') // 默認顯示"全部"
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]) // 當天有預約的教練
  const [viewMode, setViewMode] = useState<'date' | 'unreported'>(defaultViewMode)
  
  // 保留這些變數以支援未來的內部 tab 切換功能
  void hideInternalTabs // 用於控制是否顯示內部 tabs
  void setViewMode // 用於切換 date/unreported 模式
  const [userCoachId, setUserCoachId] = useState<string | null>(null) // 登入用戶對應的教練 ID
  
  // 預約列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([]) // 用於統計
  const [loading, setLoading] = useState(true) // 初始為 true 避免閃爍
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null) // 最後刷新時間
  
  // 回報表單
  const [reportingBookingId, setReportingBookingId] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'coach' | 'driver' | 'both'>('coach')
  const [reportingCoachId, setReportingCoachId] = useState<string | null>(null)
  const [reportingCoachName, setReportingCoachName] = useState<string>('')
  const [driverDuration, setDriverDuration] = useState<number>(0)
  const [originalDriverDuration, setOriginalDriverDuration] = useState<number | null>(null) // 用於比較是否有變更
  const [participants, setParticipants] = useState<Participant[]>([])
  const [originalParticipants, setOriginalParticipants] = useState<Participant[]>([]) // 用於比較是否有變更
  
  // 會員搜尋
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null)  // 追蹤正在搜尋的參與者索引
  const { 
    filteredMembers,
    handleSearchChange 
  } = useMemberSearch()
  
  // 提交狀態
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 載入教練列表
  useEffect(() => {
    loadCoaches()
  }, [])

  // 如果是自動篩選模式，載入用戶對應的教練 ID
  useEffect(() => {
    if (autoFilterByUser && user?.email) {
      loadUserCoach()
    }
  }, [autoFilterByUser, user?.email])

  // 載入預約列表
  useEffect(() => {
    // 在自動篩選模式下，等待 userCoachId 載入完成後才載入預約
    if (autoFilterByUser && !userCoachId) {
      return
    }
    loadBookings()
  }, [selectedDate, selectedCoachId, viewMode, autoFilterByUser, userCoachId])

  // 自動刷新：每 30 秒重新載入列表（只在沒開對話框時）
  useEffect(() => {
    const interval = setInterval(() => {
      // 只有在對話框關閉時才刷新，避免打擾正在填表單的人
      if (!reportingBookingId) {
        loadBookings(true) // 靜默刷新，不顯示 loading
      }
    }, 30000) // 30秒
    
    return () => clearInterval(interval)
  }, [reportingBookingId, selectedDate, selectedCoachId, viewMode, autoFilterByUser, userCoachId])

  useEffect(() => {
    handleSearchChange(memberSearchTerm)
  }, [memberSearchTerm, handleSearchChange])

  const loadCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, status, notes, created_at, updated_at, user_email, designated_lesson_price_30min')
      .eq('status', 'active')
      .order('name')
    
    if (error) {
      console.error('載入教練列表失敗:', error)
      return
    }
    
    setCoaches(data || [])
  }

  const loadUserCoach = async () => {
    if (!user?.email) return

    const { data, error } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_email', user.email)
      .single()

    if (error) {
      console.error('查找用戶對應的教練失敗:', error)
      toast.error('無法找到您對應的教練帳號，請聯繫管理員設定')
      return
    }

    if (data) {
      setUserCoachId(data.id)
      setSelectedCoachId(data.id) // 自動選擇該教練
      console.log('✅ 自動篩選模式：已設定教練 ID =', data.id)
    } else {
      toast.error('您的帳號尚未配對教練，請聯繫管理員')
    }
  }

  const loadBookings = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id, start_at, duration_min, contact_name, notes, boat_id, requires_driver, status, is_coach_practice,
          boats(name, color),
          booking_members(member_id, members:member_id(id, name, nickname))
        `)
        .eq('status', 'confirmed')
        .eq('is_coach_practice', false)  // 過濾教練練習
        .order('start_at')

      if (viewMode === 'date') {
        const startOfDay = `${selectedDate}T00:00:00`
        const endOfDay = `${selectedDate}T23:59:59`
        bookingsQuery = bookingsQuery
          .gte('start_at', startOfDay)
          .lte('start_at', endOfDay)
      } else {
        // 待回報模式：顯示過去 90 天內未回報的預約
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        const ninetyDaysAgoStr = getLocalDateString(ninetyDaysAgo) + 'T00:00:00'
        bookingsQuery = bookingsQuery.gte('start_at', ninetyDaysAgoStr)
      }

      const { data: bookingsData, error: bookingsError } = await bookingsQuery

      if (bookingsError) throw bookingsError

      const now = new Date()
      const validBookings = (bookingsData || []).filter(b => {
        const bookingEnd = new Date(new Date(b.start_at).getTime() + b.duration_min * 60000)
        return bookingEnd <= now
      })

      const bookingIds = validBookings.map(b => b.id)
      if (bookingIds.length === 0) {
        setBookings([])
        setAllBookings([])
        setAvailableCoaches([])
        return
      }

      // 使用輔助函數查詢和組裝關聯數據
      const relations = await fetchBookingRelations(bookingIds)
      const bookingsWithRelations = assembleBookingsWithRelations(validBookings as any, relations)

      let filteredBookings = bookingsWithRelations
      
      // 保存所有預約用於統計（按日期模式時）
      if (viewMode === 'date') {
        let statsBookings = bookingsWithRelations
        if (selectedCoachId !== 'all') {
          statsBookings = statsBookings.filter((booking: any) => {
            const isCoach = booking.coaches.some((c: any) => c.id === selectedCoachId)
            const isDriver = booking.drivers.some((d: any) => d.id === selectedCoachId)
            return isCoach || isDriver
          })
        }
        setAllBookings(statsBookings)
        
        // 使用輔助函數提取當天有預約的教練
        const availableCoachList = extractAvailableCoaches(bookingsWithRelations)
        setAvailableCoaches(availableCoachList)
        
        // 如果當前選中的教練不在可用列表中，切換到"全部"（但在自動篩選模式下不切換）
        if (!autoFilterByUser && selectedCoachId !== 'all' && !availableCoachList.some(c => c.id === selectedCoachId)) {
          setSelectedCoachId('all')
        }
      } else {
        setAllBookings([])
        // 在自動篩選模式下，只顯示當前教練
        if (autoFilterByUser && userCoachId) {
          const currentCoach = coaches.find(c => c.id === userCoachId)
          setAvailableCoaches(currentCoach ? [currentCoach] : [])
        } else {
          setAvailableCoaches(coaches) // 未回報模式顯示所有教練
        }
      }

      // 使用輔助函數篩選預約
      // 在自動篩選模式下，強制使用 userCoachId
      const coachIdToFilter = autoFilterByUser && userCoachId ? userCoachId : selectedCoachId
      filteredBookings = filterBookingsByCoach(filteredBookings, coachIdToFilter)

      if (viewMode === 'unreported') {
        filteredBookings = filterUnreportedBookings(
          filteredBookings,
          selectedCoachId,
          getReportType,
          getReportStatus
        )
      }

      setBookings(filteredBookings)
      setLastRefreshTime(new Date()) // 記錄刷新時間
    } catch (error) {
      console.error('載入預約失敗:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const getReportType = (booking: Booking, coachId: string): 'coach' | 'driver' | 'both' | null => {
    const isCoach = (booking.coaches || []).some(c => c.id === coachId)
    const isExplicitDriver = (booking.drivers || []).some(d => d.id === coachId)
    const hasNoDriver = (booking.drivers || []).length === 0
    const hasNoCoach = (booking.coaches || []).length === 0
    
    const boatName = booking.boats?.name || ''
    const isFacilityBooking = isFacility(boatName)
    
    // 重要：只有在「當前」沒有駕駛員的情況下，教練才能作為隱性駕駛
    // 如果已經指定了駕駛員，教練就不能回報駕駛時長
    const isImplicitDriver = isCoach && hasNoDriver && !isFacilityBooking
    
    const needsCoachReport = isCoach
    const needsDriverReport = isExplicitDriver || isImplicitDriver
    
    // 純駕駛的預約（沒有教練，只有駕駛）需要同時回報駕駛時數和參與者
    if (hasNoCoach && isExplicitDriver) {
      return 'both'
    }
    
    if (needsCoachReport && needsDriverReport) {
      return 'both'
    } else if (needsCoachReport) {
      return 'coach'
    } else if (needsDriverReport) {
      return 'driver'
    }
    
    return null
  }

  const getReportStatus = (booking: Booking, coachId: string) => {
    const type = getReportType(booking, coachId)
    if (!type) return { hasCoachReport: false, hasDriverReport: false }
    
    // 業務邏輯：每個教練必須分別提交回報
    // 檢查這個特定教練是否在 coach_reports 中有記錄（無論是否有參與者）
    const hasCoachReport = !!(booking.coach_reports && 
      booking.coach_reports.some(r => r.coach_id === coachId))
    
    // 駕駛時數：檢查這個特定教練是否回報過駕駛時數（driver_duration_min 有值）
    const hasDriverReport = !!(booking.coach_reports && 
      booking.coach_reports.some(r => r.coach_id === coachId && r.driver_duration_min !== null))
    
    return { hasCoachReport, hasDriverReport }
  }

  const startReportWithCoach = (booking: Booking, coachId: string) => {
    const type = getReportType(booking, coachId)
    if (!type) return
    
    const coach = (booking.coaches || []).find(c => c.id === coachId) || (booking.drivers || []).find(d => d.id === coachId)
    const coachName = coach?.name || ''
    
    setReportingBookingId(booking.id)
    setReportType(type)
    setReportingCoachId(coachId)
    setReportingCoachName(coachName)
    
    // 找到這個教練的駕駛回報記錄
    const myDriverReport = booking.coach_reports?.find(r => r.coach_id === coachId)
    if (myDriverReport) {
      const duration = myDriverReport.driver_duration_min || 0
      setDriverDuration(duration)
      setOriginalDriverDuration(duration) // 保存原始值用於比較
    } else {
      setDriverDuration(booking.duration_min)
      setOriginalDriverDuration(null) // 沒有舊記錄
    }
    
    // 檢查這個教練是否已有回報記錄
    const existingParticipants = booking.participants?.filter(p => p.coach_id === coachId) || []
    
    if (existingParticipants.length > 0) {
      // 這個教練已有回報，載入現有記錄
      setParticipants(existingParticipants)
      // 深拷貝保存原始資料，用於比較是否有變更
      setOriginalParticipants(JSON.parse(JSON.stringify(existingParticipants)))
    } else {
      // 這個教練尚未回報，自動帶入會員（排除其他教練已回報的）
      setOriginalParticipants([]) // 新回報沒有原始資料
      loadBookingMembers(booking.id, booking.duration_min)
    }
  }

  const loadBookingMembers = async (bookingId: number, defaultDuration: number) => {
    try {
      type BookingMemberWithMember = {
        member_id: string
        members: {
          id: string
          name: string
          nickname: string | null
        } | null
      }

      const { data: bookingMembersData } = await supabase
        .from('booking_members')
        .select('member_id, members:member_id(id, name, nickname)')
        .eq('booking_id', bookingId)

      const { data: reportedParticipants } = await supabase
        .from('booking_participants')
        .select('member_id, participant_name, coach_id')
        .eq('booking_id', bookingId)
        .eq('is_deleted', false)
        .not('coach_id', 'is', null)

      const reportedMemberIds = new Set<string>()
      const reportedNames = new Set<string>()
      if (reportedParticipants) {
        reportedParticipants.forEach(rp => {
          if (rp.coach_id !== reportingCoachId) {
            if (rp.member_id) reportedMemberIds.add(rp.member_id)
            if (rp.participant_name) reportedNames.add(rp.participant_name.trim())
          }
        })
      }

      const availableMembers = (bookingMembersData as BookingMemberWithMember[] || []).filter(
        (bm) => !reportedMemberIds.has(bm.member_id)
      )

      const participants: Participant[] = []
      const addedMemberIds = new Set<string>()
      
      availableMembers.forEach((bm) => {
        const member = bm.members
        if (!member) return // 跳過沒有會員資訊的記錄
        
        addedMemberIds.add(bm.member_id)
        participants.push({
          id: 0,
          booking_id: bookingId,
          coach_id: reportingCoachId,
          member_id: bm.member_id,
          participant_name: member.nickname || member.name,
          duration_min: defaultDuration,
          payment_method: 'cash',
          lesson_type: 'undesignated',  // 默认不指定
          status: 'pending',
          created_at: null,
          created_by_email: null,
          updated_at: null,
          updated_by_email: null,
          deleted_at: null,
          is_deleted: null,
          is_teaching: null,
          notes: null,
          replaced_by_id: null,
          replaces_id: null,
          reported_at: null,
          transaction_id: null
        })
      })

      const booking = bookings.find(b => b.id === bookingId)
      if (booking) {
        // 使用去重函數處理預約人名單
        const contactNames = splitAndDeduplicateNames(booking.contact_name)
        contactNames.forEach(contactName => {
          if (!reportedNames.has(contactName) && !participants.some(p => p.participant_name === contactName)) {
            const isExistingMember = participants.some(p => 
              p.participant_name.includes(contactName) || contactName.includes(p.participant_name)
            )
            
            if (!isExistingMember) {
              participants.push({
                id: 0,
                booking_id: bookingId,
                coach_id: reportingCoachId,
                member_id: null,
                participant_name: contactName,
                duration_min: defaultDuration,
                payment_method: 'cash',
                lesson_type: 'undesignated',  // 默认不指定
                status: 'not_applicable',
                created_at: null,
                created_by_email: null,
                updated_at: null,
                updated_by_email: null,
                deleted_at: null,
                is_deleted: null,
                is_teaching: null,
                notes: null,
                replaced_by_id: null,
                replaces_id: null,
                reported_at: null,
                transaction_id: null
              })
            }
          }
        })
      }

      if (participants.length === 0) {
        participants.push({
          id: 0,
          booking_id: bookingId,
          coach_id: reportingCoachId,
          member_id: null,
          participant_name: '',
          duration_min: defaultDuration,
          payment_method: 'cash',
          lesson_type: 'undesignated',  // 默认不指定
          status: 'pending',
          created_at: null,
          created_by_email: null,
          updated_at: null,
          updated_by_email: null,
          deleted_at: null,
          is_deleted: null,
          is_teaching: null,
          notes: null,
          replaced_by_id: null,
          replaces_id: null,
          reported_at: null,
          transaction_id: null
        })
      }

      setParticipants(participants)
    } catch (error) {
      console.error('載入會員失敗:', error)
    }
  }

  const submitReport = async () => {
    // 防止重複提交
    if (isSubmitting) {
      console.log('⚠️ 正在提交中，請勿重複點擊')
      return
    }
    
    // 驗證用戶登入狀態（防止 session 過期時提交）
    if (!user?.email) {
      toast.error('連線逾時，請重新整理頁面後再提交')
      console.error('❌ 提交失敗：user.email 不存在', { user, hasUser: !!user })
      // 嘗試重新取得 session 資訊幫助診斷
      const { data: sessionData } = await supabase.auth.getSession()
      console.error('❌ Session 狀態:', { 
        hasSession: !!sessionData.session,
        sessionEmail: sessionData.session?.user?.email 
      })
      return
    }
    
    // 先收起手機鍵盤，避免畫面跳動
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    
    setIsSubmitting(true)
    try {
      if (reportType === 'driver' || reportType === 'both') {
        await submitDriverReport()
      }
      
      if (reportType === 'coach' || reportType === 'both') {
        await submitCoachReport()
      }
      
      toast.success('回報成功！')
      setReportingBookingId(null)
      
      // 稍微延遲載入，確保對話框先關閉
      setTimeout(() => {
        loadBookings()
        // 捲動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('提交回報失敗:', error)
      // 顯示錯誤訊息給用戶
      if (error instanceof Error) {
        // 用戶主動取消不需要顯示錯誤
        if (error.message !== '用戶取消操作') {
          toast.error(`提交失敗：${error.message}`)
        }
      } else {
        toast.error('提交失敗，請重試')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitDriverReport = async () => {
    if (!reportingBookingId || !reportingCoachId) return

    const booking = bookings.find(b => b.id === reportingBookingId)
    if (!booking) return
    
    // 檢查當前角色是否應該回報駕駛
    const reportType = getReportType(booking, reportingCoachId)
    const shouldReportDriver = reportType === 'driver' || reportType === 'both'
    
    if (!shouldReportDriver) {
      // 如果不應該回報駕駛（例如預約現在有明確的駕駛員了），刪除舊的駕駛回報記錄
      console.log('清除不該有的駕駛回報記錄:', {
        booking_id: reportingBookingId,
        coach_id: reportingCoachId
      })
      
      const { error: deleteError } = await supabase
        .from('coach_reports')
        .delete()
        .eq('booking_id', reportingBookingId)
        .eq('coach_id', reportingCoachId)
      
      if (deleteError) {
        console.error('刪除駕駛回報失敗:', deleteError)
      }
      return
    }

    // 檢查駕駛時數是否有變更
    const driverDurationChanged = originalDriverDuration === null || originalDriverDuration !== driverDuration
    
    console.log('提交駕駛回報:', {
      booking_id: reportingBookingId,
      coach_id: reportingCoachId,
      driver_duration_min: driverDuration,
      original_duration: originalDriverDuration,
      has_changes: driverDurationChanged
    })

    // 如果沒有變更，跳過更新
    if (!driverDurationChanged) {
      console.log('駕駛時數沒有變更，跳過更新')
      return
    }

    const { error } = await supabase
      .from('coach_reports')
      .upsert({
        booking_id: reportingBookingId,
        coach_id: reportingCoachId,
        driver_duration_min: driverDuration,
        reported_at: getLocalTimestamp()
      }, {
        onConflict: 'booking_id,coach_id'
      })

    if (error) {
      console.error('提交駕駛回報失敗:', error)
      throw new Error(`提交駕駛回報失敗: ${error.message}`)
    }
  }

  const submitCoachReport = async () => {
    if (!reportingBookingId || !reportingCoachId) {
      toast.warning('缺少必要資訊')
      return
    }

    try {
      // 檢查是否有空的參與者
      const emptyParticipants = participants.filter(p => !p.participant_name.trim())
      if (emptyParticipants.length > 0) {
        const confirmMsg = `⚠️ 提醒\n\n有 ${emptyParticipants.length} 個空的參與者未填寫姓名，將不會被提交。\n\n確定要繼續提交嗎？`
        if (!confirm(confirmMsg)) {
          return
        }
      }
      
      // 允許單個教練不回報參與者（其他教練可能已經回報了）
      // 只過濾掉空名字的參與者，不強制要求至少一個
      const validParticipants = participants.filter(p => p.participant_name.trim())
      
      // 驗證時數（允許空值，但不能是 0 或負數）
      const invalidDuration = validParticipants.find(p => {
        const duration = Number(p.duration_min)
        return isNaN(duration) || duration <= 0
      })
      if (invalidDuration) {
        toast.warning(`「${invalidDuration.participant_name || '未命名'}」的時數必須大於 0`)
        return
      }
      
      // 檢查：如果是「會員」狀態但沒有選擇具體會員，提示用戶
      const memberStatusWithoutId = validParticipants.filter(
        p => p.status === 'pending' && !p.member_id
      )
      
      if (memberStatusWithoutId.length > 0) {
        const names = memberStatusWithoutId.map(p => p.participant_name || '(未填寫)').join('、')
        toast.warning(`以下參與者標記為會員但尚未選擇：${names}。請點擊該參與者從會員列表選擇，或刪除後改用「新增客人」`)
        return
      }
      
      // 继续提交流程
      // 步驟 1: 載入現有參與者記錄
      const { data: oldParticipants, error: fetchError } = await supabase
        .from('booking_participants')
        .select('*')
        .eq('booking_id', reportingBookingId)
        .eq('coach_id', reportingCoachId)
        .eq('is_deleted', false)

      if (fetchError) {
        console.error('載入現有記錄失敗:', fetchError)
        throw new Error(`載入現有記錄失敗: ${fetchError.message}`)
      }

      // 步驟 2: 硬刪除已移除的參與者（先檢查交易記錄並警告）
      const oldParticipantIds = new Set<number>()
      validParticipants.forEach((p: any) => {
        if (p.id !== undefined) {
          oldParticipantIds.add(p.id)
        }
      })
      const participantsToDelete = (oldParticipants || []).filter(old => !oldParticipantIds.has(old.id))

      if (participantsToDelete.length > 0) {
        // 先檢查是否有交易記錄
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('id, booking_participant_id, amount, description')
          .in('booking_participant_id', participantsToDelete.map(p => p.id))
        
        // 如果有交易記錄，警告用戶
        if (transactionsData && transactionsData.length > 0) {
          const names = participantsToDelete
            .filter(p => transactionsData.some(t => t.booking_participant_id === p.id))
            .map(p => p.participant_name)
            .join('、')
          const totalAmount = transactionsData.reduce((sum, t) => sum + (t.amount || 0), 0)
          
          const confirmMessage = `⚠️ 即將刪除的參與者中：\n\n${names}\n\n已有 ${transactionsData.length} 筆交易記錄（總額 ${totalAmount} 元）\n\n刪除回報記錄後，交易記錄不會變動。\n請記得到「會員交易」檢查並處理！\n\n確定要刪除這些回報記錄嗎？`
          
          if (!confirm(confirmMessage)) {
            throw new Error('用戶取消操作')
          }
        }
        
        // 用戶確認後才刪除
        const { error: deleteError } = await supabase
          .from('booking_participants')
          .delete()
          .in('id', participantsToDelete.map(p => p.id))

        if (deleteError) {
          console.error('刪除記錄失敗:', deleteError)
          throw new Error(`刪除記錄失敗: ${deleteError.message}`)
        }

      }

      // 步驟 3 & 4: 更新現有記錄 + 插入新記錄
      type ParticipantUpdate = Database['public']['Tables']['booking_participants']['Update'] & { id: number }
      type ParticipantInsert = Database['public']['Tables']['booking_participants']['Insert']
      
      const participantsToUpdate: ParticipantUpdate[] = []
      const participantsToInsert: ParticipantInsert[] = []

      // 取得船隻名稱（彈簧床特殊處理：不管指定不指定都算教學時數）
      const currentBooking = bookings.find(b => b.id === reportingBookingId)
      const boatName = currentBooking?.boats?.name || ''

      validParticipants.forEach((p: Participant) => {
        // 使用工具函数计算 is_teaching 和 status
        const isTeaching = calculateIsTeaching(p.lesson_type || 'undesignated', boatName)
        const calculatedStatus = calculateParticipantStatus(p.member_id)

        if (p.id) {
          // 現有記錄：更新
          // 檢查關鍵欄位是否有變更（統一處理類型和空值）
          const original = originalParticipants.find(op => op.id === p.id)
          
          // 正規化比較函數：統一處理 null/undefined/空字串
          const normalize = (val: any) => val ?? ''
          const normalizeLesson = (val: any) => val || 'undesignated' // lesson_type 預設是 undesignated
          
          const hasChanges = !original || 
            normalize(original.participant_name) !== normalize(p.participant_name) ||
            Number(original.duration_min) !== Number(p.duration_min) ||
            normalize(original.payment_method) !== normalize(p.payment_method) ||
            normalizeLesson(original.lesson_type) !== normalizeLesson(p.lesson_type) ||
            normalize(original.member_id) !== normalize(p.member_id) ||
            normalize(original.notes) !== normalize(p.notes)
          
          // 如果有變更，使用新計算的 status（會員 → pending，非會員 → not_applicable）
          // 如果沒有變更，保留原狀態（避免 processed 變回 pending）
          const finalStatus = hasChanges ? calculatedStatus : (p.status || calculatedStatus)
          
          // 如果原本沒有 created_by_email（首次回報），則設定回報者
          const shouldSetCreatedBy = !original?.created_by_email
          
          // ⛔ 安全檢查：確保 user.email 有值
          if (!user?.email) {
            throw new Error(`無法取得您的帳號資訊，請重新整理頁面後再試。(participant: ${p.participant_name})`)
          }
          
          participantsToUpdate.push({
            booking_id: reportingBookingId,
            coach_id: reportingCoachId,
            member_id: p.member_id,
            participant_name: p.participant_name,
            duration_min: p.duration_min,
            payment_method: p.payment_method,
            lesson_type: p.lesson_type,
            notes: p.notes || null,
            status: finalStatus,
            reported_at: getLocalTimestamp(),
            is_teaching: isTeaching,
            id: p.id,
            updated_at: getLocalTimestamp(),
            updated_by_email: user.email,
            // 首次回報時設定 created_by_email
            ...(shouldSetCreatedBy ? { created_by_email: user.email } : {})
          })
        } else {
          // 新記錄：插入
          // ⛔ 安全檢查：確保 user.email 有值（理論上不應該發生，但防止空值寫入）
          if (!user?.email) {
            throw new Error(`無法取得您的帳號資訊，請重新整理頁面後再試。(participant: ${p.participant_name})`)
          }
          participantsToInsert.push({
            booking_id: reportingBookingId,
            coach_id: reportingCoachId,
            member_id: p.member_id,
            participant_name: p.participant_name,
            duration_min: p.duration_min,
            payment_method: p.payment_method,
            lesson_type: p.lesson_type,
            notes: p.notes || null,
            status: calculatedStatus,
            reported_at: getLocalTimestamp(),
            is_teaching: isTeaching,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp(),
            created_by_email: user.email,
            updated_by_email: user.email
          })
        }
      })

      // 執行更新
      if (participantsToUpdate.length > 0) {
        for (const participant of participantsToUpdate) {
          const { id, ...updateData } = participant
          const { error: updateError } = await supabase
            .from('booking_participants')
            .update(updateData)
            .eq('id', id)

          if (updateError) {
            console.error('更新記錄失敗:', updateError)
            throw new Error(`更新記錄失敗: ${updateError.message}`)
          }
        }
      }

      // 執行插入
      if (participantsToInsert.length > 0) {
        console.log('準備插入的參與者記錄:', participantsToInsert)

        const { error: insertError } = await supabase
          .from('booking_participants')
          .insert(participantsToInsert)

        if (insertError) {
          console.error('插入新記錄失敗:', insertError)
          throw new Error(`插入新記錄失敗: ${insertError.message}`)
        }
      }

      // 確保在 coach_reports 中有記錄，用於追蹤教練是否已提交回報
      // 注意：如果是 'both' 或 'driver' 類型，submitDriverReport 已經處理了
      // 這裡只處理純 'coach' 類型的情況
      if (reportType === 'coach') {
        const { error: upsertError } = await supabase
          .from('coach_reports')
          .upsert({
            booking_id: reportingBookingId,
            coach_id: reportingCoachId,
            driver_duration_min: null, // 純教練不回報駕駛時數
            reported_at: getLocalTimestamp()
          }, {
            onConflict: 'booking_id,coach_id'
          })

        if (upsertError) {
          console.error('記錄教練回報狀態失敗:', upsertError)
          // 不拋出錯誤，因為參與者已經成功提交
        }
      }
    } catch (error) {
      console.error('提交教練回報失敗:', error)
      throw error
    }
  }

  // 新增參與者（統一入口）
  const addParticipant = () => {
    const booking = bookings.find(b => b.id === reportingBookingId)
    setParticipants([
      ...participants,
      {
        id: 0,
        booking_id: reportingBookingId || 0,
        coach_id: reportingCoachId,
        member_id: null,
        participant_name: '',
        duration_min: booking?.duration_min || 60,
        payment_method: 'cash',  // 默認現金
        lesson_type: 'undesignated',
        status: 'not_applicable',  // 默認非會員
        created_at: null,
        created_by_email: null,
        updated_at: null,
        updated_by_email: null,
        deleted_at: null,
        is_deleted: null,
        is_teaching: null,
        notes: null,
        replaced_by_id: null,
        replaces_id: null,
        reported_at: null,
        transaction_id: null
      }
    ])
  }

  // 清除會員綁定
  const clearMember = (index: number) => {
    const updated = [...participants]
    const current = updated[index]
    
    // 只有在實際有會員時才調整付款方式
    const hadMember = !!current.member_id
    
    updated[index] = {
      ...current,
      member_id: null,
      // 只有清除會員時才改付款方式
      payment_method: hadMember ? 'cash' : current.payment_method
      // 不再強制設定 status，讓 submitCoachReport 計算
    }
    setParticipants(updated)
  }

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const selectMember = (index: number, member: MemberSearchResult) => {
    // 一次性更新所有字段，選了會員自動調整收費方式
    const updated = [...participants]
    const current = updated[index]
    
    // 只有在實際更換會員時才調整付款方式
    // 保留原本的 status，讓 submitCoachReport 根據 hasChanges 決定
    const isSameMember = current.member_id === member.id
    
    updated[index] = {
      ...current,
      member_id: member.id,
      participant_name: member.nickname || member.name,
      // 只有換成不同會員時才改付款方式
      payment_method: isSameMember ? current.payment_method : 'balance'
      // 不再強制設定 status，讓 submitCoachReport 計算
    }
    setParticipants(updated)
    setMemberSearchTerm('')
  }

  const reportingBooking = bookings.find(b => b.id === reportingBookingId)

  // 快捷日期按鈕
  const setDateOffset = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    setSelectedDate(`${year}-${month}-${day}`)
  }

  // 導出當日回報為 CSV
  const exportToCSV = async () => {
    // 🔍 調試：顯示 allBookings 的內容
    console.log('📋 準備匯出的預約數量:', allBookings.length)
    console.log('📋 所有預約 ID:', allBookings.map(b => ({ id: b.id, contact: b.contact_name, coaches: b.coaches?.length || 0, drivers: b.drivers?.length || 0 })))
    
    if (allBookings.length === 0) {
      toast.warning('沒有資料可以匯出')
      return
    }

    // 查詢所有預約的駕駛回報記錄
    const bookingIds = allBookings.map(b => b.id)
    const { data: allCoachReports } = await supabase
      .from('coach_reports')
      .select('booking_id, coach_id, driver_duration_min, coaches:coach_id(name)')
      .in('booking_id', bookingIds)

    // 🔍 調試：顯示所有駕駛回報記錄
    console.log('📊 所有駕駛回報記錄:', allCoachReports)

    // 建立駕駛回報查找映射
    const driverReportsMap = new Map<number, Map<string, number>>()
    allCoachReports?.forEach(report => {
      if (!driverReportsMap.has(report.booking_id)) {
        driverReportsMap.set(report.booking_id, new Map())
      }
      if (report.driver_duration_min) {
        driverReportsMap.get(report.booking_id)!.set(report.coach_id, report.driver_duration_min)
      }
    })

    // CSV 標題
    const headers = [
      '預約時間',
      '船隻',
      '預約人',
      '時長(分)',
      '教練',
      '回報教練',
      '參與者',
      '駕駛',
      '駕駛時長',
      '備註'
    ]

    // 準備 CSV 資料
    const rows: string[][] = []

    allBookings.forEach(booking => {
      const startTime = extractDate(booking.start_at) + ' ' + extractTime(booking.start_at)
      const boatName = booking.boats?.name || ''
      const contactName = booking.contact_name || ''
      const durationMin = booking.duration_min.toString()
      const coachNames = (booking.coaches || []).map(c => c.name).join('、') || ''
      const driverNames = (booking.drivers || []).map(d => d.name).join('、') || ''
      const notes = (booking.notes || '').replace(/[\n\r]/g, ' ') // 移除換行符
      
      // 🔍 調試：純駕駛預約
      if ((booking.coaches || []).length === 0 && (booking.drivers || []).length > 0) {
        console.log('🚤 純駕駛預約:', { id: booking.id, contact: contactName, drivers: driverNames, participants: booking.participants?.length || 0 })
      }
      
      // 獲取所有駕駛的回報時長（只顯示應該回報駕駛的人）
      const driverReports = driverReportsMap.get(booking.id)
      let reportedDriverName = ''
      let reportedDriverDuration = ''
      
      if (driverReports && driverReports.size > 0) {
        // 過濾掉不該有的駕駛回報（例如教練在有明確駕駛員後不該回報駕駛）
        const validDriverReports = new Map<string, number>()
        driverReports.forEach((duration, coachId) => {
          const reportType = getReportType(booking, coachId)
          const shouldReportDriver = reportType === 'driver' || reportType === 'both'
          if (shouldReportDriver) {
            validDriverReports.set(coachId, duration)
          }
        })
        
        if (validDriverReports.size > 0) {
          // 如果有多個人回報駕駛時長，顯示每個人的名字和時長
          if (validDriverReports.size > 1) {
            const driverNames: string[] = []
            const durations: string[] = []
            validDriverReports.forEach((duration, coachId) => {
              // 從教練或駕駛列表中查找名字
              const coachName = booking.coaches?.find(c => c.id === coachId)?.name ||
                              booking.drivers?.find(d => d.id === coachId)?.name ||
                              '未知'
              driverNames.push(coachName)
              durations.push(`${duration}分`)
            })
            reportedDriverName = driverNames.join('、')
            reportedDriverDuration = durations.join('、')
          } else {
            // 只有一個人回報，分別顯示名字和時長
            const firstEntry = Array.from(validDriverReports.entries())[0]
            const coachId = firstEntry[0]
            const duration = firstEntry[1]
            const coachName = booking.coaches?.find(c => c.id === coachId)?.name ||
                            booking.drivers?.find(d => d.id === coachId)?.name ||
                            '未知'
            reportedDriverName = coachName
            reportedDriverDuration = `${duration}分`
          }
        }
      }

      // 如果有參與者記錄，每個參與者一行
      if (booking.participants && booking.participants.length > 0) {
        booking.participants.forEach((p, index) => {
          const paymentMethodLabel = PAYMENT_METHODS.find(pm => pm.value === p.payment_method)?.label || p.payment_method
          const lessonTypeLabel = LESSON_TYPES.find(lt => lt.value === p.lesson_type)?.label || p.lesson_type
          
          // 組合參與者資訊：姓名(時長、付款方式、課程類型)
          const participantInfo = `${p.participant_name}(${p.duration_min}分、${paymentMethodLabel}、${lessonTypeLabel})`
          
          // 獲取回報教練名字 - 從 booking.coaches 或 booking.drivers 中找
          let reportCoach = ''
          if (p.coach_id) {
            const coach = booking.coaches?.find(c => c.id === p.coach_id) || 
                         booking.drivers?.find(d => d.id === p.coach_id)
            reportCoach = coach?.name || ''
          }
          
          // 第一個參與者顯示完整資訊，後續參與者只顯示參與者資訊
          if (index === 0) {
            rows.push([
              startTime,
              boatName,
              contactName,
              durationMin,
              coachNames,
              reportCoach,
              participantInfo,
              reportedDriverName,
              reportedDriverDuration,
              notes
            ])
          } else {
            rows.push([
              '',  // 空白日期
              '',  // 空白船隻
              '',  // 空白預約人
              '',  // 空白時長
              '',  // 空白教練
              reportCoach,  // 回報教練
              participantInfo,
              '',  // 空白駕駛
              '',  // 空白駕駛時長
              ''   // 空白備註
            ])
          }
        })
      } else {
        // 沒有參與者記錄（未回報或只有駕駛回報）
        // 檢查是否有駕駛回報（包括明確駕駛和隱性駕駛）
        const hasDriverReport = reportedDriverName !== ''
        
        const reportStatus = hasDriverReport ? '已回報駕駛' : '未回報'
        
        // 駕駛名稱列表（用於顯示）
        const driverNames = (booking.drivers || []).map(d => d.name).join('、') || ''
        
        rows.push([
          startTime,
          boatName,
          contactName,
          durationMin,
          coachNames,
          reportedDriverName || '',  // 回報人（駕駛）
          reportStatus,
          driverNames || reportedDriverName,  // 駕駛欄位
          reportedDriverDuration,
          notes
        ])
      }
    })

    // 轉換為 CSV 字符串
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // 處理包含逗號或引號的內容
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(',')
      )
    ].join('\n')

    // 添加 BOM 以支持 Excel 正確顯示中文
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `回報記錄_${selectedDate}_${selectedCoachId === 'all' ? '全部教練' : availableCoaches.find(c => c.id === selectedCoachId)?.name || '未知'}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 統計數據計算已移至需要時再計算（目前 UI 中未顯示）

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <div style={{
        flex: 1,
        padding: embedded ? '0' : (isMobile ? '16px' : '24px'),
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        overflow: 'hidden'
      }}>
        {!embedded && (
          <PageHeader 
            user={user} 
            title={autoFilterByUser ? "📋 我的回報" : "📋 預約回報"}
            showBaoLink={!autoFilterByUser}
            extraLinks={autoFilterByUser ? undefined : [
              { label: '回報管理 →', link: '/coach-admin' }
            ]}
          />
        )}
        
        {/* 最後更新時間 */}
        {lastRefreshTime && (
          <div style={{
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '16px'
          }}>
            🔄 已更新 {lastRefreshTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}

        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '16px'
        }}>
          {/* 日期選擇標題 */}
          <div style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#666',
            fontWeight: '600',
            marginBottom: '12px'
          }}>
            選擇日期
          </div>

          {/* 快捷按鈕 */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: isMobile ? '0' : '12px',
            alignItems: 'center'
          }}>
            {/* 全部未回報按鈕 */}
            <button
              data-track="coach_report_view_unreported"
              onClick={() => setViewMode('unreported')}
              style={{
                padding: isMobile ? '10px 16px' : '10px 20px',
                background: viewMode === 'unreported' ? '#f57c00' : '#fff3e0',
                color: viewMode === 'unreported' ? 'white' : '#e65100',
                border: `2px solid ${viewMode === 'unreported' ? '#f57c00' : '#ffcc80'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              ⚠️ 全部未回報
            </button>

            {/* 日期按鈕 - 只在桌面版顯示 */}
            {!isMobile && [
              { label: '今天', offset: 0 },
              { label: '昨天', offset: -1 },
              { label: '前天', offset: -2 }
            ].map(({ label, offset }) => {
                const targetDate = new Date()
                targetDate.setDate(targetDate.getDate() + offset)
                const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
                const isSelected = viewMode === 'date' && selectedDate === targetDateStr
                
                return (
                  <button
                    key={offset}
                    onClick={() => {
                      setViewMode('date')
                      setDateOffset(offset)
                    }}
                    style={{
                      padding: '10px 20px',
                      background: isSelected ? '#2196f3' : '#e3f2fd',
                      color: isSelected ? 'white' : '#1976d2',
                      border: `2px solid ${isSelected ? '#2196f3' : '#90caf9'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              
              {/* 日期選擇器 + 星期幾 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: isMobile ? '0' : 'auto',
                ...(isMobile ? { marginTop: '8px', width: '100%', justifyContent: 'space-between' } : {})
              }}>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => {
                    const newDate = e.target.value
                    if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      setViewMode('date')
                      setSelectedDate(newDate)
                    }
                  }} 
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px', // 16px 防止 iOS 縮放
                    color: '#333',
                    cursor: 'pointer',
                    flex: isMobile ? '1' : 'none'
                  }}
                />
                <span style={{
                  padding: '8px 12px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '13px',
                  fontWeight: '600',
                  color: '#666',
                  whiteSpace: 'nowrap'
                }}>
                  {getWeekdayText(selectedDate)}
                </span>
              </div>
          </div>

          {/* 教練選擇 - 只在非自動篩選模式且桌面版顯示 */}
          {!autoFilterByUser && !isMobile && (
            <>
              <div style={{
                fontSize: '14px',
                color: '#666',
                fontWeight: '600',
                marginBottom: '12px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #eee'
              }}>
                選擇教練
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setSelectedCoachId('all')}
                  style={{
                    padding: '10px 20px',
                    background: selectedCoachId === 'all' ? '#2196f3' : '#f5f5f5',
                    color: selectedCoachId === 'all' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  全部
                </button>
                {availableCoaches.map(coach => (
                  <button
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    style={{
                      padding: '10px 20px',
                      background: selectedCoachId === coach.id ? '#2196f3' : '#f5f5f5',
                      color: selectedCoachId === coach.id ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    {coach.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 匯出按鈕 - 只在日期模式且桌面版顯示 */}
          {viewMode === 'date' && !isMobile && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="success"
                size="medium"
                onClick={exportToCSV}
                icon={<span>📊</span>}
                data-track="coach_report_export"
              >
                匯出回報記錄
              </Button>
            </div>
          )}
        </div>


        {/* 預約列表 */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: isMobile ? '40px 20px' : '40px', 
            color: '#999',
            background: 'white',
            borderRadius: '12px'
          }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: isMobile ? '40px 20px' : '40px', 
            color: '#999',
            background: 'white',
            borderRadius: '12px'
          }}>
            {viewMode === 'unreported' ? '沒有未回報的預約' : '沒有預約記錄'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bookings.map(booking => {
              const displayCoaches = selectedCoachId === 'all' 
                ? (booking.coaches || [])
                : (booking.coaches || []).filter(c => c.id === selectedCoachId)
              
              const displayDrivers = selectedCoachId === 'all'
                ? (booking.drivers || [])
                : (booking.drivers || []).filter(d => d.id === selectedCoachId)

              const shouldShow = displayCoaches.length > 0 || displayDrivers.length > 0

              if (!shouldShow) return null

              return (
                <div 
                  key={booking.id}
                  style={{
                    ...getCardStyle(isMobile),
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`
                  }}
                >
                  {/* 預約資訊 */}
                  <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                      {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                    </div>
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      {getDisplayContactName(booking)}
                    </div>
                    {booking.notes && (
                      <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                        備註：{booking.notes}
                      </div>
                    )}
                  </div>

                  {/* 教練列表 */}
                  {displayCoaches && displayCoaches.length > 0 && (
                    <div style={{ 
                      marginBottom: (displayDrivers && displayDrivers.length > 0) ? '8px' : '0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '16px', opacity: 0.5 }}>🎓</span>
                      {displayCoaches.map(coach => {
                        const reportType = getReportType(booking, coach.id)
                        const reportStatus = getReportStatus(booking, coach.id)
                        const isReported = reportStatus.hasCoachReport || (reportType === 'both' && reportStatus.hasCoachReport && reportStatus.hasDriverReport)
                        
                        return (
                          <button
                            key={coach.id}
                            data-track="coach_report_start"
                            onClick={() => startReportWithCoach(booking, coach.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              background: isReported ? 'transparent' : '#e8f5e9',
                              border: isReported ? '2px solid #4caf50' : '2px solid transparent',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#2e7d32',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.25)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            {isReported && <span>✓</span>}
                            <span>{coach.name}</span>
                            {!isReported && <span style={{ opacity: 0.7 }}>· 回報</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* 駕駛列表 */}
                  {displayDrivers && displayDrivers.length > 0 && (
                    <div style={{ 
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '16px', opacity: 0.5 }}>🚤</span>
                      {displayDrivers.map(driver => {
                        const reportStatus = getReportStatus(booking, driver.id)
                        const isReported = reportStatus.hasDriverReport
                        
                        return (
                          <button
                            key={driver.id}
                            data-track="coach_report_start"
                            onClick={() => startReportWithCoach(booking, driver.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              background: isReported ? 'transparent' : '#e3f2fd',
                              border: isReported ? '2px solid #2196f3' : '2px solid transparent',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#1565c0',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.25)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            {isReported && <span>✓</span>}
                            <span>{driver.name}</span>
                            {!isReported && <span style={{ opacity: 0.7 }}>· 回報</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 回報對話框 - 使用新组件 */}
      <CoachReportFormDialog
        booking={reportingBooking}
        reportType={reportType}
        coachName={reportingCoachName}
        driverDuration={driverDuration}
        participants={participants}
        isMobile={isMobile}
        memberSearchTerm={memberSearchTerm}
        filteredMembers={filteredMembers as any}
        lessonTypes={LESSON_TYPES}
        paymentMethods={PAYMENT_METHODS}
        isSubmitting={isSubmitting}
        activeSearchIndex={activeSearchIndex}
        onDriverDurationChange={setDriverDuration}
        onParticipantUpdate={updateParticipant}
        onParticipantAdd={addParticipant}
        onParticipantRemove={removeParticipant}
        onClearMember={clearMember}
        onMemberSearch={(value) => {
          setMemberSearchTerm(value)
          handleSearchChange(value)
        }}
        onMemberSelect={selectMember}
        onSubmit={submitReport}
        onCancel={() => setReportingBookingId(null)}
        onSearchFocus={(index) => setActiveSearchIndex(index)}
        onSearchBlur={() => setActiveSearchIndex(null)}
      />

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

