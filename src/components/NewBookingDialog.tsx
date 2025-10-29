import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Coach {
  id: string // UUID from Supabase
  name: string
}

interface NewBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultBoatId: number
  defaultStartTime: string // ISO format datetime
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
  const [repeatEndType, setRepeatEndType] = useState<'count' | 'date'>('count')
  const [repeatCount, setRepeatCount] = useState(8)
  const [repeatEndDate, setRepeatEndDate] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchCoaches()
      // Parse defaultStartTime into date and time
      const startDateTime = new Date(defaultStartTime)
      const dateStr = startDateTime.toISOString().split('T')[0]
      const timeStr = startDateTime.toTimeString().slice(0, 5) // HH:MM
      setStartDate(dateStr)
      setStartTime(timeStr)
    }
  }, [isOpen, defaultStartTime])

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
    // 對於重複預約，使用 defaultStartTime；對於單次預約，使用手動輸入的時間
    const baseDateTime = isRepeat 
      ? new Date(defaultStartTime)
      : new Date(`${startDate}T${startTime}:00`)
    
    if (!isRepeat) {
      return [baseDateTime]
    }

    const dates: Date[] = []
    const startDateTime = new Date(defaultStartTime)
    const targetWeekday = startDateTime.getDay() // 獲取點擊的星期幾（0=週日, 1=週一, ..., 6=週六）
    
    if (repeatEndType === 'count') {
      // 根據重複次數生成日期
      let currentDate = new Date(startDateTime)
      let count = 0
      
      // 最多檢查 365 天，避免無限循環
      for (let i = 0; i < 365 && count < repeatCount; i++) {
        const dayOfWeek = currentDate.getDay()
        if (dayOfWeek === targetWeekday) {
          dates.push(new Date(currentDate))
          count++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // 根據結束日期生成日期
      const endDate = new Date(repeatEndDate)
      let currentDate = new Date(startDateTime)
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay()
        if (dayOfWeek === targetWeekday) {
          dates.push(new Date(currentDate))
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    
    return dates
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 防呆檢查：08:00之前的預約必須指定教練
    const [hour] = startTime.split(':').map(Number)
    if (hour < 8 && selectedCoaches.length === 0) {
      setError('⚠️ 08:00之前的預約必須指定教練')
      return
    }

    // 驗證重複預約設定
    if (isRepeat) {
      if (repeatEndType === 'date' && !repeatEndDate) {
        setError('請選擇結束日期')
        return
      }
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

      // 對每個日期進行處理
      for (const dateTime of datesToCreate) {
        const dateStr = dateTime.toISOString().split('T')[0]
        const timeStr = `${dateTime.getHours().toString().padStart(2, '0')}:${dateTime.getMinutes().toString().padStart(2, '0')}`
        const displayDate = `${dateStr} ${timeStr}`
        
        const newStartAt = dateTime.toISOString()
        const newStartTime = dateTime.getTime()
        const newEndTime = newStartTime + durationMin * 60000
        
        let hasConflict = false
        let conflictReason = ''
      
        // 檢查船隻衝突（需要至少15分鐘間隔）
        const { data: existingBookings, error: checkError } = await supabase
          .from('bookings')
          .select('id, start_at, duration_min, student, coaches(name)')
          .eq('boat_id', defaultBoatId)
          .gte('start_at', `${dateStr}T00:00:00`)
          .lte('start_at', `${dateStr}T23:59:59`)
      
        if (checkError) {
          hasConflict = true
          conflictReason = '檢查衝突時發生錯誤'
        } else {
          // 檢查是否與現有預約衝突（需要15分鐘接船時間）
          for (const existing of existingBookings || []) {
            const existingStart = new Date(existing.start_at).getTime()
            const existingEnd = existingStart + existing.duration_min * 60000
            const existingCleanupEnd = existingEnd + 15 * 60000 // 加15分鐘接船時間
            
            // 檢查新預約是否在現有預約的接船時間內開始
            if (newStartTime >= existingEnd && newStartTime < existingCleanupEnd) {
              hasConflict = true
              conflictReason = `與 ${existing.student} 的預約衝突：需要至少15分鐘接船時間`
              break
            }
            
            // 檢查新預約結束時間是否會影響現有預約
            const newCleanupEnd = newEndTime + 15 * 60000
            if (existingStart >= newEndTime && existingStart < newCleanupEnd) {
              hasConflict = true
              conflictReason = `與 ${existing.student} 的預約衝突：需要至少15分鐘接船時間`
              break
            }
            
            // 檢查時間重疊
            if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
              hasConflict = true
              conflictReason = `與 ${existing.student} 的預約時間重疊`
              break
            }
          }
        }
      
        // 檢查教練衝突（如果有選擇教練）
        if (!hasConflict && selectedCoaches.length > 0) {
          for (const coachId of selectedCoaches) {
            const { data: coachBookings, error: coachCheckError } = await supabase
              .from('bookings')
              .select('id, start_at, duration_min, student, boats(name)')
              .eq('coach_id', coachId)
              .gte('start_at', `${dateStr}T00:00:00`)
              .lte('start_at', `${dateStr}T23:59:59`)
            
            if (coachCheckError) continue
            
            for (const existing of coachBookings || []) {
              const existingStart = new Date(existing.start_at).getTime()
              const existingEnd = existingStart + existing.duration_min * 60000
              
              // 檢查時間重疊
              if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
                const coachName = coaches.find(c => c.id === coachId)?.name || coachId
                const boatName = (existing as any).boats?.name || ''
                hasConflict = true
                conflictReason = `教練 ${coachName} 在此時段已有其他預約${boatName ? `（${boatName}）` : ''}`
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
      
        // Create bookings
        let bookingsToInsert
        if (selectedCoaches.length === 0) {
          // 如果沒有選擇教練，創建一個沒有教練的預約
          bookingsToInsert = [{
            boat_id: defaultBoatId,
            coach_id: null,
            student: student,
            start_at: newStartAt,
            duration_min: durationMin,
            activity_types: activityTypes.length > 0 ? activityTypes : null,
            notes: notes || null,
            status: 'Confirmed',
            created_by: user.id,
          }]
        } else {
          // 為每個選擇的教練創建一個預約
          bookingsToInsert = selectedCoaches.map(coachId => ({
            boat_id: defaultBoatId,
            coach_id: coachId,
            student: student,
            start_at: newStartAt,
            duration_min: durationMin,
            activity_types: activityTypes.length > 0 ? activityTypes : null,
            notes: notes || null,
            status: 'Confirmed',
            created_by: user.id,
          }))
        }

        const { data: insertedBookings, error: insertError } = await supabase
          .from('bookings')
          .insert(bookingsToInsert)
          .select('*, boats(name, color), coaches(name)')

        if (insertError) {
          // 如果創建失敗，記錄為跳過
          results.skipped.push({
            date: displayDate,
            reason: insertError.message.includes('violates exclusion constraint')
              ? '該時段已被預約'
              : insertError.message
          })
          continue
        }

        // Log to audit_log
        if (insertedBookings && insertedBookings.length > 0) {
          const auditLogs = insertedBookings.map(booking => ({
            table_name: 'bookings',
            record_id: booking.id,
            action: 'INSERT',
            user_id: user.id,
            user_email: user.email,
            new_data: booking,
            old_data: null,
            changed_fields: null,
          }))

          const { error: auditError } = await supabase.from('audit_log').insert(auditLogs)
          if (auditError) {
            console.error('Audit log insert error:', auditError)
          }
          
          // 記錄成功
          results.success.push(displayDate)
        }
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
    setError('')
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
        <h2 style={{ marginTop: 0, color: '#000', fontSize: '20px' }}>新增預約</h2>
        
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
            ) : coaches.length === 0 ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                沒有可用的教練
              </div>
            ) : (
              <div style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#f8f9fa',
              }}>
                {coaches.map((coach) => (
                  <label
                    key={coach.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      marginBottom: '4px',
                      backgroundColor: selectedCoaches.includes(coach.id) ? '#e7f3ff' : 'white',
                      border: selectedCoaches.includes(coach.id) ? '2px solid #007bff' : '2px solid transparent',
                      transition: 'all 0.2s',
                      touchAction: 'manipulation',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCoaches.includes(coach.id)}
                      onChange={() => toggleCoach(coach.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        marginRight: '10px',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ 
                      fontSize: '16px',
                      color: '#000',
                      fontWeight: selectedCoaches.includes(coach.id) ? '600' : '400',
                    }}>
                      {coach.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
            
            {selectedCoaches.length > 0 && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '13px', 
                color: '#007bff',
                fontWeight: '500',
              }}>
                已選擇 {selectedCoaches.length} 位教練
              </div>
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
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
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
                cursor: 'pointer',
                borderRadius: '8px',
                backgroundColor: activityTypes.includes('WB') ? '#e7f3ff' : '#f8f9fa',
                border: activityTypes.includes('WB') ? '2px solid #007bff' : '2px solid #ddd',
                transition: 'all 0.2s',
                touchAction: 'manipulation',
                flex: '1 1 auto',
                minWidth: '100px',
                justifyContent: 'center',
              }}>
                <input
                  type="checkbox"
                  checked={activityTypes.includes('WB')}
                  onChange={() => toggleActivityType('WB')}
                  style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '8px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ 
                  fontSize: '16px',
                  color: '#000',
                  fontWeight: activityTypes.includes('WB') ? '600' : '400',
                }}>
                  WB (滑水板)
                </span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                cursor: 'pointer',
                borderRadius: '8px',
                backgroundColor: activityTypes.includes('WS') ? '#e7f3ff' : '#f8f9fa',
                border: activityTypes.includes('WS') ? '2px solid #007bff' : '2px solid #ddd',
                transition: 'all 0.2s',
                touchAction: 'manipulation',
                flex: '1 1 auto',
                minWidth: '100px',
                justifyContent: 'center',
              }}>
                <input
                  type="checkbox"
                  checked={activityTypes.includes('WS')}
                  onChange={() => toggleActivityType('WS')}
                  style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '8px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ 
                  fontSize: '16px',
                  color: '#000',
                  fontWeight: activityTypes.includes('WS') ? '600' : '400',
                }}>
                  WS (滑水)
                </span>
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
              placeholder="例如：初學者、需要救生衣、特殊需求..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

          {/* 重複預約選項 */}
          <div style={{ 
            marginBottom: '18px',
            padding: '16px',
            backgroundColor: '#f0f8ff',
            borderRadius: '8px',
            border: '1px solid #d0e8ff',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: isRepeat ? '16px' : '0',
            }}>
              <input
                type="checkbox"
                checked={isRepeat}
                onChange={(e) => setIsRepeat(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  marginRight: '10px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ 
                fontSize: '16px',
                fontWeight: '600',
                color: '#000',
              }}>
                🔄 重複預約
              </span>
            </label>

            {isRepeat && (
              <div>
                {/* 提示訊息 */}
                <div style={{
                  padding: '12px',
                  backgroundColor: '#e7f3ff',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px',
                  color: '#004085',
                }}>
                  💡 將會在每{['日', '一', '二', '三', '四', '五', '六'][new Date(defaultStartTime).getDay()]} {new Date(defaultStartTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 重複預約
                </div>

                {/* 結束條件 */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}>
                    結束條件：
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        checked={repeatEndType === 'count'}
                        onChange={() => setRepeatEndType('count')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', color: '#000' }}>重複</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={repeatCount}
                        onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={repeatEndType !== 'count'}
                        style={{
                          width: '70px',
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '14px',
                        }}
                      />
                      <span style={{ fontSize: '14px', color: '#000' }}>次</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        checked={repeatEndType === 'date'}
                        onChange={() => setRepeatEndType('date')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', color: '#000' }}>結束於</span>
                      <input
                        type="date"
                        value={repeatEndDate}
                        onChange={(e) => setRepeatEndDate(e.target.value)}
                        disabled={repeatEndType !== 'date'}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '14px',
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 預覽 */}
                <div style={{
                  padding: '10px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#856404',
                }}>
                  📅 預計創建 <strong>{generateRepeatDates().length}</strong> 個預約
                </div>
              </div>
            )}
          </div>

          <div style={{ 
            marginBottom: '20px', 
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#333', 
            fontSize: '14px',
          }}>
            <strong>開始時間:</strong><br />
            {new Date(defaultStartTime).toLocaleString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee',
                color: '#c00',
                borderRadius: '4px',
                marginBottom: '16px',
                border: '1px solid #fcc',
                fontSize: '15px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#000',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontSize: '16px',
                fontWeight: '500',
                minHeight: '48px',
                touchAction: 'manipulation',
                flex: '1 1 auto',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontSize: '16px',
                fontWeight: '500',
                minHeight: '48px',
                touchAction: 'manipulation',
                flex: '1 1 auto',
              }}
            >
              {loading ? '新增中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

