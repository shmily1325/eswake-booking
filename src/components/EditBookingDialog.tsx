import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingCreation, logBookingUpdate, logBookingDeletion } from '../utils/auditLog'
import { getLocalTimestamp, getWeekdayText } from '../utils/date'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { normalizeFilledByForSave } from '../utils/filledByHelper'
import { useBookingConflict } from '../hooks/useBookingConflict'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import type { Booking } from '../types/booking'
import { useToast } from './ui'

import { BookingDetails } from './booking/BookingDetails'

interface EditBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  booking: Booking
  user: User
}

export function EditBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  booking,
  user,
}: EditBookingDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()

  // 刪除狀態 - 獨立於 loading，防止干擾
  const [isDeleting, setIsDeleting] = useState(false)

  // 防止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  // 複製功能狀態
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [copyToDate, setCopyToDate] = useState('')
  const [copyToTime, setCopyToTime] = useState('') // 新增：複製到的時間
  const [copyFilledBy, setCopyFilledBy] = useState('') // 複製對話框專用的填表人
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [copyConflictStatus, setCopyConflictStatus] = useState<'checking' | 'available' | 'conflict' | null>(null)

  // 使用 useBookingForm Hook
  const {
    // State
    boats,
    selectedBoatId,
    coaches,
    selectedCoaches,
    members,
    memberSearchTerm,
    selectedMemberIds,
    showMemberDropdown,
    manualStudentName,
    manualNames,
    startDate,
    startTime,
    durationMin,
    activityTypes,
    notes,
    requiresDriver,
    filledBy,
    isCoachPractice,
    error,
    loading,
    loadingCoaches,

    // Derived
    selectedCoachesSet,
    activityTypesSet,
    filteredMembers,
    finalStudentName,
    isSelectedBoatFacility,
    canRequireDriver,

    // Setters
    setSelectedBoatId,
    setSelectedCoaches,
    setMemberSearchTerm,
    setSelectedMemberIds,
    setShowMemberDropdown,
    setManualStudentName,
    setManualNames,
    setStartDate,
    setStartTime,
    setDurationMin,
    setNotes,
    setRequiresDriver,
    setFilledBy,
    setIsCoachPractice,
    setError,
    setLoading,

    // Actions
    fetchAllData,
    toggleCoach,
    toggleActivityType,
    handleMemberSearch,
    performConflictCheck,
    resetForm,
    refreshCoachTimeOff
  } = useBookingForm({
    initialBooking: booking,
    userEmail: user.email || undefined
  })

  // 複製功能專用的衝突檢查
  const { checkConflict: checkConflictForCopy } = useBookingConflict()

  // 即時衝突檢查狀態
  const [conflictStatus, setConflictStatus] = useState<'checking' | 'available' | 'conflict' | null>(null)
  const [conflictMessage, setConflictMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchAllData()
    }
  }, [isOpen, fetchAllData])

  // 日期變化時刷新教練休假狀態
  useEffect(() => {
    if (isOpen && startDate) {
      refreshCoachTimeOff()
    }
  }, [isOpen, startDate, refreshCoachTimeOff])

  // 即時衝突檢查 Effect（編輯預約用）
  useEffect(() => {
    if (!isOpen || !startDate || !startTime || !selectedBoatId || !booking || !booking.id) {
      setConflictStatus(null)
      return
    }

    const check = async () => {
      setConflictStatus('checking')
      const result = await performConflictCheck(booking.id)
      if (result.hasConflict) {
        setConflictStatus('conflict')
        setConflictMessage(result.reason || '此時段已被預約')
      } else {
        setConflictStatus('available')
        setConflictMessage('✅ 此時段可預約')
      }
    }

    const timer = setTimeout(check, 500) // Debounce
    return () => clearTimeout(timer)
  }, [isOpen, startDate, startTime, durationMin, selectedBoatId, selectedCoaches, performConflictCheck, booking?.id])

  // 即時衝突檢查 Effect（複製預約用）
  useEffect(() => {
    if (!showCopyDialog || !copyToDate || !copyToTime) {
      setCopyConflictStatus(null)
      setCopyError('')
      return
    }

    const checkCopyConflict = async () => {
      setCopyConflictStatus('checking')
      setCopyError('')

      try {
        const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
        const selectedBoat = boats.find(b => b.id === selectedBoatId)
        
        const conflictResult = await checkConflictForCopy({
          boatId: selectedBoatId,
          boatName: selectedBoat?.name,
          date: copyToDate,
          startTime: copyToTime,
          durationMin,
          coachIds: selectedCoaches,
          coachesMap,
          excludeBookingId: undefined
        })

        if (conflictResult.hasConflict) {
          setCopyConflictStatus('conflict')
          setCopyError(conflictResult.reason)
        } else {
          setCopyConflictStatus('available')
        }
      } catch (err) {
        setCopyConflictStatus('conflict')
        setCopyError('檢查衝突時發生錯誤')
      }
    }

    const timer = setTimeout(checkCopyConflict, 500) // Debounce
    return () => clearTimeout(timer)
  }, [showCopyDialog, copyToDate, copyToTime, selectedBoatId, durationMin, selectedCoaches, boats, coaches, checkConflictForCopy])

  if (!isOpen) return null

  // 如果 booking 或 booking.id 不存在，不渲染內容
  if (!booking || !booking.id) {
    return null
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 防止重複提交（最優先檢查）
    if (loading) {
      console.log('更新進行中，忽略重複請求')
      return
    }

    // 安全檢查：確保 booking 和 booking.id 存在
    if (!booking || !booking.id) {
      setError('預約資料不完整，無法更新')
      return
    }

    // 檢查預約人是否填寫
    if (!finalStudentName || !finalStudentName.trim()) {
      setError('請填寫預約人姓名')
      return
    }

    // 檢查填表人是否填寫
    if (!filledBy.trim()) {
      setError('請填寫填表人姓名')
      return
    }

    // 檢查早場預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < EARLY_BOOKING_HOUR_LIMIT && selectedCoaches.length === 0) {
      setError(`${EARLY_BOOKING_HOUR_LIMIT}:00 之前的預約必須指定教練`)
      return
    }

    // 立即設置 loading 防止重複點擊
    setLoading(true)

    try {
      console.log('開始更新預約，ID:', booking.id)
      
      // Combine date and time into ISO format（TEXT 格式，不含時區）
      const newStartAt = `${startDate}T${startTime}:00`

      // 使用 Hook 檢查衝突
      const conflictResult = await performConflictCheck(booking.id)

      if (conflictResult.hasConflict) {
        setError(conflictResult.reason)
        return
      }

      // ... existing update logic ...

      // 更新預約
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          boat_id: selectedBoatId,
          member_id: selectedMemberIds.length > 0 ? selectedMemberIds[0] : null,
          contact_name: finalStudentName,
          start_at: newStartAt,
          duration_min: durationMin,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          filled_by: normalizeFilledByForSave(filledBy),
          requires_driver: requiresDriver,
          is_coach_practice: isCoachPractice,
          updated_at: getLocalTimestamp(),
        })
        .eq('id', booking.id)

      if (updateError) {
        setError(updateError.message || '更新失敗')
        setLoading(false)
        return
      }

      // 刪除舊的教練關聯
      await supabase
        .from('booking_coaches')
        .delete()
        .eq('booking_id', booking.id)

      // 插入新的教練關聯
      if (selectedCoaches.length > 0) {
        const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
          booking_id: booking.id,
          coach_id: coachId,
        }))

        const { error: coachInsertError } = await supabase
          .from('booking_coaches')
          .insert(bookingCoachesToInsert)

        if (coachInsertError) {
          console.error('插入教練關聯失敗:', coachInsertError)
          // 不阻止更新，只記錄錯誤
        }
      }

      // 更新 booking_members（多會員支援）
      // 先刪除舊的
      await supabase
        .from('booking_members')
        .delete()
        .eq('booking_id', booking.id)

      // 插入新的
      if (selectedMemberIds.length > 0) {
        const bookingMembersToInsert = selectedMemberIds.map(memberId => ({
          booking_id: booking.id,
          member_id: memberId
        }))

        const { error: membersInsertError } = await supabase
          .from('booking_members')
          .insert(bookingMembersToInsert)

        if (membersInsertError) {
          console.error('插入會員關聯失敗:', membersInsertError)
        }
      }

      // 檢查是否修改了關鍵字段（時間/船/預約人/教練）
      const coachesChanged = (() => {
        const oldCoachIds = (booking.coaches || []).map(c => c.id).sort().join(',')
        const newCoachIds = [...selectedCoaches].sort().join(',')
        return oldCoachIds !== newCoachIds
      })()

      const contactNameChanged = booking.contact_name !== finalStudentName
      const boatChanged = booking.boat_id !== selectedBoatId

      const timeChanged = (() => {
        const oldDatetime = booking.start_at.substring(0, 16)
        return oldDatetime !== newStartAt.substring(0, 16)
      })()

      const keyFieldsChanged = coachesChanged || contactNameChanged || boatChanged || timeChanged

      // 如果修改了關鍵欄位，檢查是否有排班和回報記錄
      if (keyFieldsChanged) {
        const [driverCheck, coachReportCheck, participantsResult] = await Promise.all([
          supabase
            .from('booking_drivers')
            .select('id', { count: 'exact', head: true })
            .eq('booking_id', booking.id),
          supabase
            .from('coach_reports')
            .select('id', { count: 'exact', head: true })
            .eq('booking_id', booking.id),
          supabase
            .from('booking_participants')
            .select('id, participant_name')
            .eq('booking_id', booking.id)
            .eq('is_deleted', false)
        ])

        const hasDriverAssignment = (driverCheck.count || 0) > 0
        const hasCoachReports = (coachReportCheck.count || 0) > 0
        const hasParticipants = (participantsResult.data || []).length > 0
        const hasAnyReports = hasDriverAssignment || hasCoachReports || hasParticipants

        // 檢查有交易記錄的參與者（單獨查詢）
        let participantsWithTransactions: any[] = []
        if (hasParticipants) {
          const participantIds = participantsResult.data!.map((p: any) => p.id)
          const { data: transactionsData } = await supabase
            .from('transactions')
            .select('id, booking_participant_id')
            .in('booking_participant_id', participantIds)
          
          if (transactionsData && transactionsData.length > 0) {
            const participantIdsWithTx = new Set(transactionsData.map(t => t.booking_participant_id))
            participantsWithTransactions = participantsResult.data!.filter((p: any) => 
              participantIdsWithTx.has(p.id)
            )
          }
        }

        // 如果有任何排班或回報記錄，需要警告用戶
        if (hasAnyReports) {
          const changedFields = []
          if (timeChanged) changedFields.push('時間')
          if (boatChanged) changedFields.push('船')
          if (contactNameChanged) changedFields.push('預約人')
          if (coachesChanged) changedFields.push('教練')

          let confirmMessage = ''

          // 檢查是否有回報記錄（教練回報或參與者記錄）
          const hasReports = hasCoachReports || hasParticipants

          if (hasReports) {
            // 有回報記錄 - 顯示完整訊息
            const warnings = []
            if (hasDriverAssignment) warnings.push('已排班')
            if (hasCoachReports) warnings.push('已有教練回報')
            if (hasParticipants) warnings.push('已有參與者記錄')

            confirmMessage = `⚠️ 您修改了 ${changedFields.join('、')}\n\n此預約已有後續記錄：\n${warnings.join('、')}\n\n修改後將刪除：\n• 所有排班記錄\n• 所有回報記錄\n`

            if (participantsWithTransactions.length > 0) {
              const names = participantsWithTransactions.map((p: any) => p.participant_name).join('、')
              confirmMessage += `\n💰 ${names} 有交易記錄\n（交易記錄會保留，請到「會員儲值」檢查並處理）\n`
            }
          } else {
            // 只有排班 - 顯示簡化訊息
            confirmMessage = `⚠️ 您修改了 ${changedFields.join('、')}\n\n此預約已排班\n\n修改後將刪除：\n• 所有排班記錄\n`
          }

          confirmMessage += `\n確定要修改嗎？`

          if (!confirm(confirmMessage)) {
            console.log('用戶取消修改')
            setLoading(false) // 重置 loading 狀態
            return
          }

          console.log('用戶確認修改，清除排班和回報記錄...')

          // 刪除排班和回報記錄
          await Promise.all([
            supabase.from('booking_drivers').delete().eq('booking_id', booking.id),
            supabase.from('coach_reports').delete().eq('booking_id', booking.id),
            supabase.from('booking_participants').delete().eq('booking_id', booking.id).eq('is_deleted', false)
          ])
        }
      }

      // 如果改為不需要駕駛，靜默刪除司機排班
      if (!requiresDriver) {
        await supabase
          .from('booking_drivers')
          .delete()
          .eq('booking_id', booking.id)
      }

      // 計算變更內容
      const changes: string[] = []

      // 檢查預約人變更
      if (booking.contact_name !== finalStudentName) {
        const oldName = booking.contact_name || '(無)'
        const newName = finalStudentName || '(無)'
        changes.push(`預約人: ${oldName} → ${newName}`)
      }

      // 檢查船變更
      if (booking.boat_id !== selectedBoatId) {
        const oldBoatName = booking.boats?.name || '未知'
        const newBoatName = boats.find(b => b.id === selectedBoatId)?.name || '未知'
        changes.push(`船: ${oldBoatName} → ${newBoatName}`)
      }

      // 檢查教練變更
      const oldCoachNames = booking.coaches && booking.coaches.length > 0
        ? booking.coaches.map(c => c.name).join(' / ')
        : '未指定'
      const newCoachNames = selectedCoaches.length > 0
        ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join(' / ')
        : '未指定'
      if (oldCoachNames !== newCoachNames) {
        changes.push(`教練: ${oldCoachNames} → ${newCoachNames}`)
      }

      // 檢查需要駕駛變更
      if (booking.requires_driver !== requiresDriver) {
        changes.push(`駕駛: ${booking.requires_driver ? '需要' : '無'} → ${requiresDriver ? '需要' : '無'}`)
      }

      // 檢查教練練習變更
      if ((booking.is_coach_practice || false) !== isCoachPractice) {
        changes.push(`教練練習: ${booking.is_coach_practice ? '是' : '否'} → ${isCoachPractice ? '是' : '否'}`)
      }

      // 檢查時間變更
      if (booking.start_at !== newStartAt) {
        const oldDatetime = booking.start_at.substring(0, 16)
        const [oldDate, oldTime] = oldDatetime.split('T')
        const newDatetime = newStartAt.substring(0, 16)
        const [newDate, newTime] = newDatetime.split('T')
        changes.push(`時間: ${oldDate} ${oldTime} → ${newDate} ${newTime}`)
      }

      // 檢查時長變更
      if (booking.duration_min !== durationMin) {
        changes.push(`時長: ${booking.duration_min}分 → ${durationMin}分`)
      }

      // 檢查活動類型變更
      const oldActivities = (booking.activity_types || []).sort().join('+')
      const newActivities = activityTypes.sort().join('+')
      if (oldActivities !== newActivities) {
        changes.push(`活動類型: ${oldActivities || '無'} → ${newActivities || '無'}`)
      }

      // 檢查備註變更
      const oldNotes = booking.notes || ''
      const newNotes = notes || ''
      if (oldNotes !== newNotes) {
        const oldDisplay = oldNotes.length > 20 ? oldNotes.substring(0, 20) + '...' : oldNotes || '無'
        const newDisplay = newNotes.length > 20 ? newNotes.substring(0, 20) + '...' : newNotes || '無'
        changes.push(`備註: ${oldDisplay} → ${newDisplay}`)
      }

      // 只在有變更時才記錄
      if (changes.length > 0) {
        await logBookingUpdate({
          userEmail: user.email || '',
          studentName: finalStudentName,
          startTime: newStartAt,  // 使用更新後的時間
          changes,
          filledBy
        })
      }

      // Success
      // Success
      resetForm()
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '更新失敗')
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    // 安全檢查：確保 booking 和 booking.id 存在
    if (!booking || !booking.id) {
      setError('預約資料不完整，無法刪除')
      return
    }

    // 檢查填表人是否填寫
    if (!filledBy.trim()) {
      setError('請先填寫填表人後再刪除')
      toast.error('請先填寫填表人後再刪除')
      return
    }

    // 防止重複執行
    if (loading || isDeleting) {
      console.log('刪除進行中，忽略重複請求')
      return
    }

    console.log('開始刪除流程，預約 ID:', booking.id)
    setIsDeleting(true) // 標記刪除開始

    try {
      // 檢查是否已有排班、回報記錄和交易記錄（只檢查 booking_drivers）
      const [driversCheck, participantsResult, reportsResult] = await Promise.all([
        supabase
          .from('booking_drivers')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', booking.id),
        supabase
          .from('booking_participants')
          .select('id, participant_name')
          .eq('booking_id', booking.id)
          .eq('is_deleted', false),
        supabase
          .from('coach_reports')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', booking.id)
      ])

      // 檢查資料庫查詢是否有錯誤
      if (driversCheck.error) {
        console.error('查詢排班記錄失敗:', driversCheck.error)
        setError('查詢排班記錄失敗：' + driversCheck.error.message)
        setIsDeleting(false)
        return
      }
      if (participantsResult.error) {
        console.error('查詢參與者記錄失敗:', participantsResult.error)
        setError('查詢參與者記錄失敗：' + participantsResult.error.message)
        setIsDeleting(false)
        return
      }
      if (reportsResult.error) {
        console.error('查詢回報記錄失敗:', reportsResult.error)
        setError('查詢回報記錄失敗：' + reportsResult.error.message)
        setIsDeleting(false)
        return
      }

      const hasDriverAssignment = (driversCheck.count || 0) > 0
      const hasParticipants = (participantsResult.data || []).length > 0
      const hasDriverReports = (reportsResult.count || 0) > 0
      const hasReports = hasDriverAssignment || hasParticipants || hasDriverReports

      // 檢查有交易記錄的參與者（單獨查詢）
      let participantsWithTransactions: any[] = []
      if (hasParticipants) {
        const participantIds = participantsResult.data!.map((p: any) => p.id)
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('id, booking_participant_id')
          .in('booking_participant_id', participantIds)
        
        if (transactionsData && transactionsData.length > 0) {
          const participantIdsWithTx = new Set(transactionsData.map(t => t.booking_participant_id))
          participantsWithTransactions = participantsResult.data!.filter((p: any) => 
            participantIdsWithTx.has(p.id)
          )
        }
      }

      // 根據是否有回報給予不同的提示
      let confirmMessage = '確定要刪除這個預約嗎？'
      if (hasReports || participantsWithTransactions.length > 0) {
        const warnings = []

        // 只檢查 booking_drivers 表，有記錄就顯示「已有排班」
        if (hasDriverAssignment) {
          warnings.push('已有排班')
        }
        if (hasParticipants) warnings.push(`參與者記錄 ${participantsResult.data!.length} 筆`)
        if (hasDriverReports) warnings.push(`駕駛回報 ${reportsResult.count} 筆`)

        confirmMessage = `⚠️ 此預約已有後續記錄：\n${warnings.join('、')}\n\n刪除預約將會同時刪除：\n• 所有排班記錄\n• 所有回報記錄\n`

        if (participantsWithTransactions.length > 0) {
          const names = participantsWithTransactions.map((p: any) => p.participant_name).join('、')
          confirmMessage += `\n💰 ${names} 的交易記錄受影響\n（交易記錄會保留，請到「會員交易」檢查並處理）\n`
        }

        confirmMessage += `\n確定要刪除嗎？`
      }

      if (!confirm(confirmMessage)) {
        console.log('用戶取消刪除')
        setIsDeleting(false)
        return
      }

      console.log('用戶確認刪除，開始執行...')
      // 用戶確認後才開始 loading
      setLoading(true)

      // 🔥 關鍵修復：在刪除之前先查詢完整的預約資料，確保不遺漏任何欄位
      // 因為從 React 狀態傳來的 booking 物件可能不完整（coaches 可能未載入）
      console.log('查詢完整預約資料...')
      const { data: completeBooking, error: queryError } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(name)')
        .eq('id', booking.id)
        .single()
      
      if (queryError) {
        console.error('查詢預約資料失敗:', queryError)
        setError('查詢預約資料失敗')
        setLoading(false)
        setIsDeleting(false)
        return
      }
      
      // 查詢教練和駕駛
      const [coachesData, driversData] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('coaches:coach_id(name)')
          .eq('booking_id', booking.id),
        supabase
          .from('booking_drivers')
          .select('coaches:driver_id(name)')
          .eq('booking_id', booking.id)
      ])

      // 刪除預約（CASCADE 會自動刪除相關記錄）
      console.log('執行刪除...')
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (deleteError) {
        console.error('刪除失敗:', deleteError)
        setError(deleteError.message || '刪除失敗')
        setLoading(false)
        toast.error('刪除失敗：' + (deleteError.message || '未知錯誤'))
        return
      }

      console.log('刪除成功，記錄審計日誌...')
      
      // 記錄到審計日誌（使用表單中重新填寫的填表人）
      await logBookingDeletion({
        userEmail: user.email || '',
        studentName: completeBooking?.contact_name || booking.contact_name,
        boatName: completeBooking?.boats?.name || booking.boats?.name || '未知',
        startTime: completeBooking?.start_at || booking.start_at,
        durationMin: completeBooking?.duration_min || booking.duration_min,
        filledBy: filledBy,  // 使用表單中重新填寫的填表人
        notes: completeBooking?.notes || undefined,  // 保留預約的原始備註
        coachNames: coachesData.data?.map((c: any) => c.coaches?.name).filter(Boolean) || undefined,  // 教練
        driverNames: driversData.data?.map((d: any) => d.coaches?.name).filter(Boolean) || undefined,  // 駕駛
        activityTypes: completeBooking?.activity_types || undefined  // 活動類型
      })

      // Success
      console.log('刪除完成，關閉對話框')
      setLoading(false)
      setIsDeleting(false) // 重置刪除狀態
      toast.success('預約已刪除')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('刪除過程發生錯誤:', err)
      const errorMessage = err.message || '刪除失敗'
      setError(errorMessage)
      setLoading(false)
      setIsDeleting(false) // 重要：重置刪除狀態
      toast.error('刪除失敗：' + errorMessage)
    }
  }

  const handleClose = () => {
    // 如果正在刪除或更新中，不允許關閉
    if (loading || isDeleting) {
      console.log('操作進行中，無法關閉對話框')
      return
    }
    resetForm()
    setError('')
    onClose()
  }

  // 處理複製預約
  const handleCopy = async () => {
    if (!copyToDate) {
      setCopyError('請選擇複製到的日期')
      return
    }

    // ✅ 檢查船隻是否已選擇
    if (!selectedBoatId || selectedBoatId === 0) {
      setCopyError('請選擇船隻')
      return
    }

    if (!copyToTime) {
      setCopyError('請選擇複製到的時間')
      return
    }

    if (!copyFilledBy.trim()) {
      setCopyError('請填寫填表人')
      return
    }

    setCopyLoading(true)
    setCopyError('')

    try {
      // 組合新的日期和時間（使用選擇的時間，不是原預約的時間）
      const newStartAt = `${copyToDate}T${copyToTime}:00`

      // 使用專用的衝突檢查
      const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
      const selectedBoat = boats.find(b => b.id === selectedBoatId)
      
      const conflictResult = await checkConflictForCopy({
        boatId: selectedBoatId,
        boatName: selectedBoat?.name,
        date: copyToDate,
        startTime: copyToTime, // 使用選擇的時間
        durationMin,
        coachIds: selectedCoaches,
        coachesMap,
        excludeBookingId: undefined // 複製是新建預約，不排除任何 ID
      })

      if (conflictResult.hasConflict) {
        setCopyError(conflictResult.reason)
        setCopyLoading(false)
        return
      }

      // 獲取船名稱（用於審計日誌）
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'

      // 創建新預約
      const bookingToInsert = {
        boat_id: selectedBoatId,
        member_id: selectedMemberIds.length > 0 ? selectedMemberIds[0] : null,
        contact_name: finalStudentName,
        contact_phone: null,
        start_at: newStartAt,
        duration_min: durationMin,
        cleanup_minutes: isSelectedBoatFacility ? 0 : 15,     // 設施不需清理時間，船隻需要15分鐘
        activity_types: activityTypes.length > 0 ? activityTypes : null,
        notes: notes || null,
        requires_driver: requiresDriver,
        filled_by: normalizeFilledByForSave(copyFilledBy),
        status: 'confirmed',
        created_by: user.id,
        created_at: getLocalTimestamp(),
      }

      const { data: newBooking, error: insertError } = await supabase
        .from('bookings')
        .insert([bookingToInsert])
        .select()
        .single()

      if (insertError || !newBooking) {
        setCopyError(insertError?.message || '複製失敗')
        setCopyLoading(false)
        return
      }

      // 插入教練關聯
      if (selectedCoaches.length > 0) {
        const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
          booking_id: newBooking.id,
          coach_id: coachId,
        }))

        await supabase
          .from('booking_coaches')
          .insert(bookingCoachesToInsert)
      }

      // 插入多會員關聯
      if (selectedMemberIds.length > 0) {
        const bookingMembersToInsert = selectedMemberIds.map(memberId => ({
          booking_id: newBooking.id,
          member_id: memberId,
        }))

        await supabase
          .from('booking_members')
          .insert(bookingMembersToInsert)
      }

      // 記錄審計日誌
      await logBookingCreation({
        userEmail: user.email || '',
        studentName: finalStudentName,
        boatName,
        startTime: newStartAt,
        durationMin,
        coachNames: selectedCoaches.length > 0
          ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
          : [],
        filledBy: copyFilledBy,
        activityTypes: activityTypes.length > 0 ? activityTypes : undefined,  // 活動類型
        notes: notes || undefined  // 備註
      })

      // Success
      setCopyLoading(false)
      setShowCopyDialog(false)
      setCopyToDate('')
      setCopyToTime('')
      setCopyFilledBy('')
      setCopyError('')
      setCopyConflictStatus(null)
      toast.success(`預約已複製到 ${copyToDate} ${copyToTime}`)
      onSuccess()
    } catch (err: any) {
      setCopyError(err.message || '複製失敗')
      setCopyLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '16px',
        overflowY: isMobile ? 'hidden' : 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : '12px',
          width: '100%',
          maxWidth: '500px',
          color: '#000',
          margin: isMobile ? 'auto 0 0 0' : 'auto',
          position: 'relative',
          maxHeight: isMobile ? '80vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* 標題欄 - Sticky */}
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '20px',
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: isMobile ? '18px' : '20px', 
            fontWeight: 'bold',
            color: '#000',
          }}>
            ✏️ 修改預約
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading || isDeleting}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '28px',
              cursor: (loading || isDeleting) ? 'not-allowed' : 'pointer',
              color: '#666',
              padding: '0 8px',
              opacity: (loading || isDeleting) ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 內容區域 - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '20px' : '20px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <form onSubmit={handleUpdate} id="edit-booking-form">
          {/* 預約人選擇（支援多會員選擇或手動輸入） */}
          <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              預約人 {selectedMemberIds.length > 0 && <span style={{ color: '#4caf50', fontSize: '13px' }}>（已選 {selectedMemberIds.length} 位會員）</span>}
            </label>

            {/* 已選會員和手動輸入標籤 */}
            {(selectedMemberIds.length > 0 || manualNames.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {/* 會員標籤（藍色） */}
                {selectedMemberIds.map((id) => {
                  const member = members.find(m => m.id === id)
                  if (!member) return null
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#2196F3',
                        color: 'white',
                        borderRadius: '16px',
                        fontSize: '14px',
                        fontWeight: '500',
                      }}
                    >
                      {member.nickname || member.name}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberIds(prev => prev.filter(mid => mid !== id))
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '18px',
                          lineHeight: '1',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}

                {/* 非會員標籤（橘色邊框） */}
                {manualNames.map((name, index) => (
                  <span
                    key={index}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'white',
                      color: '#f57c00',
                      border: '1.5px solid #ffb74d',
                      borderRadius: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => setManualNames(prev => prev.filter((_, i) => i !== index))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f57c00',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '18px',
                        lineHeight: '1',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* 清除全部按鈕 */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberIds([])
                    setMemberSearchTerm('')
                    setManualStudentName('')
                    setManualNames([])
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  清除全部
                </button>
              </div>
            )}

            {/* 搜尋會員 */}
            <input
              type="text"
              value={memberSearchTerm}
              onChange={(e) => {
                handleMemberSearch(e.target.value)
              }}
              onFocus={() => setShowMemberDropdown(true)}
              placeholder="搜尋會員暱稱/姓名/電話..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: selectedMemberIds.length > 0 ? '2px solid #4caf50' : '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                touchAction: 'manipulation',
              }}
            />

            {/* 會員下拉選單 */}
            {showMemberDropdown && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '8px',
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
              }}>
                {filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id)
                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        if (!isSelected) {
                          setSelectedMemberIds(prev => [...prev, member.id])
                        }
                        setMemberSearchTerm('')
                        setShowMemberDropdown(false)
                      }}
                      style={{
                        padding: '12px',
                        cursor: isSelected ? 'default' : 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                        background: isSelected ? '#e8f5e9' : 'white',
                        opacity: isSelected ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f5f5f5')}
                      onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {isSelected && '✓ '}
                        {member.nickname || member.name}
                        {member.nickname && <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '6px' }}>({member.name})</span>}
                      </div>
                      {member.phone && (
                        <div style={{ fontSize: '13px', color: '#999' }}>
                          📱 {member.phone}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 或手動輸入 */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <input
                type="text"
                value={manualStudentName}
                onChange={(e) => setManualStudentName(e.target.value)}
                onKeyDown={(e) => {
                  // 檢查是否正在使用輸入法（避免中文輸入時 Enter 確認選字被誤觸發）
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && manualStudentName.trim()) {
                    e.preventDefault()
                    setManualNames(prev => [...prev, manualStudentName.trim()])
                    setManualStudentName('')
                  }
                }}
                placeholder="或直接輸入姓名（非會員/首次體驗）"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ff9800',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (manualStudentName.trim()) {
                    setManualNames(prev => [...prev, manualStudentName.trim()])
                    setManualStudentName('')
                  }
                }}
                disabled={!manualStudentName.trim()}
                style={{
                  padding: '0 20px',
                  background: manualStudentName.trim() ? '#ff9800' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: manualStudentName.trim() ? 'pointer' : 'not-allowed',
                  minWidth: '52px',
                  touchAction: 'manipulation',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* 船隻選擇 - 大按鈕 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              船隻 <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}>
              {boats.map(boat => {
                const isSelected = selectedBoatId === boat.id
                return (
                  <button
                    key={boat.id}
                    type="button"
                    onClick={() => setSelectedBoatId(boat.id)}
                    style={{
                      padding: '14px 8px',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                      borderRadius: '8px',
                      background: isSelected ? '#dbeafe' : 'white',
                      color: '#333',
                      fontSize: '15px',
                      fontWeight: isSelected ? '600' : '500',
                      cursor: 'pointer',
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.background = isSelected ? '#dbeafe' : '#fafafa'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white'
                    }}
                  >
                    {boat.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 教練選擇 - 大按鈕 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              教練（可複選）
            </label>

            {/* 已選教練顯示 */}
            {selectedCoaches.length > 0 && (
              <div style={{
                marginBottom: '12px',
                padding: '12px 14px',
                background: '#dbeafe',
                borderRadius: '8px',
                border: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  minWidth: 0,
                }}>
                  <span style={{ color: '#1e40af', fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                    已選：
                  </span>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    flex: 1,
                  }}>
                    {selectedCoaches.map(coachId => {
                      const coach = coaches.find(c => c.id === coachId)
                      return coach ? (
                        <span
                          key={coachId}
                          style={{
                            padding: '6px 12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: '1px solid #3b82f6',
                            color: '#1e40af',
                            fontSize: '15px',
                            fontWeight: '600',
                          }}
                        >
                          {coach.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCoaches([])}
                  style={{
                    padding: '6px 12px',
                    background: 'white',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    color: '#1e40af',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flexShrink: 0,
                  }}
                >
                  清除
                </button>
              </div>
            )}

            {loadingCoaches ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                載入教練列表中...
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}>
                {/* 不指定教練 */}
                <button
                  type="button"
                  onClick={() => setSelectedCoaches([])}
                  style={{
                    padding: '14px 10px',
                    border: selectedCoaches.length === 0 ? '3px solid #1976d2' : '2px solid #e0e0e0',
                    borderRadius: '10px',
                    background: selectedCoaches.length === 0 ? '#1976d2' : 'white',
                    color: selectedCoaches.length === 0 ? 'white' : '#666',
                    fontSize: '15px',
                    fontWeight: selectedCoaches.length === 0 ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedCoaches.length === 0 ? '0 4px 12px rgba(25,118,210,0.3)' : '0 2px 4px rgba(0,0,0,0.05)',
                    gridColumn: '1 / -1',
                  }}
                  onTouchStart={(e) => {
                    if (selectedCoaches.length > 0) {
                      e.currentTarget.style.transform = 'scale(0.95)'
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  不指定教練
                </button>

                {/* 教練列表 */}
                {coaches.map((coach) => {
                  const isSelected = selectedCoachesSet.has(coach.id)
                  const isOnTimeOff = (coach as any).isOnTimeOff
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() => toggleCoach(coach.id)}
                      style={{
                        padding: '14px 10px',
                        border: isSelected ? '3px solid #1976d2' : '2px solid #e0e0e0',
                        borderRadius: '10px',
                        background: isSelected ? '#e3f2fd' : 'white',
                        color: isSelected ? '#1976d2' : '#333',
                        fontSize: '15px',
                        fontWeight: isSelected ? '700' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 12px rgba(25,118,210,0.15)' : '0 2px 4px rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                      onTouchStart={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'scale(0.95)'
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                    >
                      {isSelected && <span style={{ fontSize: '16px' }}>✓</span>}
                      {coach.name}
                                      {isOnTimeOff && (
                                        <span style={{ marginLeft: '2px', opacity: 0.4 }}>🏖️</span>
                                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 需要駕駛勾選框 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: canRequireDriver ? 'pointer' : 'not-allowed',
              padding: '12px',
              backgroundColor: requiresDriver ? '#dbeafe' : (canRequireDriver ? '#f8f9fa' : '#f5f5f5'),
              borderRadius: '8px',
              border: requiresDriver ? '2px solid #3b82f6' : '1px solid #e0e0e0',
              transition: 'all 0.2s',
              opacity: canRequireDriver ? 1 : 0.6,
            }}>
              <input
                type="checkbox"
                checked={requiresDriver}
                onChange={(e) => setRequiresDriver(e.target.checked)}
                disabled={!canRequireDriver}
                style={{
                  marginRight: '10px',
                  width: '18px',
                  height: '18px',
                  cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  color: requiresDriver ? '#3b82f6' : (canRequireDriver ? '#333' : '#999'),
                }}>
                  🚤 需要駕駛（勾選後在排班時必須指定駕駛）
                </span>
                {!canRequireDriver && (
                  <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                    {isSelectedBoatFacility ? '⚠️ 彈簧床不需要駕駛' : '⚠️ 未指定教練不能選駕駛'}
                  </div>
                )}
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              開始日期
            </label>
            <div style={{ display: 'flex' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                }}
              />
            </div>
            {/* 星期幾顯示 - 更醒目 */}
            {startDate && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '15px',
                fontWeight: '600',
                color: '#495057',
                textAlign: 'center',
              }}>
                {getWeekdayText(startDate)}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              開始時間
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={startTime.split(':')[0]}
                onChange={(e) => {
                  const hour = e.target.value
                  const minute = startTime.split(':')[1] || '00'
                  setStartTime(`${hour}:${minute}`)
                }}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0')
                  return <option key={hour} value={hour}>{hour}</option>
                })}
              </select>
              <select
                value={startTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour = startTime.split(':')[0]
                  const minute = e.target.value
                  setStartTime(`${hour}:${minute}`)
                }}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
            </div>
          </div>

          {/* 時長選擇 - 常用按鈕 + 自訂輸入 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              時長（分鐘）
            </label>

            {/* 常用時長按鈕 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '12px',
            }}>
              {[30, 40, 60, 90, 120, 150, 180, 210].map(minutes => {
                const isSelected = durationMin === minutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDurationMin(minutes)}
                    style={{
                      padding: '12px 8px',
                      border: isSelected ? '3px solid #1976d2' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: isSelected ? '#e3f2fd' : 'white',
                      color: isSelected ? '#1976d2' : '#333',
                      fontSize: '14px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 2px 8px rgba(25,118,210,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                    onTouchStart={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(0.95)'
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {minutes}
                  </button>
                )
              })}
            </div>

            {/* 自訂時長輸入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>自訂：</span>
              <input
                type="text"
                inputMode="numeric"
                value={durationMin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '') // 只允許數字
                  const numValue = Number(value)
                  if (numValue > 0 && numValue <= 999) {
                    setDurationMin(numValue)
                  } else if (value === '') {
                    setDurationMin(0)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#333',
                  boxSizing: 'border-box',
                }}
                placeholder="輸入分鐘數"
              />
              <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>分</span>
            </div>
          </div>

          <BookingDetails
            activityTypesSet={activityTypesSet}
            toggleActivityType={toggleActivityType}
            notes={notes}
            setNotes={setNotes}
            filledBy={filledBy}
            setFilledBy={setFilledBy}
            isCoachPractice={isCoachPractice}
            setIsCoachPractice={setIsCoachPractice}
          />

          {/* 即時衝突回饋 */}
          {conflictStatus && (
            <div style={{
              marginTop: '18px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: conflictStatus === 'conflict' ? '#ffebee' : '#e8f5e9',
              color: conflictStatus === 'conflict' ? '#c62828' : '#2e7d32',
              border: `1px solid ${conflictStatus === 'conflict' ? '#ef9a9a' : '#a5d6a7'}`,
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              {conflictStatus === 'checking' ? '檢查中...' : conflictMessage}
            </div>
          )}

          </form>
        </div>

        {/* 錯誤訊息 - 固定在按鈕上方，不需滾動就能看到 */}
        {error && (
          <div style={{
            padding: isMobile ? '12px 20px' : '14px 24px',
            backgroundColor: '#fff3cd',
            borderTop: '2px solid #ffc107',
            color: '#856404',
            fontSize: '15px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <span style={{ whiteSpace: 'pre-line', flex: 1 }}>{error}</span>
          </div>
        )}

        {/* 按鈕欄 - 固定底部 */}
        <div style={{
          padding: isMobile ? '12px 20px' : '20px 24px',
          borderTop: '1px solid #e0e0e0',
          background: 'white',
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          flexWrap: 'wrap',
          paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom))' : '20px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleDelete()
            }}
            disabled={loading}
            style={{
              padding: isMobile ? '14px 12px' : '12px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#ccc' : '#dc3545',
              color: 'white',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              flex: isMobile ? '0 0 auto' : '0 0 auto',
              minWidth: isMobile ? 'auto' : '100px',
            }}
          >
            🗑️ 刪除
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCopyToTime(startTime)
              setCopyFilledBy(filledBy)
              setShowCopyDialog(true)
            }}
            disabled={loading}
            style={{
              padding: isMobile ? '14px 12px' : '12px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#ccc' : '#ff9800',
              color: 'white',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              flex: isMobile ? '0 0 auto' : '0 0 auto',
              minWidth: isMobile ? 'auto' : '100px',
            }}
            title='複製此預約到其他日期'
          >
            📋 複製
          </button>
          <div style={{ flex: 1, minWidth: isMobile ? '100%' : 'auto', display: 'flex', gap: isMobile ? '8px' : '12px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: isMobile ? '14px' : '12px 24px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#333',
                fontSize: isMobile ? '16px' : '15px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                touchAction: 'manipulation',
                minHeight: isMobile ? '48px' : '44px',
                minWidth: isMobile ? 'auto' : '120px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              form="edit-booking-form"
              disabled={loading || conflictStatus === 'conflict'}
              style={{
                flex: 1,
                padding: isMobile ? '14px' : '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: (loading || conflictStatus === 'conflict') ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                fontSize: isMobile ? '16px' : '15px',
                fontWeight: '600',
                cursor: (loading || conflictStatus === 'conflict') ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
                minHeight: isMobile ? '48px' : '44px',
                minWidth: isMobile ? 'auto' : '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{ 
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  處理中...
                </>
              ) : '✅ 確認更新'}
            </button>
          </div>
        </div>
      </div>

      {/* 複製預約對話框 */}
      {showCopyDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}
          onClick={() => {
            if (!copyLoading) {
              setShowCopyDialog(false)
              setCopyToDate('')
              setCopyToTime('')
              setCopyFilledBy('')
              setCopyError('')
              setCopyConflictStatus(null)
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              color: '#000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              marginTop: 0,
              marginBottom: '20px',
              fontSize: '20px',
              fontWeight: 'bold',
            }}>
              📋 複製預約到其他日期
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <div style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                <div><strong>預約人：</strong>{finalStudentName}</div>
                <div><strong>船隻：</strong>{boats.find(b => b.id === selectedBoatId)?.name}</div>
                <div><strong>教練：</strong>{selectedCoaches.length > 0 
                  ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join('、')
                  : '未指定'}</div>
                <div><strong>時間：</strong>{startTime}</div>
                <div><strong>時長：</strong>{durationMin} 分鐘</div>
              </div>

              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '15px',
                fontWeight: '600',
              }}>
                填表人 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={copyFilledBy}
                onChange={(e) => setCopyFilledBy(e.target.value)}
                placeholder="請輸入您的姓名"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #ff9800',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  marginBottom: '16px',
                }}
              />

              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '15px',
                fontWeight: '600',
              }}>
                複製到日期 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="date"
                value={copyToDate}
                onChange={(e) => setCopyToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #ff9800',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  marginBottom: '16px',
                }}
              />

              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '15px',
                fontWeight: '600',
              }}>
                複製到時間 <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={copyToTime ? copyToTime.split(':')[0] : ''}
                  onChange={(e) => {
                    const hour = e.target.value
                    const minute = copyToTime ? copyToTime.split(':')[1] : '00'
                    setCopyToTime(`${hour}:${minute}`)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #ff9800',
                    boxSizing: 'border-box',
                    fontSize: '16px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">時</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = String(i).padStart(2, '0')
                    return <option key={hour} value={hour}>{hour}</option>
                  })}
                </select>
                <select
                  value={copyToTime ? copyToTime.split(':')[1] : ''}
                  onChange={(e) => {
                    const hour = copyToTime ? copyToTime.split(':')[0] : '00'
                    const minute = e.target.value
                    setCopyToTime(`${hour}:${minute}`)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #ff9800',
                    boxSizing: 'border-box',
                    fontSize: '16px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">分</option>
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>

            {/* 即時衝突檢查狀態顯示 */}
            {copyToDate && copyToTime && (
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                {copyConflictStatus === 'checking' && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#fff3e0',
                    border: '1px solid #ff9800',
                    borderRadius: '8px',
                    color: '#e65100',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}>
                    🔍 檢查中...
                  </div>
                )}
                
                {copyConflictStatus === 'available' && !copyError && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#e8f5e9',
                    border: '1px solid #4caf50',
                    borderRadius: '8px',
                    color: '#2e7d32',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}>
                    ✅ 此時段可預約
                  </div>
                )}
                
                {copyConflictStatus === 'conflict' && copyError && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#ffebee',
                    border: '1px solid #ef5350',
                    borderRadius: '8px',
                    color: '#c62828',
                    fontSize: '14px',
                    fontWeight: '500',
                    whiteSpace: 'pre-line',
                  }}>
                    ⚠️ {copyError}
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
            }}>
              <button
                type="button"
                onClick={() => {
                  if (!copyLoading) {
                    setShowCopyDialog(false)
                    setCopyToDate('')
                    setCopyToTime('')
                    setCopyFilledBy('')
                    setCopyError('')
                    setCopyConflictStatus(null)
                  }
                }}
                disabled={copyLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: copyLoading ? 'not-allowed' : 'pointer',
                  opacity: copyLoading ? 0.5 : 1,
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={copyLoading || !copyFilledBy.trim() || !copyToDate || !copyToTime || copyConflictStatus === 'checking' || copyConflictStatus === 'conflict'}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: (copyLoading || !copyFilledBy.trim() || !copyToDate || !copyToTime || copyConflictStatus === 'checking' || copyConflictStatus === 'conflict') 
                    ? '#ccc' 
                    : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (copyLoading || !copyFilledBy.trim() || !copyToDate || !copyToTime || copyConflictStatus === 'checking' || copyConflictStatus === 'conflict') 
                    ? 'not-allowed' 
                    : 'pointer',
                }}
              >
                {copyLoading ? '複製中...' : '確認複製'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
