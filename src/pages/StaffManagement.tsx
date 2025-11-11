import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface Staff {
  id: string
  name: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface StaffManagementProps {
  user: User
}

export function StaffManagement({ user }: StaffManagementProps) {
  const { isMobile } = useResponsive()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [newCoachName, setNewCoachName] = useState('')
  const [adding, setAdding] = useState(false)
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setStaffList(data || [])
    } catch (error) {
      console.error('載入人員資料失敗:', error)
      alert('載入人員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newCoachName.trim()) {
      alert('請輸入教練姓名')
      return
    }

    setAdding(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .insert([{ name: newCoachName.trim() }])

      if (error) throw error

      setNewCoachName('')
      loadStaff()
    } catch (error) {
      console.error('新增失敗:', error)
      alert('新增失敗')
    } finally {
      setAdding(false)
    }
  }


  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666',
      }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="🎓 教練管理" user={user} showBaoLink={true} />

      {/* 教練列表 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        {staffList.map((staff, index) => (
          <div
            key={staff.id}
            style={{
              padding: isMobile ? '15px' : '20px',
              borderBottom: index < staffList.length - 1 ? '1px solid #f0f0f0' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '15px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white'
            }}
          >
            <div style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '500',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>🎓</span>
              {staff.name}
            </div>

            <button
              onClick={() => {
                setSelectedStaff(staff)
                setTimeOffDialogOpen(true)
              }}
              style={{
                padding: isMobile ? '10px 20px' : '12px 24px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                cursor: 'pointer',
                minWidth: isMobile ? '80px' : '100px'
              }}
            >
              休假
            </button>
          </div>
        ))}

        {/* 新增教練輸入框 */}
        <form
          onSubmit={handleAddCoach}
          style={{
            padding: isMobile ? '15px' : '20px',
            background: '#f8f9fa',
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
          }}
        >
          <input
            type="text"
            value={newCoachName}
            onChange={(e) => setNewCoachName(e.target.value)}
            placeholder="輸入教練姓名..."
            disabled={adding}
            style={{
              flex: 1,
              padding: isMobile ? '10px 12px' : '12px 14px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '15px',
              outline: 'none',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
          />
          <button
            type="submit"
            disabled={adding || !newCoachName.trim()}
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: adding || !newCoachName.trim() ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: 'bold',
              cursor: adding || !newCoachName.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {adding ? '新增中...' : '+ 新增'}
          </button>
        </form>
      </div>

      {/* 休假管理對話框 */}
      {timeOffDialogOpen && selectedStaff && (
        <TimeOffDialog
          open={timeOffDialogOpen}
          coach={selectedStaff}
          onClose={() => {
            setTimeOffDialogOpen(false)
            setSelectedStaff(null)
          }}
        />
      )}

      {/* Footer */}
      <Footer />
    </div>
  )
}

// 休假管理對話框組件
interface TimeOffDialogProps {
  open: boolean
  coach: Staff
  onClose: () => void
}

interface TimeOffRecord {
  id: string
  coach_id: string
  start_date: string
  end_date: string | null
  reason: string | null
  created_at: string
}

function TimeOffDialog({ open, coach, onClose }: TimeOffDialogProps) {
  const [loading, setLoading] = useState(false)
  const [timeOffRecords, setTimeOffRecords] = useState<TimeOffRecord[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    indefinite: false
  })

  useEffect(() => {
    if (open) {
      loadTimeOffRecords()
    }
  }, [open])

  const loadTimeOffRecords = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('coach_time_off')
        .select('*')
        .eq('coach_id', coach.id)
        .order('start_date', { ascending: false })

      if (error) throw error
      setTimeOffRecords(data || [])
    } catch (error) {
      console.error('載入休假記錄失敗:', error)
      alert('載入休假記錄失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTimeOff = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.start_date) {
      alert('請選擇開始日期')
      return
    }

    if (!formData.indefinite && !formData.end_date) {
      alert('請選擇結束日期或勾選無限延期')
      return
    }

    if (!formData.indefinite && formData.start_date > formData.end_date) {
      alert('結束日期不能早於開始日期')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('coach_time_off')
        .insert([{
          coach_id: coach.id,
          start_date: formData.start_date,
          end_date: formData.indefinite ? null : formData.end_date,
          reason: formData.reason.trim() || null
        }])

      if (error) throw error
      setFormData({ start_date: '', end_date: '', reason: '', indefinite: false })
      setShowAddForm(false)
      loadTimeOffRecords()
    } catch (error) {
      console.error('新增休假失敗:', error)
      alert('新增休假失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTimeOff = async (id: string) => {
    if (!confirm('確定要刪除這筆休假記錄嗎？')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('coach_time_off')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadTimeOffRecords()
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            {coach.name} - 休假管理
          </h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* 新增按鈕 */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '20px'
              }}
            >
              + 新增休假
            </button>
          )}

          {/* 新增表單 */}
          {showAddForm && (
            <form onSubmit={handleAddTimeOff} style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  開始日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '10px',
                  background: formData.indefinite ? '#fff3e0' : 'white',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px'
                }}>
                  <input
                    type="checkbox"
                    checked={formData.indefinite}
                    onChange={(e) => setFormData({ ...formData, indefinite: e.target.checked, end_date: '' })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>無限延期（長假）</span>
                </label>
              </div>

              {!formData.indefinite && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    結束日期 <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                    required={!formData.indefinite}
                  />
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  原因 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="例如：個人休假、出國..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '新增中...' : '確認新增'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({ start_date: '', end_date: '', reason: '', indefinite: false })
                  }}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          )}

          {/* 休假記錄列表 */}
          {loading && timeOffRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              載入中...
            </div>
          ) : timeOffRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              尚無休假記錄
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timeOffRecords.map((record) => (
                <div
                  key={record.id}
                  style={{
                    background: 'white',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '8px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                        📅 {record.start_date} ~ {record.end_date || '無限延期'}
                      </div>
                      {record.reason && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          📝 {record.reason}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTimeOff(record.id)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
