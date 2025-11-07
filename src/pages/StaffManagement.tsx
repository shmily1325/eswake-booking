import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false)
  const [bookingsDialogOpen, setBookingsDialogOpen] = useState(false)
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

  const handleDelete = async (staff: Staff, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm(`確定要刪除「${staff.name}」嗎？此操作無法復原。`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('coaches')
        .delete()
        .eq('id', staff.id)

      if (error) throw error

      alert('刪除成功！')
      loadStaff()
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗')
    }
  }

  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      {/* 標題列 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isMobile ? '15px' : '20px',
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        gap: isMobile ? '8px' : '10px',
        flexWrap: 'wrap'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 'bold',
          color: 'white'
        }}>
          🎓 教練管理
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setAddDialogOpen(true)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: isMobile ? '14px' : '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation'
            }}
          >
            + 新增教練
          </button>
          <Link
            to="/bao"
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              background: '#f8f9fa',
              color: '#333',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: isMobile ? '14px' : '13px',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation'
            }}
          >
            ← BAO
          </Link>
          <Link
            to="/"
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              background: '#f8f9fa',
              color: '#333',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: isMobile ? '14px' : '13px',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation'
            }}
          >
            ← HOME
          </Link>
          <UserMenu user={user} />
        </div>
      </div>

      {/* 搜尋欄 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder="搜尋教練姓名..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '10px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '14px',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
        />
      </div>

      {/* 統計資訊 */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>教練總數</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
          {filteredStaff.length}
        </div>
      </div>

      {/* 教練列表 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '15px'
      }}>
        {filteredStaff.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '40px',
            color: '#999',
            fontSize: '16px'
          }}>
            {searchTerm ? '找不到符合條件的教練' : '尚無教練資料'}
          </div>
        ) : (
          filteredStaff.map((staff) => (
            <div
              key={staff.id}
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                border: '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {/* 教練姓名 */}
              <div style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span>🎓</span>
                {staff.name}
              </div>

              {/* 備註 */}
              {staff.notes && (
                <div style={{
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '12px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  📝 {staff.notes}
                </div>
              )}

              {/* 操作按鈕 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginTop: '12px'
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStaff(staff)
                    setTimeOffDialogOpen(true)
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  休假管理
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStaff(staff)
                    setBookingsDialogOpen(true)
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  查看預約
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStaff(staff)
                    setEditDialogOpen(true)
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  編輯
                </button>
                <button
                  onClick={(e) => handleDelete(staff, e)}
                  style={{
                    padding: '8px 12px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  刪除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增教練對話框 */}
      {addDialogOpen && (
        <AddStaffDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={() => {
            loadStaff()
            setAddDialogOpen(false)
          }}
        />
      )}

      {/* 編輯教練對話框 */}
      {editDialogOpen && selectedStaff && (
        <EditStaffDialog
          open={editDialogOpen}
          staff={selectedStaff}
          onClose={() => {
            setEditDialogOpen(false)
            setSelectedStaff(null)
          }}
          onSuccess={() => {
            loadStaff()
            setEditDialogOpen(false)
            setSelectedStaff(null)
          }}
        />
      )}

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

      {/* 查看預約對話框 */}
      {bookingsDialogOpen && selectedStaff && (
        <BookingsDialog
          open={bookingsDialogOpen}
          staff={selectedStaff}
          onClose={() => {
            setBookingsDialogOpen(false)
            setSelectedStaff(null)
          }}
        />
      )}
    </div>
  )
}

// 新增教練對話框組件
interface AddStaffDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function AddStaffDialog({ open, onClose, onSuccess }: AddStaffDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('請輸入姓名')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .insert([{
          name: formData.name.trim(),
          notes: formData.notes.trim() || null
        }])

      if (error) throw error

      alert('新增成功！')
      onSuccess()
      setFormData({ name: '', notes: '' })
    } catch (error) {
      console.error('新增失敗:', error)
      alert('新增失敗')
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
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            新增教練
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

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                姓名 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                備註 <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="請輸入備註"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
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

// 編輯教練對話框組件
interface EditStaffDialogProps {
  open: boolean
  staff: Staff
  onClose: () => void
  onSuccess: () => void
}

function EditStaffDialog({ open, staff, onClose, onSuccess }: EditStaffDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: staff.name,
    notes: staff.notes || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('請輸入姓名')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          name: formData.name.trim(),
          notes: formData.notes.trim() || null
        })
        .eq('id', staff.id)

      if (error) throw error

      alert('更新成功！')
      onSuccess()
    } catch (error) {
      console.error('更新失敗:', error)
      alert('更新失敗')
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
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            編輯教練
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

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                姓名 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                備註 <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="請輸入備註"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
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

      alert('新增休假成功！')
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

      alert('刪除成功！')
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
                    background: loading ? '#ccc' : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
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

// 查看預約對話框組件
interface BookingsDialogProps {
  open: boolean
  staff: Staff
  onClose: () => void
}

interface Booking {
  id: string
  start_at: string
  status: string
  participants: Array<{
    member_name: string
    reported: boolean
  }>
}

function BookingsDialog({ open, staff, onClose }: BookingsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    if (open) {
      loadBookings()
    }
  }, [open, filterDate])

  const loadBookings = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          status,
          booking_participants (
            member_name,
            reported
          )
        `)
        .or(`coach.eq.${staff.name},driver.eq.${staff.name}`)
        .order('start_at', { ascending: false })
        .limit(50)

      // 如果有日期過濾
      if (filterDate) {
        query = query.gte('start_at', filterDate).lt('start_at', filterDate + 'T23:59:59')
      }

      const { data, error } = await query

      if (error) throw error
      
      // Map booking_participants to participants
      const formattedData = (data || []).map((booking: any) => ({
        ...booking,
        participants: booking.booking_participants || []
      }))
      
      setBookings(formattedData)
    } catch (error) {
      console.error('載入預約記錄失敗:', error)
      alert('載入預約記錄失敗')
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
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              {staff.name} - 預約記錄
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

          {/* 日期過濾 */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              篩選日期
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#f8f9fa',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                清除篩選
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              載入中...
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {filterDate ? '該日期無預約記錄' : '尚無預約記錄'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map((booking) => {
                const participants = booking.participants || []
                const reportedCount = participants.filter(p => p.reported).length
                const totalCount = participants.length

                return (
                  <div
                    key={booking.id}
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
                      marginBottom: '12px'
                    }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          📅 {booking.start_at.split('T')[0]} {booking.start_at.split('T')[1]?.substring(0, 5)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          狀態: {booking.status}
                        </div>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        background: reportedCount === totalCount && totalCount > 0
                          ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
                          : reportedCount > 0
                          ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
                          : '#e0e0e0',
                        color: reportedCount > 0 ? 'white' : '#666'
                      }}>
                        已回報 {reportedCount}/{totalCount}
                      </span>
                    </div>

                    {/* 參與者列表 */}
                    {participants.length > 0 && (
                      <div style={{
                        background: '#f8f9fa',
                        padding: '12px',
                        borderRadius: '6px',
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#666' }}>
                          參與者:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {participants.map((participant, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 10px',
                                background: participant.reported ? '#4caf50' : 'white',
                                color: participant.reported ? 'white' : '#333',
                                border: participant.reported ? 'none' : '1px solid #ddd',
                                borderRadius: '12px',
                                fontSize: '13px',
                              }}
                            >
                              {participant.reported ? '✓ ' : ''}{participant.member_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
