import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { logAction } from '../utils/auditLog'

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
  const [durationMin, setDurationMin] = useState<number>(30)
  const [filledBy, setFilledBy] = useState('')
  
  
  // 載入教練和船隻列表
  useEffect(() => {
    if (isOpen) {
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
  
  
  // 檢查教練衝突
  const checkCoachConflict = async (bookingId: number, coachIds: string[]): Promise<string[]> => {
    if (coachIds.length === 0) return []
    
    const { data: booking } = await supabase
      .from('bookings')
      .select('start_at, duration_min')
      .eq('id', bookingId)
      .single()
    
    if (!booking) return []
    
    const startAt = new Date(booking.start_at)
    const endAt = new Date(startAt.getTime() + (booking.duration_min || 30) * 60 * 1000)
    const dateStr = booking.start_at.split('T')[0]
    
    const conflictingCoaches: string[] = []
    
    for (const coachId of coachIds) {
      // 查詢該教練當天的其他預約
      const { data: coachBookings } = await supabase
        .from('booking_coaches')
        .select('booking_id, bookings!inner(id, start_at, duration_min, status)')
        .eq('coach_id', coachId)
        .neq('booking_id', bookingId)
      
      if (!coachBookings) continue
      
      for (const cb of coachBookings) {
        const b = cb.bookings as any
        if (b.status === 'cancelled') continue
        if (!b.start_at.startsWith(dateStr)) continue
        
        const bStart = new Date(b.start_at)
        const bEnd = new Date(bStart.getTime() + (b.duration_min || 30) * 60 * 1000)
        
        if (startAt < bEnd && endAt > bStart) {
          conflictingCoaches.push(coachId)
          break
        }
      }
    }
    
    return conflictingCoaches
  }
  
  // 檢查時長變更後的衝突（船隻和教練）
  const checkDurationConflict = async (bookingId: number, newDuration: number): Promise<boolean> => {
    const { data: booking } = await supabase
      .from('bookings')
      .select('start_at, boat_id')
      .eq('id', bookingId)
      .single()
    
    if (!booking) return false
    
    const startAt = new Date(booking.start_at)
    const newEndAt = new Date(startAt.getTime() + newDuration * 60 * 1000)
    const dateStr = booking.start_at.split('T')[0]
    
    // 檢查船隻衝突
    const { data: boatConflicts } = await supabase
      .from('bookings')
      .select('id, start_at, duration_min')
      .eq('boat_id', booking.boat_id)
      .gte('start_at', `${dateStr}T00:00:00`)
      .lte('start_at', `${dateStr}T23:59:59`)
      .neq('id', bookingId)
      .neq('status', 'cancelled')
    
    if (boatConflicts) {
      for (const c of boatConflicts) {
        const cStart = new Date(c.start_at)
        const cEnd = new Date(cStart.getTime() + (c.duration_min || 30) * 60 * 1000)
        if (startAt < cEnd && newEndAt > cStart) {
          return true
        }
      }
    }
    
    return false
  }
  
  // 檢查船隻衝突
  const checkBoatConflict = async (bookingId: number, newBoatId: number): Promise<boolean> => {
    const { data: booking } = await supabase
      .from('bookings')
      .select('start_at, duration_min')
      .eq('id', bookingId)
      .single()
    
    if (!booking) return false
    
    // 計算預約的時間範圍
    const startAt = new Date(booking.start_at)
    const endAt = new Date(startAt.getTime() + (booking.duration_min || 30) * 60 * 1000)
    
    // 查詢同一天同一艘船的預約
    const dateStr = booking.start_at.split('T')[0]
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, start_at, duration_min')
      .eq('boat_id', newBoatId)
      .gte('start_at', `${dateStr}T00:00:00`)
      .lte('start_at', `${dateStr}T23:59:59`)
      .neq('id', bookingId)
      .neq('status', 'cancelled')
    
    if (!conflicts || conflicts.length === 0) return false
    
    // 檢查時間是否重疊
    for (const c of conflicts) {
      const cStart = new Date(c.start_at)
      const cEnd = new Date(cStart.getTime() + (c.duration_min || 30) * 60 * 1000)
      
      // 檢查時間重疊
      if (startAt < cEnd && endAt > cStart) {
        return true // 有衝突
      }
    }
    
    return false
  }
  
  // 執行批次更新
  const handleSubmit = async () => {
    if (fieldsToEdit.size === 0) {
      toast.warning('請至少選擇一個要修改的欄位')
      return
    }
    
    if (fieldsToEdit.has('boat') && !selectedBoatId) {
      toast.warning('請選擇要更改的船隻')
      return
    }
    
    if (!filledBy.trim()) {
      toast.warning('請輸入填表人')
      return
    }
    
    setLoading(true)
    
    try {
      let successCount = 0
      let errorCount = 0
      let skippedBoat = 0
      let skippedCoach = 0
      let skippedDuration = 0
      
      const changes: string[] = []
      if (fieldsToEdit.has('boat') && selectedBoatId) {
        const boat = boats.find(b => b.id === selectedBoatId)
        changes.push(`船隻→${boat?.name || '未知'}`)
      }
      if (fieldsToEdit.has('coaches')) {
        const coachNames = coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
        changes.push(`教練→${coachNames.length > 0 ? coachNames.join('、') : '清空'}`)
      }
      if (fieldsToEdit.has('duration')) {
        changes.push(`時長→${durationMin}分鐘`)
      }
      if (fieldsToEdit.has('notes')) {
        changes.push(`備註→${notes.trim() || '清空'}`)
      }
      
      for (const bookingId of bookingIds) {
        try {
          // 如果要改船，先檢查衝突
          if (fieldsToEdit.has('boat') && selectedBoatId) {
            const hasConflict = await checkBoatConflict(bookingId, selectedBoatId)
            if (hasConflict) {
              skippedBoat++
              continue
            }
          }
          
          // 如果要改教練，檢查衝突
          if (fieldsToEdit.has('coaches') && selectedCoaches.length > 0) {
            const conflictingCoaches = await checkCoachConflict(bookingId, selectedCoaches)
            if (conflictingCoaches.length > 0) {
              skippedCoach++
              continue
            }
          }
          
          // 如果要改時長，檢查衝突
          if (fieldsToEdit.has('duration')) {
            const hasConflict = await checkDurationConflict(bookingId, durationMin)
            if (hasConflict) {
              skippedDuration++
              continue
            }
          }
          
          // 更新 bookings 表的欄位
          const updateData: Record<string, any> = {}
          
          if (fieldsToEdit.has('boat') && selectedBoatId) {
            updateData.boat_id = selectedBoatId
          }
          if (fieldsToEdit.has('notes')) {
            updateData.notes = notes.trim() || null
          }
          if (fieldsToEdit.has('duration')) {
            updateData.duration_min = durationMin
          }
          
          // 如果有要更新 bookings 表的欄位
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from('bookings')
              .update(updateData)
              .eq('id', bookingId)
            
            if (error) throw error
          }
          
          // 更新教練
          if (fieldsToEdit.has('coaches')) {
            // 先刪除舊的
            await supabase
              .from('booking_coaches')
              .delete()
              .eq('booking_id', bookingId)
            
            // 新增新的
            if (selectedCoaches.length > 0) {
              const coachInserts = selectedCoaches.map(coachId => ({
                booking_id: bookingId,
                coach_id: coachId,
              }))
              await supabase.from('booking_coaches').insert(coachInserts)
            }
          }
          
          successCount++
        } catch (err) {
          console.error(`更新預約 ${bookingId} 失敗:`, err)
          errorCount++
        }
      }
      
      // 記錄 Audit Log
      if (successCount > 0 && user?.email) {
        const details = `批次修改 ${successCount} 筆預約：${changes.join('、')} (填表人: ${filledBy.trim()})`
        logAction(user.email, 'update', 'bookings', details)
      }
      
      const totalSkipped = skippedBoat + skippedCoach + skippedDuration
      
      if (errorCount === 0 && totalSkipped === 0) {
        toast.success(`成功更新 ${successCount} 筆預約`)
        onSuccess()
      } else if (totalSkipped > 0) {
        const skipReasons: string[] = []
        if (skippedBoat > 0) skipReasons.push(`${skippedBoat}筆船隻衝突`)
        if (skippedCoach > 0) skipReasons.push(`${skippedCoach}筆教練衝突`)
        if (skippedDuration > 0) skipReasons.push(`${skippedDuration}筆時長衝突`)
        toast.warning(`更新完成：${successCount} 筆成功，跳過 ${skipReasons.join('、')}`)
        onSuccess()
      } else {
        toast.warning(`更新完成：${successCount} 筆成功，${errorCount} 筆失敗`)
        onSuccess()
      }
    } catch (err) {
      console.error('批次更新失敗:', err)
      toast.error('批次更新失敗')
    } finally {
      setLoading(false)
    }
  }
  
  // 重置表單
  const resetForm = () => {
    setFieldsToEdit(new Set())
    setSelectedBoatId(null)
    setSelectedCoaches([])
    setNotes('')
    setDurationMin(30)
    setFilledBy('')
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
      padding: isMobile ? '0' : '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '12px 12px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '500px',
        width: '100%',
        maxHeight: isMobile ? '90vh' : '85vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        {/* 標題 */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              批次修改預約
            </h2>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              已選擇 {bookingIds.length} 筆預約
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
        
        {/* 內容 */}
        <div style={{ padding: isMobile ? '16px' : '20px' }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
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
                {selectedCoaches.length === 0 && (
                  <span style={{ fontSize: '13px', color: '#dc3545' }}>（將清空教練）</span>
                )}
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DURATION_OPTIONS.map(duration => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setDurationMin(duration)}
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
        
        {/* 底部按鈕 */}
        <div style={{
          padding: isMobile ? '16px 20px 30px' : '16px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0,
          background: 'white',
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '12px 24px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              background: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: '500',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || fieldsToEdit.size === 0}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: (loading || fieldsToEdit.size === 0) ? '#ccc' : '#28a745',
              color: 'white',
              cursor: (loading || fieldsToEdit.size === 0) ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: '600',
            }}
          >
            {loading ? '更新中...' : `確認修改 (${bookingIds.length} 筆)`}
          </button>
        </div>
      </div>
    </div>
  )
}

