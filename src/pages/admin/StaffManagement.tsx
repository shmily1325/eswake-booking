import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'
import { clearPermissionCache } from '../../utils/auth'

interface Coach {
  id: string
  name: string
  status: string | null
  notes: string | null
  created_at: string | null
  user_email?: string | null
  designated_lesson_price_30min?: number | null
}

interface TimeOff {
  id: number
  coach_id: string
  start_date: string
  end_date: string
  reason: string | null
  notes: string | null
}

interface EditorUser {
  id: string
  email: string
  created_at: string | null
  created_by: string | null
  notes: string | null
}

export function StaffManagement() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([])
  const [editorUsers, setEditorUsers] = useState<EditorUser[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'archived'>('active') // 狀態篩選
  const [activeTab, setActiveTab] = useState<'coaches' | 'accounts' | 'pricing' | 'features'>('coaches') // Tab 切換
  const [expandedCoachIds, setExpandedCoachIds] = useState<Set<string>>(new Set()) // 展開的教練ID
  
  // 月份篩選
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  
  // 新增教練
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCoachName, setNewCoachName] = useState('')
  const [newCoachEmail, setNewCoachEmail] = useState('')
  const [newCoachPrice, setNewCoachPrice] = useState('')
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
  
  // 設定指定課價格
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false)
  const [selectedPricingCoach, setSelectedPricingCoach] = useState<Coach | null>(null)
  const [lessonPrice, setLessonPrice] = useState<string>('')
  const [pricingLoading, setPricingLoading] = useState(false)
  
  // 功能權限（小編）
  const [newEditorEmail, setNewEditorEmail] = useState('')
  const [addingEditor, setAddingEditor] = useState(false)
  
  // 說明展開狀態
  const [showHelp, setShowHelp] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  // 格式化日期為 MM/DD
  const formatShortDate = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-')
    return `${parseInt(month)}/${parseInt(day)}`
  }

  // 合併連續的休假日期
  const mergeConsecutiveTimeOffs = (timeOffs: TimeOff[]): (TimeOff & { displayText: string })[] => {
    if (timeOffs.length === 0) return []

    // 按日期排序
    const sorted = [...timeOffs].sort((a, b) => a.start_date.localeCompare(b.start_date))
    
    const merged: (TimeOff & { displayText: string })[] = []
    let currentGroup: TimeOff[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const previous = currentGroup[currentGroup.length - 1]

      // 檢查是否為連續日期（且原因相同）
      const prevEndDate = new Date(previous.end_date)
      const currStartDate = new Date(current.start_date)
      const dayDiff = (currStartDate.getTime() - prevEndDate.getTime()) / (1000 * 60 * 60 * 24)
      
      const isSameReason = (previous.reason || '') === (current.reason || '')
      const isConsecutive = dayDiff <= 1 && isSameReason

      if (isConsecutive) {
        currentGroup.push(current)
      } else {
        // 合併當前組
        merged.push(createMergedTimeOff(currentGroup))
        currentGroup = [current]
      }
    }

    // 合併最後一組
    if (currentGroup.length > 0) {
      merged.push(createMergedTimeOff(currentGroup))
    }

    return merged
  }

  const createMergedTimeOff = (group: TimeOff[]): TimeOff & { displayText: string } => {
    const first = group[0]
    const last = group[group.length - 1]
    
    const startStr = formatShortDate(first.start_date)
    const endStr = formatShortDate(last.end_date)
    
    let displayText = startStr === endStr ? startStr : `${startStr} - ${endStr}`
    
    return {
      ...first, // 保留第一個的 ID 等資訊
      end_date: last.end_date, // 使用最後一個的結束日期
      displayText,
      // 將組內所有 ID 保存起來（用於刪除時參考）
      notes: group.map(t => t.id).join(',') // 臨時存儲所有相關 ID
    }
  }

  // 切換展開/收起
  const toggleExpandCoach = (coachId: string) => {
    setExpandedCoachIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(coachId)) {
        newSet.delete(coachId)
      } else {
        newSet.add(coachId)
      }
      return newSet
    })
  }

  // 過濾該月份的休假記錄
  const filterTimeOffsByMonth = (timeOffs: TimeOff[], month: string): TimeOff[] => {
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    return timeOffs.filter(timeOff => {
      // 如果休假的開始或結束日期在該月份內，就顯示
      return (timeOff.start_date <= endDate && timeOff.end_date >= startDate)
    })
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [coachesResult, timeOffsResult, editorsResult] = await Promise.all([
        supabase
          .from('coaches')
          .select('*')
          .order('name'),
        supabase
          .from('coach_time_off')
          .select('*')
          .order('start_date', { ascending: false }),
        (supabase as any)
          .from('editor_users')
          .select('*')
          .order('email')
      ])

      if (coachesResult.error) throw coachesResult.error
      if (timeOffsResult.error) throw timeOffsResult.error
      // editor_users 表可能不存在，忽略錯誤

      setCoaches(coachesResult.data || [])
      setTimeOffs(timeOffsResult.data || [])
      setEditorUsers(editorsResult.data as any || [])
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

    // 驗證 email 格式（如果有填寫）
    const email = newCoachEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.warning('請輸入有效的 Email 格式')
      return
    }

    // 驗證價格（如果有填寫）
    const price = newCoachPrice.trim()
    if (price && (isNaN(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(price)))) {
      toast.warning('請輸入有效的價格（正整數）')
      return
    }

    setAddLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .insert([{
          name: newCoachName.trim(),
          status: 'active',
          user_email: email || null,
          designated_lesson_price_30min: price ? parseInt(price) : null,
          created_at: getLocalTimestamp()
        }])

      if (error) {
        if (error.code === '23505') {
          throw new Error('此帳號已被其他教練使用')
        }
        throw error
      }

      setNewCoachName('')
      setNewCoachEmail('')
      setNewCoachPrice('')
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

  const handleDeleteCoach = async (coach: Coach) => {
    // 先檢查是否有關聯的預約
    const { data: bookingCoaches } = await supabase
      .from('booking_coaches')
      .select('id')
      .eq('coach_id', coach.id)
      .limit(1)

    const { data: bookingDrivers } = await supabase
      .from('booking_drivers')
      .select('id')
      .eq('driver_id', coach.id)
      .limit(1)

    const hasBookings = (bookingCoaches && bookingCoaches.length > 0) || (bookingDrivers && bookingDrivers.length > 0)

    if (hasBookings) {
      toast.error(`${coach.name} 有歷史預約記錄，無法刪除。建議使用「隱藏」功能。`)
      return
    }

    if (!confirm(`確定要永久刪除「${coach.name}」嗎？\n\n此操作無法復原！`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('coaches')
        .delete()
        .eq('id', coach.id)

      if (error) throw error

      toast.success(`${coach.name} 已刪除`)
      loadData()
    } catch (error) {
      toast.error('刪除教練失敗：' + (error as Error).message)
    }
  }

  const handleAddTimeOff = async () => {
    if (!selectedCoach) return
    if (!timeOffStartDate || !timeOffEndDate) {
      toast.warning('請選擇日期')
      return
    }

    if (timeOffEndDate < timeOffStartDate) {
      toast.warning('結束日期不能早於開始日期')
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

  const openPricingDialog = (coach: Coach) => {
    setSelectedPricingCoach(coach)
    setLessonPrice(coach.designated_lesson_price_30min?.toString() || '')
    setPricingDialogOpen(true)
  }

  const handleSetPrice = async () => {
    if (!selectedPricingCoach) return
    
    // 驗證價格格式（必須是正整數或空值）
    const priceValue = lessonPrice.trim()
    if (priceValue && (isNaN(Number(priceValue)) || Number(priceValue) < 0 || !Number.isInteger(Number(priceValue)))) {
      toast.error('請輸入有效的價格（正整數）')
      return
    }

    setPricingLoading(true)
    try {
      const { error } = await supabase
        .from('coaches')
        .update({
          designated_lesson_price_30min: priceValue ? parseInt(priceValue) : null,
          updated_at: getLocalTimestamp()
        })
        .eq('id', selectedPricingCoach.id)

      if (error) throw error

      toast.success(priceValue ? `已設定 ${selectedPricingCoach.name} 的指定課價格` : `已清除 ${selectedPricingCoach.name} 的指定課價格`)
      setPricingDialogOpen(false)
      setSelectedPricingCoach(null)
      setLessonPrice('')
      loadData()
    } catch (error: any) {
      toast.error('設定價格失敗：' + error.message)
    } finally {
      setPricingLoading(false)
    }
  }

  // 新增功能權限帳號
  const handleAddEditor = async () => {
    if (!newEditorEmail.trim()) {
      toast.warning('請輸入 Email')
      return
    }

    if (!newEditorEmail.includes('@')) {
      toast.warning('請輸入有效的 Email')
      return
    }

    setAddingEditor(true)
    try {
      // 加入 editor_users 表
      const { error: editorError } = await (supabase as any)
        .from('editor_users')
        .insert([{
          email: newEditorEmail.trim().toLowerCase(),
          created_by: user.email,
          notes: null
        }])

      if (editorError) {
        if (editorError.code === '23505') {
          throw new Error('此 Email 已有功能權限')
        }
        throw editorError
      }

      // 同時加入白名單（使用 upsert）
      await supabase
        .from('allowed_users')
        .upsert([{
          email: newEditorEmail.trim().toLowerCase(),
          created_by: user.email,
          notes: '功能權限'
        }], {
          onConflict: 'email',
          ignoreDuplicates: true
        })

      toast.success(`已將 ${newEditorEmail} 加入功能權限`)
      setNewEditorEmail('')
      clearPermissionCache() // 清除權限緩存
      loadData()
    } catch (error) {
      toast.error('新增失敗: ' + (error as Error).message)
    } finally {
      setAddingEditor(false)
    }
  }

  // 移除功能權限帳號
  const handleRemoveEditor = async (id: string, email: string) => {
    if (!confirm(`確定要將 ${email} 從功能權限移除嗎？`)) {
      return
    }

    try {
      const { error } = await (supabase as any)
        .from('editor_users')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success(`已將 ${email} 從功能權限移除`)
      clearPermissionCache() // 清除權限緩存
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
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
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: isMobile ? '20px 16px' : '40px 20px'
      }}>
        <PageHeader user={user} title="🎓 人員管理" showBaoLink={true} />

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
              padding: isMobile ? '12px 16px' : '14px 28px',
              background: activeTab === 'coaches' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'coaches' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'coaches' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'coaches' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            教練管理
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            style={{
              padding: isMobile ? '12px 16px' : '14px 28px',
              background: activeTab === 'accounts' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'accounts' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'accounts' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'accounts' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            帳號配對
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            style={{
              padding: isMobile ? '12px 16px' : '14px 28px',
              background: activeTab === 'pricing' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'pricing' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'pricing' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'pricing' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            指定課價格
          </button>
          <button
            onClick={() => setActiveTab('features')}
            style={{
              padding: isMobile ? '12px 16px' : '14px 28px',
              background: activeTab === 'features' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'features' ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === 'features' ? '#2196F3' : '#666',
              fontWeight: activeTab === 'features' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            功能權限
          </button>
        </div>

        {/* 說明提示 - 可展開收起 */}
        {activeTab === 'coaches' && (
          <div style={{
            background: showHelp ? '#fff9e6' : '#f8f9fa',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
            color: showHelp ? '#856404' : '#666',
            border: showHelp ? '1px solid #ffeaa7' : '1px solid #e9ecef',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => setShowHelp(!showHelp)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>💡 {showHelp ? '功能說明' : '點此查看功能說明'}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>{showHelp ? '▲ 收起' : '▼ 展開'}</span>
            </div>
            {showHelp && (
              <div style={{ marginTop: '12px', lineHeight: '1.7' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>啟用／停用</strong>：啟用 = 可選擇、停用 = 暫不上班
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>
                  <strong>休假</strong>：特定日期不在，排班時顯示「今日休假」
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>
                  <strong>隱藏</strong>：長期不在，資料保留可恢復
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  <strong>刪除</strong>：永久刪除（僅限無預約的隱藏教練）
                </div>
              </div>
            )}
          </div>
        )}

        {/* 統計資訊 - 緊湊版 */}
        {activeTab === 'coaches' && !isMobile && (
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#666'
          }}>
            <span>共 <strong style={{ color: '#2196F3' }}>{coaches.length}</strong> 位</span>
            <span>啟用 <strong style={{ color: '#4caf50' }}>{coaches.filter(c => c.status === 'active').length}</strong></span>
            {coaches.filter(c => c.status === 'inactive').length > 0 && (
              <span>停用 <strong style={{ color: '#ff9800' }}>{coaches.filter(c => c.status === 'inactive').length}</strong></span>
            )}
            {coaches.filter(c => c.status === 'archived').length > 0 && (
              <span>隱藏 <strong style={{ color: '#999' }}>{coaches.filter(c => c.status === 'archived').length}</strong></span>
            )}
          </div>
        )}

        {/* 教練管理 Tab */}
        {activeTab === 'coaches' && (
          <>
            {/* 控制列：新增 + 顯示已隱藏 + 月份 */}
            <div style={{
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* 新增按鈕 */}
              <Button
                variant="outline"
                size="medium"
                onClick={() => setAddDialogOpen(true)}
                icon={<span>➕</span>}
              >
                新增教練
              </Button>

              {/* 間隔 */}
              <div style={{ flex: 1 }} />

              {/* 狀態篩選按鈕組 */}
              <div style={{
                display: 'flex',
                background: '#f0f0f0',
                borderRadius: '6px',
                padding: '3px'
              }}>
                <button
                  onClick={() => setStatusFilter('active')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    background: statusFilter === 'active' ? 'white' : 'transparent',
                    color: statusFilter === 'active' ? '#4caf50' : '#666',
                    fontSize: '13px',
                    fontWeight: statusFilter === 'active' ? '600' : '400',
                    cursor: 'pointer',
                    boxShadow: statusFilter === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  啟用中
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    background: statusFilter === 'all' ? 'white' : 'transparent',
                    color: statusFilter === 'all' ? '#2196F3' : '#666',
                    fontSize: '13px',
                    fontWeight: statusFilter === 'all' ? '600' : '400',
                    cursor: 'pointer',
                    boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  全部
                </button>
                <button
                  onClick={() => setStatusFilter('archived')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '4px',
                    background: statusFilter === 'archived' ? 'white' : 'transparent',
                    color: statusFilter === 'archived' ? '#999' : '#666',
                    fontSize: '13px',
                    fontWeight: statusFilter === 'archived' ? '600' : '400',
                    cursor: 'pointer',
                    boxShadow: statusFilter === 'archived' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  已隱藏
                </button>
              </div>

              {/* 月份選擇器 */}
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  background: 'white',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 教練列表 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
          gap: '15px' 
        }}>
          {coaches.filter(coach => {
            if (statusFilter === 'active') return coach.status === 'active' || coach.status === 'inactive'
            if (statusFilter === 'archived') return coach.status === 'archived'
            return true // 'all'
          }).map(coach => {
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
                      // 已隱藏：顯示恢復按鈕 + 刪除按鈕
                      <div style={{ display: 'flex', gap: '8px' }}>
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
                            transition: 'all 0.2s'
                          }}
                        >
                          恢復
                        </button>
                        <button
                          onClick={() => handleDeleteCoach(coach)}
                          style={{
                            padding: '8px 16px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                          }}
                        >
                          刪除
                        </button>
                      </div>
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
                {!isArchived && coachTimeOffs.length > 0 && (() => {
                  // 先按月份篩選
                  const filteredTimeOffs = filterTimeOffsByMonth(coachTimeOffs, selectedMonth)
                  
                  // 如果該月份沒有休假記錄，不顯示區塊
                  if (filteredTimeOffs.length === 0) return null
                  
                  // 合併連續日期
                  const mergedTimeOffs = mergeConsecutiveTimeOffs(filteredTimeOffs)
                  const isExpanded = expandedCoachIds.has(coach.id)
                  const maxDisplay = 3
                  const displayTimeOffs = isExpanded ? mergedTimeOffs : mergedTimeOffs.slice(0, maxDisplay)
                  const hasMore = mergedTimeOffs.length > maxDisplay

                  return (
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
                      {displayTimeOffs.map((timeOff, idx) => (
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
                            borderBottom: idx === displayTimeOffs.length - 1 && !hasMore ? 'none' : '1px solid #ffe082'
                          }}
                        >
                          <span style={{ 
                            flex: 1,
                            color: '#555',
                            lineHeight: '1.4',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontWeight: '600' }}>{timeOff.displayText}</span>
                            {timeOff.reason && (
                              <span style={{ 
                                padding: '3px 10px',
                                background: '#fff',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#f57c00',
                                fontWeight: '600',
                                border: '1px solid #ffe082'
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
                      
                      {/* 展開/收起按鈕 */}
                      {hasMore && (
                        <button
                          onClick={() => toggleExpandCoach(coach.id)}
                          style={{
                            width: '100%',
                            marginTop: '8px',
                            padding: '6px',
                            background: 'transparent',
                            color: '#f57c00',
                            border: '1px solid #ffe082',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isExpanded ? `收起 ▲` : `查看全部 ${mergedTimeOffs.length} 筆 ▼`}
                        </button>
                      )}
                    </div>
                  )
                })()}

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
              {coaches.filter(c => c.status === 'active').map(coach => (
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

        {/* 指定課價格 Tab */}
        {activeTab === 'pricing' && (
          <>
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
                <span style={{ flexShrink: 0 }}>💰</span>
                <div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>指定課價格</strong>：設定每位教練 30 分鐘指定課的價格
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9 }}>
                    設定後，在扣款時如果是該教練的指定課，會自動帶入對應價格（其他時長會按比例自動換算，無條件進位）
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    如果未設定，扣款時會顯示自訂輸入框
                  </div>
                </div>
              </div>
            </div>

            {/* 指定課價格列表 */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
              gap: '15px' 
            }}>
              {coaches.filter(c => c.status === 'active').map(coach => (
                <div
                  key={coach.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: isMobile ? '16px' : '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: coach.designated_lesson_price_30min ? '2px solid #FF9800' : '2px solid #e0e0e0'
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

                  {/* 價格狀態 */}
                  {coach.designated_lesson_price_30min ? (
                    <div style={{
                      background: '#fff8e1',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        30分鐘指定課價格
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#f57c00'
                      }}>
                        ${coach.designated_lesson_price_30min}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
                        其他時長自動換算（無條件捨去）：
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        20分=${Math.floor(coach.designated_lesson_price_30min * 20 / 30)} / 
                        40分=${Math.floor(coach.designated_lesson_price_30min * 40 / 30)} / 
                        60分=${Math.floor(coach.designated_lesson_price_30min * 60 / 30)} / 
                        90分=${Math.floor(coach.designated_lesson_price_30min * 90 / 30)}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#f5f5f5',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      💡 未設定價格
                    </div>
                  )}

                  {/* 設定按鈕 */}
                  <button
                    onClick={() => openPricingDialog(coach)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '14px',
                      background: coach.designated_lesson_price_30min ? '#fff8e1' : '#FF9800',
                      color: coach.designated_lesson_price_30min ? '#e65100' : 'white',
                      border: coach.designated_lesson_price_30min ? '2px solid #ffcc80' : 'none',
                      borderRadius: '10px',
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {coach.designated_lesson_price_30min ? '修改價格' : '設定價格'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 功能權限 Tab */}
        {activeTab === 'features' && (
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
                <span style={{ flexShrink: 0 }}>🚤</span>
                <div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>功能權限</strong>：設定哪些帳號可以在首頁看到額外功能
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>
                    加入後，該帳號登入時首頁會直接顯示對應功能的 icon
                  </div>
                  <div style={{ 
                    background: 'rgba(255,255,255,0.7)', 
                    padding: '10px 12px', 
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '6px', color: '#0d47a1' }}>
                      目前開放的功能：
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>📆</span>
                      <span><strong>排班</strong> - 分配教練、駕駛，填寫排班備註</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>🚤</span>
                      <span><strong>船隻管理</strong> - 管理船隻狀態、設定維修/停用時段、調整價格</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>🔍</span>
                      <span><strong>批次修改</strong> - 在預約查詢中批次修改多筆預約</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔄</span>
                      <span><strong>重複預約</strong> - 在預約表中將預約重複到多個日期</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 新增帳號 */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '16px',
                color: '#333'
              }}>
                新增帳號
              </div>
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <input
                  type="email"
                  value={newEditorEmail}
                  onChange={(e) => setNewEditorEmail(e.target.value)}
                  placeholder="輸入 Email"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddEditor()
                  }}
                />
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleAddEditor}
                  disabled={addingEditor}
                >
                  {addingEditor ? '新增中...' : '➕ 新增'}
                </Button>
              </div>
            </div>

            {/* 已授權帳號列表 */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '16px',
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                已授權帳號
                <Badge variant="info" size="small">
                  {editorUsers.length} 人
                </Badge>
              </div>

              {editorUsers.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '14px'
                }}>
                  尚無帳號，請在上方新增
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editorUsers.map((editor) => (
                    <div
                      key={editor.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: '#f8f9fa',
                        borderRadius: '10px',
                        border: '1px solid #e9ecef',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#333',
                          wordBreak: 'break-all'
                        }}>
                          {editor.email}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#999',
                          marginTop: '4px'
                        }}>
                          加入時間：{editor.created_at ? new Date(editor.created_at).toLocaleDateString('zh-TW') : '-'}
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => handleRemoveEditor(editor.id, editor.email)}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
            maxWidth: '450px',
            width: '100%'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>新增教練</h2>
            
            {/* 教練名稱（必填） */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                教練名稱 <span style={{ color: '#e53935' }}>*</span>
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

            {/* 登入帳號（可選） */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                登入帳號 Email <span style={{ color: '#999', fontWeight: '400', fontSize: '13px' }}>（可選）</span>
              </label>
              <input
                type="email"
                value={newCoachEmail}
                onChange={(e) => setNewCoachEmail(e.target.value)}
                placeholder="例如：coach@example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 指定課價格（可選） */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                30分鐘指定課價格 <span style={{ color: '#999', fontWeight: '400', fontSize: '13px' }}>（可選）</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={newCoachPrice}
                onChange={(e) => {
                  const numValue = e.target.value.replace(/\D/g, '')
                  setNewCoachPrice(numValue)
                }}
                placeholder="例如：1000"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0e0e0',
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
                  setAddDialogOpen(false)
                  setNewCoachName('')
                  setNewCoachEmail('')
                  setNewCoachPrice('')
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
            width: '100%',
            overflow: 'hidden'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '20px' }}>
              設定 {selectedCoach.name} 的休假
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                開始日期
              </label>
              <div style={{ display: 'flex' }}>
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
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                結束日期
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={timeOffEndDate}
                  onChange={(e) => setTimeOffEndDate(e.target.value)}
                  min={timeOffStartDate}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
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

      {/* 設定指定課價格彈窗 */}
      {pricingDialogOpen && selectedPricingCoach && (
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
              設定指定課價格：{selectedPricingCoach.name}
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                30分鐘指定課價格（元）
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={lessonPrice}
                onChange={(e) => {
                  const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                  setLessonPrice(numValue)
                }}
                placeholder="例如：1000"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '15px',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSetPrice()
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '13px',
                color: '#666',
                lineHeight: '1.4'
              }}>
                💡 其他時長會自動按比例換算（無條件進位：20分、40分、60分、90分）
              </div>
              {lessonPrice && !isNaN(Number(lessonPrice)) && Number(lessonPrice) > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#fff8e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#666'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px', color: '#f57c00' }}>
                    換算參考（無條件捨去）：
                  </div>
                  <div>20分 = ${Math.floor(Number(lessonPrice) * 20 / 30)}</div>
                  <div>40分 = ${Math.floor(Number(lessonPrice) * 40 / 30)}</div>
                  <div>60分 = ${Math.floor(Number(lessonPrice) * 60 / 30)}</div>
                  <div>90分 = ${Math.floor(Number(lessonPrice) * 90 / 30)}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setPricingDialogOpen(false)
                  setSelectedPricingCoach(null)
                  setLessonPrice('')
                }}
                disabled={pricingLoading}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleSetPrice}
                disabled={pricingLoading}
                style={{ flex: 1, background: pricingLoading ? '#ccc' : 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)' }}
              >
                {pricingLoading ? '設定中...' : '確定'}
              </Button>
            </div>

            {/* 清除價格按鈕 */}
            {selectedPricingCoach.designated_lesson_price_30min && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <button
                  onClick={() => {
                    if (confirm(`確定要清除 ${selectedPricingCoach.name} 的指定課價格嗎？`)) {
                      setLessonPrice('')
                      handleSetPrice()
                    }
                  }}
                  disabled={pricingLoading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#ffebee',
                    color: '#c62828',
                    border: '1px solid #ef9a9a',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: pricingLoading ? 'not-allowed' : 'pointer',
                    opacity: pricingLoading ? 0.5 : 1
                  }}
                >
                  清除價格設定
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
