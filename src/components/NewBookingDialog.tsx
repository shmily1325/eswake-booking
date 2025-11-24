import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingCreation } from '../utils/auditLog'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { BoatSelector } from './booking/BoatSelector'
import { TimeSelector } from './booking/TimeSelector'
import { MemberSelector } from './booking/MemberSelector'
import { CoachSelector } from './booking/CoachSelector'
import { BookingDetails } from './booking/BookingDetails'

interface NewBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultBoatId: number
  defaultStartTime: string
  user: User
}

export function NewBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  defaultBoatId,
  defaultStartTime,
  user,
}: NewBookingDialogProps) {

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
    defaultBoatId,
    defaultDate: defaultStartTime
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
      const result = await performConflictCheck()
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
  }, [isOpen, startDate, startTime, durationMin, selectedBoatId, selectedCoaches, performConflictCheck])


  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!filledBy.trim()) {
      setError('請填寫填表人姓名')
      return
    }

    setLoading(true)

    try {
      // 獲取船名稱（用於審計日誌和衝突檢查）
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'

      // 構建時間
      const [year, month, day] = startDate.split('-').map(Number)
      const [hour, minute] = startTime.split(':').map(Number)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const newStartAt = `${dateStr}T${timeStr}:00`

      // 最終衝突檢查
      const conflictResult = await performConflictCheck()
      if (conflictResult.hasConflict) {
        setError(conflictResult.reason || '此時段已被預約')
        setLoading(false)
        return
      }

      // 創建預約
      const bookingToInsert = {
        boat_id: selectedBoatId,
        member_id: selectedMemberIds[0] || null,  // 主要會員 ID（向下相容）
        contact_name: finalStudentName,           // 聯絡人姓名
        contact_phone: null,
        start_at: newStartAt,
        duration_min: durationMin,
        activity_types: activityTypes.length > 0 ? activityTypes : null,
        notes: notes || null,
        requires_driver: requiresDriver,
        filled_by: filledBy,                      // 新增填表人欄位
        status: 'confirmed',
        created_by: user.id,
        created_at: (() => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const hour = String(now.getHours()).padStart(2, '0')
          const minute = String(now.getMinutes()).padStart(2, '0')
          const second = String(now.getSeconds()).padStart(2, '0')
          return `${year}-${month}-${day}T${hour}:${minute}:${second}`
        })(),
      }

      const { data: insertedBooking, error: insertError } = await supabase
        .from('bookings')
        .insert([bookingToInsert])
        .select('id')
        .single()

      if (insertError) {
        throw new Error(insertError.message || '插入失敗')
      }

      // 插入教練關聯
      if (selectedCoaches.length > 0 && insertedBooking) {
        const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
          booking_id: insertedBooking.id,
          coach_id: coachId,
        }))

        const { error: coachInsertError } = await supabase
          .from('booking_coaches')
          .insert(bookingCoachesToInsert)

        if (coachInsertError) {
          // 如果插入教練關聯失敗，刪除剛剛創建的預約
          await supabase.from('bookings').delete().eq('id', insertedBooking.id)
          throw new Error('插入教練關聯失敗')
        }
      }

      // 插入會員關聯
      if (selectedMemberIds.length > 0 && insertedBooking) {
        const bookingMembersToInsert = selectedMemberIds.map(memberId => {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const day = String(now.getDate()).padStart(2, '0')
          const hour = String(now.getHours()).padStart(2, '0')
          const minute = String(now.getMinutes()).padStart(2, '0')
          const second = String(now.getSeconds()).padStart(2, '0')
          const createdAt = `${year}-${month}-${day}T${hour}:${minute}:${second}`

          return {
            booking_id: insertedBooking.id,
            member_id: memberId,
            created_at: createdAt
          }
        })

        const { error: memberInsertError } = await supabase
          .from('booking_members')
          .insert(bookingMembersToInsert)

        if (memberInsertError) {
          console.error('插入會員關聯失敗:', memberInsertError)
        }
      }

      // 記錄到審計日誌
      const coachNames = selectedCoaches.length > 0
        ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
        : []

      await logBookingCreation({
        userEmail: user.email || '',
        studentName: finalStudentName,
        boatName,
        startTime: newStartAt,
        durationMin,
        coachNames
      })

      // Success
      resetForm()
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '新增失敗')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
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
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#000', fontSize: '20px', marginBottom: '20px' }}>新增預約</h2>

        <form onSubmit={handleSubmit}>

          {/* 1. 船隻選擇 */}
          <BoatSelector
            boats={boats}
            selectedBoatId={selectedBoatId}
            onSelect={setSelectedBoatId}
          />

          {/* 2. 時間選擇 */}
          <TimeSelector
            startDate={startDate}
            setStartDate={setStartDate}
            startTime={startTime}
            setStartTime={setStartTime}
            durationMin={durationMin}
            setDurationMin={setDurationMin}
          />

          {/* 即時衝突回饋 */}
          {conflictStatus && (
            <div style={{
              marginBottom: '18px',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: conflictStatus === 'conflict' ? '#ffebee' : '#e8f5e9',
              color: conflictStatus === 'conflict' ? '#c62828' : '#2e7d32',
              border: `1px solid ${conflictStatus === 'conflict' ? '#ef9a9a' : '#a5d6a7'}`,
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {conflictStatus === 'checking' ? '檢查中...' : conflictMessage}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />

          {/* 3. 會員選擇 */}
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

          {/* 4. 教練選擇 */}
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

          {/* 5. 其他詳情 (含填表人) */}
          <BookingDetails
            activityTypesSet={activityTypesSet}
            toggleActivityType={toggleActivityType}
            notes={notes}
            setNotes={setNotes}
            filledBy={filledBy}
            setFilledBy={setFilledBy}
          />

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
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
          }}>
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
                minHeight: '52px',
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
                minHeight: '52px',
              }}
            >
              {loading ? '處理中...' : '確認新增'}
            </button>
          </div>
        </form>
        {isMobile && (
          <div style={{ height: '80px' }} />
        )}
      </div>
    </div>
  )
}
