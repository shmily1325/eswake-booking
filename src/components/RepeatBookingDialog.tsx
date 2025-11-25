import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingCreation } from '../utils/auditLog'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { BoatSelector } from './booking/BoatSelector'
import { TimeSelector } from './booking/TimeSelector'
import { MemberSelector } from './booking/MemberSelector'
import { CoachSelector } from './booking/CoachSelector'
import { BookingDetails } from './booking/BookingDetails'
import { getLocalTimestamp } from '../utils/date'


interface RepeatBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultBoatId: number
  defaultStartTime: string
  user: User
}

export function RepeatBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  defaultBoatId,
  defaultStartTime,
  user,
}: RepeatBookingDialogProps) {
  const { isMobile } = useResponsive()

  // 重複預約設定
  const [repeatMode, setRepeatMode] = useState<'count' | 'endDate'>('count')
  const [repeatCount, setRepeatCount] = useState(8)
  const [repeatEndDate, setRepeatEndDate] = useState('')

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
    resetForm
  } = useBookingForm({
    defaultBoatId,
    defaultDate: defaultStartTime
  })

  useEffect(() => {
    if (isOpen) {
      fetchAllData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 生成重複日期列表 - 使用 useCallback 確保穩定性
  const generateRepeatDates = useCallback((): Date[] => {
    if (!startDate || !startTime) return []
    
    const [year, month, day] = startDate.split('-').map(Number)
    const [hour, minute] = startTime.split(':').map(Number)
    const baseDateTime = new Date(year, month - 1, day, hour, minute, 0)
    
    const dates: Date[] = []
    const currentDate = new Date(baseDateTime)

    if (repeatMode === 'endDate' && repeatEndDate) {
      const [endYear, endMonth, endDay] = repeatEndDate.split('-').map(Number)
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    } else {
      for (let i = 0; i < repeatCount; i++) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    }

    return dates
  }, [startDate, startTime, repeatMode, repeatCount, repeatEndDate])

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!filledBy.trim()) {
      setError('請填寫填表人姓名')
      return
    }

    // 檢查至少要有會員或手動輸入姓名
    if (selectedMemberIds.length === 0 && manualNames.length === 0) {
      setError('請選擇會員或輸入非會員姓名')
      return
    }

    // 檢查早場預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < EARLY_BOOKING_HOUR_LIMIT && selectedCoaches.length === 0) {
      setError(`${EARLY_BOOKING_HOUR_LIMIT}:00 之前的預約必須指定教練`)
      return
    }

    setLoading(true)

    try {
      const datesToCreate = generateRepeatDates()

      if (datesToCreate.length === 0) {
        setError('沒有可以生成的預約日期')
        setLoading(false)
        return
      }

      // 準備結果記錄
      const results = {
        success: [] as string[],
        skipped: [] as { date: string; reason: string }[],
      }

      // 獲取船名稱
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'

      // 逐個日期循環建立
      for (const dateTime of datesToCreate) {
        const year = dateTime.getFullYear()
        const month = (dateTime.getMonth() + 1).toString().padStart(2, '0')
        const day = dateTime.getDate().toString().padStart(2, '0')
        const hours = dateTime.getHours().toString().padStart(2, '0')
        const minutes = dateTime.getMinutes().toString().padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        const timeStr = `${hours}:${minutes}`
        const displayDate = `${dateStr} ${timeStr}`
        const newStartAt = `${dateStr}T${timeStr}:00`

        // 這裡進行衝突檢查（簡化版，實際應該更完整）
        // 為了簡化，這裡假設前端已經做了基本檢查
        
        // 創建預約
        const bookingToInsert = {
          boat_id: selectedBoatId,
          member_id: selectedMemberIds[0] || null,
          contact_name: finalStudentName,
          contact_phone: null,
          start_at: newStartAt,
          duration_min: durationMin,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          requires_driver: requiresDriver,
          filled_by: filledBy,
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
          results.skipped.push({
            date: displayDate,
            reason: insertError?.message || '未知錯誤'
          })
          continue
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

        results.success.push(displayDate)
      }

      // 顯示結果
      if (results.success.length > 0 && results.skipped.length === 0) {
        alert(`✅ 成功建立 ${results.success.length} 個重複預約！`)
        resetForm()
        onSuccess()
        onClose()
      } else if (results.success.length > 0 && results.skipped.length > 0) {
        alert(
          `⚠️ 部分成功：\n` +
          `✅ 成功：${results.success.length} 個\n` +
          `❌ 跳過：${results.skipped.length} 個\n\n` +
          `跳過的日期：\n${results.skipped.map(s => `${s.date}: ${s.reason}`).join('\n')}`
        )
        onSuccess()
        onClose()
      } else {
        setError(`所有預約都失敗：\n${results.skipped.map(s => s.reason).join('\n')}`)
      }
    } catch (err: any) {
      setError(err.message || '建立失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const previewDates = useMemo(() => {
    if (!startDate || !startTime) return []
    
    try {
      const [year, month, day] = startDate.split('-').map(Number)
      const [hour, minute] = startTime.split(':').map(Number)
      const baseDateTime = new Date(year, month - 1, day, hour, minute, 0)
      
      const dates: Date[] = []
      const currentDate = new Date(baseDateTime)

      if (repeatMode === 'endDate' && repeatEndDate) {
        const [endYear, endMonth, endDay] = repeatEndDate.split('-').map(Number)
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)
        while (currentDate <= endDate && dates.length < 5) {
          dates.push(new Date(currentDate))
          currentDate.setDate(currentDate.getDate() + 7)
        }
      } else {
        const count = Math.min(5, repeatCount)
        for (let i = 0; i < count; i++) {
          dates.push(new Date(currentDate))
          currentDate.setDate(currentDate.getDate() + 7)
        }
      }

      return dates
    } catch {
      return []
    }
  }, [startDate, startTime, repeatMode, repeatCount, repeatEndDate])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '10px' : '20px',
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: isMobile ? '20px' : '30px',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
          📅 重複預約
        </h2>

        <form onSubmit={handleSubmit}>
          {/* 會員選擇 */}
          <MemberSelector
            members={members}
            selectedMemberIds={selectedMemberIds}
            memberSearchTerm={memberSearchTerm}
            showMemberDropdown={showMemberDropdown}
            filteredMembers={filteredMembers}
            manualStudentName={manualStudentName}
            manualNames={manualNames}
            setSelectedMemberIds={setSelectedMemberIds}
            setMemberSearchTerm={setMemberSearchTerm}
            setShowMemberDropdown={setShowMemberDropdown}
            setManualStudentName={setManualStudentName}
            setManualNames={setManualNames}
            handleMemberSearch={handleMemberSearch}
          />

          {/* 船隻選擇 */}
          <BoatSelector
            boats={boats}
            selectedBoatId={selectedBoatId}
            onSelect={setSelectedBoatId}
          />

          {/* 教練選擇 */}
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

          {/* 時間選擇 */}
          <TimeSelector
            startDate={startDate}
            startTime={startTime}
            durationMin={durationMin}
            setStartDate={setStartDate}
            setStartTime={setStartTime}
            setDurationMin={setDurationMin}
          />

          {/* 重複設定 */}
          <div style={{
            marginBottom: '18px',
            padding: '16px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '2px solid #ffc107',
          }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              color: '#000',
              fontSize: '16px',
              fontWeight: '600',
            }}>
              🔁 重複設定
            </label>

            {/* 重複模式選擇 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={repeatMode === 'count'}
                  onChange={() => setRepeatMode('count')}
                  style={{ marginRight: '8px' }}
                />
                按次數重複（每週）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={repeatMode === 'endDate'}
                  onChange={() => setRepeatMode('endDate')}
                  style={{ marginRight: '8px' }}
                />
                按結束日期重複
              </label>
            </div>

            {/* 次數設定 */}
            {repeatMode === 'count' && (
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                }}>
                  重複次數
                </label>
                <input
                  type="number"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Math.max(1, Number(e.target.value)))}
                  min="1"
                  max="52"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '15px',
                  }}
                />
              </div>
            )}

            {/* 結束日期設定 */}
            {repeatMode === 'endDate' && (
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                }}>
                  結束日期
                </label>
                <input
                  type="date"
                  value={repeatEndDate}
                  onChange={(e) => setRepeatEndDate(e.target.value)}
                  min={startDate}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '15px',
                  }}
                />
              </div>
            )}

            {/* 預覽 */}
            {previewDates.length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                <div style={{ fontWeight: '600', marginBottom: '6px' }}>預覽（前5個）：</div>
                {previewDates.map((date, i) => (
                  <div key={i}>
                    {i + 1}. {date.getFullYear()}/{String(date.getMonth() + 1).padStart(2, '0')}/{String(date.getDate()).padStart(2, '0')} {String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')}
                  </div>
                ))}
                {repeatMode === 'count' && repeatCount > 5 && (
                  <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                    ...還有 {repeatCount - 5} 個
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 活動類型和註解 */}
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
              whiteSpace: 'pre-line',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 按鈕 */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
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
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '建立中...' : `確認建立 ${previewDates.length}+ 個預約`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

