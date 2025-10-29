import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Coach {
  id: string // UUID from Supabase
  name: string
}

interface Booking {
  id: number
  boat_id: number
  coach_id: string
  student: string
  start_at: string
  duration_min: number
  activity_types?: string[] | null
  notes?: string | null
  status: string
  actual_duration_min?: number | null
  coach_confirmed?: boolean
  confirmed_at?: string | null
  confirmed_by?: string | null
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
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [student, setStudent] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [activityTypes, setActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCoaches, setLoadingCoaches] = useState(true)
  
  // 教練確認相關狀態
  const [actualDurationMin, setActualDurationMin] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchCoaches()
      if (booking) {
        setSelectedCoachId(booking.coach_id)
        setStudent(booking.student)
        setDurationMin(booking.duration_min)
        setActivityTypes(booking.activity_types || [])
        setNotes(booking.notes || '')
        setActualDurationMin(booking.actual_duration_min || booking.duration_min)
        
        // Parse start_at into date and time
        const startDateTime = new Date(booking.start_at)
        const dateStr = startDateTime.toISOString().split('T')[0]
        const timeStr = startDateTime.toTimeString().slice(0, 5) // HH:MM
        setStartDate(dateStr)
        setStartTime(timeStr)
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
        .eq('boat_id', booking.boat_id)
        .neq('id', booking.id) // 排除當前預約
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
        const existingCleanupEnd = existingEnd + 15 * 60000
        
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
      if (selectedCoachId) {
        const { data: coachBookings, error: coachCheckError } = await supabase
          .from('bookings')
          .select('id, start_at, duration_min, student, boats(name)')
          .eq('coach_id', selectedCoachId)
          .neq('id', booking.id) // 排除當前預約
          .gte('start_at', `${startDate}T00:00:00`)
          .lte('start_at', `${startDate}T23:59:59`)
        
        if (!coachCheckError) {
          for (const existing of coachBookings || []) {
            const existingStart = new Date(existing.start_at).getTime()
            const existingEnd = existingStart + existing.duration_min * 60000
            
            // 檢查時間重疊
            if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
              const coachName = coaches.find(c => c.id === selectedCoachId)?.name || selectedCoachId
              const boatName = (existing as any).boats?.name || ''
              setError(`教練 ${coachName} 在此時段已有其他預約${boatName ? `（${boatName}）` : ''}`)
              setLoading(false)
              return
            }
          }
        }
      }
      
      const updateData = {
        coach_id: selectedCoachId || null,
        student: student,
        start_at: newStartAt,
        duration_min: durationMin,
        activity_types: activityTypes.length > 0 ? activityTypes : null,
        notes: notes || null,
        updated_by: user.id,
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id)

      if (updateError) {
        if (updateError.message.includes('violates exclusion constraint')) {
          setError('該時段已被預約（教練/船）')
        } else {
          setError(updateError.message)
        }
        setLoading(false)
        return
      }

      // Log to audit_log
      const changedFields = []
      if (booking.coach_id !== selectedCoachId) changedFields.push('coach_id')
      if (booking.student !== student) changedFields.push('student')
      if (booking.start_at !== newStartAt) changedFields.push('start_at')
      if (booking.duration_min !== durationMin) changedFields.push('duration_min')
      if (JSON.stringify(booking.activity_types) !== JSON.stringify(activityTypes.length > 0 ? activityTypes : null)) {
        changedFields.push('activity_types')
      }
      if ((booking.notes || '') !== (notes || '')) changedFields.push('notes')

      const { error: auditError } = await supabase.from('audit_log').insert({
        table_name: 'bookings',
        record_id: booking.id,
        action: 'UPDATE',
        user_id: user.id,
        user_email: user.email,
        old_data: booking,
        new_data: { ...booking, ...updateData },
        changed_fields: changedFields,
      })
      if (auditError) {
        console.error('Audit log insert error:', auditError)
      }

      // Success
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '更新失敗')
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!booking) return
    if (!actualDurationMin || actualDurationMin <= 0) {
      setError('請輸入實際時長')
      return
    }

    setIsConfirming(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          actual_duration_min: actualDurationMin,
          coach_confirmed: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id
        })
        .eq('id', booking.id)

      if (updateError) throw updateError

      // Log to audit_log
      const { error: auditError } = await supabase.from('audit_log').insert({
        table_name: 'bookings',
        record_id: booking.id,
        action: 'UPDATE',
        user_id: user.id,
        user_email: user.email,
        old_data: booking,
        new_data: { 
          ...booking, 
          actual_duration_min: actualDurationMin, 
          coach_confirmed: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id
        },
        changed_fields: ['actual_duration_min', 'coach_confirmed', 'confirmed_at', 'confirmed_by']
      })
      
      if (auditError) {
        console.error('Audit log insert error:', auditError)
      }

      setIsConfirming(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '確認失敗')
      setIsConfirming(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('確定要刪除這筆預約嗎？')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Log to audit_log before deleting
      const { error: auditError } = await supabase.from('audit_log').insert({
        table_name: 'bookings',
        record_id: booking.id,
        action: 'DELETE',
        user_id: user.id,
        user_email: user.email,
        old_data: booking,
        new_data: null,
        changed_fields: null,
      })
      if (auditError) {
        console.error('Audit log insert error:', auditError)
      }

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (deleteError) {
        setError(deleteError.message)
        setLoading(false)
        return
      }

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
    setError('')
    setSelectedCoachId('')
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
              教練
            </label>
            
            {loadingCoaches ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                載入教練列表中...
              </div>
            ) : (
              <select
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
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
                <option value="">不指定教練</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
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
              step="900"
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

          {/* 教練確認區塊 */}
          {booking && (() => {
            const endTime = new Date(booking.start_at).getTime() + booking.duration_min * 60000
            const isEnded = endTime < Date.now()
            const isConfirmed = booking.coach_confirmed
            
            if (isEnded && !isConfirmed) {
              return (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: '#fff3cd',
                  border: '2px solid #ff9800',
                  borderRadius: '8px'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                    ⚠️ 教練確認
                  </h3>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      color: '#000',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}>
                      實際時長（分鐘） *
                    </label>
                    <input
                      type="number"
                      value={actualDurationMin || ''}
                      onChange={(e) => setActualDurationMin(parseInt(e.target.value) || null)}
                      placeholder="輸入實際上課時長"
                      min="0"
                      step="15"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        boxSizing: 'border-box',
                        fontSize: '15px',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isConfirming || !actualDurationMin}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isConfirming || !actualDurationMin ? '#ccc' : '#28a745',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: isConfirming || !actualDurationMin ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isConfirming ? '確認中...' : '✓ 確認完成'}
                  </button>
                </div>
              )
            } else if (isConfirmed) {
              return (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: '#d4edda',
                  border: '2px solid #28a745',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>✓</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#155724' }}>
                      已確認
                    </h3>
                  </div>
                  <div style={{ fontSize: '14px', color: '#155724' }}>
                    實際時長：{booking.actual_duration_min} 分鐘
                  </div>
                  {booking.confirmed_at && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      確認時間：{new Date(booking.confirmed_at).toLocaleString('zh-TW')}
                    </div>
                  )}
                </div>
              )
            }
            return null
          })()}

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
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid #dc3545',
                backgroundColor: 'white',
                color: '#dc3545',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontSize: '16px',
                fontWeight: '500',
                minHeight: '48px',
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
                backgroundColor: '#28a745',
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
              {loading ? '更新中...' : '確認更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

