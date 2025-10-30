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
  
  const [boats, setBoats] = useState<Boat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState(defaultBoatId)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [student, setStudent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [activityTypes, setActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCoaches, setLoadingCoaches] = useState(true)

  // 重複預約相關狀態
  const [isRepeat, setIsRepeat] = useState(false)
  const [repeatCount, setRepeatCount] = useState(8)
  const [repeatEndDate, setRepeatEndDate] = useState('')

  // 使用 useMemo 優化性能
  const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
  const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])

  useEffect(() => {
    if (isOpen) {
      fetchBoats()
      fetchCoaches()
      setSelectedBoatId(defaultBoatId)
      // Parse defaultStartTime into date and time
      const startDateTime = new Date(defaultStartTime)
      // 使用本地時間
      const year = startDateTime.getFullYear()
      const month = (startDateTime.getMonth() + 1).toString().padStart(2, '0')
      const day = startDateTime.getDate().toString().padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      const hours = startDateTime.getHours().toString().padStart(2, '0')
      const minutes = startDateTime.getMinutes().toString().padStart(2, '0')
      const timeStr = `${hours}:${minutes}`
      setStartDate(dateStr)
      setStartTime(timeStr)
    }
  }, [isOpen, defaultStartTime, defaultBoatId])

  const fetchBoats = async () => {
    const { data, error } = await supabase
      .from('boats')
      .select('id, name, color')
      .order('id')
    
    if (error) {
      console.error('Error fetching boats:', error)
    } else {
      setBoats(data || [])
    }
  }

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

  // 生成所有重複日期
  const generateRepeatDates = (): Date[] => {
    const baseDateTime = new Date(`${startDate}T${startTime}:00`)
    
    if (!isRepeat) {
      return [baseDateTime]
    }

    const dates: Date[] = []
    const currentDate = new Date(baseDateTime)
    
    if (repeatEndDate) {
      // 使用結束日期
      const endDate = new Date(repeatEndDate)
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    } else {
      // 使用次數
      for (let i = 0; i < repeatCount; i++) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    }

    return dates
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 驗證必填欄位
    if (!student.trim()) {
      setError('⚠️ 請輸入學生姓名')
      return
    }

    if (!startDate || !startTime) {
      setError('⚠️ 請選擇開始日期和時間')
      return
    }

    // 防呆檢查：08:00之前的預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < 8 && selectedCoaches.length === 0) {
      setError('⚠️ 08:00之前的預約必須指定教練')
      return
    }

    setLoading(true)

    try {
      const datesToCreate = generateRepeatDates()
      
      if (datesToCreate.length === 0) {
        setError('沒有可創建的預約日期')
        setLoading(false)
        return
      }

      // 用於追蹤結果
      const results = {
        success: [] as string[],
        skipped: [] as { date: string; reason: string }[],
      }

      // 獲取船隻名稱（用於審計日誌）
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'

      // 對每個日期進行處理
      for (const dateTime of datesToCreate) {
        // 使用本地日期組件構建 ISO 字符串（避免時區偏移）
        const year = dateTime.getFullYear()
        const month = (dateTime.getMonth() + 1).toString().padStart(2, '0')
        const day = dateTime.getDate().toString().padStart(2, '0')
        const hours = dateTime.getHours().toString().padStart(2, '0')
        const minutes = dateTime.getMinutes().toString().padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        const timeStr = `${hours}:${minutes}`
        const displayDate = `${dateStr} ${timeStr}`
        
        // 手動構建 ISO 字符串，明確指定台北時區 (+08:00)
        const newStartAt = `${dateStr}T${timeStr}:00+08:00`
        
        let hasConflict = false
        let conflictReason = ''
        
        // 計算新預約的時間（分鐘數，用於所有衝突檢查）
        const [newHour, newMinute] = timeStr.split(':').map(Number)
        const newStartMinutes = newHour * 60 + newMinute
        const newEndMinutes = newStartMinutes + durationMin
        const newCleanupEndMinutes = newEndMinutes + 15
      
        // 檢查船隻衝突（需要至少15分鐘間隔）
        const { data: existingBookings, error: checkError } = await supabase
          .from('bookings')
          .select('id, start_at, duration_min, student')
          .eq('boat_id', selectedBoatId)
          .gte('start_at', `${dateStr}T00:00:00`)
          .lte('start_at', `${dateStr}T23:59:59`)
      
        if (checkError) {
          hasConflict = true
          conflictReason = '檢查衝突時發生錯誤'
        } else {
          // 純字符串比較（避免時區問題）
          
          for (const existing of existingBookings || []) {
            // 直接從資料庫取前16個字符
            const existingDatetime = existing.start_at.substring(0, 16)
            const [, existingTime] = existingDatetime.split('T')
            const [existingHour, existingMinute] = existingTime.split(':').map(Number)
            
            const existingStartMinutes = existingHour * 60 + existingMinute
            const existingEndMinutes = existingStartMinutes + existing.duration_min
            const existingCleanupEndMinutes = existingEndMinutes + 15
            
            // 檢查新預約是否在現有預約的接船時間內開始
            if (newStartMinutes >= existingEndMinutes && newStartMinutes < existingCleanupEndMinutes) {
              hasConflict = true
              const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
              conflictReason = `與 ${existing.student} 的預約衝突：${existing.student} 在 ${existingEndTime} 結束，需要15分鐘接船時間。您的預約 ${timeStr} 太接近了。`
              break
            }
            
            // 檢查新預約結束時間是否會影響現有預約
            if (existingStartMinutes >= newEndMinutes && existingStartMinutes < newCleanupEndMinutes) {
              hasConflict = true
              const newEndTime = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
              conflictReason = `與 ${existing.student} 的預約衝突：您的預約 ${newEndTime} 結束，${existing.student} ${existingTime} 開始，需要15分鐘接船時間。`
              break
            }
            
            // 檢查時間重疊
            if (!(newEndMinutes <= existingStartMinutes || newStartMinutes >= existingEndMinutes)) {
              hasConflict = true
              const newEnd = `${Math.floor(newEndMinutes/60).toString().padStart(2,'0')}:${(newEndMinutes%60).toString().padStart(2,'0')}`
              const existingEndTime = `${Math.floor(existingEndMinutes/60).toString().padStart(2,'0')}:${(existingEndMinutes%60).toString().padStart(2,'0')}`
              conflictReason = `與 ${existing.student} 的預約時間重疊：您的時間 ${timeStr}-${newEnd}，${existing.student} 的時間 ${existingTime}-${existingEndTime}`
              break
            }
          }
        }
        
        // 檢查教練衝突（如果有選擇教練）
        if (!hasConflict && selectedCoaches.length > 0) {
          for (const coachId of selectedCoaches) {
            // 第一步：查詢該教練的所有預約關聯
            const { data: coachBookingIds, error: coachCheckError } = await supabase
              .from('booking_coaches')
              .select('booking_id')
              .eq('coach_id', coachId)
            
            if (coachCheckError) {
              hasConflict = true
              conflictReason = '檢查教練衝突時發生錯誤'
              break
            }
            
            if (!coachBookingIds || coachBookingIds.length === 0) {
              continue // 該教練沒有任何預約，跳過
            }
            
            // 第二步：查詢這些預約的詳細信息
            const bookingIds = coachBookingIds.map(item => item.booking_id)
            const { data: coachBookings, error: bookingError } = await supabase
              .from('bookings')
              .select('id, start_at, duration_min, student')
              .in('id', bookingIds)
              .gte('start_at', `${dateStr}T00:00:00`)
              .lte('start_at', `${dateStr}T23:59:59`)
            
            if (bookingError) {
              hasConflict = true
              conflictReason = '檢查教練衝突時發生錯誤'
              break
            }
            
            for (const booking of coachBookings || []) {
              // 純字符串比較
              const bookingDatetime = booking.start_at.substring(0, 16)
              const [, bookingTime] = bookingDatetime.split('T')
              const [bookingHour, bookingMinute] = bookingTime.split(':').map(Number)
              
              const bookingStartMinutes = bookingHour * 60 + bookingMinute
              const bookingEndMinutes = bookingStartMinutes + booking.duration_min
              
              // 檢查時間重疊
              if (!(newEndMinutes <= bookingStartMinutes || newStartMinutes >= bookingEndMinutes)) {
                // 找到教練名字
                const coach = coaches.find(c => c.id === coachId)
                hasConflict = true
                conflictReason = `教練 ${coach?.name || '未知'} 在此時段已有其他預約（${booking.student}）`
                break
              }
            }
            
            if (hasConflict) break
          }
        }
        
        // 如果有衝突，跳過這個日期
        if (hasConflict) {
          results.skipped.push({ date: displayDate, reason: conflictReason })
          continue
        }
      
        // 創建預約（不包含 coach_id）
        const bookingToInsert = {
          boat_id: selectedBoatId,
          student: student,
          start_at: newStartAt,
          duration_min: durationMin,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          status: 'Confirmed',
          created_by: user.id,
        }

        const { data: insertedBooking, error: insertError } = await supabase
          .from('bookings')
          .insert([bookingToInsert])
          .select('id')
          .single()

        if (insertError) {
          results.skipped.push({
            date: displayDate,
            reason: insertError.message || '插入失敗'
          })
          continue
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
            results.skipped.push({
              date: displayDate,
              reason: '插入教練關聯失敗'
            })
            continue
          }
        }

        // 記錄到審計日誌（人類可讀格式）
        const coachNames = selectedCoaches.length > 0
          ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name).join(' / ')
          : '未指定'

        await supabase.from('audit_log').insert({
          operation: '新增預約',
          user_email: user.email || '',
          student_name: student,
          boat_name: boatName,
          coach_names: coachNames,
          start_time: newStartAt,
          duration_min: durationMin,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
        })

        // 記錄成功
        results.success.push(displayDate)
      }

      // 顯示結果
      if (results.success.length === 0) {
        setError('沒有成功創建任何預約，所有日期都有衝突')
        setLoading(false)
        return
      }
      
      // 如果有跳過的，顯示詳細報告
      if (results.skipped.length > 0) {
        let message = `✅ 成功創建 ${results.success.length} 個預約\n⚠️ 跳過 ${results.skipped.length} 個衝突:\n\n`
        results.skipped.forEach(({ date, reason }) => {
          message += `• ${date}: ${reason}\n`
        })
        alert(message)
      }

      // Success - 重置表單
      setSelectedCoaches([])
      setStudent('')
      setStartDate('')
      setStartTime('')
      setDurationMin(60)
      setActivityTypes([])
      setNotes('')
      setIsRepeat(false)
      setRepeatCount(8)
      setRepeatEndDate('')
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
      setSelectedCoaches([])
      setStudent('')
      setStartDate('')
      setStartTime('')
      setDurationMin(60)
      setActivityTypes([])
      setNotes('')
      setError('')
      setIsRepeat(false)
      setRepeatCount(8)
      setRepeatEndDate('')
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
        <h2 style={{ marginTop: 0, color: '#000', fontSize: '20px' }}>新增預約</h2>
        
        {error && (
          <div style={{
            padding: '14px 16px',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '18px',
            color: '#856404',
            fontSize: '15px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
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

          {/* 船隻選擇 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              船隻
            </label>
            <select
              value={selectedBoatId}
              onChange={(e) => setSelectedBoatId(Number(e.target.value))}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              {boats.map(boat => (
                <option key={boat.id} value={boat.id}>
                  {boat.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              學生姓名
            </label>
            <input
              type="text"
              value={student}
              onChange={(e) => setStudent(e.target.value)}
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
                <span style={{ fontSize: '15px' }}>WB (滑水板)</span>
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
                <span style={{ fontSize: '15px' }}>WS (滑水)</span>
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

          <div style={{ marginBottom: '18px', padding: '14px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: isRepeat ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={isRepeat}
                onChange={(e) => setIsRepeat(e.target.checked)}
                style={{ marginRight: '8px', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '15px', fontWeight: '500', color: '#000' }}>重複預約（每週同一時間）</span>
            </label>

            {isRepeat && (
              <div style={{ marginTop: '12px', paddingLeft: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>
                    重複次數（含首次）
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={repeatCount}
                    onChange={(e) => {
                      setRepeatCount(Number(e.target.value))
                      setRepeatEndDate('')
                    }}
                    disabled={!!repeatEndDate}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      fontSize: '15px',
                      backgroundColor: repeatEndDate ? '#f5f5f5' : 'white',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'center', margin: '10px 0', color: '#999', fontSize: '13px' }}>
                  或
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>
                    重複至日期
                  </label>
                  <input
                    type="date"
                    value={repeatEndDate}
                    onChange={(e) => {
                      setRepeatEndDate(e.target.value)
                      if (e.target.value) {
                        setRepeatCount(1)
                      }
                    }}
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
              </div>
            )}
          </div>

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
              {loading ? '處理中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
