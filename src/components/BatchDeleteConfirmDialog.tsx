import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { logAction } from '../utils/auditLog'

interface BatchDeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  bookingIds: number[]
  user: { email?: string } | null
}

export function BatchDeleteConfirmDialog({
  isOpen,
  onClose,
  onSuccess,
  bookingIds,
  user,
}: BatchDeleteConfirmDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [loading, setLoading] = useState(false)
  const [filledBy, setFilledBy] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  
  // 每次打開時重置表單
  useEffect(() => {
    if (isOpen) {
      setFilledBy('')
      setConfirmed(false)
    }
  }, [isOpen])
  
  const handleClose = () => {
    setFilledBy('')
    setConfirmed(false)
    onClose()
  }
  
  const handleDelete = async () => {
    if (!filledBy.trim()) {
      toast.warning('請輸入填表人')
      return
    }
    
    if (!confirmed) {
      toast.warning('請勾選確認')
      return
    }
    
    setLoading(true)
    
    try {
      let successCount = 0
      let errorCount = 0
      
      for (const bookingId of bookingIds) {
        try {
          // 真的刪除（CASCADE 會自動刪除相關記錄）
          const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId)
          
          if (error) throw error
          successCount++
        } catch (err) {
          console.error(`刪除預約 ${bookingId} 失敗:`, err)
          errorCount++
        }
      }
      
      // 記錄 Audit Log
      if (successCount > 0 && user?.email) {
        const details = `批次刪除 ${successCount} 筆預約 (填表人: ${filledBy.trim()})`
        logAction(user.email, 'delete', 'bookings', details)
      }
      
      if (errorCount === 0) {
        toast.success(`成功刪除 ${successCount} 筆預約`)
        handleClose()
        onSuccess()
      } else {
        toast.warning(`刪除完成：${successCount} 筆成功，${errorCount} 筆失敗`)
        handleClose()
        onSuccess()
      }
    } catch (err) {
      console.error('批次刪除失敗:', err)
      toast.error('批次刪除失敗')
    } finally {
      setLoading(false)
    }
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
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1001,
      padding: isMobile ? '0' : '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '12px 12px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '450px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        {/* 標題 */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#dc3545',
          borderRadius: isMobile ? '12px 12px 0 0' : '12px 12px 0 0',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
              ⚠️ 批次刪除預約
            </h2>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
              即將刪除 {bookingIds.length} 筆預約
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'white',
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
        
        {/* 警告訊息 */}
        <div style={{ padding: isMobile ? '16px' : '20px' }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #ffc107',
          }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#856404',
              marginBottom: '8px'
            }}>
              ⚠️ 此操作無法復原！
            </div>
            <div style={{ fontSize: '14px', color: '#856404' }}>
              預約將被永久刪除，無法恢復。請確認您要刪除的預約正確無誤。
            </div>
          </div>
          
          {/* 填表人 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '6px',
              color: '#333',
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
          
          {/* 確認勾選 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: confirmed ? '#f8d7da' : '#f8f9fa',
              borderRadius: '8px',
              cursor: 'pointer',
              border: confirmed ? '2px solid #dc3545' : '1px solid #e0e0e0',
            }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ 
                  width: '24px', 
                  height: '24px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ 
                fontSize: '15px', 
                fontWeight: '600',
                color: confirmed ? '#dc3545' : '#333',
              }}>
                我確認要刪除這 {bookingIds.length} 筆預約
              </span>
            </label>
          </div>
        </div>
        
        {/* 底部按鈕 */}
        <div style={{
          padding: isMobile ? '16px 20px 30px' : '16px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
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
            onClick={handleDelete}
            disabled={loading || !filledBy.trim() || !confirmed}
            style={{
              padding: '14px 28px',
              border: 'none',
              borderRadius: '8px',
              background: (loading || !filledBy.trim() || !confirmed) ? '#ccc' : '#dc3545',
              color: 'white',
              cursor: (loading || !filledBy.trim() || !confirmed) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.15s',
              transform: 'scale(1)',
              opacity: loading ? 0.7 : 1,
            }}
            onTouchStart={(e) => {
              if (!loading && filledBy.trim() && confirmed) {
                e.currentTarget.style.transform = 'scale(0.95)'
                e.currentTarget.style.opacity = '0.8'
              }
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.opacity = '1'
            }}
            onMouseDown={(e) => {
              if (!loading && filledBy.trim() && confirmed) {
                e.currentTarget.style.transform = 'scale(0.95)'
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {loading ? '🔄 刪除中...' : `🗑️ 確認刪除 (${bookingIds.length} 筆)`}
          </button>
        </div>
      </div>
    </div>
  )
}

