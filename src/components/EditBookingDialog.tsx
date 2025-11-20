import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingUpdate, logBookingDeletion } from '../utils/auditLog'
import { getDisplayContactName } from '../utils/bookingFormat'
import { checkCoachesConflictBatch } from '../utils/bookingConflict'
import { filterMembers, composeFinalStudentName, toggleSelection } from '../utils/memberUtils'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { useResponsive } from '../hooks/useResponsive'
import { isFacility } from '../utils/facility'
import { getLocalTimestamp } from '../utils/date'

interface Coach {
  id: string
  name: string
}

interface Boat {
  id: number
  name: string
  color: string
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface Booking {
  id: number
  boat_id: number
  contact_name: string
  member_id?: string | null
  start_at: string
  duration_min: number
  activity_types?: string[] | null
  notes?: string | null
  requires_driver?: boolean
  status: string
  boats?: Boat
  coaches?: Coach[]
}

interface EditBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  booking: Booking | null
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
  const [boats, setBoats] = useState<Boat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  
  // 會員搜尋相關（支援多會員）
  const [members, setMembers] = useState<Member[]>([])
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [manualStudentName, setManualStudentName] = useState('') // 手動輸入框的暫存值
  const [manualNames, setManualNames] = useState<string[]>([]) // 已新增的非會員名字陣列
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [durationMin, setDurationMin] = useState(60)
  const [activityTypes, setActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [requiresDriver, setRequiresDriver] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCoaches, setLoadingCoaches] = useState(true)

  // 使用 useMemo 優化性能
  const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
  const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])
  
  // 計算選中的船隻和是否為設施
  const selectedBoat = useMemo(() => boats.find(b => b.id === selectedBoatId), [boats, selectedBoatId])
  const isSelectedBoatFacility = useMemo(() => isFacility(selectedBoat?.name), [selectedBoat])
  
  // 判斷是否可以勾選「需要駕駛」：必須有教練且不是彈簧床
  const canRequireDriver = selectedCoaches.length > 0 && !isSelectedBoatFacility
  
  // 自動取消「需要駕駛」當條件不符時
  useEffect(() => {
    if (!canRequireDriver && requiresDriver) {
      setRequiresDriver(false)
    }
  }, [canRequireDriver, requiresDriver])

  useEffect(() => {
    if (isOpen) {
      fetchBoats()
      fetchMembers()
      
      if (booking) {
        // 先解析並設置日期時間
        if (booking.start_at) {
          const datetime = booking.start_at.substring(0, 16) // 取前16個字符 "2025-10-30T17:00"
          const [dateStr, timeStr] = datetime.split('T')
          setStartDate(dateStr)
          setStartTime(timeStr)
        }
        
        // 獲取教練列表
        fetchCoaches()
        
        // 設置船只選擇
        setSelectedBoatId(booking.boat_id)
        
        // 設置教練選擇
        if (booking.coaches && booking.coaches.length > 0) {
          setSelectedCoaches(booking.coaches.map(c => c.id))
        } else {
          setSelectedCoaches([])
        }
        
        // 從 booking_members 表加載已選會員
        const loadBookingMembers = async () => {
          const { data: bookingMembersData } = await supabase
            .from('booking_members')
            .select('member_id, members:member_id(name, nickname)')
            .eq('booking_id', booking.id)
          
          if (bookingMembersData && bookingMembersData.length > 0) {
            const memberIds = bookingMembersData.map(bm => bm.member_id)
            setSelectedMemberIds(memberIds)
            
            // 從 contact_name 中提取非會員名字
            // 使用暱稱優先，如果沒有暱稱則使用真實姓名
            const memberDisplayNames = bookingMembersData
              .map((bm: any) => bm.members?.nickname || bm.members?.name)
              .filter(Boolean)
            
            // contact_name 可能是 "會員1, 會員2, 非會員1, 非會員2"
            // 需要移除會員的顯示名字（暱稱或姓名），剩下的就是手動輸入的非會員
            const allNames = booking.contact_name.split(',').map(n => n.trim())
            const extractedManualNames = allNames.filter(name => !memberDisplayNames.includes(name))
            setManualNames(extractedManualNames)
            
            // 不自動設置搜尋框
            setMemberSearchTerm('')
          } else {
            // 如果沒有會員，將 contact_name 拆分成陣列
            setSelectedMemberIds([])
            setMemberSearchTerm('')
            const names = booking.contact_name.split(',').map(n => n.trim()).filter(n => n)
            setManualNames(names)
          }
        }
        
        loadBookingMembers()
        
        setDurationMin(booking.duration_min)
        setActivityTypes(booking.activity_types || [])
        setNotes(booking.notes || '')
        setRequiresDriver(booking.requires_driver || false)
      } else {
        fetchCoaches()
      }
    }
  }, [isOpen, booking])

  // 當用戶修改日期時，重新獲取教練列表（不再需要，因為教練列表不受日期影響）
  // useEffect(() => {
  //   if (isOpen && startDate) {
  //     fetchCoaches()
  //   }
  // }, [startDate])

  const fetchBoats = async () => {
    const { data, error } = await supabase
      .from('boats')
      .select('id, name, color')
      .order('id')
    
    if (error) {
      console.error('Error fetching boats:', error)
      return
    }
    
    setBoats(data || [])
  }

  const fetchCoaches = async () => {
    setLoadingCoaches(true)
    
    try {
      // 只查詢啟用狀態的教練，不過濾休假狀態
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
      
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError)
        setLoadingCoaches(false)
        return
      }
      
      // 調試輸出
      console.log('👨‍🏫 編輯預約 - 可用教練（不卡休假）:', coachesData?.length, coachesData?.map(c => c.name))
      
      setCoaches(coachesData || [])
    } catch (error) {
      console.error('Error in fetchCoaches:', error)
    } finally {
      setLoadingCoaches(false)
    }
  }

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, nickname, phone')
      .eq('status', 'active')
      .order('name')
    
    if (error) {
      console.error('Error fetching members:', error)
    } else {
      setMembers(data || [])
    }
  }

  // 使用共用函數過濾會員列表
  const filteredMembers = useMemo(() => 
    filterMembers(members, memberSearchTerm, 10),
    [members, memberSearchTerm]
  )

  // 使用共用函數切換教練選擇
  const toggleCoach = (coachId: string) => {
    setSelectedCoaches(prev => toggleSelection(prev, coachId))
  }

  // 使用共用函數切換活動類型選擇
  const toggleActivityType = (type: string) => {
    setActivityTypes(prev => toggleSelection(prev, type))
  }

  if (!isOpen || !booking) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 檢查預約人是否為空
    if (selectedMemberIds.length === 0 && manualNames.length === 0 && !manualStudentName.trim()) {
      setError('請至少選擇一位會員或輸入預約人姓名')
      return
    }

    if (!selectedBoatId || selectedBoatId === 0) {
      setError('請選擇船隻')
      return
    }

    // 防呆檢查：08:00之前的預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < EARLY_BOOKING_HOUR_LIMIT && selectedCoaches.length === 0) {
      setError(`${EARLY_BOOKING_HOUR_LIMIT}:00之前的預約必須指定教練\n`)
      return
    }

    setLoading(true)

    try {
      // Combine date and time into ISO format（TEXT 格式，不含時區）
      const newStartAt = `${startDate}T${startTime}:00`
      
      // 檢查船衝突（需要至少15分鐘間隔）
      // TEXT 格式查詢，直接字符串比較
      const { data: existingBookings, error: checkError} = await supabase
        .from('bookings')
        .select('id, start_at, duration_min, contact_name, booking_members(member_id, members:member_id(id, name, nickname))')
        .eq('boat_id', selectedBoatId)
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${startDate}T23:59:59`)
      
      if (checkError) {
        setError('檢查衝突時發生錯誤')
        setLoading(false)
        return
      }
      
      // 純字符串比較（避免時區問題）
      const [newHour, newMinute] = startTime.split(':').map(Number)
      const newStartMinutes = newHour * 60 + newMinute
      const newEndMinutes = newStartMinutes + durationMin
      // 加上整理船時間（彈簧床除外）
      const newCleanupTime = isSelectedBoatFacility ? 0 : 15
      const newCleanupEndMinutes = newEndMinutes + newCleanupTime
      
      // 排除當前編輯的預約
      for (const existing of existingBookings || []) {
        if (existing.id === booking.id) {
          continue
        }
        
        // 直接從資料庫取前16個字符
        const existingDatetime = existing.start_at.substring(0, 16)
        const [, existingTimeStr] = existingDatetime.split('T')
        const [existingHour, existingMinute] = existingTimeStr.split(':').map(Number)
        
        const existingStartMinutes = existingHour * 60 + existingMinute
        const existingEndMinutes = existingStartMinutes + existing.duration_min
        // 加上整理船時間（彈簧床除外）
        const existingCleanupTime = isSelectedBoatFacility ? 0 : 15
        const existingCleanupEndMinutes = existingEndMinutes + existingCleanupTime
        
        // 檢查新預約是否在現有預約的接船時間內開始
        if (newStartMinutes >= existingEndMinutes && newStartMinutes < existingCleanupEndMinutes) {
          const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
          const displayName = getDisplayContactName(existing)
          setError(`與 ${displayName} 的預約衝突：${displayName} 在 ${existingEndTime} 結束，需要15分鐘接船時間。您的預約 ${startTime} 太接近了。`)
          setLoading(false)
          return
        }
        
        // 檢查新預約結束時間是否會影響現有預約
        if (existingStartMinutes >= newEndMinutes && existingStartMinutes < newCleanupEndMinutes) {
          const newEndTime = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
          const displayName = getDisplayContactName(existing)
          setError(`與 ${displayName} 的預約衝突：您的預約 ${newEndTime} 結束，${displayName} ${existingTimeStr} 開始，需要15分鐘接船時間。`)
          setLoading(false)
          return
        }
        
        // 檢查時間重疊
        if (!(newEndMinutes <= existingStartMinutes || newStartMinutes >= existingEndMinutes)) {
          const newEnd = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
          const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
          const displayName = getDisplayContactName(existing)
          setError(`與 ${displayName} 的預約時間重疊：您的時間 ${startTime}-${newEnd}，${displayName} 的時間 ${existingTimeStr}-${existingEndTime}`)
          setLoading(false)
          return
        }
      }
      
      // ✅ 優化：使用批量檢查教練衝突（避免 N+1 查詢）
      if (selectedCoaches.length > 0) {
        // 建立教練名稱映射
        const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
        
        // 使用優化後的批量查詢，並排除當前預約（避免自己跟自己衝突）
        const conflictResult = await checkCoachesConflictBatch(
          selectedCoaches,
          startDate,
          startTime,
          durationMin,
          coachesMap,
          booking.id  // 排除當前正在編輯的預約
        )
        
        if (conflictResult.hasConflict) {
          // 組合所有衝突訊息
          const conflictMessages = conflictResult.conflictCoaches
            .map(c => `${c.coachName}: ${c.reason}`)
            .join('\n')
          setError(`教練衝突：\n${conflictMessages}`)
          setLoading(false)
          return
        }
      }

      // 使用共用函數決定最終的學生名字（會員 + 手動輸入）
      const finalStudentName = composeFinalStudentName(members, selectedMemberIds, manualNames)

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

      // 如果取消勾選「需要駕駛」，清空 booking_drivers
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
      setSelectedCoaches([])
      setSelectedMemberIds([])
      setMemberSearchTerm('')
      setManualStudentName('')
      setStartDate('')
      setStartTime('00:00')
      setDurationMin(60)
      setActivityTypes([])
      setNotes('')
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
      // 檢查是否已有回報記錄
      const [participantsResult, reportsResult] = await Promise.all([
        supabase
          .from('booking_participants')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', booking.id)
          .eq('is_deleted', false),
        supabase
          .from('coach_reports')
          .select('id', { count: 'exact', head: true })
          .eq('booking_id', booking.id)
      ])

      const hasParticipants = (participantsResult.count || 0) > 0
      const hasDriverReports = (reportsResult.count || 0) > 0
      const hasReports = hasParticipants || hasDriverReports

      // 根據是否有回報給予不同的提示
      let confirmMessage = '確定要刪除這個預約嗎？'
      if (hasReports) {
        const reportTypes = []
        if (hasParticipants) reportTypes.push(`參與者記錄 ${participantsResult.count} 筆`)
        if (hasDriverReports) reportTypes.push(`駕駛回報 ${reportsResult.count} 筆`)
        
        confirmMessage = `⚠️ 此預約已有回報記錄：\n${reportTypes.join('、')}\n\n刪除預約將會同時刪除所有回報記錄！\n\n確定要刪除嗎？`
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
      setSelectedCoaches([])
      setSelectedMemberIds([])
      setMemberSearchTerm('')
      setManualStudentName('')
      setStartDate('')
      setStartTime('00:00')
      setDurationMin(60)
      setActivityTypes([])
      setNotes('')
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
                setMemberSearchTerm(e.target.value)
                setShowMemberDropdown(true)
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

          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              活動類型（可複選）
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                border: '1px solid #ccc',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: activityTypesSet.has('WB') ? '#e3f2fd' : 'white',
                transition: 'all 0.2s',
                flex: '1',
                minWidth: '120px',
                justifyContent: 'center',
              }}>
                <input
                  type="checkbox"
                  checked={activityTypesSet.has('WB')}
                  onChange={() => toggleActivityType('WB')}
                  style={{ marginRight: '8px', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '15px' }}>WB</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                border: '1px solid #ccc',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: activityTypesSet.has('WS') ? '#e3f2fd' : 'white',
                transition: 'all 0.2s',
                flex: '1',
                minWidth: '120px',
                justifyContent: 'center',
              }}>
                <input
                  type="checkbox"
                  checked={activityTypesSet.has('WS')}
                  onChange={() => toggleActivityType('WS')}
                  style={{ marginRight: '8px', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '15px' }}>WS</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              註解（選填）
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="例如：初學者、特殊需求..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '15px',
                fontFamily: 'inherit',
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

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
