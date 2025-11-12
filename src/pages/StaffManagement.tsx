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
        maxWidth: '1000px',
        margin: '0 auto',
        padding: isMobile ? '20px 16px' : '40px 20px'
      }}>
        {/* 標題與操作按鈕 */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: '16px',
          marginBottom: '30px'
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: isMobile ? '24px' : '32px',
            color: '#333',
            fontWeight: 'bold'
          }}>
            👨‍🏫 教練管理
          </h1>
          
          <button
            onClick={() => setAddDialogOpen(true)}
            style={{
              padding: isMobile ? '12px 20px' : '12px 24px',
              background: '#5a5a5a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            <span>➕</span>
            <span>新增教練</span>
          </button>
        </div>

        {/* 統計資訊 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: isMobile ? '16px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>總數</div>
            <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
              {coaches.length}
            </div>
          </div>
          
          <div style={{
            background: 'white',
            padding: isMobile ? '16px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>啟用中</div>
            <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#4caf50' }}>
              {coaches.filter(c => c.status === 'active').length}
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: isMobile ? '16px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>已停用</div>
            <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#ff9800' }}>
              {coaches.filter(c => c.status === 'inactive').length}
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: isMobile ? '16px 12px' : '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>已歸檔</div>
            <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#999' }}>
              {coaches.filter(c => c.status === 'archived').length}
            </div>
          </div>
        </div>

        {/* 顯示切換 */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              padding: '10px 16px',
              background: showArchived ? '#5a5a5a' : 'white',
              color: showArchived ? 'white' : '#5a5a5a',
              border: '2px solid #5a5a5a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📦</span>
            <span>{showArchived ? '隱藏已歸檔' : '顯示已歸檔'}</span>
          </button>
        </div>

        {/* 教練列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
              borderColor = '#e0e0e0'
            } else if (isActive) {
              statusBg = '#e8f5e9'
              statusColor = '#2e7d32'
              statusText = '啟用中'
              borderColor = '#a5d6a7'
            } else {
              statusBg = '#fff3e0'
              statusColor = '#e65100'
              statusText = '已停用'
              borderColor = '#ffcc80'
            }

            return (
              <div
                key={coach.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: isMobile ? '16px' : '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: `2px solid ${borderColor}`,
                  opacity: isArchived ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {/* 教練名稱 + 狀態 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  gap: '12px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '20px' : '22px',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      {coach.name}
                    </h3>
                    <span style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: statusBg,
                      color: statusColor,
                      alignSelf: 'flex-start'
                    }}>
                      {statusText}
                    </span>
                  </div>
                  
                  {/* 操作按鈕 - 手機版改為垂直排列 */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: '8px',
                    alignItems: isMobile ? 'flex-end' : 'center'
                  }}>
                    {isArchived ? (
                      // 已歸檔：只顯示恢復按鈕
                      <button
                        onClick={() => handleRestoreCoach(coach)}
                        style={{
                          padding: isMobile ? '8px 14px' : '8px 16px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '13px' : '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                            padding: isMobile ? '8px 14px' : '8px 16px',
                            background: isActive ? '#f44336' : '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: isMobile ? '13px' : '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            minWidth: isMobile ? '70px' : 'auto'
                          }}
                        >
                          {isActive ? '停用' : '啟用'}
                        </button>
                        <button
                          onClick={() => handleArchiveCoach(coach)}
                          style={{
                            padding: isMobile ? '8px 14px' : '8px 16px',
                            background: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: isMobile ? '13px' : '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: isMobile ? '70px' : 'auto'
                          }}
                        >
                          <span>🗄️</span>
                          <span>歸檔</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 休假記錄 */}
                {!isArchived && coachTimeOffs.length > 0 && (
                  <div style={{
                    marginBottom: '14px',
                    padding: isMobile ? '12px' : '14px',
                    background: '#fff8e1',
                    borderRadius: '10px',
                    border: '1px solid #ffecb3'
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      marginBottom: '10px', 
                      color: '#f57c00',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>📅</span>
                      <span>休假記錄</span>
                    </div>
                    {coachTimeOffs.map(timeOff => (
                      <div
                        key={timeOff.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          flexDirection: isMobile ? 'column' : 'row',
                          padding: '8px 0',
                          fontSize: '13px',
                          gap: isMobile ? '8px' : '12px',
                          borderBottom: timeOff.id === coachTimeOffs[coachTimeOffs.length - 1].id ? 'none' : '1px solid #ffe082'
                        }}
                      >
                        <span style={{ 
                          flex: 1,
                          color: '#555',
                          lineHeight: '1.4'
                        }}>
                          {timeOff.start_date} ~ {timeOff.end_date}
                          {timeOff.reason && (
                            <span style={{ 
                              marginLeft: '8px',
                              padding: '2px 8px',
                              background: '#fff',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: '#666'
                            }}>
                              {timeOff.reason}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleDeleteTimeOff(timeOff)}
                          style={{
                            padding: '6px 12px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            alignSelf: isMobile ? 'flex-start' : 'center'
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
                      padding: isMobile ? '12px' : '14px',
                      background: '#e3f2fd',
                      color: '#1565c0',
                      border: '2px solid #bbdefb',
                      borderRadius: '10px',
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#bbdefb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#e3f2fd'
                    }}
                  >
                    <span>📅</span>
                    <span>設定休假</span>
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
                placeholder="直接 key 上姓名"
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
