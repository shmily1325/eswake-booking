import { useState, useEffect, useCallback, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logAction } from '../utils/auditLog'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { normalizeFilledByForSave } from '../utils/filledByHelper'
import { useBookingConflict } from '../hooks/useBookingConflict'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { isFacility } from '../utils/facility'
import { useToast } from './ui'
import { BoatSelector } from './booking/BoatSelector'
import { MemberSelector } from './booking/MemberSelector'
import { CoachSelector } from './booking/CoachSelector'
import { BookingDetails } from './booking/BookingDetails'
import { getLocalTimestamp } from '../utils/date'
import { BatchResultDialog } from './BatchResultDialog'
import { DateMultiPicker } from './booking/DateMultiPicker'


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
  const toast = useToast()
  const { checkConflict } = useBookingConflict()

  // 防止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  // 重複預約設定（僅保留自選日期）
  const [customDates, setCustomDates] = useState<string[]>([])

  // 結果對話框
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [resultData, setResultData] = useState<{
    successCount: number
    skippedItems: Array<{ label: string; reason: string }>
  }>({ successCount: 0, skippedItems: [] })

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
    resetForm
  } = useBookingForm({
    defaultBoatId,
    defaultDate: defaultStartTime,
    userEmail: user.email || undefined
  })

  useEffect(() => {
    if (isOpen) {
      fetchAllData()
    }
  }, [isOpen, fetchAllData])

  // 生成重複日期列表 - 僅依自選日期
  const generateRepeatDates = useCallback((): Date[] => {
    if (!startTime) return []
    
    const [hour, minute] = startTime.split(':').map(Number)

    if (customDates.length === 0) return []
    return customDates.map(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number)
      return new Date(y, m - 1, d, hour, minute, 0)
    })
  }, [startTime, customDates])

  if (!isOpen) return null
  
  // 與 New/Edit 對齊：不做即時禁用送出，沿用提交時檢查
  // 保留取得名稱以利日後擴充（目前未直接使用）
  // const selectedBoatName = boats.find(b => b.id === selectedBoatId)?.name || ''

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // 防止重複提交（最優先檢查）
    if (loading) {
      console.log('提交進行中，忽略重複請求')
      return
    }

    // ✅ 檢查船隻是否已選擇
    if (!selectedBoatId || selectedBoatId === 0) {
      setError('請選擇船隻')
      return
    }

    // 檢查預約人是否填寫（檢查最終的組合結果）
    if (!finalStudentName || !finalStudentName.trim()) {
      setError('請填寫預約人姓名')
      return
    }

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

    // 檢查必填：至少一個日期
    if (customDates.length === 0) {
      setError('請至少選擇一個日期')
      return
    }

    // 立即設置 loading 防止重複點擊
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
      
      // 收集成功創建的預約時間（用於審計日誌）
      const successTimes: string[] = []

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

        // 進行完整的衝突檢查（就像普通預約一樣）
        const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
        const conflictResult = await checkConflict({
          boatId: selectedBoatId,
          boatName,
          date: dateStr,
          startTime: timeStr,
          durationMin,
          coachIds: selectedCoaches,
          coachesMap,
          excludeBookingId: undefined
        })

        if (conflictResult.hasConflict) {
          results.skipped.push({
            date: displayDate,
            reason: conflictResult.reason || '時間衝突'
          })
          continue
        }
        
        // 創建預約
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
          filled_by: normalizeFilledByForSave(filledBy),
          is_coach_practice: isCoachPractice,
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

        // 記錄成功的時間（用於審計日誌）
        const shortDate = `${month}/${day}`
        successTimes.push(`${shortDate} ${timeStr}`)

        results.success.push(displayDate)
      }

      // 記錄審計日誌（批次記錄）
      if (results.success.length > 0 && user.email) {
        // 格式：重複預約 3 筆：G23 60分 Queenie | Papa教練 [SUP] [課堂人：L] [04/03 10:00, 04/04 10:00, 04/05 10:00] (填表人: L)
        const coachNames = selectedCoaches.length > 0
          ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
          : []
        
        let details = `重複預約 ${results.success.length} 筆：${boatName} ${durationMin}分 ${finalStudentName}`
        
        // 加上教練
        if (coachNames.length > 0) {
          details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
        }
        
        // 加上活動類型
        if (activityTypes.length > 0) {
          details += ` [${activityTypes.join('+')}]`
        }
        
        // 加上備註
        if (notes && notes.trim()) {
          details += ` [${notes.trim()}]`
        }
        
        // 加上時間列表
        const timeList = successTimes.length <= 5 
          ? successTimes.join(', ')
          : `${successTimes.slice(0, 5).join(', ')} 等${successTimes.length}筆`
        details += ` [${timeList}]`
        
        // 加上填表人
        details += ` (填表人: ${filledBy})`
        
        console.log('[重複預約] 寫入 Audit Log:', details)
        await logAction(user.email, 'create', 'bookings', details)
      }
      
      // 顯示結果
      if (results.success.length > 0 && results.skipped.length === 0) {
        // 全部成功：用簡短 toast
        toast.success(`成功建立 ${results.success.length} 個重複預約！`)
        resetForm()
        resetRepeatState()
        onSuccess()
        onClose()
      } else if (results.skipped.length > 0) {
        // 有跳過的：用結果對話框顯示詳情
        setResultData({
          successCount: results.success.length,
          skippedItems: results.skipped.map(s => ({
            label: s.date,
            reason: s.reason,
          })),
        })
        setShowResultDialog(true)
        if (results.success.length > 0) {
          onSuccess()
        }
      }
    } catch (err: any) {
      setError(err.message || '建立失敗')
    } finally {
      setLoading(false)
    }
  }

  // 重置重複預約專用的 state
  const resetRepeatState = () => {
    setCustomDates([])
  }

  const handleClose = () => {
    resetForm()
    resetRepeatState()
    onClose()
  }

  // 關閉結果對話框
  const handleResultClose = () => {
    setShowResultDialog(false)
    resetForm()
    resetRepeatState()
    onClose()
  }

  // 預覽日期 - 取前5個（用於預覽）
  let previewDates: Date[] = []
  let totalDatesCount = 0
  try {
    const allDates = generateRepeatDates()
    totalDatesCount = allDates.length
    previewDates = allDates.slice(0, 5)
  } catch (error) {
    console.error('[RepeatBookingDialog] Error computing preview:', error)
    previewDates = []
    totalDatesCount = 0
  }

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
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px',
        overflowY: isMobile ? 'hidden' : 'auto',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: isMobile ? '80vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* 標題欄 - Sticky */}
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '24px 30px 20px',
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
            fontSize: isMobile ? '20px' : '24px', 
            fontWeight: 'bold',
          }}>
            📅 重複預約
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '28px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#666',
              padding: '0 8px',
              opacity: loading ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 內容區域 - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '20px' : '30px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <form onSubmit={handleSubmit} id="repeat-booking-form">
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

          {/* 自選日期與時間（與新增預約邏輯對齊：先日期後時間） */}
          <>
            {/* 自選日期（取代開始日期概念） */}
            <div style={{ marginBottom: isMobile ? '14px' : '18px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                color: '#000',
                fontSize: '15px',
                fontWeight: '600',
              }}>
                日期（可多選）
              </label>
              <DateMultiPicker
                selectedDates={customDates}
                onDatesChange={setCustomDates}
              />
            </div>

            {/* 開始時間 */}
            <div style={{ marginBottom: isMobile ? '14px' : '18px' }}>
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

            {/* 時長 */}
            <div style={{ marginBottom: isMobile ? '14px' : '18px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  color: '#000',
                  fontSize: '15px',
                  fontWeight: '600',
                }}>
                  時長（分鐘）
                </label>
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
                      >
                        {minutes}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>自訂：</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={durationMin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
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
          </>

          {/* 預覽區塊移至按鈕列上方（僅顯示前 5 個） */}
          {previewDates.length > 0 && (
            <div style={{ 
              marginTop: '8px', 
              marginBottom: '8px', 
              fontSize: '13px', 
              color: '#666' 
            }}>
              <div style={{ fontWeight: '600', marginBottom: '6px' }}>預覽（前5個）：</div>
              {previewDates.map((date, i) => (
                <div key={i}>
                  {i + 1}. {date.getFullYear()}/{String(date.getMonth() + 1).padStart(2, '0')}/{String(date.getDate()).padStart(2, '0')} {String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')}
                </div>
              ))}
              {totalDatesCount > 5 && (
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  ...還有 {totalDatesCount - 5} 個
                </div>
              )}
            </div>
          )}

          {/* 活動類型和註解 */}
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
          padding: isMobile ? '12px 18px' : '20px 30px',
          borderTop: '1px solid #e0e0e0',
          background: 'white',
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom))' : '20px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '12px 24px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              background: 'white',
              color: '#333',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              touchAction: 'manipulation',
              minHeight: isMobile ? '44px' : '44px',
              minWidth: isMobile ? 'auto' : '120px',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            form="repeat-booking-form"
            disabled={loading}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
              color: 'white',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              touchAction: 'manipulation',
              minHeight: isMobile ? '44px' : '44px',
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
                }} />
                建立中...
              </>
            ) : `✅ 確認建立 ${totalDatesCount} 個預約`}
          </button>
        </div>
      </div>
      
      {/* 結果對話框 */}
      <BatchResultDialog
        isOpen={showResultDialog}
        onClose={handleResultClose}
        title="重複預約結果"
        successCount={resultData.successCount}
        skippedItems={resultData.skippedItems}
        successLabel="成功建立"
        skippedLabel="跳過"
      />
    </div>
  )
}

