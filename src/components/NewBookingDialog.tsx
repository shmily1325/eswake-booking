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

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    setLoading(true)

    try {
      // Combine date and time into ISO format
      const newStartAt = new Date(`${startDate}T${startTime}:00`).toISOString()
      const newStartTime = new Date(newStartAt).getTime()
      const newEndTime = newStartTime + durationMin * 60000
      
      // 檢查船隻衝突（需要至少15分鐘間隔）
      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('id, start_at, duration_min, student, coaches(name)')
        .eq('boat_id', defaultBoatId)
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${startDate}T23:59:59`)
      
      if (checkError) {
        setError('檢查衝突時發生錯誤')
        setLoading(false)
        return
      }
      
      // 檢查是否與現有預約衝突（需要15分鐘接船時間）
      for (const existing of existingBookings || []) {
        const existingStart = new Date(existing.start_at).getTime()
        const existingEnd = existingStart + existing.duration_min * 60000
        const existingCleanupEnd = existingEnd + 15 * 60000 // 加15分鐘接船時間
        
        // 檢查新預約是否在現有預約的接船時間內開始
        if (newStartTime >= existingEnd && newStartTime < existingCleanupEnd) {
          setError(`與 ${existing.student} 的預約衝突：需要至少15分鐘接船時間`)
          setLoading(false)
          return
        }
        
        // 檢查新預約結束時間是否會影響現有預約
        const newCleanupEnd = newEndTime + 15 * 60000
        if (existingStart >= newEndTime && existingStart < newCleanupEnd) {
          setError(`與 ${existing.student} 的預約衝突：需要至少15分鐘接船時間`)
          setLoading(false)
          return
        }
        
        // 檢查時間重疊
        if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
          setError(`與 ${existing.student} 的預約時間重疊`)
          setLoading(false)
          return
        }
      }
      
      // 檢查教練衝突（如果有選擇教練）
      if (selectedCoaches.length > 0) {
        for (const coachId of selectedCoaches) {
          const { data: coachBookings, error: coachCheckError } = await supabase
            .from('bookings')
            .select('id, start_at, duration_min, student, boats(name)')
            .eq('coach_id', coachId)
            .gte('start_at', `${startDate}T00:00:00`)
            .lte('start_at', `${startDate}T23:59:59`)
          
          if (coachCheckError) continue
          
          for (const existing of coachBookings || []) {
            const existingStart = new Date(existing.start_at).getTime()
            const existingEnd = existingStart + existing.duration_min * 60000
            
            // 檢查時間重疊
            if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
              const coachName = coaches.find(c => c.id === coachId)?.name || coachId
              const boatName = (existing as any).boats?.name || ''
              setError(`教練 ${coachName} 在此時段已有其他預約${boatName ? `（${boatName}）` : ''}`)
              setLoading(false)
              return
            }
          }
        }
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
        .select()

      if (insertError) {
        // Check for exclusion constraint violation
        if (insertError.message.includes('violates exclusion constraint')) {
          setError('該時段已被預約（教練/船）')
        } else {
          setError(insertError.message)
        }
        setLoading(false)
        return
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

        await supabase.from('audit_log').insert(auditLogs)
      }

      // Success
      setSelectedCoaches([])
      setStudent('')
      setStartDate('')
      setStartTime('')
      setDurationMin(60)
      setActivityTypes([])
      setNotes('')
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
        
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fee',
              color: '#c00',
              borderRadius: '4px',
              marginBottom: '16px',
              border: '1px solid #fcc',
            }}
          >
            {error}
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

