import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'
import { clearPermissionCache, isAdmin, EDITOR_FEATURE_KEYS, EDITOR_FEATURE_LABELS, type EditorFeatureKey } from '../../utils/auth'

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

/** 合併連續休假後的顯示列（刪除時會一併刪除合併範圍內的所有資料列） */
type TimeOffDisplayRow = TimeOff & { displayText: string; mergedRecordIds: number[] }

/** 功能權限名單（表 editor_users）＋ 各模組布林 */
interface EditorUser {
  id: string
  email: string
  display_name: string | null
  created_at: string | null
  created_by: string | null
  notes: string | null
  can_schedule?: boolean
  can_boats?: boolean
  can_repeat_booking?: boolean
  can_search_batch?: boolean
}

// 一般權限用戶
interface ViewUser {
  id: string
  email: string
  display_name: string | null
  created_at: string | null
  notes: string | null
}

/** 系統登入名單（allowed_users）— 最上層，通過才能使用應用（含「今日預約」） */
interface AllowedUser {
  id: string
  email: string
  created_at: string | null
  created_by: string | null
  notes: string | null
}

export function StaffManagement() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([])
  const [editorUsers, setEditorUsers] = useState<EditorUser[]>([])
  const [loading, setLoading] = useState(true)
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !isAdmin(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'archived'>('active') // 狀態篩選
  const [activeTab, setActiveTab] = useState<'coaches' | 'accounts' | 'pricing' | 'permissions'>('coaches') // Tab 切換
  const [expandedCoachIds, setExpandedCoachIds] = useState<Set<string>>(new Set())
  
  // 系統登入名單（最上層）
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])
  const [newAllowedEmail, setNewAllowedEmail] = useState('')
  const [newAllowedNotes, setNewAllowedNotes] = useState('')
  const [addingAllowed, setAddingAllowed] = useState(false)
  const [editingAllowedId, setEditingAllowedId] = useState<string | null>(null)
  const [editAllowedNotes, setEditAllowedNotes] = useState('')

  // 一般權限管理
  const [viewUsers, setViewUsers] = useState<ViewUser[]>([])
  const [newViewUserEmail, setNewViewUserEmail] = useState('')
  const [newViewUserName, setNewViewUserName] = useState('')
  const [addingViewUser, setAddingViewUser] = useState(false)
  const [editingViewUserId, setEditingViewUserId] = useState<string | null>(null)
  const [editViewUserName, setEditViewUserName] = useState('')
  
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
  
  // 功能權限
  const [newEditorEmail, setNewEditorEmail] = useState('')
  const [newEditorDisplayName, setNewEditorDisplayName] = useState('')
  const [addingEditor, setAddingEditor] = useState(false)
  const [editingEditorId, setEditingEditorId] = useState<string | null>(null)
  const [editEditorName, setEditEditorName] = useState('')
  
  // 說明展開狀態
  const [showHelp, setShowHelp] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const formatShortDate = (dateStr: string, showYear: boolean = false): string => {
    const [year, month, day] = dateStr.split('-')
    if (showYear) {
      return `${year}/${parseInt(month)}/${parseInt(day)}`
    }
    return `${parseInt(month)}/${parseInt(day)}`
  }

  const mergeConsecutiveTimeOffs = (rows: TimeOff[]): TimeOffDisplayRow[] => {
    if (rows.length === 0) return []
    const sorted = [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const merged: TimeOffDisplayRow[] = []
    let group: TimeOff[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const previous = group[group.length - 1]
      const prevEnd = new Date(previous.end_date)
      const currStart = new Date(current.start_date)
      const dayDiff = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24)
      const sameReason = (previous.reason || '') === (current.reason || '')
      if (dayDiff <= 1 && sameReason) {
        group.push(current)
      } else {
        merged.push(createMergedTimeOff(group))
        group = [current]
      }
    }
    if (group.length > 0) merged.push(createMergedTimeOff(group))
    return merged
  }

  const createMergedTimeOff = (group: TimeOff[]): TimeOffDisplayRow => {
    const first = group[0]
    const last = group[group.length - 1]
    const startYear = first.start_date.split('-')[0]
    const endYear = last.end_date.split('-')[0]
    const isCrossYear = startYear !== endYear
    const startStr = formatShortDate(first.start_date, isCrossYear)
    const endStr = formatShortDate(last.end_date, isCrossYear)
    const displayText = startStr === endStr ? startStr : `${startStr} - ${endStr}`
    return {
      ...first,
      end_date: last.end_date,
      displayText,
      mergedRecordIds: group.map(t => t.id),
    }
  }

  const toggleExpandCoach = (coachId: string) => {
    setExpandedCoachIds(prev => {
      const next = new Set(prev)
      if (next.has(coachId)) next.delete(coachId)
      else next.add(coachId)
      return next
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
      const [
        coachesResult, 
        timeOffsResult, 
        editorsResult,
        viewUsersResult,
        allowedUsersResult
      ] = await Promise.all([
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
          .order('email'),
        // 載入一般權限用戶
        (supabase as any)
          .from('view_users')
          .select('*')
          .order('email'),
        supabase
          .from('allowed_users')
          .select('*')
          .order('email')
      ])

      if (coachesResult.error) throw coachesResult.error
      if (timeOffsResult.error) throw timeOffsResult.error
      // 其他表可能不存在，忽略錯誤

      setCoaches(coachesResult.data || [])
      setTimeOffs(timeOffsResult.data || [])
      setEditorUsers(editorsResult.data as any || [])
      setViewUsers(viewUsersResult.data || [])
      if (allowedUsersResult.error) {
        console.error('載入登入名單失敗:', allowedUsersResult.error)
      } else {
        setAllowedUsers((allowedUsersResult.data as AllowedUser[]) || [])
      }
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
      const reasonVal = timeOffReason.trim() || null
      const { error } = await supabase
        .from('coach_time_off')
        .insert([{
          coach_id: selectedCoach.id,
          start_date: timeOffStartDate,
          end_date: timeOffEndDate,
          reason: reasonVal,
          created_at: getLocalTimestamp()
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

  const handleDeleteTimeOff = async (row: TimeOffDisplayRow) => {
    if (!confirm('確定要刪除這個休假記錄嗎？')) return

    try {
      const { error } = await supabase
        .from('coach_time_off')
        .delete()
        .in('id', row.mergedRecordIds)

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

  // 新增功能權限帳號（表 editor_users；預設四項全開，可於下方勾選關閉）
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
      const email = newEditorEmail.trim().toLowerCase()
      const displayName = newEditorDisplayName.trim() || null

      const { error: editorError } = await (supabase as any)
        .from('editor_users')
        .insert([{
          email: email,
          display_name: displayName,
          can_schedule: true,
          can_boats: true,
          can_repeat_booking: true,
          can_search_batch: true
        }])

      if (editorError) {
        if (editorError.code === '23505') {
          throw new Error('此 Email 已在功能權限名單中')
        }
        throw editorError
      }

      await (supabase as any)
        .from('view_users')
        .upsert([{
          email: email,
          display_name: displayName,
          notes: '功能權限'
        }], {
          onConflict: 'email',
          ignoreDuplicates: true
        })

      await supabase
        .from('allowed_users')
        .upsert([{
          email: email,
          notes: '功能權限'
        }], {
          onConflict: 'email',
          ignoreDuplicates: true
        })

      toast.success(`已將 ${displayName || email} 加入功能權限名單（四項模組預設全開）`)
      setNewEditorEmail('')
      setNewEditorDisplayName('')
      clearPermissionCache() // 清除權限緩存
      loadData()
    } catch (error) {
      toast.error('新增失敗: ' + (error as Error).message)
    } finally {
      setAddingEditor(false)
    }
  }

  const handleToggleEditorModule = async (id: string, key: EditorFeatureKey, value: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('editor_users')
        .update({ [key]: value })
        .eq('id', id)
      if (error) throw error
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('更新權限失敗: ' + (error as Error).message)
    }
  }

  // 從功能權限名單移除
  const handleRemoveEditor = async (id: string, email: string, displayName: string | null) => {
    if (!confirm(`確定要將 ${displayName || email} 從功能權限名單移除嗎？`)) {
      return
    }

    try {
      const e = email.toLowerCase()
      const { error } = await (supabase as any)
        .from('editor_users')
        .delete()
        .eq('id', id)

      if (error) throw error

      const { data: stillView } = await (supabase as any)
        .from('view_users')
        .select('id')
        .eq('email', e)
        .maybeSingle()
      if (!stillView) {
        const { error: delAllow } = await supabase.from('allowed_users').delete().eq('email', e)
        if (delAllow) throw delAllow
      }

      toast.success(`已將 ${displayName || email} 從功能權限名單移除`)
      clearPermissionCache() // 清除權限緩存
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
    }
  }
  
  // 更新顯示名稱
  const handleUpdateEditorName = async (id: string) => {
    try {
      await (supabase as any)
        .from('editor_users')
        .update({
          display_name: editEditorName.trim() || null
        })
        .eq('id', id)
      
      toast.success('已更新名稱')
      setEditingEditorId(null)
      setEditEditorName('')
      loadData()
    } catch (error) {
      toast.error('更新失敗: ' + (error as Error).message)
    }
  }

  // ========== 系統登入名單（allowed_users，最上層）==========

  const handleAddAllowedUser = async () => {
    if (!newAllowedEmail.trim()) {
      toast.warning('請輸入 Email')
      return
    }
    if (!newAllowedEmail.includes('@')) {
      toast.warning('請輸入有效的 Email')
      return
    }
    setAddingAllowed(true)
    try {
      const email = newAllowedEmail.trim().toLowerCase()
      const notes = newAllowedNotes.trim() || '登入名單'
      const { error } = await supabase
        .from('allowed_users')
        .upsert(
          {
            email,
            notes
          },
          { onConflict: 'email' }
        )
      if (error) throw error
      toast.success(`已加入登入名單：${email}`)
      setNewAllowedEmail('')
      setNewAllowedNotes('')
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('新增失敗: ' + (error as Error).message)
    } finally {
      setAddingAllowed(false)
    }
  }

  /** 從登入名單移除時，一併移除同 Email 之一般權限與功能權限列，避免資料不一致 */
  const handleRemoveAllowedUser = async (id: string, email: string) => {
    if (
      !confirm(
        `確定要從「登入名單」移除 ${email} 嗎？\n將一併移除其一般權限與小編（若有），且對方登入後將無法使用本系統。`
      )
    ) {
      return
    }
    try {
      const e = email.toLowerCase()
      const { error: e1 } = await (supabase as any).from('editor_users').delete().eq('email', e)
      if (e1) throw e1
      const { error: e2 } = await (supabase as any).from('view_users').delete().eq('email', e)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('allowed_users').delete().eq('id', id)
      if (e3) throw e3
      toast.success(`已從登入名單與下層權限移除 ${email}`)
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
    }
  }

  const handleUpdateAllowedNotes = async (id: string) => {
    try {
      const { error } = await supabase
        .from('allowed_users')
        .update({ notes: editAllowedNotes.trim() || null })
        .eq('id', id)
      if (error) throw error
      toast.success('已更新備註')
      setEditingAllowedId(null)
      setEditAllowedNotes('')
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('更新失敗: ' + (error as Error).message)
    }
  }

  // ========== 一般權限管理 ==========
  
  // 新增一般權限用戶
  const handleAddViewUser = async () => {
    if (!newViewUserEmail.trim()) {
      toast.warning('請輸入 Email')
      return
    }
    
    if (!newViewUserEmail.includes('@')) {
      toast.warning('請輸入有效的 Email')
      return
    }
    
    setAddingViewUser(true)
    try {
      const email = newViewUserEmail.trim().toLowerCase()
      
      const { error } = await (supabase as any)
        .from('view_users')
        .insert([{
          email: email,
          display_name: newViewUserName.trim() || null
        }])
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('此 Email 已有一般權限')
        }
        throw error
      }

      await supabase.from('allowed_users').upsert(
        {
          email,
          notes: '一般權限'
        },
        { onConflict: 'email' }
      )
      
      toast.success(`已新增 ${newViewUserName || email} 的一般權限`)
      setNewViewUserEmail('')
      setNewViewUserName('')
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('新增失敗: ' + (error as Error).message)
    } finally {
      setAddingViewUser(false)
    }
  }
  
  // 移除一般權限用戶
  const handleRemoveViewUser = async (id: string, email: string, displayName: string | null) => {
    if (!confirm(`確定要移除 ${displayName || email} 的一般權限嗎？`)) {
      return
    }
    
    try {
      const e = email.toLowerCase()
      const { error } = await (supabase as any)
        .from('view_users')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      const { data: stillEditor } = await (supabase as any)
        .from('editor_users')
        .select('id')
        .eq('email', e)
        .maybeSingle()
      if (!stillEditor) {
        const { error: delAllow } = await supabase.from('allowed_users').delete().eq('email', e)
        if (delAllow) throw delAllow
      }
      
      toast.success(`已移除 ${displayName || email} 的一般權限`)
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
    }
  }
  
  // 更新一般權限用戶的顯示名稱
  const handleUpdateViewUserName = async (id: string) => {
    try {
      await (supabase as any)
        .from('view_users')
        .update({
          display_name: editViewUserName.trim() || null
        })
        .eq('id', id)
      
      toast.success('已更新名稱')
      setEditingViewUserId(null)
      setEditViewUserName('')
      loadData()
    } catch (error) {
      toast.error('更新失敗: ' + (error as Error).message)
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
            data-track="staff_tab_coaches"
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
            data-track="staff_tab_accounts"
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
            data-track="staff_tab_pricing"
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
            data-track="staff_tab_permissions"
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: isMobile ? '12px 16px' : '14px 28px',
              background: activeTab === 'permissions' ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'permissions' ? '3px solid #4CAF50' : '3px solid transparent',
              color: activeTab === 'permissions' ? '#4CAF50' : '#666',
              fontWeight: activeTab === 'permissions' ? 'bold' : 'normal',
              fontSize: isMobile ? '14px' : '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            權限管理
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
                data-track="staff_add_coach"
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
            if (statusFilter === 'active') return coach.status === 'active'
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
                  const filteredTimeOffs = filterTimeOffsByMonth(coachTimeOffs, selectedMonth)
                  if (filteredTimeOffs.length === 0) return null

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
                          key={timeOff.mergedRecordIds.join('-')}
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
                            type="button"
                            data-track="staff_delete_time_off"
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
                      {hasMore && (
                        <button
                          type="button"
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

                {!isArchived && (
                  <button
                    type="button"
                    data-track="staff_time_off_dialog"
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

        {/* 權限管理 Tab */}
        {activeTab === 'permissions' && (
          <>
            {/* 總體說明 */}
            <div style={{
              background: '#fff3e0',
              padding: isMobile ? '12px 16px' : '14px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#e65100',
              border: '1px solid #ffcc80',
              lineHeight: '1.8'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}>
                📋 權限說明
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>• <strong>系統登入名單</strong>（下表自行維護）：先在此加入 Email，對方才能登入使用本系統；僅在名單內、未加下層權限者，以首頁已開放功能為準（如「今日預約」）</div>
                <div>• <strong>一般權限</strong>：可看到預約表、預約查詢、明日提醒、編輯記錄</div>
                <div>• <strong>功能權限</strong>（下表）：在一般權限之上，可<strong>逐項勾選</strong>排班、船隻、重複預約、預約查詢批次等模組</div>
              </div>
              <div style={{ 
                marginTop: '10px', 
                padding: '8px 12px', 
                background: 'rgba(255,255,255,0.7)', 
                borderRadius: '6px',
                fontSize: '13px'
              }}>
                💡 在「一般／小編」新增帳號時，會一併寫入下方登入名單。僅需「能登入、但只開今日預約等」者，可只在登入名單加 Email 並用備註註記。從登入名單移除時，可選擇一併清除下層權限（見按鈕說明）。
              </div>
            </div>

            {/* ========== 系統登入名單（表格，最上層）========== */}
            <div style={{
              background: '#fff8e1',
              padding: '12px 16px',
              borderRadius: '8px 8px 0 0',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#f57f17',
              border: '1px solid #ffdcc0',
              borderBottom: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <span>🗝️</span>
              系統登入名單
              <Badge variant="warning" size="small">{allowedUsers.length} 人</Badge>
              <span style={{ fontWeight: '500', fontSize: '12px', color: '#8d6e63' }}>（allowed_users，可在此自訂新增／備註／移除）</span>
            </div>
            <div style={{
              background: 'white',
              borderRadius: '0 0 12px 12px',
              padding: isMobile ? '12px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              marginBottom: '24px',
              border: '1px solid #ffdcc0',
              borderTop: 'none'
            }}>
              <div style={{ fontSize: '13px', color: '#6d4c41', marginBottom: '16px', lineHeight: 1.6 }}>
                僅下表內的 Google 帳號可通過登入；未在表內者會看到「無法使用此系統」與聯絡官方說明。超級管理員不在此表亦永遠可登入。
              </div>
              <div style={{
                display: 'flex',
                gap: '10px',
                flexDirection: isMobile ? 'column' : 'row',
                marginBottom: '16px',
                alignItems: isMobile ? 'stretch' : 'flex-end'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Email</div>
                  <input
                    type="email"
                    value={newAllowedEmail}
                    onChange={(e) => setNewAllowedEmail(e.target.value)}
                    placeholder="例：name@gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>備註（選填）</div>
                  <input
                    type="text"
                    value={newAllowedNotes}
                    onChange={(e) => setNewAllowedNotes(e.target.value)}
                    placeholder="例：教練僅需今日預約"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddAllowedUser()
                    }}
                  />
                </div>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleAddAllowedUser}
                  disabled={addingAllowed}
                  style={{ background: '#f9a825', color: '#333', fontWeight: 600 }}
                >
                  {addingAllowed ? '新增中...' : '➕ 加入名單'}
                </Button>
              </div>

              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  minWidth: isMobile ? '520px' : '100%'
                }}>
                  <thead>
                    <tr style={{ background: '#fffde7', borderBottom: '2px solid #ffe0b2' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#5d4037' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#5d4037' }}>備註</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#5d4037', whiteSpace: 'nowrap' }}>建立時間</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#5d4037', width: '120px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '32px 12px', textAlign: 'center', color: '#999' }}>
                          尚無資料，請在上方新增，或從一般／小編權限新增（會連動寫入此表）
                        </td>
                      </tr>
                    ) : (
                      allowedUsers.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px', wordBreak: 'break-all', verticalAlign: 'top' }}>{row.email}</td>
                          <td style={{ padding: '12px', verticalAlign: 'top' }}>
                            {editingAllowedId === row.id ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={editAllowedNotes}
                                  onChange={(e) => setEditAllowedNotes(e.target.value)}
                                  style={{ flex: 1, minWidth: '120px', padding: '6px 8px', border: '1px solid #ffb74d', borderRadius: '6px' }}
                                  autoFocus
                                />
                                <Button variant="primary" size="small" onClick={() => handleUpdateAllowedNotes(row.id)} style={{ background: '#f9a825', color: '#333' }}>儲存</Button>
                                <Button variant="outline" size="small" onClick={() => { setEditingAllowedId(null); setEditAllowedNotes('') }}>取消</Button>
                              </div>
                            ) : (
                              <span style={{ color: row.notes ? '#333' : '#aaa' }}>{row.notes || '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', color: '#666', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {row.created_at ? new Date(row.created_at).toLocaleString('zh-TW') : '—'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {editingAllowedId !== row.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setEditingAllowedId(row.id); setEditAllowedNotes(row.notes || '') }}
                                  style={{ marginRight: '8px', background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                                >
                                  編輯備註
                                </button>
                                <Button variant="danger" size="small" onClick={() => handleRemoveAllowedUser(row.id, row.email)}>
                                  移除
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========== 一般權限區塊 ========== */}
            <div style={{
              background: '#e8f5e9',
              padding: '12px 16px',
              borderRadius: '8px 8px 0 0',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#2e7d32',
              border: '1px solid #a5d6a7',
              borderBottom: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>👁️</span>
              一般權限
              <Badge variant="success" size="small">{viewUsers.length} 人</Badge>
            </div>

            {/* 一般權限 - 內容區塊 */}
            <div style={{
              background: 'white',
              borderRadius: '0 0 12px 12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              marginBottom: '24px',
              border: '1px solid #a5d6a7',
              borderTop: 'none'
            }}>
              {/* 新增表單 */}
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                flexDirection: isMobile ? 'column' : 'row',
                marginBottom: '16px'
              }}>
                <input
                  type="email"
                  value={newViewUserEmail}
                  onChange={(e) => setNewViewUserEmail(e.target.value)}
                  placeholder="輸入 Email"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
                <input
                  type="text"
                  value={newViewUserName}
                  onChange={(e) => setNewViewUserName(e.target.value)}
                  placeholder="名稱標記（選填）"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleAddViewUser}
                  disabled={addingViewUser}
                  style={{ background: '#4CAF50' }}
                >
                  {addingViewUser ? '新增中...' : '➕ 新增'}
                </Button>
              </div>

              {/* 帳號列表 */}
              {viewUsers.length === 0 ? (
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
                  {viewUsers.map((viewUser) => (
                    <div
                      key={viewUser.id}
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
                        {editingViewUserId === viewUser.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editViewUserName}
                              onChange={(e) => setEditViewUserName(e.target.value)}
                              placeholder="輸入名稱"
                              style={{
                                flex: 1,
                                padding: '8px',
                                border: '1px solid #4CAF50',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                              autoFocus
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                  handleUpdateViewUserName(viewUser.id)
                                }
                              }}
                            />
                            <Button
                              variant="primary"
                              size="small"
                              onClick={() => handleUpdateViewUserName(viewUser.id)}
                              style={{ background: '#4CAF50' }}
                            >
                              確定
                            </Button>
                            <Button
                              variant="outline"
                              size="small"
                              onClick={() => {
                                setEditingViewUserId(null)
                                setEditViewUserName('')
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {viewUser.display_name && (
                                <span style={{ color: '#4CAF50' }}>{viewUser.display_name}</span>
                              )}
                              <span style={{ 
                                color: viewUser.display_name ? '#999' : '#333',
                                fontSize: viewUser.display_name ? '13px' : '15px',
                                wordBreak: 'break-all'
                              }}>
                                {viewUser.display_name ? `(${viewUser.email})` : viewUser.email}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingViewUserId(viewUser.id)
                                  setEditViewUserName(viewUser.display_name || '')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '2px 6px',
                                  opacity: 0.6
                                }}
                                title="編輯名稱"
                              >
                                ✏️
                              </button>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#999',
                              marginTop: '4px'
                            }}>
                              加入時間：{viewUser.created_at ? new Date(viewUser.created_at).toLocaleDateString('zh-TW') : '-'}
                            </div>
                          </>
                        )}
                      </div>
                      {editingViewUserId !== viewUser.id && (
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleRemoveViewUser(viewUser.id, viewUser.email, viewUser.display_name)}
                        >
                          移除
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ========== 功能權限（模組勾選）========== */}
            <div style={{
              background: '#e3f2fd',
              padding: '12px 16px',
              borderRadius: '8px 8px 0 0',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#1565c0',
              border: '1px solid #90caf9',
              borderBottom: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🧩</span>
              功能權限
              <Badge variant="info" size="small">{editorUsers.length} 人</Badge>
            </div>
            
            <div style={{
              background: '#e3f2fd',
              padding: '10px 16px',
              fontSize: '13px',
              color: '#1565c0',
              border: '1px solid #90caf9',
              borderTop: 'none',
              borderBottom: 'none',
              lineHeight: '1.6'
            }}>
              <div style={{ marginBottom: '6px' }}>
                此名單內帳號可再<strong>各自勾選</strong>模組；未勾的項目不會在畫面出現對應按鈕或無法進入該頁。新增帳號預設<strong>四項全開</strong>（之後可關閉）。超級管理員不受此表限制。
              </div>
              <div style={{ 
                fontSize: '12px', 
                opacity: 0.85,
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                ⚠️ 從此名單移除時，<strong>不會</strong>自動移除一般權限與登入名單（與各區塊說明一致）
              </div>
            </div>

            {/* 功能權限 - 內容區塊 */}
            <div style={{
              background: 'white',
              borderRadius: '0 0 12px 12px',
              padding: isMobile ? '16px' : '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #90caf9',
              borderTop: 'none'
            }}>
              {/* 新增表單 */}
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                flexDirection: isMobile ? 'column' : 'row',
                marginBottom: '16px'
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
                />
                <input
                  type="text"
                  value={newEditorDisplayName}
                  onChange={(e) => setNewEditorDisplayName(e.target.value)}
                  placeholder="名稱標記（選填）"
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

              {/* 帳號列表 */}
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
                        {editingEditorId === editor.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editEditorName}
                              onChange={(e) => setEditEditorName(e.target.value)}
                              placeholder="輸入名稱"
                              style={{
                                flex: 1,
                                padding: '8px',
                                border: '1px solid #2196F3',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                              autoFocus
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                  handleUpdateEditorName(editor.id)
                                }
                              }}
                            />
                            <Button
                              variant="primary"
                              size="small"
                              onClick={() => handleUpdateEditorName(editor.id)}
                            >
                              確定
                            </Button>
                            <Button
                              variant="outline"
                              size="small"
                              onClick={() => {
                                setEditingEditorId(null)
                                setEditEditorName('')
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              {editor.display_name && (
                                <span style={{ color: '#2196F3' }}>{editor.display_name}</span>
                              )}
                              <span style={{ 
                                color: editor.display_name ? '#999' : '#333',
                                fontSize: editor.display_name ? '13px' : '15px',
                                wordBreak: 'break-all'
                              }}>
                                {editor.display_name ? `(${editor.email})` : editor.email}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingEditorId(editor.id)
                                  setEditEditorName(editor.display_name || '')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '2px 6px',
                                  opacity: 0.6
                                }}
                                title="編輯名稱"
                              >
                                ✏️
                              </button>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#999',
                              marginTop: '4px'
                            }}>
                              加入時間：{editor.created_at ? new Date(editor.created_at).toLocaleDateString('zh-TW') : '-'}
                            </div>
                            <div style={{
                              marginTop: '12px',
                              paddingTop: '10px',
                              borderTop: '1px solid #e9ecef'
                            }}>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>模組</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                                {EDITOR_FEATURE_KEYS.map((key) => (
                                  <label
                                    key={key}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '12px',
                                      color: '#333',
                                      cursor: 'pointer',
                                      userSelect: 'none'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editor[key] !== false}
                                      onChange={(e) => handleToggleEditorModule(editor.id, key, e.target.checked)}
                                    />
                                    {EDITOR_FEATURE_LABELS[key]}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {editingEditorId !== editor.id && (
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => handleRemoveEditor(editor.id, editor.email, editor.display_name)}
                        >
                          移除
                        </Button>
                      )}
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
                  setTimeOffStartDate('')
                  setTimeOffEndDate('')
                  setTimeOffReason('')
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
