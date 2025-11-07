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
  status: string
  created_at: string
  updated_at: string
}

interface StaffManagementProps {
  user: User
}

type StaffType = 'coach' | 'driver'

export function StaffManagement({ user }: StaffManagementProps) {
  const { isMobile } = useResponsive()
  const [activeTab, setActiveTab] = useState<StaffType>('coach')
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [drivers, setDrivers] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    setLoading(true)
    try {
      // 載入教練
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .order('name', { ascending: true })

      if (coachError) throw coachError
      setCoaches(coachData || [])

      // 載入駕駛
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .order('name', { ascending: true })

      if (driverError) throw driverError
      setDrivers(driverData || [])
    } catch (error) {
      console.error('載入人員資料失敗:', error)
      alert('載入人員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const toggleStaffStatus = async (staff: Staff, type: StaffType, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const newStatus = staff.status === 'active' ? 'inactive' : 'active'
    const statusText = newStatus === 'active' ? '上架' : '下架'
    const tableName = type === 'coach' ? 'coaches' : 'drivers'
    
    if (!confirm(`確定要${statusText}「${staff.name}」嗎？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ status: newStatus })
        .eq('id', staff.id)

      if (error) throw error

      alert(`已${statusText}成功！`)
      loadStaff()
    } catch (error) {
      console.error('更新人員狀態失敗:', error)
      alert('更新人員狀態失敗')
    }
  }

  const currentStaff = activeTab === 'coach' ? coaches : drivers
  const filteredStaff = currentStaff.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getIcon = () => activeTab === 'coach' ? '🎓' : '🚤'
  const getTitle = () => activeTab === 'coach' ? '教練' : '駕駛'

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666'
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
          👥 人員管理
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
            + 新增{getTitle()}
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

      {/* Tab 切換 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: isMobile ? '15px' : '20px',
        borderBottom: '2px solid #e0e0e0',
        background: 'white',
        padding: '10px 15px 0 15px',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setActiveTab('coach')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'coach' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: activeTab === 'coach' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px 6px 0 0',
            fontSize: isMobile ? '15px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          🎓 教練 ({coaches.length})
        </button>
        <button
          onClick={() => setActiveTab('driver')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'driver' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
            color: activeTab === 'driver' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px 6px 0 0',
            fontSize: isMobile ? '15px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          🚤 駕駛 ({drivers.length})
        </button>
      </div>

      {/* 搜尋欄 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder={`搜尋${getTitle()}（姓名）`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '10px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '14px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
        />
      </div>

      {/* 統計資訊 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>總{getTitle()}數</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            {filteredStaff.length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>上架中</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
            {filteredStaff.filter(s => s.status === 'active').length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>已下架</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#999' }}>
            {filteredStaff.filter(s => s.status === 'inactive').length}
          </div>
        </div>
      </div>

      {/* 人員列表 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
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
            {searchTerm ? `找不到符合條件的${getTitle()}` : `尚無${getTitle()}資料`}
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
                cursor: 'pointer',
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
              {/* 姓名和狀態 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>{getIcon()}</span>
                  {staff.name}
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: staff.status === 'active' 
                    ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
                    : '#e0e0e0',
                  color: staff.status === 'active' ? 'white' : '#666'
                }}>
                  {staff.status === 'active' ? '✓ 上架' : '下架'}
                </span>
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
                display: 'flex',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #f0f0f0'
              }}>
                <button
                  onClick={(e) => toggleStaffStatus(staff, activeTab, e)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: staff.status === 'active'
                      ? '#f44336'
                      : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
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
                  {staff.status === 'active' ? '下架' : '上架'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedStaff(staff)
                    setEditDialogOpen(true)
                  }}
                  style={{
                    flex: 1,
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增人員對話框 */}
      {addDialogOpen && (
        <AddStaffDialog
          open={addDialogOpen}
          type={activeTab}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={() => {
            loadStaff()
            setAddDialogOpen(false)
          }}
        />
      )}

      {/* 編輯人員對話框 */}
      {editDialogOpen && selectedStaff && (
        <EditStaffDialog
          open={editDialogOpen}
          staff={selectedStaff}
          type={activeTab}
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
    </div>
  )
}

// 新增人員對話框組件
interface AddStaffDialogProps {
  open: boolean
  type: StaffType
  onClose: () => void
  onSuccess: () => void
}

function AddStaffDialog({ open, type, onClose, onSuccess }: AddStaffDialogProps) {
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
      const tableName = type === 'coach' ? 'coaches' : 'drivers'
      const { error } = await supabase
        .from(tableName)
        .insert([{
          name: formData.name.trim(),
          notes: formData.notes.trim() || null,
          status: 'active'
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

  const title = type === 'coach' ? '教練' : '駕駛'

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
            新增{title}
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

// 編輯人員對話框組件
interface EditStaffDialogProps {
  open: boolean
  staff: Staff
  type: StaffType
  onClose: () => void
  onSuccess: () => void
}

function EditStaffDialog({ open, staff, type, onClose, onSuccess }: EditStaffDialogProps) {
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
      const tableName = type === 'coach' ? 'coaches' : 'drivers'
      const { error } = await supabase
        .from(tableName)
        .update({
          name: formData.name.trim(),
          notes: formData.notes.trim() || null,
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

  const title = type === 'coach' ? '教練' : '駕駛'

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
            編輯{title}
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

