import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { CoachReportFormDialog } from '../../components/CoachReportFormDialog'
import { useResponsive } from '../../hooks/useResponsive'
import { useMemberSearch } from '../../hooks/useMemberSearch'
import { getCardStyle, getInputStyle, getLabelStyle } from '../../styles/designSystem'
import { Button, useToast, ToastContainer } from '../../components/ui'
import { isFacility } from '../../utils/facility'
import { getLocalDateString, getLocalTimestamp, getWeekdayText } from '../../utils/date'
import { extractDate, extractTime } from '../../utils/formatters'
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
}

export function CoachReport({ autoFilterByUser = false, embedded = false }: CoachReportProps = {}) {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  
  // 日期和教練篩選
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all') // 默認顯示"全部"
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]) // 當天有預約的教練
  const [viewMode, setViewMode] = useState<'date' | 'unreported'>('date')
  const [userCoachId, setUserCoachId] = useState<string | null>(null) // 登入用戶對應的教練 ID
  
  // 預約列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([]) // 用於統計
  const [loading, setLoading] = useState(false)
  
  // 回報表單
  const [reportingBookingId, setReportingBookingId] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'coach' | 'driver' | 'both'>('coach')
  const [reportingCoachId, setReportingCoachId] = useState<string | null>(null)
  const [reportingCoachName, setReportingCoachName] = useState<string>('')
  const [driverDuration, setDriverDuration] = useState<number>(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  
  // 會員搜尋
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
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

  const loadBookings = async () => {
    setLoading(true)
    try {
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id, start_at, duration_min, contact_name, notes, boat_id, requires_driver, status, is_coach_practice,
          boats(name, color)
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
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo) + 'T00:00:00'
        bookingsQuery = bookingsQuery.gte('start_at', thirtyDaysAgoStr)
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
    } catch (error) {
      console.error('載入預約失敗:', error)
    } finally {
      setLoading(false)
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
    
    const hasCoachReport = !!(booking.participants && booking.participants.length > 0 && 
      (booking.coaches || []).some(c => c.id === coachId))
    const hasDriverReport = !!booking.coach_report
    
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
    
    if (booking.coach_report) {
      setDriverDuration(booking.coach_report.driver_duration_min || 0)
    } else {
      setDriverDuration(booking.duration_min)
    }
    
    if (booking.participants && booking.participants.length > 0) {
      const existingParticipants = booking.participants.filter(p => p.coach_id === coachId)
      setParticipants(existingParticipants)
    } else {
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
        if (!member) return // 跳过没有会员信息的记录
        
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
          updated_at: null,
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
        const contactNames = booking.contact_name.split(/[,，]/).map(n => n.trim()).filter(n => n)
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
                updated_at: null,
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
          updated_at: null,
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
      loadBookings()
    } catch (error) {
      // 錯誤已在子函數中處理，這裡不再重複顯示
      console.error('提交回報失敗:', error)
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

    console.log('提交駕駛回報:', {
      booking_id: reportingBookingId,
      coach_id: reportingCoachId,
      driver_duration_min: driverDuration
    })

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
      
      // 驗證時數
      if (validParticipants.some(p => p.duration_min <= 0)) {
        throw new Error('時數必須大於 0')
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

      validParticipants.forEach((p: Participant) => {
        // 使用工具函数计算 is_teaching 和 status
        const isTeaching = calculateIsTeaching(p.lesson_type || 'undesignated')
        const status = calculateParticipantStatus(p.member_id)
        
        console.log(`參與者 ${p.participant_name}:`, {
          member_id: p.member_id,
          status: status,
          is_teaching: isTeaching,
          is_會員: !!p.member_id
        })
        
        const recordData = {
          booking_id: reportingBookingId,
          coach_id: reportingCoachId,
          member_id: p.member_id,
          participant_name: p.participant_name,
          duration_min: p.duration_min,
          payment_method: p.payment_method,
          lesson_type: p.lesson_type,
          notes: p.notes || null,
          status: status,
          reported_at: getLocalTimestamp(),
          is_teaching: isTeaching
        }

        if (p.id) {
          // 現有記錄：更新
          participantsToUpdate.push({
            ...recordData,
            id: p.id,
            updated_at: getLocalTimestamp()
          })
        } else {
          // 新記錄：插入
          participantsToInsert.push(recordData)
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
        updated_at: null,
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
    updated[index] = {
      ...updated[index],
      member_id: null,
      payment_method: 'cash',
      status: 'not_applicable'
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
    updated[index] = {
      ...updated[index],
      member_id: member.id,
      participant_name: member.nickname || member.name,
      payment_method: 'balance',  // 會員自動改為扣儲值
      status: 'pending'  // 會員狀態
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
      const notes = (booking.notes || '').replace(/[\n\r]/g, ' ') // 移除換行符
      
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
        const hasDriverReport = booking.drivers && booking.drivers.length > 0 && 
          booking.drivers.some(d => {
            const status = getReportStatus(booking, d.id)
            return status.hasDriverReport
          })
        
        const reportStatus = hasDriverReport ? '已回報駕駛' : '未回報'
        
        rows.push([
          startTime,
          boatName,
          contactName,
          durationMin,
          coachNames,
          '',  // 無回報教練，留空
          reportStatus,
          reportedDriverName,
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

  // 計算統計數據（更細緻的邏輯）
  const stats = {
    total: allBookings.length,
    reported: allBookings.filter(b => {
      if (selectedCoachId === 'all') {
        // 檢查所有教練和駕駛是否都已回報
        const hasCoaches = (b.coaches || []).length > 0
        const hasDrivers = (b.drivers || []).length > 0
        
        if (!hasCoaches && !hasDrivers) return false // 沒有教練也沒有駕駛
        
        // 檢查所有教練是否都已回報
        const allCoachesReported = (b.coaches || []).length === 0 || (b.coaches || []).every((coach: any) => {
          const type = getReportType(b, coach.id)
          if (!type) return true
          const status = getReportStatus(b, coach.id)
          if (type === 'coach') return status.hasCoachReport
          if (type === 'driver') return status.hasDriverReport
          if (type === 'both') return status.hasCoachReport && status.hasDriverReport
          return true
        })
        
        // 檢查所有駕駛是否都已回報
        const allDriversReported = (b.drivers || []).length === 0 || (b.drivers || []).every((driver: any) => {
          const status = getReportStatus(b, driver.id)
          return status.hasDriverReport
        })
        
        return allCoachesReported && allDriversReported
      } else {
        return b.participants && b.participants.some(p => p.coach_id === selectedCoachId)
      }
    }).length,
    unreported: allBookings.filter(b => {
      if (selectedCoachId !== 'all') {
        const type = getReportType(b, selectedCoachId)
        if (!type) return false
        const status = getReportStatus(b, selectedCoachId)
        if (type === 'coach') return !status.hasCoachReport
        if (type === 'driver') return !status.hasDriverReport
        if (type === 'both') return !status.hasCoachReport || !status.hasDriverReport
        return false
      } else {
        // 檢查是否有任何教練或駕駛未回報
        const hasCoaches = (b.coaches || []).length > 0
        const hasDrivers = (b.drivers || []).length > 0
        
        if (!hasCoaches && !hasDrivers) return false // 沒有教練也沒有駕駛，不算未回報
        
        // 檢查教練是否都已回報
        const allCoachesReported = (b.coaches || []).length === 0 || (b.coaches || []).every((coach: any) => {
          const type = getReportType(b, coach.id)
          if (!type) return true
          const status = getReportStatus(b, coach.id)
          if (type === 'coach') return status.hasCoachReport
          if (type === 'driver') return status.hasDriverReport
          if (type === 'both') return status.hasCoachReport && status.hasDriverReport
          return true
        })
        
        // 檢查駕駛是否都已回報
        const allDriversReported = (b.drivers || []).length === 0 || (b.drivers || []).every((driver: any) => {
          const status = getReportStatus(b, driver.id)
          return status.hasDriverReport
        })
        
        // 只要有任何一個未回報，就算未回報
        return !allCoachesReported || !allDriversReported
      }
    }).length
  }

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {!embedded && (
        <PageHeader 
          user={user} 
          title={autoFilterByUser ? "我的回報" : "預約回報"}
          showBaoLink={!autoFilterByUser}
          extraLinks={autoFilterByUser ? undefined : [
            { label: '回報管理 →', link: '/coach-admin' }
          ]}
        />
      )}
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 標籤頁式視圖切換 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '0',
          borderBottom: '2px solid #e0e0e0'
        }}>
            <button
              onClick={() => {
                setBookings([])  // 清空舊資料避免閃爍
                setViewMode('date')
              }}
              style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: viewMode === 'date' ? 'white' : 'transparent',
              color: viewMode === 'date' ? '#2196f3' : '#999',
              border: 'none',
              borderBottom: viewMode === 'date' ? '3px solid #2196f3' : '3px solid transparent',
                cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
              }}
            >
            📅 按日期查看
            </button>
            <button
              onClick={() => {
                setBookings([])  // 清空舊資料避免閃爍
                setViewMode('unreported')
              }}
              style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: viewMode === 'unreported' ? 'white' : 'transparent',
              color: viewMode === 'unreported' ? '#ff9800' : '#999',
              border: 'none',
              borderBottom: viewMode === 'unreported' ? '3px solid #ff9800' : '3px solid transparent',
                cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
              }}
            >
            ⚠️ 查看全部
            {viewMode === 'unreported' && bookings.length > 0 && (
              <span style={{
                background: '#ff9800',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                {bookings.length}
              </span>
            )}
            </button>
          </div>

        {/* 統計摘要 - 獨立在外面 */}
        {viewMode === 'date' && stats.total > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #90caf9'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                  總預約
                </div>
                <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                  {stats.total}
                </div>
              </div>

              <div style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #81c784'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                  已回報
                </div>
                <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                  {stats.reported}
                </div>
              </div>

              <div style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: '4px solid #ffb74d'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                  未回報
                </div>
                <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                  {stats.unreported}
                </div>
              </div>
            </div>

          </>
        )}


        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '24px',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0
        }}>
          {/* 日期選擇 - 只在按日期模式顯示 */}
          {viewMode === 'date' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>日期</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDateOffset(-2)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2196f3'
                    e.currentTarget.style.color = '#2196f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0'
                    e.currentTarget.style.color = '#666'
                  }}
                >
                  前天
                </button>
                <button
                  onClick={() => setDateOffset(-1)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2196f3'
                    e.currentTarget.style.color = '#2196f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0'
                    e.currentTarget.style.color = '#666'
                  }}
                >
                  昨天
                </button>
                <button
                  onClick={() => setDateOffset(0)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: selectedDate === getLocalDateString() ? '#2196f3' : 'white',
                    color: selectedDate === getLocalDateString() ? 'white' : '#666',
                    border: `2px solid ${selectedDate === getLocalDateString() ? '#2196f3' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  今天
                </button>
              </div>
              {isMobile ? (
                // 手機版：徽章在右上角
                <div style={{ position: 'relative' }}>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => {
                      const newDate = e.target.value
                      // 驗證日期格式（必須是 yyyy-MM-dd）
                      if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        setSelectedDate(newDate)
                      }
                    }} 
                    style={getInputStyle(isMobile)} 
                  />
                  {/* 星期幾徽章 - 右上角 */}
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '8px',
                    fontSize: '11px',
                    color: 'white',
                    fontWeight: '600',
                    background: '#5a5a5a',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    pointerEvents: 'none',
                  }}>
                    {getWeekdayText(selectedDate)}
                  </div>
                </div>
              ) : (
                // 電腦版：徽章在旁邊
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => {
                      const newDate = e.target.value
                      // 驗證日期格式（必須是 yyyy-MM-dd）
                      if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        setSelectedDate(newDate)
                      }
                    }} 
                    style={getInputStyle(isMobile)} 
                  />
                  {/* 星期幾徽章 */}
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
                    {getWeekdayText(selectedDate)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 教練選擇 - 按鈕組 */}
          {!autoFilterByUser && (
            <div style={{ marginTop: viewMode === 'date' ? '16px' : 0 }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '12px' }}>教練</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedCoachId('all')}
                  style={{
                    padding: '10px 20px',
                    background: selectedCoachId === 'all' ? '#2196f3' : 'white',
                    color: selectedCoachId === 'all' ? 'white' : '#666',
                    border: `2px solid ${selectedCoachId === 'all' ? '#2196f3' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  全部
                </button>
                {(viewMode === 'date' ? availableCoaches : coaches).map(coach => (
                  <button
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    style={{
                      padding: '10px 20px',
                      background: selectedCoachId === coach.id ? '#2196f3' : 'white',
                      color: selectedCoachId === coach.id ? 'white' : '#666',
                      border: `2px solid ${selectedCoachId === coach.id ? '#2196f3' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    {coach.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 自動篩選模式提示 */}

          {/* 匯出按鈕 - 在按日期查看模式顯示 */}
          {viewMode === 'date' && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="success"
                size="medium"
                onClick={exportToCSV}
                icon={<span>📊</span>}
                style={{
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                }}
              >
                匯出回報記錄
              </Button>
            </div>
          )}
        </div>

        {/* 預約列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
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
                    <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                      {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      {booking.contact_name || '未命名'}
                    </div>
                    {booking.notes && (
                      <div style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                        備註：{booking.notes}
                      </div>
                    )}
                  </div>

                  {/* 教練列表 */}
                  {displayCoaches && displayCoaches.length > 0 && (
                    <div style={{ marginBottom: (displayDrivers && displayDrivers.length > 0) ? '12px' : '0' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', marginTop: '6px' }}>🎓</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {displayCoaches.map(coach => {
                          const reportType = getReportType(booking, coach.id)
                          const reportStatus = getReportStatus(booking, coach.id)
                          
                          return (
                            <div
                              key={coach.id}
                              style={{
                                  padding: '8px 12px',
                                background: '#f5f5f5',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                                <span style={{ fontWeight: '500' }}>
                                  {coach.name}
                                </span>
                              <Button
                                variant="primary"
                                size="small"
                                onClick={() => startReportWithCoach(booking, coach.id)}
                              >
                                {reportStatus.hasCoachReport || (reportType === 'both' && reportStatus.hasCoachReport && reportStatus.hasDriverReport)
                                  ? '修改回報'
                                  : '回報'}
                              </Button>
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 駕駛列表 */}
                  {displayDrivers && displayDrivers.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', marginTop: '6px' }}>🚤</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {displayDrivers.map(driver => {
                          const reportStatus = getReportStatus(booking, driver.id)
                          
                          return (
                            <div
                              key={driver.id}
                              style={{
                                  padding: '8px 12px',
                                background: '#f5f5f5',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                                <span style={{ fontWeight: '500' }}>
                                  {driver.name}
                                </span>
                              <Button
                                variant="primary"
                                size="small"
                                onClick={() => startReportWithCoach(booking, driver.id)}
                              >
                                {reportStatus.hasDriverReport ? '修改回報' : '回報'}
                              </Button>
                            </div>
                          )
                        })}
                        </div>
                      </div>
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
      />

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

