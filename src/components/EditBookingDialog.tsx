import { useState, useEffect, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
  driver_coach_id?: string | null
  start_at: string
  duration_min: number
  activity_types?: string[] | null
  notes?: string | null
  status: string
  boats?: Boat
  coaches?: Coach[]
  driver?: { name: string } | null
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
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('') // 駕駛（可選）
  
  // 會員搜尋相關
  const [members, setMembers] = useState<Member[]>([])
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [manualStudentName, setManualStudentName] = useState('') // 手動輸入的名字
  
  const [student, setStudent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [durationMin, setDurationMin] = useState(60)
  const [activityTypes, setActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCoaches, setLoadingCoaches] = useState(true)

  // 使用 useMemo 優化性能
  const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
  const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])

  useEffect(() => {
    if (isOpen) {
      fetchCoaches()
      fetchMembers()
      if (booking) {
        // 設置教練選擇
        if (booking.coaches && booking.coaches.length > 0) {
          setSelectedCoaches(booking.coaches.map(c => c.id))
        } else {
          setSelectedCoaches([])
        }
        
        // 設置駕駛選擇
        if (booking.driver) {
          setSelectedDriver(booking.driver.name)
        } else {
          setSelectedDriver('')
        }
        
        // 設置學生/會員資訊
        setStudent(booking.contact_name)
        setManualStudentName(booking.contact_name)
        if (booking.member_id) {
          setSelectedMemberId(booking.member_id)
          setMemberSearchTerm(booking.contact_name)
        } else {
          setSelectedMemberId(null)
          setMemberSearchTerm('')
        }
        
        setDurationMin(booking.duration_min)
        setActivityTypes(booking.activity_types || [])
        setNotes(booking.notes || '')
        
        // Parse start_at into date and time（純字符串解析，避免時區問題）
        // booking.start_at 格式: "2025-10-30T17:00:00"
        if (booking.start_at) {
          const datetime = booking.start_at.substring(0, 16) // 取前16個字符 "2025-10-30T17:00"
          const [dateStr, timeStr] = datetime.split('T')
          setStartDate(dateStr)
          setStartTime(timeStr)
        }
      }
    }
  }, [isOpen, booking])

  const fetchCoaches = async () => {
    setLoadingCoaches(true)
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name')
      .order('name')
    
    if (error) {
      console.error('Error fetching coaches:', error)
    } else {
      setCoaches(data || [])
    }
    setLoadingCoaches(false)
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

  // 過濾會員列表
  const filteredMembers = useMemo(() => {
    if (!memberSearchTerm.trim()) return []
    
    const searchLower = memberSearchTerm.toLowerCase()
    return members.filter(member => 
      member.name.toLowerCase().includes(searchLower) ||
      (member.nickname && member.nickname.toLowerCase().includes(searchLower)) ||
      (member.phone && member.phone.includes(searchLower))
    ).slice(0, 10) // 只顯示前 10 筆
  }, [members, memberSearchTerm])

  const toggleCoach = (coachId: string) => {
    setSelectedCoaches(prev => 
      prev.includes(coachId)
        ? prev.filter(id => id !== coachId)
        : [...prev, coachId]
    )
  }

  const toggleActivityType = (type: string) => {
    setActivityTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  if (!isOpen || !booking) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 防呆檢查：08:00之前的預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < 8 && selectedCoaches.length === 0) {
      setError('⚠️ 08:00之前的預約必須指定教練')
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
        .select('id, start_at, duration_min, contact_name')
        .eq('boat_id', booking.boat_id)
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
      const newCleanupEndMinutes = newEndMinutes + 15
      
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
        const existingCleanupEndMinutes = existingEndMinutes + 15
        
        // 檢查新預約是否在現有預約的接船時間內開始
        if (newStartMinutes >= existingEndMinutes && newStartMinutes < existingCleanupEndMinutes) {
          const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
          setError(`與 ${existing.contact_name} 的預約衝突：${existing.contact_name} 在 ${existingEndTime} 結束，需要15分鐘接船時間。您的預約 ${startTime} 太接近了。`)
          setLoading(false)
          return
        }
        
        // 檢查新預約結束時間是否會影響現有預約
        if (existingStartMinutes >= newEndMinutes && existingStartMinutes < newCleanupEndMinutes) {
          const newEndTime = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
          setError(`與 ${existing.contact_name} 的預約衝突：您的預約 ${newEndTime} 結束，${existing.contact_name} ${existingTimeStr} 開始，需要15分鐘接船時間。`)
          setLoading(false)
          return
        }
        
        // 檢查時間重疊
        if (!(newEndMinutes <= existingStartMinutes || newStartMinutes >= existingEndMinutes)) {
          const newEnd = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
          const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
          setError(`與 ${existing.contact_name} 的預約時間重疊：您的時間 ${startTime}-${newEnd}，${existing.contact_name} 的時間 ${existingTimeStr}-${existingEndTime}`)
          setLoading(false)
          return
        }
      }
      
      // 檢查教練衝突（如果有選擇教練）
      if (selectedCoaches.length > 0) {
        for (const coachId of selectedCoaches) {
          // 第一步：查詢該教練的所有預約關聯
          const { data: coachBookingIds, error: coachCheckError } = await supabase
            .from('booking_coaches')
            .select('booking_id')
            .eq('coach_id', coachId)
          
          if (coachCheckError) {
            setError('檢查教練衝突時發生錯誤')
            setLoading(false)
            return
          }
          
          if (!coachBookingIds || coachBookingIds.length === 0) {
            continue // 該教練沒有任何預約，跳過
          }
          
          // 第二步：查詢這些預約的詳細信息
          const bookingIds = coachBookingIds.map(item => item.booking_id)
          const { data: coachBookings, error: bookingError } = await supabase
            .from('bookings')
            .select('id, start_at, duration_min, contact_name')
            .in('id', bookingIds)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${startDate}T23:59:59`)
          
          if (bookingError) {
            setError('檢查教練衝突時發生錯誤')
            setLoading(false)
            return
          }
          
          for (const coachBooking of coachBookings || []) {
            // 跳過當前編輯的預約
            if (coachBooking.id === booking.id) {
              continue
            }
            
            // 純字符串比較
            const bookingDatetime = coachBooking.start_at.substring(0, 16)
            const [, bookingTime] = bookingDatetime.split('T')
            const [bookingHour, bookingMinute] = bookingTime.split(':').map(Number)
            
            const bookingStartMinutes = bookingHour * 60 + bookingMinute
            const bookingEndMinutes = bookingStartMinutes + coachBooking.duration_min
            
            // 檢查時間重疊
            if (!(newEndMinutes <= bookingStartMinutes || newStartMinutes >= bookingEndMinutes)) {
              const coach = coaches.find(c => c.id === coachId)
              setError(`教練 ${coach?.name || '未知'} 在此時段已有其他預約（${coachBooking.contact_name}）`)
              setLoading(false)
              return
            }
          }
        }
      }

      // 決定最終的學生名字
      const finalStudentName = selectedMemberId 
        ? (members.find(m => m.id === selectedMemberId)?.name || manualStudentName)
        : manualStudentName

      // 找到駕駛的 ID（如果有選擇）
      const driverCoachId = selectedDriver 
        ? (coaches.find(c => c.name === selectedDriver)?.id || null)
        : null

      // 更新預約
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          member_id: selectedMemberId || null,
          contact_name: finalStudentName,
          start_at: newStartAt,
          duration_min: durationMin,
          driver_coach_id: driverCoachId,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          updated_by: user.id,
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

      // 記錄到審計日誌（人類可讀格式）
      const boatName = booking.boats?.name || '未知船隻'
      const oldCoachNames = booking.coaches && booking.coaches.length > 0
        ? booking.coaches.map(c => c.name).join(' / ')
        : '未指定'
      const newCoachNames = selectedCoaches.length > 0
        ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join(' / ')
        : '未指定'

      // 計算變更內容
      const changes: string[] = []
      if (booking.contact_name !== student) {
        changes.push(`學生: ${booking.contact_name} → ${student}`)
      }
      if (oldCoachNames !== newCoachNames) {
        changes.push(`教練: ${oldCoachNames} → ${newCoachNames}`)
      }
      if (booking.start_at !== newStartAt) {
        // 純字符串格式化（避免時區問題）
        const oldDatetime = booking.start_at.substring(0, 16)
        const [oldDate, oldTime] = oldDatetime.split('T')
        const newDatetime = newStartAt.substring(0, 16)
        const [newDate, newTime] = newDatetime.split('T')
        changes.push(`時間: ${oldDate} ${oldTime} → ${newDate} ${newTime}`)
      }
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
        changes.push(`備註已修改`)
      }

      await supabase.from('audit_log').insert({
        operation: '修改預約',
        user_email: user.email || '',
        student_name: student,
        boat_name: boatName,
        coach_names: newCoachNames,
        start_time: newStartAt,
        duration_min: durationMin,
        activity_types: activityTypes.length > 0 ? activityTypes : null,
        notes: notes || null,
        changes: changes.length > 0 ? changes.join('; ') : null,
      })

      // Success
      setSelectedCoaches([])
      setStudent('')
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
    if (!confirm('確定要刪除這個預約嗎？')) {
      return
    }

    setLoading(true)

    try {
      // 獲取船名稱
      const boatName = booking.boats?.name || '未知船'
      const coachNames = booking.coaches && booking.coaches.length > 0
        ? booking.coaches.map(c => c.name).join(' / ')
        : '未指定'

      // 刪除預約（CASCADE 會自動刪除 booking_coaches）
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
      await supabase.from('audit_log').insert({
        operation: '刪除預約',
        user_email: user.email || '',
        student_name: booking.contact_name,
        boat_name: boatName,
        coach_names: coachNames,
        start_time: booking.start_at,
        duration_min: booking.duration_min,
        activity_types: booking.activity_types,
        notes: booking.notes || null,
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
      setStudent('')
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#000', fontSize: '20px' }}>編輯預約</h2>
        
        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              教練（可複選）
            </label>
            
            {loadingCoaches ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                載入教練列表中...
              </div>
            ) : (
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                WebkitOverflowScrolling: 'touch',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                  backgroundColor: selectedCoaches.length === 0 ? '#f0f0f0' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedCoaches.length === 0}
                    onChange={() => setSelectedCoaches([])}
                    style={{
                      marginRight: '10px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '15px', color: '#666' }}>不指定教練</span>
                </label>
                {coaches.map((coach) => (
                  <label
                    key={coach.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'background 0.2s',
                      backgroundColor: selectedCoachesSet.has(coach.id) ? '#e3f2fd' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedCoachesSet.has(coach.id)) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedCoachesSet.has(coach.id)) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCoachesSet.has(coach.id)}
                      onChange={() => toggleCoach(coach.id)}
                      style={{
                        marginRight: '10px',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: '15px' }}>{coach.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 駕駛選擇 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              駕駛（選填）
            </label>
            
            {loadingCoaches ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                載入駕駛列表中...
              </div>
            ) : (
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                WebkitOverflowScrolling: 'touch',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                  backgroundColor: selectedDriver === '' ? '#f0f0f0' : 'transparent',
                }}>
                  <input
                    type="radio"
                    checked={selectedDriver === ''}
                    onChange={() => setSelectedDriver('')}
                    style={{
                      marginRight: '10px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '15px', color: '#666' }}>不指定駕駛</span>
                </label>
                {coaches.map((coach) => (
                  <label
                    key={coach.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      transition: 'background 0.2s',
                      backgroundColor: selectedDriver === coach.name ? '#e3f2fd' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDriver !== coach.name) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDriver !== coach.name) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <input
                      type="radio"
                      checked={selectedDriver === coach.name}
                      onChange={() => setSelectedDriver(coach.name)}
                      style={{
                        marginRight: '10px',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: '15px' }}>{coach.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 預約人選擇（會員搜尋或手動輸入） */}
          <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              預約人 {selectedMemberId && <span style={{ color: '#4caf50', fontSize: '13px' }}>（已選擇會員）</span>}
            </label>
            
            {/* 搜尋會員 */}
            <input
              type="text"
              value={memberSearchTerm}
              onChange={(e) => {
                setMemberSearchTerm(e.target.value)
                setShowMemberDropdown(true)
                if (!e.target.value) {
                  setSelectedMemberId(null)
                }
              }}
              onFocus={() => setShowMemberDropdown(true)}
              placeholder="搜尋會員姓名/暱稱/電話..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: selectedMemberId ? '2px solid #4caf50' : '1px solid #ccc',
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
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedMemberId(member.id)
                      setMemberSearchTerm(member.name + (member.nickname ? ` (${member.nickname})` : ''))
                      setManualStudentName(member.name)
                      setShowMemberDropdown(false)
                    }}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {member.name}
                      {member.nickname && <span style={{ color: '#666', fontWeight: 'normal' }}> ({member.nickname})</span>}
                    </div>
                    {member.phone && (
                      <div style={{ fontSize: '13px', color: '#999' }}>
                        📱 {member.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* 或手動輸入 */}
            {!selectedMemberId && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={manualStudentName}
                  onChange={(e) => setManualStudentName(e.target.value)}
                  placeholder="或直接輸入姓名（非會員/首次體驗）"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #ff9800',
                    boxSizing: 'border-box',
                    fontSize: '16px',
                    touchAction: 'manipulation',
                  }}
                />
              </div>
            )}
            
            {/* 清除會員選擇 */}
            {selectedMemberId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMemberId(null)
                  setMemberSearchTerm('')
                  setManualStudentName('')
                }}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                清除會員選擇
              </button>
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

          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              時長（分鐘）
            </label>
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                touchAction: 'manipulation',
              }}
            >
              <option value={30}>30 分鐘</option>
              <option value={60}>60 分鐘</option>
              <option value={90}>90 分鐘</option>
              <option value={120}>120 分鐘</option>
              <option value={150}>150 分鐘</option>
              <option value={180}>180 分鐘</option>
              <option value={210}>210 分鐘</option>
              <option value={240}>240 分鐘</option>
              <option value={270}>270 分鐘</option>
              <option value={300}>300 分鐘</option>
            </select>
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
              placeholder="例如：初學者、需要救生衣、特殊需求..."
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '14px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#ccc' : '#dc3545',
                color: 'white',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
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
                backgroundColor: loading ? '#ccc' : '#007bff',
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
    </div>
  )
}
