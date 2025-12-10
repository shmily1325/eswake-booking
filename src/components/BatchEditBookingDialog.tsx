import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'

interface Coach {
  id: string
  name: string
  status: string | null
}

interface BatchEditBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bookingIds: number[]
}

type EditField = 'coaches' | 'drivers' | 'activity_types' | 'notes' | 'schedule_notes'

const ACTIVITY_OPTIONS = ['Wake', 'Surf', 'Ski', 'Foil']

export function BatchEditBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  bookingIds,
}: BatchEditBookingDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [loading, setLoading] = useState(false)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loadingCoaches, setLoadingCoaches] = useState(true)
  
  // 要修改的欄位開關
  const [fieldsToEdit, setFieldsToEdit] = useState<Set<EditField>>(new Set())
  
  // 修改的值
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  
  // 載入教練列表
  useEffect(() => {
    if (isOpen) {
      loadCoaches()
    }
  }, [isOpen])
  
  const loadCoaches = async () => {
    setLoadingCoaches(true)
    const { data } = await supabase
      .from('coaches')
      .select('id, name, status')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      setCoaches(data)
    }
    setLoadingCoaches(false)
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
  
  // 切換駕駛選擇
  const toggleDriver = (driverId: string) => {
    if (selectedDrivers.includes(driverId)) {
      setSelectedDrivers(selectedDrivers.filter(id => id !== driverId))
    } else {
      setSelectedDrivers([...selectedDrivers, driverId])
    }
  }
  
  // 切換活動類型
  const toggleActivityType = (type: string) => {
    if (selectedActivityTypes.includes(type)) {
      setSelectedActivityTypes(selectedActivityTypes.filter(t => t !== type))
    } else {
      setSelectedActivityTypes([...selectedActivityTypes, type])
    }
  }
  
  // 執行批次更新
  const handleSubmit = async () => {
    if (fieldsToEdit.size === 0) {
      toast.warning('請至少選擇一個要修改的欄位')
      return
    }
    
    setLoading(true)
    
    try {
      let successCount = 0
      let errorCount = 0
      
      for (const bookingId of bookingIds) {
        try {
          // 更新 bookings 表的欄位
          const updateData: Record<string, any> = {}
          
          if (fieldsToEdit.has('activity_types')) {
            updateData.activity_types = selectedActivityTypes.length > 0 ? selectedActivityTypes : null
          }
          if (fieldsToEdit.has('notes')) {
            updateData.notes = notes.trim() || null
          }
          if (fieldsToEdit.has('schedule_notes')) {
            updateData.schedule_notes = scheduleNotes.trim() || null
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
          
          // 更新駕駛
          if (fieldsToEdit.has('drivers')) {
            // 先刪除舊的
            await supabase
              .from('booking_drivers')
              .delete()
              .eq('booking_id', bookingId)
            
            // 新增新的
            if (selectedDrivers.length > 0) {
              const driverInserts = selectedDrivers.map(driverId => ({
                booking_id: bookingId,
                driver_id: driverId,
              }))
              await supabase.from('booking_drivers').insert(driverInserts)
            }
          }
          
          successCount++
        } catch (err) {
          console.error(`更新預約 ${bookingId} 失敗:`, err)
          errorCount++
        }
      }
      
      if (errorCount === 0) {
        toast.success(`成功更新 ${successCount} 筆預約`)
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
    setSelectedCoaches([])
    setSelectedDrivers([])
    setSelectedActivityTypes([])
    setNotes('')
    setScheduleNotes('')
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
                {loadingCoaches ? (
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
          
          {/* 駕駛 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('drivers') ? '2px solid #007bff' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('drivers') ? '#f0f7ff' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('drivers') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('drivers')}
                onChange={() => toggleField('drivers')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>🚤 修改駕駛</span>
            </label>
            
            {fieldsToEdit.has('drivers') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {loadingCoaches ? (
                  <span style={{ color: '#666' }}>載入中...</span>
                ) : coaches.map(coach => (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => toggleDriver(coach.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: 'none',
                      background: selectedDrivers.includes(coach.id) ? '#17a2b8' : '#e9ecef',
                      color: selectedDrivers.includes(coach.id) ? 'white' : '#495057',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                    }}
                  >
                    {coach.name}
                  </button>
                ))}
                {selectedDrivers.length === 0 && (
                  <span style={{ fontSize: '13px', color: '#dc3545' }}>（將清空駕駛）</span>
                )}
              </div>
            )}
          </div>
          
          {/* 活動類型 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('activity_types') ? '2px solid #007bff' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('activity_types') ? '#f0f7ff' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('activity_types') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('activity_types')}
                onChange={() => toggleField('activity_types')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>🏄 修改活動類型</span>
            </label>
            
            {fieldsToEdit.has('activity_types') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {ACTIVITY_OPTIONS.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleActivityType(type)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: 'none',
                      background: selectedActivityTypes.includes(type) ? '#28a745' : '#e9ecef',
                      color: selectedActivityTypes.includes(type) ? 'white' : '#495057',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                    }}
                  >
                    {type}
                  </button>
                ))}
                {selectedActivityTypes.length === 0 && (
                  <span style={{ fontSize: '13px', color: '#dc3545' }}>（將清空活動類型）</span>
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
          
          {/* 排班備註 */}
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            border: fieldsToEdit.has('schedule_notes') ? '2px solid #007bff' : '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: fieldsToEdit.has('schedule_notes') ? '#f0f7ff' : 'white',
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: fieldsToEdit.has('schedule_notes') ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={fieldsToEdit.has('schedule_notes')}
                onChange={() => toggleField('schedule_notes')}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '15px' }}>📋 修改排班備註</span>
            </label>
            
            {fieldsToEdit.has('schedule_notes') && (
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="輸入新的排班備註（留空將清除）"
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  marginTop: '8px',
                }}
              />
            )}
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

