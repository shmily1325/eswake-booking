import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { logAction } from '../utils/auditLog'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'
import { checkBoatConflict, checkCoachesConflictBatch } from '../utils/bookingConflict'
import { checkBoatUnavailable } from '../utils/availability'
import { isFacility } from '../utils/facility'

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
      
      // 優化：一次查詢所有預約的完整資訊
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, start_at, duration_min, boat_id, boats:boat_id(name)')
        .in('id', bookingIds)
      
      if (!bookingsData) {
        throw new Error('無法查詢預約資料')
      }
      
      // 建立 coachesMap
      const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
      
      for (const booking of bookingsData) {
        try {
          const dateStr = booking.start_at.split('T')[0]
          const startTime = booking.start_at.split('T')[1].substring(0, 5)
          const hour = parseInt(startTime.split(':')[0])
          const actualDuration = fieldsToEdit.has('duration') ? durationMin : booking.duration_min
          const actualBoatId = fieldsToEdit.has('boat') && selectedBoatId ? selectedBoatId : booking.boat_id
          const actualBoatName = fieldsToEdit.has('boat') && targetBoat ? targetBoat.name : (booking.boats as any)?.name || ''
          const isBoatFacility = isFacility(actualBoatName)
          
          // 1. 檢查船隻維修/停用
          if (fieldsToEdit.has('boat') && selectedBoatId) {
            const availability = await checkBoatUnavailable(selectedBoatId, dateStr, startTime, undefined, actualDuration)
            if (availability.isUnavailable) {
              skippedBoat++
              continue
            }
          }
          
          // 2. 檢查船隻衝突（使用原本的完整檢查，包含清理時間）
          if (fieldsToEdit.has('boat') || fieldsToEdit.has('duration')) {
            const boatConflict = await checkBoatConflict(
              actualBoatId,
              dateStr,
              startTime,
              actualDuration,
              isBoatFacility,
              booking.id,
              actualBoatName
            )
            if (boatConflict.hasConflict) {
              if (fieldsToEdit.has('boat')) skippedBoat++
              else skippedDuration++
              continue
            }
          }
          
          // 3. 檢查 08:00 規則
          if (fieldsToEdit.has('coaches') && selectedCoaches.length === 0) {
            if (hour < EARLY_BOOKING_HOUR_LIMIT) {
              skippedCoach++
              continue
            }
          }
          
          // 4. 檢查教練衝突（使用原本的完整檢查）
          if (fieldsToEdit.has('coaches') && selectedCoaches.length > 0) {
            const coachConflict = await checkCoachesConflictBatch(
              selectedCoaches,
              dateStr,
              startTime,
              actualDuration,
              coachesMap,
              booking.id
            )
            if (coachConflict.hasConflict) {
              skippedCoach++
              continue
            }
          }
          
          // 通過所有檢查，執行更新
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
          
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from('bookings')
              .update(updateData)
              .eq('id', booking.id)
            
            if (error) throw error
          }
          
          // 更新教練
          if (fieldsToEdit.has('coaches')) {
            await supabase
              .from('booking_coaches')
              .delete()
              .eq('booking_id', booking.id)
            
            if (selectedCoaches.length > 0) {
              const coachInserts = selectedCoaches.map(coachId => ({
                booking_id: booking.id,
                coach_id: coachId,
              }))
              await supabase.from('booking_coaches').insert(coachInserts)
            }
          }
          
          successCount++
        } catch (err) {
          console.error(`更新預約 ${booking.id} 失敗:`, err)
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
        if (skippedBoat > 0) skipReasons.push(`${skippedBoat}筆船隻衝突/維修`)
        if (skippedCoach > 0) skipReasons.push(`${skippedCoach}筆教練衝突或08:00規則`)
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
              <div>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#fff3cd', 
                  borderRadius: '6px', 
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: '#856404'
                }}>
                  ⚠️ 08:00 前的預約必須指定教練，不指定時該筆會被跳過
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

