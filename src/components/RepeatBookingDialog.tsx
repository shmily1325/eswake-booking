import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logAction } from '../utils/auditLog'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'
import { normalizeFilledByForSave } from '../utils/filledByHelper'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { isFacility } from '../utils/facility'
import { checkGlobalRestriction } from '../utils/restriction'
import {
  prefetchConflictData,
  checkBoatUnavailableFromCache,
  checkBoatConflictFromCache,
  checkCoachConflictFromCache,
} from '../utils/bookingConflict'
import { useToast } from './ui'
import { BoatSelector } from './booking/BoatSelector'
import { MemberSelector } from './booking/MemberSelector'
import { CoachSelector } from './booking/CoachSelector'
import { BookingDetails } from './booking/BookingDetails'
import { TimeSelector } from './booking/TimeSelector'
import { designSystem, getButtonStyle, getLabelStyle } from '../styles/designSystem'
import { getLocalTimestamp } from '../utils/date'
import { BatchResultDialog } from './BatchResultDialog'
import { DateMultiPicker } from './booking/DateMultiPicker'
import {
  fetchCoachNamesOnTimeOffForDate,
  formatCoachTimeOffReminderMessage,
  scheduleCoachTimeOffLinesToast,
} from '../utils/coachTimeOffWarning'


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
    resetForm,
    refreshCoachTimeOff
  } = useBookingForm({
    defaultBoatId,
    defaultDate: defaultStartTime,
    userEmail: user.email || undefined
  })

  // 重開 dialog 時清掉上次的自選日期，避免殘留
  // 只依賴 isOpen：避免因 fetchAllData（隨 startTime 等變動而換 identity）
  // 造成選完時間後日期被清空
  // （表單其他欄位由 useBookingForm 的 fetchAllData / defaultBoatId 重置）
  useEffect(() => {
    if (isOpen) {
      setCustomDates([])
    }
  }, [isOpen])

  // 只在對話框開啟時抓一次資料；用 ref 取得最新的 fetchAllData，
  // 避免 fetchAllData 隨 startTime/durationMin 變動而換 identity 造成重覆抓取
  const fetchAllDataRef = useRef(fetchAllData)
  fetchAllDataRef.current = fetchAllData
  useEffect(() => {
    if (isOpen) {
      fetchAllDataRef.current()
    }
  }, [isOpen])

  // 時間／時長改變時刷新教練休假狀態（取代先前靠 fetchAllData 重跑的副作用）
  useEffect(() => {
    if (isOpen && startDate) {
      refreshCoachTimeOff()
    }
  }, [isOpen, startDate, startTime, durationMin, refreshCoachTimeOff])

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
      const timeOffWarningLines: string[] = []

      // 獲取船名稱
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'
      const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
      const isBoatFacility = isFacility(boatName)
      const cleanupMinutes = isBoatFacility ? 0 : 15

      // 一次預查衝突資料（與 BatchEdit 同款）；逐日改記憶體檢查，判定與訊息格式對齊 useBookingConflict
      const bookingsForPrefetch = datesToCreate.map(dateTime => {
        const year = dateTime.getFullYear()
        const month = (dateTime.getMonth() + 1).toString().padStart(2, '0')
        const day = dateTime.getDate().toString().padStart(2, '0')
        const hours = dateTime.getHours().toString().padStart(2, '0')
        const minutes = dateTime.getMinutes().toString().padStart(2, '0')
        return {
          id: 0,
          dateStr: `${year}-${month}-${day}`,
          startTime: `${hours}:${minutes}`,
          durationMin,
          boatId: selectedBoatId,
          boatName,
          coachIds: selectedCoaches,
        }
      })
      const conflictData = await prefetchConflictData(bookingsForPrefetch)

      const globalRestrictionCache = new Map<string, Awaited<ReturnType<typeof checkGlobalRestriction>>>()
      const getCachedGlobalRestriction = async (d: string, t: string, dur: number) => {
        const key = `${d}\u0000${t}\u0000${dur}`
        let cached = globalRestrictionCache.get(key)
        if (!cached) {
          cached = await checkGlobalRestriction(d, t, undefined, dur)
          globalRestrictionCache.set(key, cached)
        }
        return cached
      }

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

        // 0. 全站預約限制（與 useBookingConflict 相同）
        const restriction = await getCachedGlobalRestriction(dateStr, timeStr, durationMin)
        if (restriction.isRestricted) {
          results.skipped.push({
            date: displayDate,
            reason: restriction.reason?.trim() ? restriction.reason : '此時段暫停受理預約',
          })
          continue
        }

        // 1. 船隻維修／停用
        const availability = checkBoatUnavailableFromCache(
          selectedBoatId, dateStr, timeStr, durationMin,
          conflictData.unavailableRecords
        )
        if (availability.isUnavailable) {
          results.skipped.push({
            date: displayDate,
            reason: `${boatName} 不可用：${availability.reason || '維修保養中'}`,
          })
          continue
        }

        // 2. 船隻時間衝突
        const boatConflict = checkBoatConflictFromCache(
          selectedBoatId, dateStr, timeStr, durationMin,
          isBoatFacility, 0, boatName,
          conflictData.boatBookings
        )
        if (boatConflict.hasConflict) {
          results.skipped.push({
            date: displayDate,
            reason: boatConflict.reason || '時間衝突',
          })
          continue
        }

        // 3. 教練衝突
        if (selectedCoaches.length > 0) {
          const coachConflict = checkCoachConflictFromCache(
            selectedCoaches, dateStr, timeStr, durationMin, 0,
            conflictData.coachBookings, conflictData.driverBookings,
            coachesMap
          )
          if (coachConflict.hasConflict) {
            const conflictMessages = coachConflict.conflictCoaches
              .map(c => `${c.coachName}: ${c.reason}`)
              .join('\n')
            results.skipped.push({
              date: displayDate,
              reason: `教練衝突：\n${conflictMessages}`,
            })
            continue
          }
        }

        // 創建預約
        const bookingToInsert = {
          boat_id: selectedBoatId,
          member_id: selectedMemberIds.length > 0 ? selectedMemberIds[0] : null,
          contact_name: finalStudentName,
          contact_phone: null,
          start_at: newStartAt,
          duration_min: durationMin,
          cleanup_minutes: cleanupMinutes,
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

        // 後續日期記憶體檢查需看到本批已建立的預約（等同原本逐日 checkConflict 會查到 DB 新列）
        conflictData.boatBookings.push({
          id: newBooking.id,
          boat_id: selectedBoatId,
          start_at: newStartAt,
          duration_min: durationMin,
          cleanup_minutes: cleanupMinutes,
          contact_name: finalStudentName,
        })
        for (const coachId of selectedCoaches) {
          conflictData.coachBookings.push({
            coach_id: coachId,
            bookings: {
              id: newBooking.id,
              start_at: newStartAt,
              duration_min: durationMin,
              contact_name: finalStudentName,
            },
          })
        }

        // 並行：coaches 寫入、members 寫入、時間表查詢三者互相獨立
        const insertPromises: PromiseLike<unknown>[] = []

        if (selectedCoaches.length > 0) {
          const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
            booking_id: newBooking.id,
            coach_id: coachId,
          }))
          insertPromises.push(supabase.from('booking_coaches').insert(bookingCoachesToInsert))
          insertPromises.push(
            fetchCoachNamesOnTimeOffForDate(selectedCoaches, dateStr, {
              startTime: timeStr,
              durationMin,
            }).then(offNames => {
              if (offNames.length > 0) {
                timeOffWarningLines.push(formatCoachTimeOffReminderMessage(offNames, dateStr, {
                  startTime: timeStr,
                  durationMin,
                }))
              }
            })
          )
        }

        if (selectedMemberIds.length > 0) {
          const bookingMembersToInsert = selectedMemberIds.map(memberId => ({
            booking_id: newBooking.id,
            member_id: memberId,
          }))
          insertPromises.push(supabase.from('booking_members').insert(bookingMembersToInsert))
        }

        await Promise.all(insertPromises)

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

        if (isCoachPractice) {
          details += ' [教練練習]'
        }

        if (requiresDriver) {
          details += ' [需要駕駛]'
        }
        
        // 加上備註
        if (notes && notes.trim()) {
          details += ` [${notes.trim()}]`
        }
        
        // 寫入全部成功時段，方便之後用預約日期搜尋（不再截斷成前 5 筆）
        details += ` [${successTimes.join(', ')}]`
        
        // 加上填表人
        details += ` (填表人: ${filledBy})`
        
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
      if (timeOffWarningLines.length > 0) {
        scheduleCoachTimeOffLinesToast(timeOffWarningLines, '預約已建立。')
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
            fontSize: isMobile ? '20px' : '24px', 
            fontWeight: 'bold',
            color: designSystem.colors.text.primary,
          }}>
            重複預約
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
              color: designSystem.colors.text.secondary,
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
            <div style={{ marginBottom: designSystem.spacing.lg }}>
              <label style={{
                ...getLabelStyle(true),
                fontWeight: '600',
              }}>
                日期（可多選）
              </label>
              <DateMultiPicker
                selectedDates={customDates}
                onDatesChange={setCustomDates}
              />
            </div>

            <TimeSelector
              showDate={false}
              startTime={startTime}
              setStartTime={setStartTime}
              durationMin={durationMin}
              setDurationMin={setDurationMin}
            />
          </>

          {/* 預覽區塊移至按鈕列上方（僅顯示前 5 個） */}
          {previewDates.length > 0 && (
            <div style={{ 
              marginTop: '8px', 
              marginBottom: '8px', 
              fontSize: '13px', 
              color: designSystem.colors.text.secondary 
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

        {/* 按鈕欄 - 固定底部（Safari 底部工具列／Home 指示條額外留白） */}
        <div style={{
          padding: isMobile ? '12px 18px' : '20px 30px',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: 'white',
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          paddingBottom: isMobile
            ? 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))'
            : '20px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              ...getButtonStyle('secondary', 'large', isMobile),
              flex: 1,
              fontSize: isMobile ? '16px' : '15px',
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
            form="repeat-booking-form"
            disabled={loading}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              flex: 1,
              fontSize: isMobile ? '16px' : '15px',
              ...(loading
                ? { background: designSystem.colors.text.disabled, boxShadow: 'none', cursor: 'not-allowed' }
                : {}),
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              minWidth: isMobile ? 'auto' : '120px',
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
            ) : `確認建立 ${totalDatesCount} 個預約`}
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

