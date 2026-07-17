import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { CoachReportFormDialog } from '../../components/CoachReportFormDialog'
import { useResponsive } from '../../hooks/useResponsive'
import { useMemberSearch } from '../../hooks/useMemberSearch'
import { getCardStyle, getFilterChipStyle, getFontSize, getReportRolePillStyle, designSystem, PAGE_MAX_WIDTHS } from '../../styles/designSystem'
import { useToast, ToastContainer } from '../../components/ui'
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
import { getCoachReportStatus, getCoachReportType, isFullyReported } from '../../utils/coachReportStatus'
import {
  COACH_REPORT_USER_ERRORS,
  isUserFacingErrorMessage,
  reportStampSaveError,
  userFacingError,
} from '../../utils/userFacingError'
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

/** 未回報模式：只查過去 N 天內已結束的預約 */
const UNREPORTED_LOOKBACK_DAYS = 30

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
    // 換條件時先清空舊清單，避免新資料載入前畫面殘留前條件的列表
    // 注意：靜默刷新（auto-refresh）的 useEffect 不會走到這裡，所以不會閃
    setBookings([])
    setAvailableCoaches([])
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
      toast.error('無法找到您對應的教練帳號，請聯繫負責人協助設定')
      return
    }

    if (data) {
      setUserCoachId(data.id)
      setSelectedCoachId(data.id) // 自動選擇該教練
    } else {
      toast.error('您的帳號尚未配對教練，請聯繫負責人協助設定')
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
        // 待回報模式：顯示過去 30 天內未回報的預約
        const lookbackStart = new Date()
        lookbackStart.setDate(lookbackStart.getDate() - UNREPORTED_LOOKBACK_DAYS)
        const lookbackStartStr = getLocalDateString(lookbackStart) + 'T00:00:00'
        bookingsQuery = bookingsQuery.gte('start_at', lookbackStartStr)
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
        setAvailableCoaches([])
        return
      }

      // 使用輔助函數查詢和組裝關聯數據
      const relations = await fetchBookingRelations(bookingIds)
      const bookingsWithRelations = assembleBookingsWithRelations(validBookings as any, relations)

      let filteredBookings = bookingsWithRelations
      
      // 按日期模式時更新可用教練列表
      if (viewMode === 'date') {
        // 使用輔助函數提取當天有預約的教練
        const availableCoachList = extractAvailableCoaches(bookingsWithRelations)
        setAvailableCoaches(availableCoachList)
        
        // 如果當前選中的教練不在可用列表中，切換到"全部"（但在自動篩選模式下不切換）
        if (!autoFilterByUser && selectedCoachId !== 'all' && !availableCoachList.some(c => c.id === selectedCoachId)) {
          setSelectedCoachId('all')
        }
      } else {
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
          getCoachReportType,
          getCoachReportStatus
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

  const startReportWithCoach = (booking: Booking, coachId: string) => {
    const type = getCoachReportType(booking, coachId)
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

      // 兩個查詢都只依賴 bookingId，並行送出可節省一輪 RTT
      const [bookingMembersResult, reportedParticipantsResult] = await Promise.all([
        supabase
          .from('booking_members')
          .select('member_id, members:member_id(id, name, nickname)')
          .eq('booking_id', bookingId),
        supabase
          .from('booking_participants')
          .select('member_id, participant_name, coach_id')
          .eq('booking_id', bookingId)
          .eq('is_deleted', false)
          .not('coach_id', 'is', null)
      ])

      const { data: bookingMembersData } = bookingMembersResult
      const { data: reportedParticipants } = reportedParticipantsResult

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
          const message = isUserFacingErrorMessage(error.message)
            ? error.message
            : COACH_REPORT_USER_ERRORS.genericSubmit
          toast.error(`提交失敗：${message}`)
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
    const reportType = getCoachReportType(booking, reportingCoachId)
    const shouldReportDriver = reportType === 'driver' || reportType === 'both'
    
    if (!shouldReportDriver) {
      // 如果不應該回報駕駛（例如預約現在有明確的駕駛員了），刪除舊的駕駛回報記錄
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
    
    // 駕駛時數未變更時通常略過；若 DB 尚無戳章仍須寫入（例如 both 僅更新參與者）
    if (!driverDurationChanged) {
      const { data: existing, error: fetchError } = await supabase
        .from('coach_reports')
        .select('id')
        .eq('booking_id', reportingBookingId)
        .eq('coach_id', reportingCoachId)
        .maybeSingle()

      if (fetchError) {
        throw reportStampSaveError(fetchError.message)
      }
      if (existing) return
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
      throw reportStampSaveError(error.message)
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
        throw userFacingError(
          '載入現有參與者失敗',
          fetchError.message,
          COACH_REPORT_USER_ERRORS.loadExisting
        )
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
          throw userFacingError(
            '刪除參與者失敗',
            deleteError.message,
            COACH_REPORT_USER_ERRORS.deleteParticipant
          )
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
            throw userFacingError(
              '更新參與者失敗',
              updateError.message,
              COACH_REPORT_USER_ERRORS.updateParticipant
            )
          }
        }
      }

      // 執行插入
      if (participantsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('booking_participants')
          .insert(participantsToInsert)

        if (insertError) {
          console.error('插入新記錄失敗:', insertError)
          throw userFacingError(
            '插入參與者失敗',
            insertError.message,
            COACH_REPORT_USER_ERRORS.insertParticipant
          )
        }
      }

      // 確保 coach_reports 有戳章（未回報列表與 ✓ 依此判斷；失敗須告知，不可靜默成功）
      if (reportType === 'coach' || reportType === 'both') {
        const { error: upsertError } = await supabase
          .from('coach_reports')
          .upsert({
            booking_id: reportingBookingId,
            coach_id: reportingCoachId,
            driver_duration_min: reportType === 'both' ? driverDuration : null,
            reported_at: getLocalTimestamp()
          }, {
            onConflict: 'booking_id,coach_id'
          })

        if (upsertError) {
          throw reportStampSaveError(upsertError.message, { participantsAlreadySaved: true })
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

  // 統計數據計算已移至需要時再計算（目前 UI 中未顯示）

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <div style={{
        flex: 1,
        padding: embedded ? '0' : (isMobile ? '16px' : '24px'),
        maxWidth: embedded ? 'none' : PAGE_MAX_WIDTHS.focused,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        {!embedded && (
          <PageHeader 
            user={user} 
            title={autoFilterByUser ? "我的回報" : "回報"}
            showBaoLink={!autoFilterByUser}
            extraLinks={autoFilterByUser ? undefined : [
              { label: '回報管理 →', link: '/coach-admin' }
            ]}
          />
        )}
        
        {/* 最後更新時間 */}
        {lastRefreshTime && (
          <div style={{
            fontSize: getFontSize('bodySmall', isMobile),
            color: designSystem.colors.text.secondary,
            marginBottom: '16px'
          }}>
            已更新 {lastRefreshTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}

        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '16px'
        }}>
          {/* 快捷按鈕 */}
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: isMobile ? '0' : '12px',
            alignItems: 'center'
          }}>
            {/* 近30天未回報 */}
            <button
              data-track="coach_report_view_unreported"
              onClick={() => setViewMode('unreported')}
              style={{
                ...getFilterChipStyle(viewMode === 'unreported', 'warning'),
                padding: isMobile ? '10px 16px' : '10px 20px',
                fontSize: getFontSize('button', isMobile),
                transition: 'all 0.2s'
              }}
            >
              ⚠️ 近30天未回報
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
                      ...getFilterChipStyle(isSelected, 'info'),
                      padding: '10px 20px',
                      fontSize: getFontSize('button', false),
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
                    border: `1px solid ${designSystem.colors.border.main}`,
                    borderRadius: designSystem.borderRadius.lg,
                    fontSize: '16px', // 16px 防止 iOS 縮放
                    color: designSystem.colors.text.primary,
                    cursor: 'pointer',
                    flex: isMobile ? '1' : 'none',
                    background: '#ffffff'
                  }}
                />
                <span style={{
                  padding: '8px 12px',
                  background: designSystem.colors.background.hover,
                  borderRadius: designSystem.borderRadius.lg,
                  fontSize: getFontSize('bodySmall', isMobile),
                  fontWeight: '600',
                  color: designSystem.colors.text.secondary,
                  whiteSpace: 'nowrap'
                }}>
                  {getWeekdayText(selectedDate)}
                </span>
              </div>
          </div>

          {/* 教練選擇 - 只在非自動篩選模式且桌面版顯示 */}
          {!autoFilterByUser && !isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <span style={{
                fontSize: getFontSize('bodySmall', false),
                color: designSystem.colors.text.secondary,
                fontWeight: '600',
              }}>
                教練
              </span>
                <button
                  onClick={() => setSelectedCoachId('all')}
                  style={{
                    ...getFilterChipStyle(selectedCoachId === 'all', 'info'),
                    padding: '10px 20px',
                    fontSize: getFontSize('button', false)
                  }}
                >
                  全部
                </button>
                {availableCoaches.map(coach => (
                  <button
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    style={{
                      ...getFilterChipStyle(selectedCoachId === coach.id, 'info'),
                      padding: '10px 20px',
                      fontSize: getFontSize('button', false)
                    }}
                  >
                    {coach.name}
                  </button>
                ))}
            </div>
          )}

        </div>


        {/* 預約列表 */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: isMobile ? '40px 20px' : '40px', 
            color: designSystem.colors.text.secondary,
            background: 'white',
            borderRadius: designSystem.borderRadius.xl
          }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: isMobile ? '40px 20px' : '40px', 
            color: designSystem.colors.text.secondary,
            background: 'white',
            borderRadius: designSystem.borderRadius.xl
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
                    borderLeft: `4px solid ${booking.boats?.color || designSystem.colors.border.main}`
                  }}
                >
                  {/* 預約資訊 */}
                  <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
                    <div style={{ fontWeight: '600', fontSize: getFontSize('bodyLarge', isMobile), marginBottom: '4px' }}>
                      {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                    </div>
                    <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
                      {getDisplayContactName(booking)}
                    </div>
                    {booking.notes && (
                      <div style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('bodySmall', isMobile), marginTop: '4px' }}>
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
                      <span aria-label="教練" style={{ fontSize: getFontSize('bodyLarge', isMobile) }}>🎓</span>
                      {displayCoaches.map(coach => {
                        const isReported = isFullyReported(booking, coach.id)
                        
                        return (
                          <button
                            key={coach.id}
                            data-track="coach_report_start"
                            onClick={() => startReportWithCoach(booking, coach.id)}
                            style={{
                              ...getReportRolePillStyle(isReported, 'coach'),
                              fontSize: getFontSize('bodySmall', isMobile),
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 143, 104, 0.22)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onTouchEnd={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            onTouchCancel={(e) => e.currentTarget.style.transform = 'translateY(0)'}
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
                      <span aria-label="駕駛" style={{ fontSize: getFontSize('bodyLarge', isMobile) }}>🚤</span>
                      {displayDrivers.map(driver => {
                        const isReported = isFullyReported(booking, driver.id)
                        
                        return (
                          <button
                            key={driver.id}
                            data-track="coach_report_start"
                            onClick={() => startReportWithCoach(booking, driver.id)}
                            style={{
                              ...getReportRolePillStyle(isReported, 'driver'),
                              fontSize: getFontSize('bodySmall', isMobile),
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(95, 135, 145, 0.22)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                            onTouchEnd={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            onTouchCancel={(e) => e.currentTarget.style.transform = 'translateY(0)'}
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

