import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'

interface Coach {
  id: string
  name: string
  status: string | null
  notes: string | null
  created_at: string | null
  user_email?: string | null
}

interface TimeOff {
  id: number
  coach_id: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
}

export function StaffManagement() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false) // 是否顯示已歸檔
  const [activeTab, setActiveTab] = useState<'coaches' | 'accounts'>('coaches') // Tab 切換
  
  // 新增教練
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCoachName, setNewCoachName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  
  // 設定不在期間
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [timeOffStartDate, setTimeOffStartDate] = useState('')
  const [timeOffEndDate, setTimeOffEndDate] = useState('')
  const [timeOffReason, setTimeOffReason] = useState('')
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  
  // 設定教練帳號
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountCoach, setSelectedAccountCoach] = useState<Coach | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)

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
      toast.error('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCoach = async () => {
    if (!newCoachName.trim()) {
      toast.warning('請輸入教練名稱')
      return
    }

    setAddLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .insert([{
          name: newCoachName.trim(),
          status: 'active',
          created_at: getLocalTimestamp()
        }])

      if (error) throw error

      setNewCoachName('')
      setAddDialogOpen(false)
      toast.success('教練新增成功')
      loadData()
    } catch (error) {
      toast.error('新增教練失敗：' + (error as Error).message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleToggleStatus = async (coach: Coach) => {
    const newStatus = coach.status === 'active' ? 'inactive' : 'active'

    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: newStatus })
        .eq('id', coach.id)

      if (error) throw error

      toast.success('狀態更新成功')
      loadData()
    } catch (error) {
      toast.error('更新狀態失敗：' + (error as Error).message)
    }
  }

  const handleArchiveCoach = async (coach: Coach) => {
    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: 'archived' })
        .eq('id', coach.id)

      if (error) throw error

      toast.success('教練已隱藏')
      loadData()
    } catch (error) {
      toast.error('隱藏教練失敗：' + (error as Error).message)
    }
  }

  const handleRestoreCoach = async (coach: Coach) => {
    try {
      const { error } = await supabase
        .from('coaches')
        .update({ status: 'active' })
        .eq('id', coach.id)

      if (error) throw error

      toast.success('教練已恢復')
      loadData()
    } catch (error) {
      toast.error('恢復教練失敗：' + (error as Error).message)
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
          created_at: getLocalTimestamp()  // coach_time_off 表使用 TEXT
        }])

      if (error) throw error

      setTimeOffDialogOpen(false)
      setSelectedCoach(null)
      setTimeOffStartDate('')
      setTimeOffEndDate('')
      setTimeOffReason('')
      toast.success('休假設定成功')
      loadData()
    } catch (error) {
      toast.error('設定休假失敗：' + (error as Error).message)
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

      toast.success('休假記錄已刪除')
      loadData()
    } catch (error) {
      toast.error('刪除休假記錄失敗：' + (error as Error).message)
    }
  }

  const openTimeOffDialog = (coach: Coach) => {
    setSelectedCoach(coach)
    const dateStr = getLocalDateString()
    setTimeOffStartDate(dateStr)
    setTimeOffEndDate(dateStr)
    setTimeOffReason('')
    setTimeOffDialogOpen(true)
  }

  const openAccountDialog = (coach: Coach) => {
    setSelectedAccountCoach(coach)
    // 清理可能存在的空白字符
    setAccountEmail((coach.user_email || '').trim())
    setAccountDialogOpen(true)
  }

  const handleSetAccount = async (emailOverride?: string) => {
    if (!selectedAccountCoach) return
    
    // 使用參數覆蓋值（用於清除時），否則使用狀態值
    const email = emailOverride !== undefined ? emailOverride : (accountEmail || '').trim()
    
    // 驗證 email 格式
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('請輸入有效的 email 格式')
      return
    }

    setAccountLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          user_email: email || null,
          updated_at: getLocalTimestamp()
        })
        .eq('id', selectedAccountCoach.id)

      if (error) throw error

      toast.success(email ? `已設定 ${selectedAccountCoach.name} 的帳號` : `已清除 ${selectedAccountCoach.name} 的帳號`)
      setAccountDialogOpen(false)
      setSelectedAccountCoach(null)
      setAccountEmail('')
      loadData()
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('此帳號已被其他教練使用')
      } else {
        toast.error('設定帳號失敗：' + error.message)
      }
    } finally {
      setAccountLoading(false)
    }
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
      <PageHeader user={user} title="人員管理" />

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
            🎓 人員管理
          </h1>
          
          {activeTab === 'coaches' && (
            <Button
              variant="outline"
              size="medium"
              onClick={() => setAddDialogOpen(true)}
              icon={<span>➕</span>}
            >
              新增教練
            </Button>
          )}
        </div>

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <button
            onClick={() => setActiveTab('coaches')}
            style={{
              padding: isMobile ? '12px 20px' : '14px 28px',
              background: activeTab === 'coaches' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'coaches' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'coaches' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'coaches' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            👥 教練管理
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            style={{
              padding: isMobile ? '12px 20px' : '14px 28px',
              background: activeTab === 'accounts' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'accounts' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'accounts' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'accounts' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            🔐 帳號配對
          </button>
        </div>

        {/* 說明提示 */}
        <div style={{
          background: '#fff9e6',
          padding: isMobile ? '12px 16px' : '14px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#856404',
          border: '1px solid #ffeaa7',
          lineHeight: '1.6'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ flexShrink: 0 }}>💡</span>
            {isMobile ? (
              <div>
                <div style={{ marginBottom: '4px' }}>
                  <strong>切換開關</strong>：啟用 = 可選擇該教練、停用 = 立即不可選
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  <strong>休假</strong>：特定日期選不到該教練（例如：出國或者雪季）
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  <strong>隱藏</strong>：不再顯示該教練但仍保存於資料庫，可隨時恢復（例如：外師或其他俱樂部教練）
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>切換開關</strong>：啟用 = 可選擇該教練、停用 = 立即不可選擇
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>
                  <strong>休假</strong>：特定日期選不到該教練（例如：出國或者雪季）
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  <strong>隱藏</strong>：不再顯示該教練但仍保存於資料庫，可隨時恢復（例如：外師或其他俱樂部教練）
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 統計資訊 - 手機版隱藏 */}
        {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
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
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>已隱藏</div>
            <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#999' }}>
              {coaches.filter(c => c.status === 'archived').length}
            </div>
          </div>
        </div>
        )}

        {/* 教練管理 Tab */}
        {activeTab === 'coaches' && (
          <>
            {/* 顯示切換 */}
            <div style={{
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '10px 16px',
                background: '#f5f5f5',
                borderRadius: '8px',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={() => setShowArchived(!showArchived)}
                  style={{
                    width: '40px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: '#5a5a5a'
                  }}
                />
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  顯示已隱藏的教練
                </span>
              </label>
            </div>

            {/* 教練列表 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
          gap: '15px' 
        }}>
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
                    flex: 1
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '20px' : '22px',
                      fontWeight: 'bold',
                      color: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {coach.name}
                      <Badge
                        variant={isArchived ? 'default' : (isActive ? 'success' : 'warning')}
                        size="small"
                        style={{ background: statusBg, color: statusColor }}
                      >
                        {statusText}
                      </Badge>
                    </h3>
                  </div>
                  
                  {/* 操作按鈕 */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    {isArchived ? (
                      // 已隱藏：只顯示恢復按鈕
                      <button
                        onClick={() => handleRestoreCoach(coach)}
                        style={{
                          padding: '8px 16px',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          minWidth: '80px'
                        }}
                      >
                        恢復顯示
                      </button>
                    ) : (
                      // 未隱藏：顯示啟用/停用按鈕 + 隱藏按鈕
                      <>
                        {/* 啟用/停用按鈕組 */}
                        <div style={{
                          display: 'flex',
                          background: '#f5f5f5',
                          borderRadius: '8px',
                          padding: '4px',
                          gap: '4px'
                        }}>
                          <button
                            onClick={() => !isActive && handleToggleStatus(coach)}
                            style={{
                              padding: '6px 14px',
                              background: isActive ? 'white' : 'transparent',
                              color: isActive ? '#4caf50' : '#999',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: isActive ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            啟用
                          </button>
                          <button
                            onClick={() => isActive && handleToggleStatus(coach)}
                            style={{
                              padding: '6px 14px',
                              background: !isActive ? 'white' : 'transparent',
                              color: !isActive ? '#ff9800' : '#999',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: !isActive ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              boxShadow: !isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            停用
                          </button>
                        </div>
                        <button
                          onClick={() => handleArchiveCoach(coach)}
                          style={{
                            padding: '8px 16px',
                            background: '#f5f5f5',
                            color: '#999',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            minWidth: '80px'
                          }}
                        >
                          隱藏
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 不在期間記錄 */}
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
                      color: '#f57c00'
                    }}>
                      不在期間
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
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#bbdefb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#e3f2fd'
                    }}
                  >
                    設定休假
                  </button>
                )}
              </div>
            )
          })}
        </div>
          </>
        )}

        {/* 帳號配對 Tab */}
        {activeTab === 'accounts' && (
          <>
            {/* 說明提示 */}
            <div style={{
              background: '#e3f2fd',
              padding: isMobile ? '12px 16px' : '14px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#1565c0',
              border: '1px solid #90caf9',
              lineHeight: '1.6'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ flexShrink: 0 }}>🔐</span>
                <div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>帳號配對</strong>：設定教練對應的登入帳號
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>
                    配對後，教練可以在「預約表」旁的「我的回報」頁面看到自己需要回報的預約
                  </div>
                </div>
              </div>
            </div>

            {/* 帳號配對列表 */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
              gap: '15px' 
            }}>
              {coaches.filter(c => c.status !== 'archived').map(coach => (
                <div
                  key={coach.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: isMobile ? '16px' : '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: coach.user_email ? '2px solid #4CAF50' : '2px solid #e0e0e0'
                  }}
                >
                  {/* 教練名稱 */}
                  <div style={{
                    fontSize: isMobile ? '18px' : '20px',
                    fontWeight: 'bold',
                    marginBottom: '12px',
                    color: '#333'
                  }}>
                    {coach.name}
                  </div>

                  {/* 帳號狀態 */}
                  {coach.user_email ? (
                    <div style={{
                      background: '#e8f5e9',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        已配對帳號
                      </div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#2e7d32',
                        wordBreak: 'break-all'
                      }}>
                        {coach.user_email}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#fff3e0',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      fontSize: '14px',
                      color: '#e65100'
                    }}>
                      ⚠️ 尚未配對帳號
                    </div>
                  )}

                  {/* 設定按鈕 */}
                  <button
                    onClick={() => openAccountDialog(coach)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '14px',
                      background: coach.user_email ? '#e3f2fd' : '#2196F3',
                      color: coach.user_email ? '#1565c0' : 'white',
                      border: coach.user_email ? '2px solid #90caf9' : 'none',
                      borderRadius: '10px',
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {coach.user_email ? '修改帳號' : '設定帳號'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
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
                  // 檢查是否正在使用輸入法（避免中文輸入時 Enter 確認選字被誤觸發）
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddCoach()
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false)
                  setNewCoachName('')
                }}
                disabled={addLoading}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleAddCoach}
                disabled={addLoading}
                style={{ flex: 1, background: addLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {addLoading ? '新增中...' : '確定'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 設定不在期間彈窗 */}
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
                原因 / 事項
              </label>
              <input
                type="text"
                value={timeOffReason}
                onChange={(e) => setTimeOffReason(e.target.value)}
                placeholder="例如：去美國、休假..."
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setTimeOffDialogOpen(false)
                  setSelectedCoach(null)
                }}
                disabled={timeOffLoading}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleAddTimeOff}
                disabled={timeOffLoading}
                style={{ flex: 1, background: timeOffLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {timeOffLoading ? '設定中...' : '確定'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 設定帳號彈窗 */}
      {accountDialogOpen && selectedAccountCoach && (
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
            maxWidth: '450px',
            width: '100%'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 'bold' }}>
              設定帳號：{selectedAccountCoach.name}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                登入帳號 Email
              </label>
              <input
                type="text"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="例如：coach@example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#666',
                lineHeight: '1.4'
              }}>
                💡 設定後，該教練可以使用此帳號登入並查看自己的回報
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setAccountDialogOpen(false)
                  setSelectedAccountCoach(null)
                  setAccountEmail('')
                }}
                disabled={accountLoading}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSetAccount()}
                disabled={accountLoading}
                style={{ flex: 1, background: accountLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                {accountLoading ? '設定中...' : '確定'}
              </Button>
            </div>

            {/* 清除帳號按鈕 */}
            {selectedAccountCoach.user_email && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <button
                  onClick={() => {
                    if (confirm(`確定要清除 ${selectedAccountCoach.name} 的帳號配對嗎？`)) {
                      handleSetAccount('')  // 直接傳入空字串
                    }
                  }}
                  disabled={accountLoading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#ffebee',
                    color: '#c62828',
                    border: '1px solid #ef9a9a',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: accountLoading ? 'not-allowed' : 'pointer',
                    opacity: accountLoading ? 0.5 : 1
                  }}
                >
                  清除帳號配對
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
