import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface StaffManagementProps {
  user: User
}

interface Coach {
  id: string
  name: string
  status: string
  notes: string | null
  created_at: string
}

interface TimeOff {
  id: number
  coach_id: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
}

export function StaffManagement({ user }: StaffManagementProps) {
  const { isMobile } = useResponsive()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false) // 是否顯示已歸檔
  
  // 新增教練
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCoachName, setNewCoachName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  
  // 設定休假
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [timeOffStartDate, setTimeOffStartDate] = useState('')
  const [timeOffEndDate, setTimeOffEndDate] = useState('')
  const [timeOffReason, setTimeOffReason] = useState('休假')
  const [timeOffLoading, setTimeOffLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [coachesResult, timeOffsResult] = await Promise.all([
        supabase
          .from('coaches')
          .select('*')
          .order('name'),
        supabase
          .from('coach_time_off')
          .select('*')
          .order('start_date', { ascending: false })
      ])

      if (coachesResult.error) throw coachesResult.error
      if (timeOffsResult.error) throw timeOffsResult.error

      setCoaches(coachesResult.data || [])
      setTimeOffs(timeOffsResult.data || [])
    } catch (error) {
      console.error('載入資料失敗:', error)
      alert('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCoach = async () => {
    if (!newCoachName.trim()) {
      alert('請輸入教練名稱')
      return
    }

    setAddLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .insert([{
          name: newCoachName.trim(),
          status: 'active',
          created_at: new Date().toISOString()
        }])

      if (error) throw error

      alert('✅ 新增成功')
      setNewCoachName('')
      setAddDialogOpen(false)
      loadData()
    } catch (error: any) {
      console.error('新增失敗:', error)
      alert('新增失敗: ' + error.message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleToggleStatus = async (coach: Coach) => {
    const newStatus = coach.status === 'active' ? 'inactive' : 'active'
    const action = newStatus === 'active' ? '啟用' : '停用'

    if (!confirm(`確定要${action} ${coach.name} 嗎？`)) return

    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: newStatus })
        .eq('id', coach.id)

      if (error) throw error

      alert(`✅ ${coach.name} 已${action}`)
      loadData()
    } catch (error: any) {
      console.error('更新失敗:', error)
      alert('更新失敗: ' + error.message)
    }
  }

  const handleArchiveCoach = async (coach: Coach) => {
    if (!confirm(`確定要歸檔 ${coach.name} 嗎？\n\n歸檔後將完全隱藏，但可以隨時恢復。`)) return

    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: 'archived' })
        .eq('id', coach.id)

      if (error) throw error

      alert(`✅ ${coach.name} 已歸檔`)
      loadData()
    } catch (error: any) {
      console.error('歸檔失敗:', error)
      alert('歸檔失敗: ' + error.message)
    }
  }

  const handleRestoreCoach = async (coach: Coach) => {
    if (!confirm(`確定要恢復 ${coach.name} 嗎？`)) return

    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: 'active' })
        .eq('id', coach.id)

      if (error) throw error

      alert(`✅ ${coach.name} 已恢復`)
      loadData()
    } catch (error: any) {
      console.error('恢復失敗:', error)
      alert('恢復失敗: ' + error.message)
    }
  }

  const handleAddTimeOff = async () => {
    if (!selectedCoach) return
    if (!timeOffStartDate || !timeOffEndDate) {
      alert('請選擇日期')
      return
    }

    if (timeOffEndDate < timeOffStartDate) {
      alert('結束日期不能早於開始日期')
      return
    }

    setTimeOffLoading(true)
    try {
      const { error } = await supabase
        .from('coach_time_off')
        .insert([{
          coach_id: selectedCoach.id,
          start_date: timeOffStartDate,
          end_date: timeOffEndDate,
          reason: timeOffReason,
          created_at: new Date().toISOString()
        }])

      if (error) throw error

      alert('✅ 設定成功')
      setTimeOffDialogOpen(false)
      setSelectedCoach(null)
      setTimeOffStartDate('')
      setTimeOffEndDate('')
      setTimeOffReason('休假')
      loadData()
    } catch (error: any) {
      console.error('設定失敗:', error)
      alert('設定失敗: ' + error.message)
    } finally {
      setTimeOffLoading(false)
    }
  }

  const handleDeleteTimeOff = async (timeOff: TimeOff) => {
    if (!confirm('確定要刪除這個休假記錄嗎？')) return

    try {
      const { error } = await supabase
        .from('coach_time_off')
        .delete()
        .eq('id', timeOff.id)

      if (error) throw error

      alert('✅ 已刪除')
      loadData()
    } catch (error: any) {
      console.error('刪除失敗:', error)
      alert('刪除失敗: ' + error.message)
    }
  }

  const openTimeOffDialog = (coach: Coach) => {
    setSelectedCoach(coach)
    const today = new Date()
    const dateStr = today.toISOString().substring(0, 10)
    setTimeOffStartDate(dateStr)
    setTimeOffEndDate(dateStr)
    setTimeOffReason('休假')
    setTimeOffDialogOpen(true)
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <PageHeader user={user} title="教練管理" />

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: isMobile ? '20px 16px' : '40px 20px'
      }}>
        {/* 標題 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '32px' }}>
            👨‍🏫 教練管理
          </h1>
          <button
            onClick={() => setAddDialogOpen(true)}
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
          >
            ➕ 新增教練
          </button>
        </div>

        {/* 顯示切換 */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              padding: '8px 16px',
              background: showArchived ? '#666' : 'white',
              color: showArchived ? 'white' : '#666',
              border: '2px solid #666',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            📦 {showArchived ? '隱藏已歸檔' : '顯示已歸檔'}
          </button>
          <div style={{
            padding: '8px 16px',
            background: '#f5f5f5',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#666'
          }}>
            共 {coaches.filter(c => showArchived || c.status !== 'archived').length} 位教練
          </div>
        </div>

        {/* 教練列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {coaches.filter(coach => showArchived || coach.status !== 'archived').map(coach => {
            const coachTimeOffs = timeOffs.filter(t => t.coach_id === coach.id)
            const isActive = coach.status === 'active'
            const isArchived = coach.status === 'archived'
            
            // 狀態顯示
            let statusBg, statusColor, statusText, borderColor
            if (isArchived) {
              statusBg = '#f5f5f5'
              statusColor = '#999'
              statusText = '已歸檔'
              borderColor = '#ddd'
            } else if (isActive) {
              statusBg = '#e8f5e9'
              statusColor = '#2e7d32'
              statusText = '啟用中'
              borderColor = '#4caf50'
            } else {
              statusBg = '#fff3e0'
              statusColor = '#e65100'
              statusText = '已停用'
              borderColor = '#ff9800'
            }

            return (
              <div
                key={coach.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: isMobile ? '16px' : '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: `2px solid ${borderColor}`,
                  opacity: isArchived ? 0.7 : 1
                }}
              >
                {/* 教練名稱 + 狀態 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px' }}>
                      {coach.name}
                    </h3>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: statusBg,
                      color: statusColor
                    }}>
                      {statusText}
                    </span>
                  </div>
                  
                  {/* 操作按鈕 */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isArchived ? (
                      // 已歸檔：只顯示恢復按鈕
                      <button
                        onClick={() => handleRestoreCoach(coach)}
                        style={{
                          padding: '8px 16px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        恢復啟用
                      </button>
                    ) : (
                      // 未歸檔：顯示啟用/停用 + 歸檔按鈕
                      <>
                        <button
                          onClick={() => handleToggleStatus(coach)}
                          style={{
                            padding: '8px 16px',
                            background: isActive ? '#f44336' : '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {isActive ? '停用' : '啟用'}
                        </button>
                        <button
                          onClick={() => handleArchiveCoach(coach)}
                          style={{
                            padding: '8px 16px',
                            background: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🗄️ 歸檔
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 休假記錄 */}
                {!isArchived && coachTimeOffs.length > 0 && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '12px',
                    background: '#fff3e0',
                    borderRadius: '8px',
                    border: '1px solid #ffe0b2'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#e65100' }}>
                      📅 休假記錄：
                    </div>
                    {coachTimeOffs.map(timeOff => (
                      <div
                        key={timeOff.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          fontSize: '13px'
                        }}
                      >
                        <span>
                          {timeOff.start_date} ~ {timeOff.end_date}
                          {timeOff.reason && ` (${timeOff.reason})`}
                        </span>
                        <button
                          onClick={() => handleDeleteTimeOff(timeOff)}
                          style={{
                            padding: '4px 8px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 設定休假按鈕 - 只對未歸檔教練顯示 */}
                {!isArchived && (
                  <button
                    onClick={() => openTimeOffDialog(coach)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      border: '1px solid #90caf9',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    📅 設定休假
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 新增教練彈窗 */}
      {addDialogOpen && (
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
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '20px' : '30px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>新增教練</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                教練名稱
              </label>
              <input
                type="text"
                value={newCoachName}
                onChange={(e) => setNewCoachName(e.target.value)}
                placeholder="例如：火隆、可恩、其他"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddCoach()
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setAddDialogOpen(false)
                  setNewCoachName('')
                }}
                disabled={addLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: addLoading ? 'not-allowed' : 'pointer',
                  fontSize: '15px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddCoach}
                disabled={addLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: addLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: addLoading ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold'
                }}
              >
                {addLoading ? '新增中...' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 設定休假彈窗 */}
      {timeOffDialogOpen && selectedCoach && (
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
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '20px' : '30px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>
              設定 {selectedCoach.name} 的休假
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                開始日期
              </label>
              <input
                type="date"
                value={timeOffStartDate}
                onChange={(e) => {
                  setTimeOffStartDate(e.target.value)
                  // 如果結束日期早於開始日期，自動調整
                  if (timeOffEndDate < e.target.value) {
                    setTimeOffEndDate(e.target.value)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                結束日期
              </label>
              <input
                type="date"
                value={timeOffEndDate}
                onChange={(e) => setTimeOffEndDate(e.target.value)}
                min={timeOffStartDate}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                原因
              </label>
              <select
                value={timeOffReason}
                onChange={(e) => setTimeOffReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="休假">休假</option>
                <option value="請假">請假</option>
                <option value="出差">出差</option>
                <option value="其他">其他</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setTimeOffDialogOpen(false)
                  setSelectedCoach(null)
                }}
                disabled={timeOffLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: timeOffLoading ? 'not-allowed' : 'pointer',
                  fontSize: '15px'
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddTimeOff}
                disabled={timeOffLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: timeOffLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: timeOffLoading ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold'
                }}
              >
                {timeOffLoading ? '設定中...' : '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
