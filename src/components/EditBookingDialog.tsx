import { useEffect, useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingUpdate, logBookingDeletion } from '../utils/auditLog'
import { getLocalTimestamp } from '../utils/date'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { normalizeFilledByForSave } from '../utils/filledByHelper'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { isFacility } from '../utils/facility'
import type { Booking } from '../types/booking'
import { useToast } from './ui'

import { BoatSelector } from './booking/BoatSelector'
import { TimeSelector } from './booking/TimeSelector'
import { MemberSelector } from './booking/MemberSelector'
import { CoachSelector } from './booking/CoachSelector'
import { BookingDetails } from './booking/BookingDetails'
import { BookingAlternativeSuggestions } from './booking/BookingAlternativeSuggestions'
import { scheduleCoachTimeOffReminderToast } from '../utils/coachTimeOffWarning'
import { designSystem, getButtonStyle } from '../styles/designSystem'
import { useBookingAlternatives } from '../hooks/useBookingAlternatives'

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


  // 即時衝突檢查狀態
  const [conflictStatus, setConflictStatus] = useState<'checking' | 'available' | 'conflict' | null>(null)
  const [conflictMessage, setConflictMessage] = useState('')
  const alternatives = useBookingAlternatives({
    enabled: isOpen && conflictStatus === 'conflict',
    date: startDate,
    startTime,
    durationMin,
    selectedBoatId,
    boats,
    coachIds: selectedCoaches,
    excludeBookingId: booking?.id,
  })

  // 只在對話框開啟時抓一次資料；用 ref 取得最新的 fetchAllData，
  // 避免 fetchAllData 隨 startTime/durationMin 變動而換 identity 造成重覆抓取
  const fetchAllDataRef = useRef(fetchAllData)
  fetchAllDataRef.current = fetchAllData
  useEffect(() => {
    if (isOpen) {
      fetchAllDataRef.current()
    }
  }, [isOpen])

  // 日期變化時刷新教練休假狀態
  useEffect(() => {
    if (isOpen && startDate) {
      refreshCoachTimeOff()
    }
  }, [isOpen, startDate, startTime, durationMin, refreshCoachTimeOff])

  // 當選到設施時，自動取消需要駕駛
  useEffect(() => {
    if (!isOpen) return
    if (isSelectedBoatFacility && requiresDriver) {
      setRequiresDriver(false)
      // 溫和提示（不阻斷）
      toast.info('已自動取消「需要駕駛」，因為設施不需駕駛')
    }
  }, [isOpen, isSelectedBoatFacility, requiresDriver, setRequiresDriver, toast])

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


  if (!isOpen) return null

  // 如果 booking 或 booking.id 不存在，不渲染內容
  if (!booking || !booking.id) {
    return null
  }

  const handleSelectAlternativeTime = (time: string) => {
    setConflictStatus('checking')
    setStartTime(time)
  }

  const handleSelectAlternativeBoat = (boatId: number) => {
    setConflictStatus('checking')
    setSelectedBoatId(boatId)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 防止重複提交（最優先檢查）
    if (loading) {
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

    // 檢查教練：彈簧床、陸上課程一律必須指定；其他船隻 08:00 前必須指定
    const boatName = boats.find(b => b.id === selectedBoatId)?.name || ''
    const [hour] = startTime.split(':').map(Number)
    const needsCoach = isFacility(boatName) || hour < EARLY_BOOKING_HOUR_LIMIT
    if (needsCoach && selectedCoaches.length === 0) {
      setError(isFacility(boatName) ? '彈簧床、陸上課程必須指定教練' : `${EARLY_BOOKING_HOUR_LIMIT}:00 之前的預約必須指定教練`)
      return
    }

    // 立即設置 loading 防止重複點擊
    setLoading(true)

    try {
      // Combine date and time into ISO format（TEXT 格式，不含時區）
      const newStartAt = `${startDate}T${startTime}:00`

      // 使用 Hook 檢查衝突
      const conflictResult = await performConflictCheck(booking.id)

      if (conflictResult.hasConflict) {
        setError(conflictResult.reason)
        setLoading(false)
        return
      }

      // ... pre-write checks only (no writes yet) ...

      // 進一步檢查：以新時段（含+15分緩衝）檢查「已排教練/駕駛」是否與當天其他單重疊（同船豁免）
      let mustClearByPersonConflict = false
      let personConflictDetails: string[] = []
      {
        // 1) 取得此預約目前資料庫中的已排教練與駕駛（以 DB 為準）
        const [dbCoachesRes, dbDriversRes] = await Promise.all([
          supabase.from('booking_coaches').select('coach_id').eq('booking_id', booking.id),
          supabase.from('booking_drivers').select('driver_id').eq('booking_id', booking.id)
        ])
        const assignedCoachIds: string[] = (dbCoachesRes.data || []).map((r: any) => r.coach_id)
        const assignedDriverIds: string[] = (dbDriversRes.data || []).map((r: any) => r.driver_id)
        const assignedPersonIds = Array.from(new Set([...assignedCoachIds, ...assignedDriverIds]))

        if (assignedPersonIds.length > 0) {
          // 2) 查詢這些人當天所有其他預約（教練/駕駛兩表），只取 confirmed
          const dateStr = startDate
          const [coachBookingsResult, driverBookingsResult] = await Promise.all([
            supabase
              .from('booking_coaches')
              .select('coach_id, booking_id, bookings:booking_id!inner(id, start_at, duration_min, contact_name, boat_id, status, boats(id, name))')
              .eq('bookings.status', 'confirmed')
              .in('coach_id', assignedPersonIds),
            supabase
              .from('booking_drivers')
              .select('driver_id, booking_id, bookings:booking_id!inner(id, start_at, duration_min, contact_name, boat_id, status, boats(id, name))')
              .eq('bookings.status', 'confirmed')
              .in('driver_id', assignedPersonIds)
          ])

          type DbSched = { id: number; start: string; end: string; name: string; boatId: number }
          const dbPersonBookings: Record<string, Map<number, DbSched>> = {}
          const coachBufferMinutes = 15

          const addBooking = (personId: string, other: any) => {
            if (!other) return
            if (!other.start_at.startsWith(dateStr)) return
            if (!dbPersonBookings[personId]) dbPersonBookings[personId] = new Map()
            const map = dbPersonBookings[personId]
            if (!map.has(other.id)) {
              const [, timePart] = other.start_at.split('T')
              const [hours, minutes] = timePart.split(':').map(Number)
              const totalMinutes = hours * 60 + minutes + other.duration_min + coachBufferMinutes
              const endHours = Math.floor(totalMinutes / 60)
              const endMinutes = totalMinutes % 60
              const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
              map.set(other.id, {
                id: other.id,
                start: timePart.substring(0, 5),
                end: endTime,
                name: other.contact_name,
                boatId: other.boat_id
              })
            }
          }

          coachBookingsResult.data?.forEach((item: any) => {
            addBooking(item.coach_id, (item as any).bookings)
          })
          driverBookingsResult.data?.forEach((item: any) => {
            addBooking(item.driver_id, (item as any).bookings)
          })

          // 3) 與新時段比較是否重疊（同船豁免；排除自己這筆）
          const currentBoatId = selectedBoatId
          const [, timePart] = newStartAt.split('T')
          const [hh, mm] = timePart.substring(0, 5).split(':').map(Number)
          const totalNew = hh * 60 + mm + durationMin + coachBufferMinutes
          const newEnd = `${String(Math.floor(totalNew / 60)).padStart(2, '0')}:${String(totalNew % 60).padStart(2, '0')}`
          const newStart = timePart.substring(0, 5)

          const conflicts: string[] = []
          const conflictSet = new Set<string>()
          for (const personId of assignedPersonIds) {
            const map = dbPersonBookings[personId]
            if (!map) continue
            for (const [otherId, other] of map.entries()) {
              if (otherId === booking.id) continue
              // 時段重疊檢查（字串 HH:MM 比較足夠同日）
              if (newStart < other.end && newEnd > other.start) {
                // 同船豁免
                if (other.boatId === currentBoatId) continue
                const person = coaches.find(c => c.id === personId)
                const personName = person?.name || '未知'
                const times = [
                  `${newStart}-${newEnd}|${finalStudentName}`,
                  `${other.start}-${other.end}|${other.name}`
                ].sort()
                const key = `${personName}|${times[0]}|${times[1]}`
                if (!conflictSet.has(key)) {
                  conflictSet.add(key)
                  conflicts.push(`${personName} 在 ${newStart}-${newEnd} (${finalStudentName}) 與 ${other.start}-${other.end} (${other.name}) 時間重疊`)
                }
              }
            }
          }

          if (conflicts.length > 0) {
            mustClearByPersonConflict = true
            personConflictDetails = conflicts
          }
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

      // 準備合併檢查：是否需要清除既有資料或提示
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
      // 排班定義僅限駕駛（drivers）

      // 檢查有交易記錄的參與者（只為了提示用）
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

      // 最終是否需要駕駛（影響清理規則）
      const finalRequiresDriver = isSelectedBoatFacility ? false : requiresDriver

      // 是否需要合併彈窗確認
      // 需求：只有「真的需要清掉既有排班/回報/參與者」時才跳出
      // - 若偵測到已排人員時間重疊（mustClearByPersonConflict）一定需要清除 → 跳出
      // - 若資料庫中確實存在任何「排班/回報/參與者」將被刪除，才跳出
      //   （無論是因為關鍵欄位變動或最終不需要駕駛）
      const hasRecordsToBeCleared = hasDriverAssignment || hasCoachReports || hasParticipants
      const needConfirm = mustClearByPersonConflict || hasRecordsToBeCleared

      if (needConfirm) {
        const changedFields = []
        if (timeChanged) changedFields.push('時間')
        if (boatChanged) changedFields.push('船')
        if (contactNameChanged) changedFields.push('預約人')
        if (coachesChanged) changedFields.push('教練')

        const warnings = []
        if (hasDriverAssignment) warnings.push('已排班/駕駛')
        if (hasCoachReports) warnings.push('已有教練回報')
        if (hasParticipants) warnings.push('已有參與者記錄')

        const reasons: string[] = []
        // 僅作背景說明：哪些欄位有變更（非觸發條件）
        if (changedFields.length > 0) reasons.push(`修改了 ${changedFields.join('、')}`)
        if (mustClearByPersonConflict && personConflictDetails.length > 0) {
          reasons.push('偵測已排人員與其他預約時間重疊（含+15 分緩衝）')
        }
        if (!finalRequiresDriver && hasRecordsToBeCleared) {
          reasons.push(`最終狀態為「不需要駕駛」${isSelectedBoatFacility ? '（設施）' : ''}`)
        }

        let confirmMessage = `⚠️ 因為：\n• ${reasons.join('\n• ')}\n`
        if (warnings.length > 0) {
          confirmMessage += `\n此預約已有後續記錄：\n${warnings.join('、')}\n`
        }
        if (mustClearByPersonConflict && personConflictDetails.length > 0) {
          confirmMessage += `\n衝突明細：\n${personConflictDetails.map(c => `• ${c}`).join('\n')}\n`
        }
        // 合併刪除說明（取超集，確保一致性）
        confirmMessage += `\n修改後將刪除：\n`
        if (hasDriverAssignment) confirmMessage += `• 所有排班記錄（教練＋駕駛）\n`
        if (hasCoachReports) confirmMessage += `• 所有回報記錄\n`
        if (hasParticipants) confirmMessage += `• 所有參與者記錄\n`
        if (participantsWithTransactions.length > 0) {
          const names = participantsWithTransactions.map((p: any) => p.participant_name).join('、')
          confirmMessage += `\n💰 ${names} 有交易記錄\n（交易記錄會保留，請到「會員儲值」檢查並處理）\n`
        }
        confirmMessage += `\n確定要修改嗎？`

        if (!confirm(confirmMessage)) {
          setLoading(false)
          return
        }

        // 統一刪除（在任何寫入前）— 檢查每個錯誤，避免靜默失敗
        const [coachDelRes, driverDelRes, reportDelRes, partDelRes] = await Promise.all([
          supabase.from('booking_coaches').delete().eq('booking_id', booking.id),
          supabase.from('booking_drivers').delete().eq('booking_id', booking.id),
          supabase.from('coach_reports').delete().eq('booking_id', booking.id),
          supabase.from('booking_participants').delete().eq('booking_id', booking.id).eq('is_deleted', false)
        ])
        if (coachDelRes.error) throw new Error(`清除教練分配失敗: ${coachDelRes.error.message}`)
        if (driverDelRes.error) throw new Error(`清除駕駛分配失敗: ${driverDelRes.error.message}`)
        if (reportDelRes.error) throw new Error(`清除回報記錄失敗: ${reportDelRes.error.message}`)
        if (partDelRes.error) throw new Error(`清除參與者失敗: ${partDelRes.error.message}`)
      } else {
        // 不需要彈窗仍保險性確保：若最終不需要駕駛，清空駕駛排班
        if (!finalRequiresDriver) {
          const { error: silentDelError } = await supabase.from('booking_drivers').delete().eq('booking_id', booking.id)
          if (silentDelError) throw new Error(`清除駕駛分配失敗: ${silentDelError.message}`)
        }
      }

      // 實際開始寫入：更新預約（設施不需清理時間，船隻需要15分鐘）
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          boat_id: selectedBoatId,
          member_id: selectedMemberIds.length > 0 ? selectedMemberIds[0] : null,
          contact_name: finalStudentName,
          start_at: newStartAt,
          duration_min: durationMin,
          cleanup_minutes: isSelectedBoatFacility ? 0 : 15,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          filled_by: normalizeFilledByForSave(filledBy),
          // 設施一律不需要駕駛（強制覆蓋為 false）
          requires_driver: isSelectedBoatFacility ? false : requiresDriver,
          is_coach_practice: isCoachPractice,
          updated_at: getLocalTimestamp(),
        })
        .eq('id', booking.id)

      if (updateError) {
        setError(updateError.message || '更新失敗')
        setLoading(false)
        return
      }

      // 重寫教練關聯（先刪再插）— 全部檢查錯誤
      const { error: coachDelError2 } = await supabase
        .from('booking_coaches')
        .delete()
        .eq('booking_id', booking.id)
      if (coachDelError2) throw new Error(`清除教練關聯失敗: ${coachDelError2.message}`)

      if (selectedCoaches.length > 0) {
        const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
          booking_id: booking.id,
          coach_id: coachId,
        }))

        // 用 .select() 取回實際寫入的 rows 做驗證，少一筆就 throw
        const { data: insertedCoaches, error: coachInsertError } = await supabase
          .from('booking_coaches')
          .insert(bookingCoachesToInsert)
          .select('booking_id, coach_id')

        if (coachInsertError) {
          console.error('插入教練關聯失敗:', coachInsertError)
          throw new Error(`插入教練關聯失敗: ${coachInsertError.message}`)
        }
        if (!insertedCoaches || insertedCoaches.length !== bookingCoachesToInsert.length) {
          throw new Error(
            `教練關聯儲存驗證失敗：預期 ${bookingCoachesToInsert.length} 筆、實際 ${insertedCoaches?.length ?? 0} 筆，請重試`
          )
        }
      }

      // 更新 booking_members（多會員支援）：先刪後插
      const { error: memberDelError } = await supabase
        .from('booking_members')
        .delete()
        .eq('booking_id', booking.id)
      if (memberDelError) throw new Error(`清除會員關聯失敗: ${memberDelError.message}`)

      if (selectedMemberIds.length > 0) {
        const bookingMembersToInsert = selectedMemberIds.map(memberId => ({
          booking_id: booking.id,
          member_id: memberId
        }))

        const { data: insertedMembers, error: membersInsertError } = await supabase
          .from('booking_members')
          .insert(bookingMembersToInsert)
          .select('booking_id, member_id')

        if (membersInsertError) {
          console.error('插入會員關聯失敗:', membersInsertError)
          throw new Error(`插入會員關聯失敗: ${membersInsertError.message}`)
        }
        if (!insertedMembers || insertedMembers.length !== bookingMembersToInsert.length) {
          throw new Error(
            `會員關聯儲存驗證失敗：預期 ${bookingMembersToInsert.length} 筆、實際 ${insertedMembers?.length ?? 0} 筆，請重試`
          )
        }
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

      // Success（先關閉再以 toast 提示休假）
      resetForm()
      setLoading(false)
      onSuccess()
      onClose()
      scheduleCoachTimeOffReminderToast(selectedCoaches, newStartAt.substring(0, 10), '預約已更新。', {
        startTime: newStartAt.substring(11, 16),
        durationMin,
      })
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
      return
    }

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
        setIsDeleting(false)
        return
      }

      // 用戶確認後才開始 loading
      setLoading(true)

      // 🔥 關鍵修復：在刪除之前先查詢完整的預約資料，確保不遺漏任何欄位
      // 因為從 React 狀態傳來的 booking 物件可能不完整（coaches 可能未載入）
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
        activityTypes: completeBooking?.activity_types || undefined,  // 活動類型
        isCoachPractice: completeBooking?.is_coach_practice === true,
        requiresDriver: completeBooking?.requires_driver === true,
      })

      // Success
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
      return
    }
    resetForm()
    setError('')
    onClose()
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
          color: designSystem.colors.text.primary,
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
          borderBottom: `1px solid ${designSystem.colors.border.light}`,
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
            color: designSystem.colors.text.primary,
          }}>
            修改預約
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
              color: designSystem.colors.text.secondary,
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
          {/* 1. 預約人選擇 */}
          <MemberSelector
            members={members}
            selectedMemberIds={selectedMemberIds}
            setSelectedMemberIds={setSelectedMemberIds}
            memberSearchTerm={memberSearchTerm}
            setMemberSearchTerm={setMemberSearchTerm}
            showMemberDropdown={showMemberDropdown}
            setShowMemberDropdown={setShowMemberDropdown}
            filteredMembers={filteredMembers}
            handleMemberSearch={handleMemberSearch}
            manualStudentName={manualStudentName}
            setManualStudentName={setManualStudentName}
            manualNames={manualNames}
            setManualNames={setManualNames}
          />

          {/* 2. 船隻選擇 */}
          <BoatSelector
            boats={boats}
            selectedBoatId={selectedBoatId}
            onSelect={setSelectedBoatId}
          />

          {/* 3. 教練選擇（含需要駕駛） */}
          <CoachSelector
            coaches={coaches}
            selectedCoaches={selectedCoaches}
            selectedCoachesSet={selectedCoachesSet}
            setSelectedCoaches={setSelectedCoaches}
            toggleCoach={toggleCoach}
            loadingCoaches={loadingCoaches}
            requiresDriver={requiresDriver}
            setRequiresDriver={setRequiresDriver}
            canRequireDriver={canRequireDriver}
            isSelectedBoatFacility={isSelectedBoatFacility}
          />

          {/* 4. 時間選擇（開始日期+開始時間+時長） */}
          <TimeSelector
            startDate={startDate}
            setStartDate={setStartDate}
            startTime={startTime}
            setStartTime={setStartTime}
            durationMin={durationMin}
            setDurationMin={setDurationMin}
          />

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

          {conflictStatus === 'conflict' && (
            <BookingAlternativeSuggestions
              status={alternatives.status}
              nearbyTimes={alternatives.nearbyTimes}
              otherBoats={alternatives.otherBoats}
              originalTime={startTime}
              hasSelectedCoach={selectedCoaches.length > 0}
              isMobile={isMobile}
              onSelectTime={handleSelectAlternativeTime}
              onSelectBoat={(boat) => handleSelectAlternativeBoat(boat.id)}
            />
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

        {/* 按鈕欄 - 固定底部一排（Safari 底部工具列／Home 指示條額外留白） */}
        <div style={{
          padding: isMobile ? '12px 16px' : '20px 24px',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: 'white',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: isMobile ? '8px' : '12px',
          flexWrap: 'nowrap',
          paddingBottom: isMobile
            ? 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))'
            : '20px',
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
              ...getButtonStyle('outline', 'large', isMobile),
              color: designSystem.colors.danger[700],
              borderColor: `${designSystem.colors.danger[500]}66`,
              background: 'transparent',
              boxShadow: 'none',
              fontSize: isMobile ? '15px' : '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              flex: 1,
              minWidth: 0,
              paddingLeft: isMobile ? '12px' : '18px',
              paddingRight: isMobile ? '12px' : '18px',
              whiteSpace: 'nowrap',
            }}
          >
            刪除
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              ...getButtonStyle('secondary', 'large', isMobile),
              flex: 1,
              minWidth: 0,
              fontSize: isMobile ? '15px' : '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              whiteSpace: 'nowrap',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            form="edit-booking-form"
            data-track="booking_edit_save"
            disabled={loading || conflictStatus === 'conflict'}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              flex: 1,
              minWidth: 0,
              fontSize: isMobile ? '15px' : '15px',
              ...(loading || conflictStatus === 'conflict'
                ? { background: designSystem.colors.text.disabled, boxShadow: 'none', cursor: 'not-allowed' }
                : {}),
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              whiteSpace: 'nowrap',
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
            ) : '確認更新'}
          </button>
        </div>
      </div>

    </div>
  )
}
