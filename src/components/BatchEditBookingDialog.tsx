import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { logAction } from '../utils/auditLog'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { 
  prefetchConflictData, 
  checkBoatUnavailableFromCache, 
  checkBoatConflictFromCache, 
  checkCoachConflictFromCache,
  calculateTimeSlot,
  checkTimeSlotConflict
} from '../utils/bookingConflict'
import { isFacility } from '../utils/facility'
import { BatchResultDialog } from './BatchResultDialog'
import { getFilledByName } from '../utils/filledByHelper'

interface Coach {
  id: string
  name: string
  status: string | null
}

interface Boat {
  id: number
  name: string
  is_active: boolean | null
}

interface BatchEditBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bookingIds: number[]
  user: { email?: string } | null
}

type EditField = 'boat' | 'coaches' | 'notes' | 'duration'

const DURATION_OPTIONS = [30, 45, 60, 90, 120]

export function BatchEditBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  bookingIds,
  user,
}: BatchEditBookingDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [loading, setLoading] = useState(false)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [boats, setBoats] = useState<Boat[]>([])
  const [loadingData, setLoadingData] = useState(true)
  
  // 要修改的欄位開關
  const [fieldsToEdit, setFieldsToEdit] = useState<Set<EditField>>(new Set())
  
  // 修改的值
  const [selectedBoatId, setSelectedBoatId] = useState<number | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [durationMin, setDurationMin] = useState<number | null>(null)  // 無預設值
  const [durationInput, setDurationInput] = useState<string>('')  // 用於輸入框顯示
  const [filledBy, setFilledBy] = useState('')
  
  
  // 載入教練和船隻列表，並重置表單
  useEffect(() => {
    if (isOpen) {
      // 重置所有設定，避免保留上次的選擇（全部無預設值避免誤點）
      setFieldsToEdit(new Set())
      setSelectedBoatId(null)
      setSelectedCoaches([])
      setNotes('')
      setDurationMin(null)
      setDurationInput('')
      setFilledBy(getFilledByName(user?.email))  // 自動填入對應的填表人姓名
      loadData()
    }
  }, [isOpen])
  
  const loadData = async () => {
    setLoadingData(true)
    
    const [coachesResult, boatsResult] = await Promise.all([
      supabase
        .from('coaches')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('boats')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')
    ])
    
    if (coachesResult.data) {
      setCoaches(coachesResult.data)
    }
    if (boatsResult.data) {
      setBoats(boatsResult.data)
    }
    setLoadingData(false)
  }
  
  // 切換要編輯的欄位
  const toggleField = (field: EditField) => {
    const newSet = new Set(fieldsToEdit)
    if (newSet.has(field)) {
      newSet.delete(field)
    } else {
      newSet.add(field)
    }
    setFieldsToEdit(newSet)
  }
  
  // 切換教練選擇
  const toggleCoach = (coachId: string) => {
    if (selectedCoaches.includes(coachId)) {
      setSelectedCoaches(selectedCoaches.filter(id => id !== coachId))
    } else {
      setSelectedCoaches([...selectedCoaches, coachId])
    }
  }
  
  
  
  // 結果對話框狀態
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [resultData, setResultData] = useState<{
    successCount: number
    skippedItems: Array<{ label: string; reason: string }>
  }>({ successCount: 0, skippedItems: [] })
  
  // 執行批次更新（優化版：使用批量預查詢）
  const handleSubmit = async () => {
    console.log('[批次修改] 開始執行', { fieldsToEdit: Array.from(fieldsToEdit), bookingIds, selectedBoatId, durationMin })
    
    if (fieldsToEdit.size === 0) {
      toast.warning('請至少選擇一個要修改的欄位')
      return
    }
    
    if (fieldsToEdit.has('boat') && !selectedBoatId) {
      toast.warning('請選擇要更改的船隻')
      return
    }
    
    if (fieldsToEdit.has('duration') && (!durationMin || durationMin < 15)) {
      toast.warning('請輸入有效的時長（至少 15 分鐘）')
      return
    }
    
    if (!filledBy.trim()) {
      toast.warning('請輸入填表人')
      return
    }
    
    setLoading(true)
    
    try {
      const skippedItems: Array<{ label: string; reason: string }> = []
      let successCount = 0
      let errorCount = 0
      
      // 準備變更描述
      const changes: string[] = []
      const targetBoat = fieldsToEdit.has('boat') && selectedBoatId ? boats.find(b => b.id === selectedBoatId) : null
      if (targetBoat) {
        changes.push(`船隻→${targetBoat.name}`)
      }
      if (fieldsToEdit.has('coaches')) {
        const coachNames = coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
        changes.push(`教練→${coachNames.length > 0 ? coachNames.join('、') : '不指定'}`)
      }
      if (fieldsToEdit.has('duration')) {
        changes.push(`時長→${durationMin}分鐘`)
      }
      if (fieldsToEdit.has('notes')) {
        changes.push(`備註→${notes.trim() || '清空'}`)
      }
      
      // 🔴 檢查是否修改了會影響排班的關鍵欄位（與單一編輯相同的邏輯）
      const keyFieldsChanged = fieldsToEdit.has('boat') || fieldsToEdit.has('coaches') || fieldsToEdit.has('duration')
      
      if (keyFieldsChanged) {
        // 查詢哪些預約有後續記錄
        const [driversResult, reportsResult, participantsResult] = await Promise.all([
          supabase
            .from('booking_drivers')
            .select('booking_id')
            .in('booking_id', bookingIds),
          supabase
            .from('coach_reports')
            .select('booking_id')
            .in('booking_id', bookingIds),
          supabase
            .from('booking_participants')
            .select('booking_id, participant_name')
            .in('booking_id', bookingIds)
            .eq('is_deleted', false)
        ])
        
        const bookingsWithDrivers = new Set(driversResult.data?.map(d => d.booking_id) || [])
        const bookingsWithReports = new Set(reportsResult.data?.map(r => r.booking_id) || [])
        const bookingsWithParticipants = new Set(participantsResult.data?.map(p => p.booking_id) || [])
        
        // 收集有後續記錄的預約
        const bookingsWithRecords = new Set([
          ...bookingsWithDrivers,
          ...bookingsWithReports,
          ...bookingsWithParticipants
        ])
        
        if (bookingsWithRecords.size > 0) {
          // 組裝警告訊息
          const modifyingFields: string[] = []
          if (fieldsToEdit.has('boat')) modifyingFields.push('船隻')
          if (fieldsToEdit.has('coaches')) modifyingFields.push('教練')
          if (fieldsToEdit.has('duration')) modifyingFields.push('時長')
          
          const warnings: string[] = []
          if (bookingsWithDrivers.size > 0) warnings.push(`${bookingsWithDrivers.size} 筆已排班`)
          if (bookingsWithReports.size > 0) warnings.push(`${bookingsWithReports.size} 筆已有教練回報`)
          if (bookingsWithParticipants.size > 0) warnings.push(`${bookingsWithParticipants.size} 筆已有參與者記錄`)
          
          const confirmMessage = `⚠️ 您要修改 ${modifyingFields.join('、')}\n\n部分預約已有後續記錄：\n${warnings.join('\n')}\n\n修改後將刪除這些預約的：\n• 所有排班記錄\n• 所有回報記錄\n• 所有參與者記錄\n\n確定要繼續嗎？`
          
          if (!confirm(confirmMessage)) {
            console.log('[批次修改] 用戶取消修改')
            setLoading(false)
            return
          }
          
          console.log('[批次修改] 用戶確認修改，將清除相關排班和回報記錄')
        }
      }
      
      // 1️⃣ 查詢所有預約的完整資訊（包含教練、活動、備註等）
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, start_at, duration_min, boat_id, contact_name, activity_types, notes, boats:boat_id(name), booking_coaches(coach_id)')
        .in('id', bookingIds)
      
      if (!bookingsData) {
        throw new Error('無法查詢預約資料')
      }
      
      // 建立 coachesMap
      const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
      
      // 提取每個預約的原有教練 ID
      const getOriginalCoachIds = (booking: typeof bookingsData[0]): string[] => {
        const bookingCoaches = (booking as any).booking_coaches as Array<{ coach_id: string }> | null
        return bookingCoaches?.map(bc => bc.coach_id) || []
      }
      
      // 2️⃣ 準備批量衝突檢查的資料
      const bookingsForCheck = bookingsData.map(booking => {
        const dateStr = booking.start_at.split('T')[0]
        const startTime = booking.start_at.split('T')[1].substring(0, 5)
        const originalCoachIds = getOriginalCoachIds(booking)
        const actualDuration: number = fieldsToEdit.has('duration') ? durationMin! : booking.duration_min
        const actualBoatId = fieldsToEdit.has('boat') && selectedBoatId ? selectedBoatId : booking.boat_id
        const actualBoatName = fieldsToEdit.has('boat') && targetBoat ? targetBoat.name : (booking.boats as any)?.name || ''
        const actualCoachIds = fieldsToEdit.has('coaches') ? selectedCoaches : originalCoachIds
        
        return {
          id: booking.id,
          dateStr,
          startTime,
          durationMin: actualDuration,
          boatId: actualBoatId,
          boatName: actualBoatName,
          coachIds: actualCoachIds,
          originalCoachIds,
          contactName: booking.contact_name,
          hour: parseInt(startTime.split(':')[0])
        }
      })
      
      // 3️⃣ 批量預查詢所有衝突檢查需要的數據（只需 4 個 DB 查詢）
      console.log('[批次修改] 開始預查詢衝突數據...')
      const conflictData = await prefetchConflictData(
        bookingsForCheck,
        fieldsToEdit.has('boat') && selectedBoatId ? selectedBoatId : undefined
      )
      console.log('[批次修改] 預查詢完成:', {
        unavailable: conflictData.unavailableRecords.length,
        boatBookings: conflictData.boatBookings.length,
        coachBookings: conflictData.coachBookings.length,
        driverBookings: conflictData.driverBookings.length
      })
      
      // 4️⃣ 追蹤已成功更新的預約，用於檢查批次內部衝突
      const updatedBookings: Array<{
        id: number
        boatId: number
        dateStr: string
        startTime: string
        duration: number
        coachIds: string[]
      }> = []
      
      // 追蹤成功更新的預約標籤（用於 Audit Log）
      const successfulLabels: string[] = []
      
      // 輔助函數：使用 calculateTimeSlot 和 checkTimeSlotConflict 檢查內部衝突
      const checkInternalConflict = (
        boatId: number,
        boatName: string,
        dateStr: string,
        startTime: string,
        duration: number,
        coachIds: string[],
        isFacility: boolean
      ): { hasConflict: boolean; type: 'boat' | 'coach' | null; reason: string } => {
        const cleanupMinutes = isFacility ? 0 : 15
        const newSlot = calculateTimeSlot(startTime, duration, cleanupMinutes)
        
        for (const updated of updatedBookings) {
          if (updated.dateStr !== dateStr) continue
          
          const updatedIsFacility = isFacility // 假設同批次的設施類型相同
          const updatedCleanup = updatedIsFacility ? 0 : 15
          const existSlot = calculateTimeSlot(updated.startTime, updated.duration, updatedCleanup)
          
          // 檢查船隻衝突
          if (updated.boatId === boatId) {
            if (checkTimeSlotConflict(newSlot, existSlot)) {
              return { 
                hasConflict: true, 
                type: 'boat',
                reason: `${boatName} 與本批次其他預約時間衝突`
              }
            }
          }
          
          // 檢查教練衝突（教練一律 15 分鐘緩衝；場地可接著使用）
          if (coachIds.length > 0 && updated.coachIds.length > 0) {
            const sharedCoachIds = coachIds.filter(c => updated.coachIds.includes(c))
            if (sharedCoachIds.length > 0) {
              const coachBufferMin = 15
              const newCoachSlot = calculateTimeSlot(startTime, duration, coachBufferMin)
              const existCoachSlot = calculateTimeSlot(updated.startTime, updated.duration, coachBufferMin)
              if (checkTimeSlotConflict(newCoachSlot, existCoachSlot)) {
                const coachName = coachesMap.get(sharedCoachIds[0])?.name || '教練'
                return { 
                  hasConflict: true, 
                  type: 'coach',
                  reason: `${coachName} 與本批次其他預約時間衝突`
                }
              }
            }
          }
        }
        return { hasConflict: false, type: null, reason: '' }
      }
      
      // 5️⃣ 逐個預約進行衝突檢查（純內存計算，無額外 DB 查詢）
      for (const booking of bookingsForCheck) {
        const { id, dateStr, startTime, durationMin: actualDuration, boatId: actualBoatId, boatName: actualBoatName, coachIds: actualCoachIds, originalCoachIds, contactName, hour } = booking
        const isBoatFacility = isFacility(actualBoatName)
        
        // 更詳細的標籤格式：包含船只和時長
        const shortDate = dateStr.slice(5).replace('-', '/') // "04/03"
        let bookingLabel = `${contactName} (${shortDate} ${startTime}`
        if (actualBoatName) bookingLabel += ` · ${actualBoatName}`
        if (actualDuration) bookingLabel += ` · ${actualDuration}分`
        bookingLabel += ')'
        
        // 0. 檢查與本批次內已更新預約的衝突
        if (fieldsToEdit.has('boat') || fieldsToEdit.has('duration') || fieldsToEdit.has('coaches')) {
          const internalConflict = checkInternalConflict(
            actualBoatId,
            actualBoatName,
            dateStr,
            startTime,
            actualDuration,
            actualCoachIds,
            isBoatFacility
          )
          if (internalConflict.hasConflict) {
            skippedItems.push({ label: bookingLabel, reason: internalConflict.reason })
            continue
          }
        }
        
        // 1. 檢查船隻維修/停用（改船或改時長都要檢查）
        if (fieldsToEdit.has('boat') || fieldsToEdit.has('duration')) {
          const availability = checkBoatUnavailableFromCache(
            actualBoatId, dateStr, startTime, actualDuration,
            conflictData.unavailableRecords
          )
          if (availability.isUnavailable) {
            skippedItems.push({ 
              label: bookingLabel, 
              reason: `${actualBoatName} 維修中：${availability.reason || '不可用'}` 
            })
            continue
          }
        }
        
        // 2. 檢查船隻時間衝突（改船或改時長都要檢查）
        if (fieldsToEdit.has('boat') || fieldsToEdit.has('duration')) {
          const boatConflict = checkBoatConflictFromCache(
            actualBoatId, dateStr, startTime, actualDuration,
            isBoatFacility, id, actualBoatName,
            conflictData.boatBookings
          )
          if (boatConflict.hasConflict) {
            skippedItems.push({ label: bookingLabel, reason: boatConflict.reason })
            continue
          }
        }
        
        // 3. 檢查教練規則：設施一律必須指定；其他 08:00 前必須指定
        if (fieldsToEdit.has('coaches') && selectedCoaches.length === 0) {
          const needsCoach = isFacility(actualBoatName) || hour < EARLY_BOOKING_HOUR_LIMIT
          if (needsCoach) {
            skippedItems.push({ 
              label: bookingLabel, 
              reason: isFacility(actualBoatName) ? '彈簧床、陸上課程必須指定教練' : `${EARLY_BOOKING_HOUR_LIMIT}:00 前的預約必須指定教練` 
            })
            continue
          }
        }
        
        // 4. 檢查教練衝突（改教練或改時長都要檢查）
        const needCheckCoachConflict = 
          (fieldsToEdit.has('coaches') && selectedCoaches.length > 0) ||
          (fieldsToEdit.has('duration') && originalCoachIds.length > 0)
        
        if (needCheckCoachConflict && actualCoachIds.length > 0) {
          const coachConflict = checkCoachConflictFromCache(
            actualCoachIds, dateStr, startTime, actualDuration, id,
            conflictData.coachBookings, conflictData.driverBookings,
            coachesMap
          )
          if (coachConflict.hasConflict) {
            const reasons = coachConflict.conflictCoaches.map(c => `${c.coachName}${c.reason}`).join('、')
            skippedItems.push({ label: bookingLabel, reason: `教練衝突：${reasons}` })
            continue
          }
        }
        
        // ✅ 通過所有檢查，執行更新
        try {
          const updateData: Record<string, any> = {}
          
          if (fieldsToEdit.has('boat') && selectedBoatId && targetBoat) {
            updateData.boat_id = selectedBoatId
            updateData.cleanup_minutes = isFacility(targetBoat.name) ? 0 : 15
          }
          if (fieldsToEdit.has('notes')) {
            updateData.notes = notes.trim() || null
          }
          if (fieldsToEdit.has('duration')) {
            updateData.duration_min = durationMin!
          }
          
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from('bookings')
              .update(updateData)
              .eq('id', id)
            
            if (error) throw error
          }
          
          // 更新教練
          if (fieldsToEdit.has('coaches')) {
            await supabase
              .from('booking_coaches')
              .delete()
              .eq('booking_id', id)
            
            if (selectedCoaches.length > 0) {
              const coachInserts = selectedCoaches.map(coachId => ({
                booking_id: id,
                coach_id: coachId,
              }))
              await supabase.from('booking_coaches').insert(coachInserts)
            }
          }
          
          // 🔴 修改關鍵欄位後清除排班和回報記錄（與單一編輯一致）
          if (keyFieldsChanged) {
            await Promise.all([
              supabase.from('booking_drivers').delete().eq('booking_id', id),
              supabase.from('coach_reports').delete().eq('booking_id', id),
              supabase.from('booking_participants').delete().eq('booking_id', id).eq('is_deleted', false)
            ])
          }
          
          // 記錄已更新的預約，用於檢查批次內部衝突
          updatedBookings.push({
            id,
            boatId: actualBoatId,
            dateStr,
            startTime,
            duration: actualDuration,
            coachIds: actualCoachIds,
          })
          
          // 記錄成功的預約標籤（用於 Audit Log）
          successfulLabels.push(bookingLabel)
          
          successCount++
        } catch (err) {
          console.error(`更新預約 ${id} 失敗:`, err)
          skippedItems.push({ label: bookingLabel, reason: '資料庫更新失敗' })
          errorCount++
        }
      }
      
      // 記錄 Audit Log（包含每筆預約的詳細資訊）
      if (successCount > 0) {
        if (user?.email) {
          // 格式：批次修改 3 筆：時長→90分鐘 [Ming (04/03 08:30 · G23 · 60分), John (04/03 09:00 · G21 · 90分)] (填表人: xxx)
          const bookingList = successfulLabels.length <= 5 
            ? successfulLabels.join(', ')
            : `${successfulLabels.slice(0, 5).join(', ')} 等${successfulLabels.length}筆`
          let details = `批次修改 ${successCount} 筆：${changes.join('、')} [${bookingList}]`
          
          // 如果有修改備註字段，或者預約有特殊資訊，補充說明
          const modifiedBookings = bookingsData?.filter(b => successfulLabels.some(label => label.includes(b.contact_name)))
          const hasAdditionalInfo = modifiedBookings?.some(b => 
            b.activity_types?.length || 
            b.notes ||
            getOriginalCoachIds(b).length > 0
          )
          
          if (hasAdditionalInfo) {
            const infoItems: string[] = []
            const totalActivities = new Set<string>()
            let hasNotes = false
            let hasCoaches = false
            
            modifiedBookings?.forEach(b => {
              b.activity_types?.forEach((a: string) => totalActivities.add(a))
              if (b.notes) hasNotes = true
              if (getOriginalCoachIds(b).length > 0) hasCoaches = true
            })
            
            if (hasCoaches) infoItems.push('含教練')
            if (totalActivities.size > 0) infoItems.push(`活動:${Array.from(totalActivities).join('+')}`)
            if (hasNotes) infoItems.push('含備註')
            
            if (infoItems.length > 0) {
              details += ` (${infoItems.join('、')})`
            }
          }
          
          details += ` (填表人: ${filledBy.trim()})`
          console.log('[批次修改] 寫入 Audit Log:', details)
          await logAction(user.email, 'update', 'bookings', details)
        } else {
          console.warn('[批次修改] 無法寫入 Audit Log: user.email 為空', { user })
        }
      }
      
      console.log('[批次修改] 結果:', { successCount, skipped: skippedItems.length, errorCount })
      
      // 顯示結果
      if (skippedItems.length === 0) {
        toast.success(`成功更新 ${successCount} 筆預約`)
        onSuccess()
        handleClose()
      } else {
        // 有跳過的：用結果對話框顯示詳情
        setResultData({ successCount, skippedItems })
        setShowResultDialog(true)
        if (successCount > 0) {
          onSuccess()
        }
      }
    } catch (err) {
      console.error('批次更新失敗:', err)
      toast.error('批次更新失敗')
    } finally {
      setLoading(false)
    }
  }
  
  // 關閉結果對話框
  const handleResultClose = () => {
    setShowResultDialog(false)
    if (resultData.successCount > 0) {
      handleClose()
    }
  }
  
  // 重置表單（全部無預設值避免誤點）
  const resetForm = () => {
    setFieldsToEdit(new Set())
    setSelectedBoatId(null)
    setSelectedCoaches([])
    setNotes('')
    setDurationMin(null)
    setDurationInput('')
    setFilledBy(getFilledByName(user?.email))  // 重置時也使用自動填入
  }
  
  // 關閉時重置
  const handleClose = () => {
    resetForm()
    onClose()
  }
  
  if (!isOpen) return null
  
  const inputStyle = {
    width: '100%',
    padding: isMobile ? '12px' : '10px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '14px',
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: isMobile ? '0' : '16px',
      overflowY: isMobile ? 'hidden' : 'auto',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '16px 16px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '500px',
        width: '100%',
        maxHeight: isMobile ? '80vh' : '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        margin: isMobile ? 'auto 0 0 0' : 'auto',
      }}>
        {/* 標題 */}
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: 'white',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '18px', fontWeight: 'bold' }}>
              ✏️ 批次修改預約
            </h2>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              已選擇 {bookingIds.length} 筆預約
            </div>
          </div>
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
          padding: isMobile ? '16px' : '20px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{
            padding: '12px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#856404',
          }}>
            ⚠️ 請勾選要修改的欄位，未勾選的欄位將保持不變
          </div>
          
          {/* 船隻 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('boat') ? '2px solid #ff6b35' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('boat') ? '#fff5f0' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('boat') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('boat')}
                onChange={() => toggleField('boat')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>🚤 修改船隻</span>
            </label>
            
            {fieldsToEdit.has('boat') && (
              <div>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#ffe0b2', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#e65100'
                }}>
                  ⚠️ 若目標船隻在該時段已有預約，該筆會被跳過
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {loadingData ? (
                    <span style={{ color: '#666' }}>載入中...</span>
                  ) : boats.map(boat => (
                    <button
                      key={boat.id}
                      type="button"
                      onClick={() => setSelectedBoatId(boat.id)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: selectedBoatId === boat.id ? '#ff6b35' : '#e9ecef',
                        color: selectedBoatId === boat.id ? 'white' : '#495057',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                      }}
                    >
                      {boat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 教練 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('coaches') ? '2px solid #007bff' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('coaches') ? '#f0f7ff' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('coaches') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('coaches')}
                onChange={() => toggleField('coaches')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>🎓 修改教練</span>
            </label>
            
            {fieldsToEdit.has('coaches') && (
              <div>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#fff3cd', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#856404'
                }}>
                  ⚠️ 彈簧床、陸上課程一律必須指定教練；其他船隻 08:00 前必須指定，不指定時該筆會被跳過
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {/* 不指定教練按鈕 */}
                  <button
                    type="button"
                    onClick={() => setSelectedCoaches([])}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: selectedCoaches.length === 0 ? '2px solid #dc3545' : '2px solid #e9ecef',
                      background: selectedCoaches.length === 0 ? '#f8d7da' : '#e9ecef',
                      color: selectedCoaches.length === 0 ? '#dc3545' : '#495057',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                    }}
                  >
                    不指定教練
                  </button>
                  {loadingData ? (
                    <span style={{ color: '#666' }}>載入中...</span>
                  ) : coaches.map(coach => (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() => toggleCoach(coach.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '20px',
                        border: 'none',
                        background: selectedCoaches.includes(coach.id) ? '#007bff' : '#e9ecef',
                        color: selectedCoaches.includes(coach.id) ? 'white' : '#495057',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                      }}
                    >
                      {coach.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 備註 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('notes') ? '2px solid #007bff' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('notes') ? '#f0f7ff' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('notes') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('notes')}
                onChange={() => toggleField('notes')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>📝 修改備註</span>
            </label>
            
            {fieldsToEdit.has('notes') && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="輸入新的備註（留空將清除備註）"
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  marginTop: '8px',
                }}
              />
            )}
          </div>
          
          {/* 時長 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('duration') ? '2px solid #9c27b0' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('duration') ? '#f3e5f5' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('duration') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('duration')}
                onChange={() => toggleField('duration')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>⏱️ 修改時長</span>
            </label>
            
            {fieldsToEdit.has('duration') && (
              <div>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#e1bee7', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#7b1fa2'
                }}>
                  ⚠️ 若修改後與其他預約時間衝突，該筆會被跳過
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {DURATION_OPTIONS.map(duration => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => {
                        setDurationMin(duration)
                        setDurationInput(String(duration))
                      }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: durationMin === duration ? '#9c27b0' : '#e9ecef',
                        color: durationMin === duration ? 'white' : '#495057',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                      }}
                    >
                      {duration}分鐘
                    </button>
                  ))}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px dashed #ce93d8'
                }}>
                  <span style={{ fontSize: '14px', color: '#7b1fa2', fontWeight: '500' }}>自訂：</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    lang="en"
                    value={durationInput}
                    onKeyDown={(e) => {
                      // 只允許數字鍵、方向鍵、刪除鍵、Tab
                      const allowedKeys = ['0','1','2','3','4','5','6','7','8','9','Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End']
                      if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      // 允許輸入任何數字，包括空字串
                      const value = e.target.value.replace(/[^0-9]/g, '')
                      setDurationInput(value)
                      const val = parseInt(value)
                      if (!isNaN(val) && val >= 1 && val <= 480) {
                        setDurationMin(val)
                      }
                    }}
                    onBlur={() => {
                      // 離開輸入框時驗證（無預設值）
                      const val = parseInt(durationInput)
                      if (isNaN(val) || val < 15) {
                        // 無效時清空，不設預設值
                        setDurationMin(null)
                        setDurationInput('')
                      } else if (val > 480) {
                        setDurationMin(480)
                        setDurationInput('480')
                      } else {
                        setDurationMin(val)
                        setDurationInput(String(val))
                      }
                    }}
                    style={{
                      width: '80px',
                      padding: '8px 12px',
                      border: '2px solid #9c27b0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      textAlign: 'center',
                      color: '#7b1fa2',
                      imeMode: 'disabled',
                    } as React.CSSProperties}
                  />
                  <span style={{ fontSize: '14px', color: '#7b1fa2' }}>分鐘</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 填表人（必填）*/}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: filledBy.trim() ? '2px solid #28a745' : '2px solid #dc3545',
            borderRadius: '8px',
            backgroundColor: filledBy.trim() ? '#d4edda' : '#fff5f5',
          }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              fontSize: '15px',
              marginBottom: '8px',
              color: filledBy.trim() ? '#28a745' : '#dc3545',
            }}>
              ✍️ 填表人 <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input
              type="text"
              value={filledBy}
              onChange={(e) => setFilledBy(e.target.value)}
              placeholder="請輸入填表人姓名"
              style={{
                ...inputStyle,
                borderColor: filledBy.trim() ? '#28a745' : '#dc3545',
              }}
            />
          </div>
        </div>
        
        {/* 底部按鈕欄 - 固定底部 */}
        <div style={{
          padding: isMobile ? '12px 20px' : '20px 24px',
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
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading || 
              fieldsToEdit.size === 0 || 
              !filledBy.trim() ||
              (fieldsToEdit.has('boat') && !selectedBoatId) ||
              (fieldsToEdit.has('duration') && (!durationMin || durationMin < 15))
            }
            style={{
              flex: 1,
              padding: isMobile ? '14px' : '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: (
                loading || 
                fieldsToEdit.size === 0 || 
                !filledBy.trim() ||
                (fieldsToEdit.has('boat') && !selectedBoatId) ||
                (fieldsToEdit.has('duration') && (!durationMin || durationMin < 15))
              ) ? '#ccc' : '#28a745',
              color: 'white',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '600',
              cursor: (
                loading || 
                fieldsToEdit.size === 0 || 
                !filledBy.trim() ||
                (fieldsToEdit.has('boat') && !selectedBoatId) ||
                (fieldsToEdit.has('duration') && (!durationMin || durationMin < 15))
              ) ? 'not-allowed' : 'pointer',
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? '🔄 更新中...' : `✅ 確認修改 (${bookingIds.length} 筆)`}
          </button>
        </div>
      </div>
      
      {/* 結果對話框 */}
      <BatchResultDialog
        isOpen={showResultDialog}
        onClose={handleResultClose}
        title="批次修改結果"
        successCount={resultData.successCount}
        skippedItems={resultData.skippedItems}
        successLabel="成功更新"
        skippedLabel="跳過"
      />
    </div>
  )
}

