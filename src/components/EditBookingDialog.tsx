import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingUpdate, logBookingDeletion } from '../utils/auditLog'
import { getLocalTimestamp } from '../utils/date'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import type { Booking } from '../types/booking'

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
    setError,
    setLoading,

    // Actions
    fetchAllData,
    toggleCoach,
    toggleActivityType,
    handleMemberSearch,
    performConflictCheck,
    resetForm
  } = useBookingForm({
    initialBooking: booking
  })

  // 即時衝突檢查狀態
  const [conflictStatus, setConflictStatus] = useState<'checking' | 'available' | 'conflict' | null>(null)
  const [conflictMessage, setConflictMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchAllData()
    }
  }, [isOpen, fetchAllData])

  // 即時衝突檢查 Effect
  useEffect(() => {
    if (!isOpen || !startDate || !startTime || !selectedBoatId) {
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
  }, [isOpen, startDate, startTime, durationMin, selectedBoatId, selectedCoaches, performConflictCheck, booking.id])

  if (!isOpen) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 檢查早場預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < EARLY_BOOKING_HOUR_LIMIT && selectedCoaches.length === 0) {
      setError(`${EARLY_BOOKING_HOUR_LIMIT}:00 之前的預約必須指定教練`)
      return
    }

    setLoading(true)

    try {
      // Combine date and time into ISO format（TEXT 格式，不含時區）
      const newStartAt = `${startDate}T${startTime}:00`

      // ... existing logic for checking reports and drivers ...

      // 使用 Hook 檢查衝突
      const conflictResult = await performConflictCheck(booking.id)

      if (conflictResult.hasConflict) {
        setError(conflictResult.reason)
        setLoading(false)
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
          filled_by: filledBy,
          requires_driver: requiresDriver,
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

      // 如果修改了關鍵字段（時間/船只/預約人/教練），清空駕駛分配，需要重新排班
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

      const shouldClearDrivers = coachesChanged || contactNameChanged || boatChanged || timeChanged

      if (shouldClearDrivers || !requiresDriver) {
        await supabase
          .from('booking_drivers')
          .delete()
          .eq('booking_id', booking.id)
      }

      // 計算變更內容
      const changes: string[] = []

      // 檢查預約人變更
      if (booking.contact_name !== finalStudentName) {
        changes.push(`預約人: ${booking.contact_name} → ${finalStudentName}`)
      }

      // 檢查船只變更
      if (booking.boat_id !== selectedBoatId) {
        const oldBoatName = booking.boats?.name || '未知'
        const newBoatName = boats.find(b => b.id === selectedBoatId)?.name || '未知'
        changes.push(`船只: ${oldBoatName} → ${newBoatName}`)
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
        changes.push(`需要駕駛: ${booking.requires_driver ? '是' : '否'} → ${requiresDriver ? '是' : '否'}`)
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
          changes
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
    setLoading(true)

    try {
      // 檢查是否已有回報記錄和交易記錄（優化：使用 JOIN 一次查詢）
      const [participantsResult, reportsResult] = await Promise.all([
        supabase
          .from('booking_participants')
          .select(`
            id,
            participant_name,
            transactions(count)
          `)
          .eq('booking_id', booking.id)
          .eq('is_deleted', false),
        supabase
          .from('coach_reports')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', booking.id)
      ])

      const hasParticipants = (participantsResult.data || []).length > 0
      const hasDriverReports = (reportsResult.count || 0) > 0
      const hasReports = hasParticipants || hasDriverReports

      // 檢查有交易記錄的參與者
      const participantsWithTransactions = hasParticipants
        ? participantsResult.data!.filter((p: any) => {
          const txCount = p.transactions?.[0]?.count || 0
          return txCount > 0
        })
        : []

      // 根據是否有回報給予不同的提示
      let confirmMessage = '確定要刪除這個預約嗎？'
      if (hasReports || participantsWithTransactions.length > 0) {
        const warnings = []

        if (hasParticipants) warnings.push(`參與者記錄 ${participantsResult.data!.length} 筆`)
        if (hasDriverReports) warnings.push(`駕駛回報 ${reportsResult.count} 筆`)

        confirmMessage = `⚠️ 此預約已有回報記錄：\n${warnings.join('、')}\n\n刪除預約將會同時刪除所有回報記錄！\n`

        if (participantsWithTransactions.length > 0) {
          const names = participantsWithTransactions.map((p: any) => p.participant_name).join('、')
          confirmMessage += `\n⚠️ 重要提醒：\n其中 ${participantsWithTransactions.length} 位參與者（${names}）已有交易記錄。\n回報記錄會被刪除，但交易記錄不會變動。\n請記得到「會員交易」檢查並處理！\n`
        }

        confirmMessage += `\n確定要刪除嗎？`
      }

      if (!confirm(confirmMessage)) {
        setLoading(false)
        return
      }

      // 刪除預約（CASCADE 會自動刪除相關記錄）
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (deleteError) {
        setError(deleteError.message || '刪除失敗')
        setLoading(false)
        return
      }

      // 記錄到審計日誌
      await logBookingDeletion({
        userEmail: user.email || '',
        studentName: booking.contact_name,
        boatName: booking.boats?.name || '未知',
        startTime: booking.start_at,
        durationMin: booking.duration_min
      })

      // Success
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '刪除失敗')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      setError('')
      onClose()
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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
          color: '#000',
          margin: 'auto',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleUpdate}>
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                touchAction: 'manipulation',
              }}
            />
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
              {[30, 60, 90, 120, 150, 180, 210, 240].map(minutes => {
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
                type="number"
                value={durationMin}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value > 0 && value <= 999) {
                    setDurationMin(value)
                  }
                }}
                min="1"
                max="999"
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

          {/* 錯誤訊息 */}
          {error && (
            <div style={{
              padding: '14px 16px',
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              marginTop: '20px',
              color: '#856404',
              fontSize: '15px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ whiteSpace: 'pre-line', flex: 1 }}>{error}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '20px',
            position: 'relative',
            zIndex: 10,
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
                padding: '14px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#ccc' : '#dc3545',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
                minWidth: '70px',
                position: 'relative',
                zIndex: 10,
              }}
            >
              刪除
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#333',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                touchAction: 'manipulation',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || conflictStatus === 'conflict'}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: (loading || conflictStatus === 'conflict') ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '500',
                cursor: (loading || conflictStatus === 'conflict') ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {loading ? '處理中...' : '確認更新'}
            </button>
          </div>
        </form>
      </div>
      {isMobile && (
        <div style={{ height: '20px' }} />
      )}
    </div>
  )
}
