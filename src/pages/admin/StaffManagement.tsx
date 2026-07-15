import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { trackClickDedupedWithin } from '../../utils/trackClick'
import { Button, useToast, ToastContainer } from '../../components/ui'
import { ConfirmModal } from '../../components/ui/Modal'
import {
  AdminModal,
  AdminModalHeader,
  adminTextInputStyle,
  DateRangeFields,
  FormFieldLabel,
  HintBox,
  PreviewBanner,
  SegmentedControl,
  TimeSelectField,
} from '../../components/admin/AdminFormUi'
import { TimeOffBatchCalendar } from '../../components/admin/TimeOffBatchCalendar'
import {
  clearPermissionCache,
  isAdmin,
  SUPER_ADMINS,
  HIDDEN_CODE_ALLOWED_USER_EMAILS,
  EDITOR_FEATURE_KEYS,
  EDITOR_FEATURE_LABELS,
  type EditorFeatureKey
} from '../../utils/auth'
import {
  canMergeTimeOffRecords,
  formatTimeOffDisplay,
  timeOffModeToDbFields,
  buildTimeOffPreviewText,
  isCustomTimeOffEmptyOnSingleDay,
  inferTimeOffModeFromRow,
  getTimeOffListDisplayParts,
  getTimeOffCellLabel,
  type TimeOffMode,
  type TimeOffPeriodKind,
} from '../../utils/coachTimeOff'
import {
  designSystem,
  getFontSize,
  getPageContentShellStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]

/** 人員權限表上顯示的「小編」欄位：重複預約＋批次合併為一格（寫庫仍為兩欄同值） */
const MATRIX_SINGLE_FEATURE_KEYS = ['can_schedule', 'can_boats', 'can_products'] as const
const matrixFeatureColumnCount = MATRIX_SINGLE_FEATURE_KEYS.length + 1

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
  start_time: string | null
  end_time: string | null
  reason: string | null
  notes: string | null
}

/** 合併連續休假後的顯示列（刪除時會一併刪除合併範圍內的所有資料列） */
type TimeOffDisplayRow = TimeOff & {
  displayText: string
  dateLabel: string
  periodLabel: string
  periodKind: TimeOffPeriodKind
  mergedRecordIds: number[]
}

type TimeOffDraft = {
  mode: TimeOffMode
  customStartTime: string
  customEndTime: string
}

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
  can_products?: boolean
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

/** 人員權限表：合併三張表同一 email 的列 */
interface PermissionMatrixRow {
  email: string
  allowed: AllowedUser | null
  view: ViewUser | null
  editor: EditorUser | null
}

/** 人員顯示名：view → 登入備註 → editor（人名以 view／allowed 為主，避免取消「一般」後畫面名被 editor 帶跑） */
function getMatrixRowDisplayName(row: PermissionMatrixRow): string {
  const v = row.view?.display_name?.trim()
  if (v) return v
  const notes = row.allowed?.notes?.trim()
  if (notes) return notes
  const ed = row.editor?.display_name?.trim()
  if (ed) return ed
  return ''
}

/** 權限表內「取消登入／取消一般／刪除整列」共用同一套 ConfirmModal */
type PermissionMatrixConfirmAction =
  | { kind: 'removeLogin'; allowedUserId: string; email: string }
  | { kind: 'removeView'; row: PermissionMatrixRow }
  | { kind: 'deleteRow'; row: PermissionMatrixRow }

function getPermissionMatrixConfirmEmail(a: PermissionMatrixConfirmAction): string {
  if (a.kind === 'deleteRow' || a.kind === 'removeView') return a.row.email
  return a.email
}

function getPermissionMatrixConfirmCopy(a: PermissionMatrixConfirmAction): { title: string; message: string; confirmText: string } {
  switch (a.kind) {
    case 'removeLogin':
      return {
        title: '取消登入權限',
        message: `確定要將「${a.email}」從登入名單移除？\n\n一併刪除該帳的「一般」與「小編（功能）」設定。移除後此帳號無法再登入本系統。`,
        confirmText: '從名單移除',
      }
    case 'removeView': {
      const who = getMatrixRowDisplayName(a.row) || a.row.email
      return {
        title: '取消一般權限',
        message: `確定要取消「${who}」的一般權限？（帳號：${a.row.email}）\n\n取消後無法使用預約表、查詢、提醒等。登入名單（allowed_users）仍保留，對方仍可登入並查看「今日預約」。`,
        confirmText: '取消一般',
      }
    }
    case 'deleteRow':
      return {
        title: '刪除權限',
        message: `確定要刪除「${a.row.email}」在本表顯示的全部權限？\n\n將一併移除登入、一般、小編（功能）等設定。`,
        confirmText: '刪除',
      }
  }
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
  /** 權限表「名稱」欄位編輯中（列 email 小寫） */
  const [editingMatrixNameForEmail, setEditingMatrixNameForEmail] = useState<string | null>(null)
  const [editMatrixName, setEditMatrixName] = useState('')

  // 一般權限管理（併入單一權限表，仍從此 state 載入）
  const [viewUsers, setViewUsers] = useState<ViewUser[]>([])
  const [savingMatrixEmail, setSavingMatrixEmail] = useState<string | null>(null)

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
  const [timeOffMode, setTimeOffMode] = useState<TimeOffMode>('fullday')
  const [timeOffCustomStartTime, setTimeOffCustomStartTime] = useState('')
  const [timeOffCustomEndTime, setTimeOffCustomEndTime] = useState('')
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  /** 編輯模式：對應 DB 列 id（合併顯示列可能含多 id） */
  const [editingTimeOffIds, setEditingTimeOffIds] = useState<number[] | null>(null)
  const [timeOffMultiDay, setTimeOffMultiDay] = useState(false)
  const [timeOffCalendarMonth, setTimeOffCalendarMonth] = useState(currentMonth)
  const [draftTimeOffDates, setDraftTimeOffDates] = useState<Map<string, TimeOffDraft>>(new Map())

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
  const [accountClearConfirmOpen, setAccountClearConfirmOpen] = useState(false)
  const [priceClearConfirmOpen, setPriceClearConfirmOpen] = useState(false)
  const [permissionMatrixConfirm, setPermissionMatrixConfirm] = useState<PermissionMatrixConfirmAction | null>(null)

  useEffect(() => {
    loadData()
  }, [])

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
      if (dayDiff <= 1 && canMergeTimeOffRecords(previous, current)) {
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
    const mergedRow = {
      coach_id: first.coach_id,
      start_date: first.start_date,
      end_date: last.end_date,
      start_time: first.start_time,
      end_time: first.end_time,
    }
    const displayText = formatTimeOffDisplay(mergedRow)
    const { dateLabel, periodLabel, periodKind } = getTimeOffListDisplayParts(mergedRow)
    return {
      ...first,
      end_date: last.end_date,
      displayText,
      dateLabel,
      periodLabel,
      periodKind,
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

  const handleSaveTimeOff = async () => {
    if (!selectedCoach) return
    const isBatchCreate = !editingTimeOffIds?.length

    if (isBatchCreate) {
      if (draftTimeOffDates.size === 0) {
        toast.warning('請至少選擇一個日期')
        return
      }
    } else {
      if (!timeOffStartDate || !timeOffEndDate) {
        toast.warning('請選擇日期')
        return
      }

      if (timeOffEndDate < timeOffStartDate) {
        toast.warning('結束日期不能早於開始日期')
        return
      }

      const isSingleDay = timeOffStartDate === timeOffEndDate
      if ((timeOffMode === 'morning' || timeOffMode === 'afternoon') && !isSingleDay) {
        toast.warning('上午／下午僅適用單日，跨日請選擇整天或自訂時間')
        return
      }

      if (isCustomTimeOffEmptyOnSingleDay(
        timeOffMode,
        timeOffStartDate,
        timeOffEndDate,
        timeOffCustomStartTime,
        timeOffCustomEndTime
      )) {
        toast.warning('請填寫開始或結束時間，或改選「整天」')
        return
      }
    }

    if (
      timeOffMode === 'custom' &&
      timeOffCustomStartTime &&
      timeOffCustomEndTime &&
      timeOffCustomEndTime <= timeOffCustomStartTime &&
      !isBatchCreate &&
      timeOffStartDate === timeOffEndDate
    ) {
      toast.warning('結束時間需晚於開始時間')
      return
    }

    setTimeOffLoading(true)
    try {
      const reasonVal = timeOffReason.trim() || null
      const { start_time, end_time } = timeOffModeToDbFields(
        timeOffMode,
        timeOffCustomStartTime,
        timeOffCustomEndTime
      )
      const payload = {
        start_date: timeOffStartDate,
        end_date: timeOffEndDate,
        start_time,
        end_time,
        reason: reasonVal,
      }

      if (isBatchCreate) {
        const rows = [...draftTimeOffDates.entries()]
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, draft]) => {
            const draftTimes = timeOffModeToDbFields(
              draft.mode,
              draft.customStartTime,
              draft.customEndTime
            )
            return {
            coach_id: selectedCoach.id,
            start_date: date,
            end_date: date,
            start_time: draftTimes.start_time,
            end_time: draftTimes.end_time,
            reason: reasonVal,
            created_at: getLocalTimestamp(),
            }
          })
        const { error } = await supabase.from('coach_time_off').insert(rows)
        if (error) throw error
        toast.success(`已設定 ${rows.length} 天休假`)
      } else if (editingTimeOffIds?.length) {
        if (editingTimeOffIds.length === 1) {
          const { error } = await supabase
            .from('coach_time_off')
            .update(payload)
            .eq('id', editingTimeOffIds[0])
          if (error) throw error
        } else {
          const { error: deleteError } = await supabase
            .from('coach_time_off')
            .delete()
            .in('id', editingTimeOffIds)
          if (deleteError) throw deleteError
          const { error: insertError } = await supabase.from('coach_time_off').insert([{
            coach_id: selectedCoach.id,
            ...payload,
            created_at: getLocalTimestamp(),
          }])
          if (insertError) throw insertError
        }
        toast.success('休假已更新')
      } else {
        const { error } = await supabase.from('coach_time_off').insert([{
          coach_id: selectedCoach.id,
          ...payload,
          created_at: getLocalTimestamp(),
        }])
        if (error) throw error
        toast.success('休假設定成功')
      }

      resetTimeOffDialog()
      loadData()
    } catch (error) {
      toast.error(
        (editingTimeOffIds?.length ? '更新休假失敗：' : '設定休假失敗：') + (error as Error).message
      )
    } finally {
      setTimeOffLoading(false)
    }
  }

  const handleDeleteTimeOff = async (row: TimeOffDisplayRow) => {
    const label = row.reason ? `${row.displayText}（${row.reason}）` : row.displayText
    if (!confirm(`確定要刪除「${label}」嗎？`)) return

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

  const normalizeTimeForSelect = (t: string | null): string => {
    if (!t) return ''
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`
  }

  const openTimeOffDialog = (coach: Coach) => {
    setSelectedCoach(coach)
    setEditingTimeOffIds(null)
    setTimeOffCalendarMonth(selectedMonth)
    setDraftTimeOffDates(new Map())
    setTimeOffMultiDay(false)
    const today = getLocalDateString()
    const dateStr = today.startsWith(`${selectedMonth}-`) ? today : `${selectedMonth}-01`
    setTimeOffStartDate(dateStr)
    setTimeOffEndDate(dateStr)
    setTimeOffReason('')
    setTimeOffMode('fullday')
    setTimeOffCustomStartTime('')
    setTimeOffCustomEndTime('')
    setTimeOffDialogOpen(true)
  }

  const openEditTimeOffDialog = (coach: Coach, row: TimeOffDisplayRow) => {
    setSelectedCoach(coach)
    setEditingTimeOffIds(row.mergedRecordIds)
    setTimeOffCalendarMonth(row.start_date.slice(0, 7))
    setDraftTimeOffDates(new Map())
    setTimeOffMultiDay(row.start_date !== row.end_date)
    setTimeOffStartDate(row.start_date)
    setTimeOffEndDate(row.end_date)
    setTimeOffReason(row.reason || '')
    const { mode, customStartTime, customEndTime } = inferTimeOffModeFromRow({
      coach_id: row.coach_id,
      start_date: row.start_date,
      end_date: row.end_date,
      start_time: row.start_time,
      end_time: row.end_time,
    })
    setTimeOffMode(mode)
    setTimeOffCustomStartTime(normalizeTimeForSelect(customStartTime))
    setTimeOffCustomEndTime(normalizeTimeForSelect(customEndTime))
    setTimeOffDialogOpen(true)
  }

  const resetTimeOffDialog = () => {
    setTimeOffDialogOpen(false)
    setSelectedCoach(null)
    setEditingTimeOffIds(null)
    setDraftTimeOffDates(new Map())
    setTimeOffMultiDay(false)
    setTimeOffStartDate('')
    setTimeOffEndDate('')
    setTimeOffReason('')
    setTimeOffMode('fullday')
    setTimeOffCustomStartTime('')
    setTimeOffCustomEndTime('')
  }

  const resetPartialDayModeIfCrossDay = (start: string, end: string) => {
    const crossDay = Boolean(start && end && start !== end)
    if (crossDay && (timeOffMode === 'morning' || timeOffMode === 'afternoon')) {
      setTimeOffMode('fullday')
      toast.warning('跨日僅支援整天或自訂時間，已改為整天')
    }
  }

  const isTimeOffSingleDay = timeOffStartDate === timeOffEndDate
  const isTimeOffCrossDay = timeOffMultiDay && Boolean(timeOffStartDate && timeOffEndDate && !isTimeOffSingleDay)

  const handleTimeOffStartChange = (v: string) => {
    setTimeOffStartDate(v)
    const nextEnd = !timeOffMultiDay ? v : (timeOffEndDate < v ? v : timeOffEndDate)
    if (!timeOffMultiDay) setTimeOffEndDate(v)
    else if (timeOffEndDate < v) setTimeOffEndDate(v)
    resetPartialDayModeIfCrossDay(v, nextEnd)
  }

  const handleTimeOffEndChange = (v: string) => {
    setTimeOffEndDate(v)
    resetPartialDayModeIfCrossDay(timeOffStartDate, v)
  }

  const handleTimeOffMultiDayChange = (v: boolean) => {
    setTimeOffMultiDay(v)
    if (!v && timeOffStartDate) {
      setTimeOffEndDate(timeOffStartDate)
      resetPartialDayModeIfCrossDay(timeOffStartDate, timeOffStartDate)
    } else if (v) {
      resetPartialDayModeIfCrossDay(timeOffStartDate, timeOffEndDate)
    }
  }

  const timeOffPreviewText = useMemo(() => {
    if (!timeOffStartDate || !timeOffEndDate) return ''
    return buildTimeOffPreviewText(
      timeOffMode,
      timeOffStartDate,
      timeOffEndDate,
      timeOffCustomStartTime,
      timeOffCustomEndTime
    )
  }, [timeOffMode, timeOffStartDate, timeOffEndDate, timeOffCustomStartTime, timeOffCustomEndTime])

  const timeOffModeOptions = useMemo(() => ([
    { value: 'fullday' as const, label: '整天', hint: '預設', trackId: 'staff_time_off_mode_fullday' },
    { value: 'morning' as const, label: '上午', hint: '～12:00', disabled: isTimeOffCrossDay, trackId: 'staff_time_off_mode_morning' },
    { value: 'afternoon' as const, label: '下午', hint: '12:00～', disabled: isTimeOffCrossDay, trackId: 'staff_time_off_mode_afternoon' },
    { value: 'custom' as const, label: '自訂', hint: '指定時間', trackId: 'staff_time_off_mode_custom' },
  ]), [isTimeOffCrossDay])

  const existingTimeOffDateLabels = useMemo(() => {
    const labels = new Map<string, string>()
    if (!selectedCoach || !timeOffCalendarMonth) return labels

    const [year, month] = timeOffCalendarMonth.split('-').map(Number)
    const dayCount = new Date(year, month, 0).getDate()
    const coachRows = timeOffs.filter(row => row.coach_id === selectedCoach.id)

    for (let day = 1; day <= dayCount; day += 1) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const label = getTimeOffCellLabel(coachRows, date)
      if (label) labels.set(date, label)
    }
    return labels
  }, [selectedCoach, timeOffCalendarMonth, timeOffs])

  const draftTimeOffDateLabels = useMemo(() => {
    const labels = new Map<string, string>()
    draftTimeOffDates.forEach((draft, date) => {
      if (draft.mode === 'fullday') labels.set(date, '整天')
      else if (draft.mode === 'morning') labels.set(date, '上午')
      else if (draft.mode === 'afternoon') labels.set(date, '下午')
      else if (draft.customStartTime && draft.customEndTime) {
        labels.set(date, `${draft.customStartTime}–${draft.customEndTime}`)
      } else if (draft.customStartTime) {
        labels.set(date, `${draft.customStartTime}起`)
      } else {
        labels.set(date, `～${draft.customEndTime}`)
      }
    })
    return labels
  }, [draftTimeOffDates])

  const toggleDraftTimeOffDate = (date: string) => {
    if (timeOffMode === 'custom') {
      if (!timeOffCustomStartTime && !timeOffCustomEndTime) {
        toast.warning('請先設定自訂時間，再點選日期')
        return
      }
      if (
        timeOffCustomStartTime &&
        timeOffCustomEndTime &&
        timeOffCustomEndTime <= timeOffCustomStartTime
      ) {
        toast.warning('結束時間需晚於開始時間')
        return
      }
    }

    const nextDraft: TimeOffDraft = {
      mode: timeOffMode,
      customStartTime: timeOffMode === 'custom' ? timeOffCustomStartTime : '',
      customEndTime: timeOffMode === 'custom' ? timeOffCustomEndTime : '',
    }

    setDraftTimeOffDates(current => {
      const next = new Map(current)
      const existing = next.get(date)
      const isSameDraft = existing?.mode === nextDraft.mode
        && existing.customStartTime === nextDraft.customStartTime
        && existing.customEndTime === nextDraft.customEndTime
      if (isSameDraft) next.delete(date)
      else next.set(date, nextDraft)
      return next
    })
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

  /** 把「字串欄的價格」寫入 DB；清除時傳入空字串，勿先 setState 再存（state 不會立刻更新） */
  const saveDesignatedLessonPrice = async (priceText: string) => {
    if (!selectedPricingCoach) return
    const priceValue = priceText.trim()
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

  const handleSetPrice = () => {
    void saveDesignatedLessonPrice(lessonPrice)
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
      const notes = newAllowedNotes.trim() || null
      const { data: exist, error: selErr } = await supabase
        .from('allowed_users')
        .select('id, notes')
        .eq('email', email)
        .maybeSingle()
      if (selErr) throw selErr
      if (exist) {
        if (notes) {
          const { error } = await supabase.from('allowed_users').update({ notes }).eq('id', exist.id)
          if (error) throw error
          toast.success(`已更新名稱／備註：${email}`)
        } else {
          toast.info(`帳號 ${email} 已在登入名單內，未變更備註（要改顯示名稱可於下表帳號旁按 ✎ 編輯，或補寫名稱後再按加入）`)
        }
      } else {
        const { error } = await supabase.from('allowed_users').insert({ email, notes })
        if (error) throw error
        toast.success(`已加入登入名單：${email}`)
      }
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

  /** 從登入名單移除：一併刪除同 email 之一般＋小編列（由確認框觸發） */
  const runRemoveFromLoginList = async (allowedUserId: string, email: string) => {
    const e = email.toLowerCase()
    setSavingMatrixEmail(e)
    try {
      const { error: e1 } = await (supabase as any).from('editor_users').delete().eq('email', e)
      if (e1) throw e1
      const { error: e2 } = await (supabase as any).from('view_users').delete().eq('email', e)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('allowed_users').delete().eq('id', allowedUserId)
      if (e3) throw e3
      toast.success(`已從登入名單移除 ${email}，並一併刪除其一般與小編權限（若有）`)
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
    } finally {
      setSavingMatrixEmail(null)
    }
  }

  /** 僅在沒有列時 insert，不覆寫既有名稱／備註（與權限勾選無關） */
  const ensureAllowedUserRowExists = async (email: string) => {
    const e = email.toLowerCase()
    const { data, error: selErr } = await supabase.from('allowed_users').select('id').eq('email', e).maybeSingle()
    if (selErr) throw selErr
    if (data) return
    const { error } = await supabase.from('allowed_users').insert({ email: e })
    if (error && (error as any).code !== '23505') throw error
  }

  /**
   * 人員「名稱」只寫在 view_users（有一般）或僅登入時的 allowed_users.notes；
   * 不寫入 editor_users（小編表僅管功能權限，與人名分開）
   */
  const handleSaveMatrixName = async (row: PermissionMatrixRow) => {
    const e = row.email.toLowerCase()
    const name = editMatrixName.trim() || null
    setSavingMatrixEmail(e)
    try {
      if (row.view) {
        const { error } = await (supabase as any)
          .from('view_users')
          .update({ display_name: name })
          .eq('id', row.view.id)
        if (error) throw error
      } else if (row.allowed) {
        const { error } = await supabase
          .from('allowed_users')
          .update({ notes: name })
          .eq('id', row.allowed.id)
        if (error) throw error
      } else {
        const { data: vRow, error: vSel } = await (supabase as any)
          .from('view_users')
          .select('id')
          .eq('email', e)
          .maybeSingle()
        if (vSel) throw vSel
        if (vRow) {
          const { error: vUp } = await (supabase as any)
            .from('view_users')
            .update({ display_name: name })
            .eq('id', vRow.id)
          if (vUp) throw vUp
        } else {
          const { error: vIns } = await (supabase as any)
            .from('view_users')
            .insert({ email: e, display_name: name })
          if (vIns) throw vIns
        }
        await ensureAllowedUserRowExists(e)
      }
      toast.success('已更新名稱')
      setEditingMatrixNameForEmail(null)
      setEditMatrixName('')
      clearPermissionCache()
      loadData()
    } catch (err) {
      toast.error('更新失敗: ' + (err as Error).message)
    } finally {
      setSavingMatrixEmail(null)
    }
  }

  // ========== 一般權限（仍由矩陣勾選驅動）==========

  /** 刪除 view_users 一列；保留 allowed_users。先將目前畫面顯示名寫入 allowed.notes，避免刪 view 後名稱被 editor 帶跑 */
  const runRemoveViewUserRow = async (row: PermissionMatrixRow) => {
    if (!row.view) return
    const e = row.email.toLowerCase()
    const nameToKeep = getMatrixRowDisplayName(row)
    setSavingMatrixEmail(e)
    try {
      if (row.allowed && nameToKeep) {
        const { error: nErr } = await supabase.from('allowed_users').update({ notes: nameToKeep }).eq('id', row.allowed.id)
        if (nErr) throw nErr
      }
      const { error } = await (supabase as any).from('view_users').delete().eq('id', row.view.id)
      if (error) throw error

      const label = nameToKeep || e
      toast.success(`已取消 ${label} 的一般權限；若仍在登入名單內，仍可登入並查看今日預約`)
      clearPermissionCache()
      loadData()
    } catch (error) {
      toast.error('移除失敗: ' + (error as Error).message)
    } finally {
      setSavingMatrixEmail(null)
    }
  }

  const isSuperAdminEmail = (em: string) =>
    SUPER_ADMINS.some((a) => a.toLowerCase() === em.trim().toLowerCase())

  const isHiddenCodeAllowedEmail = (em: string) =>
    HIDDEN_CODE_ALLOWED_USER_EMAILS.some((a) => a.toLowerCase() === em.trim().toLowerCase())

  /** 有一般或小編，但沒有登入名單列（歷史／手改庫導致，正常流程不會產生） */
  const matrixRowMissingLogin = (row: PermissionMatrixRow) =>
    !row.allowed && (!!row.view || !!row.editor)

  const getMatrixEditorFlags = (ed: EditorUser | null): Record<EditorFeatureKey, boolean> => {
    if (!ed) {
      return {
        can_schedule: false,
        can_boats: false,
        can_products: false,
        can_repeat_booking: false,
        can_search_batch: false
      }
    }
    return {
      can_schedule: ed.can_schedule !== false,
      can_boats: ed.can_boats !== false,
      // can_products 需明確勾選才開啟（不採用「未設定 = true」的舊欄位行為）
      can_products: ed.can_products === true,
      can_repeat_booking: ed.can_repeat_booking !== false,
      can_search_batch: ed.can_search_batch !== false
    }
  }

  const hasAnyEditorFeature = (f: Record<EditorFeatureKey, boolean>) =>
    EDITOR_FEATURE_KEYS.some((k) => f[k])

  /** 權限表排序分數：分數愈高代表權限愈多；列表改為分數遞增（權限少者在上） */
  const getMatrixRowPermissionSortScore = (row: PermissionMatrixRow): number => {
    const f = getMatrixEditorFlags(row.editor)
    let score = 0
    for (const k of EDITOR_FEATURE_KEYS) {
      if (f[k]) score += 1
    }
    score *= 1_000_000
    if (row.view) score += 10_000
    if (row.allowed) score += 100
    return score
  }

  const ensureViewUserRowExists = async (email: string) => {
    const e = email.toLowerCase()
    const { data, error: selErr } = await (supabase as any).from('view_users').select('id').eq('email', e).maybeSingle()
    if (selErr) throw selErr
    if (data) return
    const { error } = await (supabase as any).from('view_users').insert({ email: e })
    if (error && error.code !== '23505') throw error
  }

  const ensureAllowedAndViewForModule = async (email: string) => {
    const e = email.toLowerCase()
    await ensureAllowedUserRowExists(e)
    await ensureViewUserRowExists(e)
  }

  const setMatrixEditorFeatureFields = async (
    row: PermissionMatrixRow,
    updates: Partial<Record<EditorFeatureKey, boolean>>
  ) => {
    const e = row.email.toLowerCase()
    setSavingMatrixEmail(e)
    try {
      const prev = getMatrixEditorFlags(row.editor)
      const flags: Record<EditorFeatureKey, boolean> = { ...prev, ...updates }
      const allOff = EDITOR_FEATURE_KEYS.every((k) => !flags[k])
      if (allOff) {
        if (row.editor) {
          const { error } = await (supabase as any).from('editor_users').delete().eq('id', row.editor.id)
          if (error) throw error
        }
      } else if (!row.editor) {
        await ensureAllowedAndViewForModule(e)
        const { error, data } = await (supabase as any)
          .from('editor_users')
          .insert({
            email: e,
            can_schedule: flags.can_schedule,
            can_boats: flags.can_boats,
            can_products: flags.can_products,
            can_repeat_booking: flags.can_repeat_booking,
            can_search_batch: flags.can_search_batch
          })
          .select('id')
          .single()
        if (error) {
          if (error.code === '23505') {
            const { error: up } = await (supabase as any)
              .from('editor_users')
              .update({
                can_schedule: flags.can_schedule,
                can_boats: flags.can_boats,
                can_products: flags.can_products,
                can_repeat_booking: flags.can_repeat_booking,
                can_search_batch: flags.can_search_batch
              })
              .eq('email', e)
            if (up) throw up
          } else {
            throw error
          }
        } else {
          void data
        }
      } else {
        const { error } = await (supabase as any)
          .from('editor_users')
          .update({
            can_schedule: flags.can_schedule,
            can_boats: flags.can_boats,
            can_products: flags.can_products,
            can_repeat_booking: flags.can_repeat_booking,
            can_search_batch: flags.can_search_batch
          })
          .eq('id', row.editor.id)
        if (error) throw error
      }
      clearPermissionCache()
      loadData()
    } catch (err) {
      toast.error('更新失敗: ' + (err as Error).message)
    } finally {
      setSavingMatrixEmail(null)
    }
  }

  const setMatrixEditorFeature = (row: PermissionMatrixRow, key: EditorFeatureKey, value: boolean) =>
    setMatrixEditorFeatureFields(row, { [key]: value })

  /** 重複預約（預約表）＋預約查詢·批次 同勾同退 */
  const setMatrixRepeatAndSearchBatch = (row: PermissionMatrixRow, value: boolean) =>
    setMatrixEditorFeatureFields(row, { can_repeat_booking: value, can_search_batch: value })

  const toggleMatrixLogin = async (row: PermissionMatrixRow, next: boolean) => {
    if (next) {
      if (row.allowed) return
      setSavingMatrixEmail(row.email)
      try {
        const e = row.email.toLowerCase()
        await ensureAllowedUserRowExists(e)
        clearPermissionCache()
        loadData()
      } catch (err) {
        toast.error('失敗: ' + (err as Error).message)
      } finally {
        setSavingMatrixEmail(null)
      }
      return
    }
    if (row.allowed) {
      const f = getMatrixEditorFlags(row.editor)
      if (row.view || hasAnyEditorFeature(f)) {
        toast.warning('請先關閉一般與功能權限，再取消登入')
        return
      }
      setPermissionMatrixConfirm({ kind: 'removeLogin', allowedUserId: row.allowed.id, email: row.email })
    }
  }

  const toggleMatrixView = async (row: PermissionMatrixRow, next: boolean) => {
    if (next) {
      if (row.view) return
      setSavingMatrixEmail(row.email)
      try {
        const e = row.email.toLowerCase()
        const { error: ve } = await (supabase as any).from('view_users').insert([{ email: e }])
        if (ve && ve.code !== '23505') throw ve
        await ensureAllowedUserRowExists(e)
        clearPermissionCache()
        loadData()
      } catch (err) {
        toast.error('失敗: ' + (err as Error).message)
      } finally {
        setSavingMatrixEmail(null)
      }
      return
    }
    if (hasAnyEditorFeature(getMatrixEditorFlags(row.editor))) {
      toast.warning('請先關閉所有功能權限，再取消一般')
      return
    }
    if (row.view) {
      setPermissionMatrixConfirm({ kind: 'removeView', row })
    }
  }

  const runDeleteMatrixRow = async (row: PermissionMatrixRow) => {
    const e = row.email.toLowerCase()
    setSavingMatrixEmail(e)
    try {
      await (supabase as any).from('editor_users').delete().eq('email', e)
      await (supabase as any).from('view_users').delete().eq('email', e)
      const { error } = await supabase.from('allowed_users').delete().eq('email', e)
      if (error) throw error
      toast.success(`已刪除 ${row.email} 的登入、一般與小編權限`)
      clearPermissionCache()
      loadData()
    } catch (err) {
      toast.error('刪除失敗: ' + (err as Error).message)
    } finally {
      setSavingMatrixEmail(null)
    }
  }

  /** 合併三張表一列一帳號 */
  const permissionMatrixRows = useMemo((): PermissionMatrixRow[] => {
    const m = new Map<string, PermissionMatrixRow>()
    const put = (email: string) => {
      const k = email.trim().toLowerCase()
      if (isSuperAdminEmail(k)) return
      if (isHiddenCodeAllowedEmail(k)) return
      if (!m.has(k)) m.set(k, { email: k, allowed: null, view: null, editor: null })
    }
    for (const a of allowedUsers) {
      put(a.email)
      const r = m.get(a.email.toLowerCase())
      if (r) r.allowed = a
    }
    for (const v of viewUsers) {
      put(v.email)
      const r = m.get(v.email.toLowerCase())
      if (r) r.view = v
    }
    for (const e of editorUsers) {
      put(e.email)
      const r = m.get(e.email.toLowerCase())
      if (r) r.editor = e as EditorUser
    }
    return Array.from(m.values()).sort((a, b) => {
      const d = getMatrixRowPermissionSortScore(a) - getMatrixRowPermissionSortScore(b)
      if (d !== 0) return d
      return a.email.localeCompare(b.email)
    })
  }, [allowedUsers, viewUsers, editorUsers])

  const matrixMissingLoginCount = useMemo(
    () => permissionMatrixRows.filter((r) => matrixRowMissingLogin(r)).length,
    [permissionMatrixRows]
  )

  /** 有下層但缺 allowed 列時自動補上，否則登入格會鎖定卻無法寫入 */
  useEffect(() => {
    if (activeTab !== 'permissions' || loading) return
    const toFix = permissionMatrixRows.filter((r) => matrixRowMissingLogin(r))
    if (toFix.length === 0) return
    let cancelled = false
    void (async () => {
      try {
        for (const row of toFix) {
          if (cancelled) return
          await ensureAllowedUserRowExists(row.email.toLowerCase())
        }
        if (cancelled) return
        clearPermissionCache()
        await loadData()
        toast.success(`已同步 ${toFix.length} 筆登入名單（與下層權限一致）`)
      } catch (e) {
        if (!cancelled) toast.error('同步登入名單失敗: ' + (e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, loading, permissionMatrixRows])

  if (loading) {
    return (
      <div style={{
        padding: isMobile ? '12px 16px' : '20px',
        minHeight: '100dvh',
        background: pageBg,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}>
        <div style={getPageContentShellStyle(isMobile)}>
          <PageHeader user={user} title="人員" showBaoLink={isAdmin(user)} />
          <div style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: '15px',
            color: designSystem.colors.text.secondary,
          }}>
            載入中...
          </div>
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '12px 16px' : '20px',
      minHeight: '100dvh',
      background: pageBg,
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    }}>
      <div style={getPageContentShellStyle(isMobile)}>
        <PageHeader user={user} title="人員" showBaoLink={isAdmin(user)} />

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          background: designSystem.colors.secondary[100],
          borderRadius: designSystem.borderRadius.lg,
          padding: '4px',
          overflowX: 'auto'
        }}>
          <button
            data-track="staff_tab_coaches"
            onClick={() => setActiveTab('coaches')}
            style={{
              padding: isMobile ? '9px 16px' : '10px 22px',
              background: activeTab === 'coaches' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: designSystem.borderRadius.lg,
              boxShadow: activeTab === 'coaches' ? designSystem.shadows.xs : 'none',
              color: activeTab === 'coaches' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
              fontWeight: activeTab === 'coaches' ? 600 : 500,
              fontSize: isMobile ? '14px' : '15px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            教練
          </button>
          <button
            data-track="staff_tab_accounts"
            onClick={() => setActiveTab('accounts')}
            style={{
              padding: isMobile ? '9px 16px' : '10px 22px',
              background: activeTab === 'accounts' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: designSystem.borderRadius.lg,
              boxShadow: activeTab === 'accounts' ? designSystem.shadows.xs : 'none',
              color: activeTab === 'accounts' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
              fontWeight: activeTab === 'accounts' ? 600 : 500,
              fontSize: isMobile ? '14px' : '15px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            帳號
          </button>
          <button
            data-track="staff_tab_pricing"
            onClick={() => setActiveTab('pricing')}
            style={{
              padding: isMobile ? '9px 16px' : '10px 22px',
              background: activeTab === 'pricing' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: designSystem.borderRadius.lg,
              boxShadow: activeTab === 'pricing' ? designSystem.shadows.xs : 'none',
              color: activeTab === 'pricing' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
              fontWeight: activeTab === 'pricing' ? 600 : 500,
              fontSize: isMobile ? '14px' : '15px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            價格
          </button>
          <button
            data-track="staff_tab_permissions"
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: isMobile ? '9px 16px' : '10px 22px',
              background: activeTab === 'permissions' ? 'white' : 'transparent',
              border: 'none',
              borderRadius: designSystem.borderRadius.lg,
              boxShadow: activeTab === 'permissions' ? designSystem.shadows.xs : 'none',
              color: activeTab === 'permissions' ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
              fontWeight: activeTab === 'permissions' ? 600 : 500,
              fontSize: isMobile ? '14px' : '15px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            權限
          </button>
        </div>

        {/* 教練管理 Tab */}
        {activeTab === 'coaches' && (
          <>
            {/* 控制列 */}
            <div style={{
              marginBottom: designSystem.spacing.md,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <Button
                variant="primary"
                size="medium"
                data-track="staff_add_coach"
                onClick={() => setAddDialogOpen(true)}
              >
                新增教練
              </Button>

              <div style={{ flex: 1 }} />

              <div style={{
                display: 'flex',
                background: designSystem.colors.secondary[100],
                borderRadius: designSystem.borderRadius.lg,
                padding: '4px',
                gap: '2px',
              }}>
                {([
                  { key: 'active' as const, label: '啟用中' },
                  { key: 'all' as const, label: '全部' },
                  { key: 'archived' as const, label: '已隱藏' },
                ]).map(opt => {
                  const selected = statusFilter === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStatusFilter(opt.key)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: designSystem.borderRadius.md,
                        background: selected ? designSystem.colors.background.card : 'transparent',
                        color: selected
                          ? designSystem.colors.text.primary
                          : designSystem.colors.text.secondary,
                        fontSize: getFontSize('bodySmall', isMobile),
                        fontWeight: selected ? 600 : 500,
                        cursor: 'pointer',
                        boxShadow: selected ? designSystem.shadows.xs : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  const next = e.target.value
                  if (!next || next === selectedMonth) return
                  setSelectedMonth(next)
                  if (user?.email) {
                    trackClickDedupedWithin(`staff_time_off_month_pick:${next}`, user.email)
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxWidth: isMobile ? '100%' : '180px',
                  padding: '10px 12px',
                  border: cardBorder,
                  borderRadius: designSystem.borderRadius.lg,
                  fontSize: '16px',
                  cursor: 'pointer',
                  background: designSystem.colors.background.card,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 單一 grouped list */}
            <div style={{
              display: 'grid',
              gap: isMobile ? '10px' : '14px',
            }}>
              {(() => {
                const filteredCoaches = coaches.filter(coach => {
                  if (statusFilter === 'active') return coach.status === 'active'
                  if (statusFilter === 'archived') return coach.status === 'archived'
                  return true
                })

                if (filteredCoaches.length === 0) {
                  return (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      fontSize: getFontSize('body', isMobile),
                      color: designSystem.colors.text.disabled,
                    }}>
                      {statusFilter === 'archived' ? '沒有已隱藏的教練' : '沒有符合的教練'}
                    </div>
                  )
                }

                return filteredCoaches.map((coach) => {
                const coachTimeOffs = timeOffs.filter(t => t.coach_id === coach.id)
                const isActive = coach.status === 'active'
                const isArchived = coach.status === 'archived'
                const statusLabel = isArchived ? '已隱藏' : (isActive ? null : '已停用')

                const filteredTimeOffs = !isArchived
                  ? filterTimeOffsByMonth(coachTimeOffs, selectedMonth)
                  : []
                const mergedTimeOffs = filteredTimeOffs.length > 0
                  ? mergeConsecutiveTimeOffs(filteredTimeOffs)
                  : []
                const isExpanded = expandedCoachIds.has(coach.id)
                const maxDisplay = 2
                const displayTimeOffs = isExpanded
                  ? mergedTimeOffs
                  : mergedTimeOffs.slice(0, maxDisplay)
                const hasMore = mergedTimeOffs.length > maxDisplay

                return (
                  <div
                    key={coach.id}
                    style={{
                      padding: isMobile ? '14px' : '16px 18px',
                      background: designSystem.colors.background.card,
                      border: `1px solid ${designSystem.colors.border.main}`,
                      borderRadius: designSystem.borderRadius.lg,
                      boxShadow: designSystem.shadows.elevation[2],
                      opacity: isArchived ? 0.72 : 1,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: isMobile ? 'stretch' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: '12px',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: getFontSize('h3', isMobile),
                          fontWeight: 600,
                          color: designSystem.colors.text.primary,
                          lineHeight: 1.3,
                        }}>
                          {coach.name}
                        </div>
                        {statusLabel && (
                          <div style={{
                            marginTop: '4px',
                            fontSize: getFontSize('caption', isMobile),
                            color: designSystem.colors.text.disabled,
                          }}>
                            {statusLabel}
                          </div>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        flexShrink: 0,
                      }}>
                        {isArchived ? (
                          <>
                            <Button
                              variant="primary"
                              size="small"
                              onClick={() => handleRestoreCoach(coach)}
                            >
                              恢復
                            </Button>
                            <Button
                              variant="outline"
                              size="small"
                              onClick={() => handleDeleteCoach(coach)}
                              style={{
                                color: designSystem.colors.danger[700],
                                borderColor: `${designSystem.colors.danger[500]}55`,
                              }}
                            >
                              刪除
                            </Button>
                          </>
                        ) : (
                          <>
                            <div style={{
                              display: 'flex',
                              background: designSystem.colors.secondary[100],
                              borderRadius: designSystem.borderRadius.lg,
                              padding: '3px',
                              gap: '2px',
                            }}>
                              <button
                                type="button"
                                onClick={() => !isActive && handleToggleStatus(coach)}
                                style={{
                                  padding: '6px 12px',
                                  background: isActive
                                    ? designSystem.colors.background.card
                                    : 'transparent',
                                  color: isActive
                                    ? designSystem.colors.text.primary
                                    : designSystem.colors.text.secondary,
                                  border: 'none',
                                  borderRadius: designSystem.borderRadius.md,
                                  fontSize: getFontSize('bodySmall', isMobile),
                                  fontWeight: isActive ? 600 : 500,
                                  cursor: isActive ? 'default' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: isActive ? designSystem.shadows.xs : 'none',
                                }}
                              >
                                啟用
                              </button>
                              <button
                                type="button"
                                onClick={() => isActive && handleToggleStatus(coach)}
                                style={{
                                  padding: '6px 12px',
                                  background: !isActive
                                    ? designSystem.colors.background.card
                                    : 'transparent',
                                  color: !isActive
                                    ? designSystem.colors.text.primary
                                    : designSystem.colors.text.secondary,
                                  border: 'none',
                                  borderRadius: designSystem.borderRadius.md,
                                  fontSize: getFontSize('bodySmall', isMobile),
                                  fontWeight: !isActive ? 600 : 500,
                                  cursor: !isActive ? 'default' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: !isActive ? designSystem.shadows.xs : 'none',
                                }}
                              >
                                停用
                              </button>
                            </div>
                            <Button
                              variant="outline"
                              size="small"
                              data-track="staff_time_off_dialog"
                              onClick={() => openTimeOffDialog(coach)}
                            >
                              設定休假
                            </Button>
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => handleArchiveCoach(coach)}
                            >
                              隱藏
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isArchived && mergedTimeOffs.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        padding: isMobile ? '4px 10px' : '4px 12px',
                        background: designSystem.colors.background.main,
                        border: `1px solid ${designSystem.colors.border.light}`,
                        borderRadius: designSystem.borderRadius.md,
                      }}>
                        {displayTimeOffs.map((timeOff, idx) => (
                          <div
                            key={timeOff.mergedRecordIds.join('-')}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: isMobile ? '6px 0' : '5px 0',
                              gap: '10px',
                              borderBottom:
                                idx === displayTimeOffs.length - 1 && !hasMore
                                  ? 'none'
                                  : `1px solid ${designSystem.colors.border.light}`,
                            }}
                          >
                            <div style={{
                              flex: 1,
                              minWidth: 0,
                              lineHeight: 1.45,
                            }}>
                              <span style={{
                                fontSize: '15px',
                                fontWeight: 500,
                                color: designSystem.colors.text.primary,
                              }}>
                                {timeOff.dateLabel}
                              </span>
                              <span style={{
                                marginLeft: '8px',
                                fontSize: getFontSize('bodySmall', isMobile),
                                color: designSystem.colors.text.secondary,
                              }}>
                                {timeOff.periodLabel}
                              </span>
                              {timeOff.reason && (
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: getFontSize('bodySmall', isMobile),
                                  color: designSystem.colors.text.disabled,
                                }}>
                                  {timeOff.reason}
                                </span>
                              )}
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              flexShrink: 0,
                            }}>
                              <Button
                                variant="outline"
                                size="small"
                                data-track="staff_edit_time_off"
                                onClick={() => openEditTimeOffDialog(coach, timeOff)}
                                style={{ padding: isMobile ? '5px 9px' : '4px 9px' }}
                              >
                                編輯
                              </Button>
                              <Button
                                variant="ghost"
                                size="small"
                                data-track="staff_delete_time_off"
                                onClick={() => handleDeleteTimeOff(timeOff)}
                                style={{
                                  color: designSystem.colors.danger[700],
                                  padding: isMobile ? '5px 7px' : '4px 7px',
                                }}
                              >
                                刪除
                              </Button>
                            </div>
                          </div>
                        ))}
                        {hasMore && (
                          <button
                            type="button"
                            data-track="staff_time_off_expand"
                            onClick={() => toggleExpandCoach(coach.id)}
                            style={{
                              width: '100%',
                              marginTop: '2px',
                              padding: '6px',
                              background: 'transparent',
                              color: designSystem.colors.text.secondary,
                              border: 'none',
                              fontSize: getFontSize('bodySmall', isMobile),
                              fontWeight: 500,
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            {isExpanded
                              ? '收起'
                              : `查看全部 ${mergedTimeOffs.length} 筆`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
              })()}
            </div>
          </>
        )}

        {/* 帳號配對 Tab */}
        {activeTab === 'accounts' && (
          <>
            <div style={{
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: cardBorder,
              boxShadow: cardShadow,
              overflow: 'hidden',
            }}>
              {(() => {
                const activeCoaches = coaches.filter(c => c.status === 'active')
                if (activeCoaches.length === 0) {
                  return (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      fontSize: getFontSize('body', isMobile),
                      color: designSystem.colors.text.disabled,
                    }}>
                      沒有啟用中的教練
                    </div>
                  )
                }
                return activeCoaches.map((coach, index) => {
                  const paired = Boolean(coach.user_email)
                  const isLast = index === activeCoaches.length - 1
                  return (
                    <div
                      key={coach.id}
                      style={{
                        padding: isMobile ? '16px' : '18px 20px',
                        borderBottom: isLast ? 'none' : `1px solid ${designSystem.colors.border.light}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: getFontSize('h3', isMobile),
                          fontWeight: 600,
                          color: designSystem.colors.text.primary,
                          lineHeight: 1.3,
                        }}>
                          {coach.name}
                        </div>
                        <div style={{
                          marginTop: '4px',
                          fontSize: '15px',
                          color: paired
                            ? designSystem.colors.text.secondary
                            : designSystem.colors.text.disabled,
                          wordBreak: 'break-all',
                        }}>
                          {paired ? coach.user_email : '尚未配對'}
                        </div>
                      </div>
                      <Button
                        variant={paired ? 'outline' : 'primary'}
                        size="small"
                        onClick={() => openAccountDialog(coach)}
                        style={{ alignSelf: isMobile ? 'stretch' : 'center' }}
                      >
                        {paired ? '修改帳號' : '設定帳號'}
                      </Button>
                    </div>
                  )
                })
              })()}
            </div>
          </>
        )}

        {/* 指定課價格 Tab */}
        {activeTab === 'pricing' && (
          <>
            <div style={{
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: cardBorder,
              boxShadow: cardShadow,
              overflow: 'hidden',
            }}>
              {(() => {
                const activeCoaches = coaches.filter(c => c.status === 'active')
                if (activeCoaches.length === 0) {
                  return (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      fontSize: getFontSize('body', isMobile),
                      color: designSystem.colors.text.disabled,
                    }}>
                      沒有啟用中的教練
                    </div>
                  )
                }
                return activeCoaches.map((coach, index) => {
                  const price = coach.designated_lesson_price_30min
                  const isLast = index === activeCoaches.length - 1
                  return (
                    <div
                      key={coach.id}
                      style={{
                        padding: isMobile ? '16px' : '18px 20px',
                        borderBottom: isLast ? 'none' : `1px solid ${designSystem.colors.border.light}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: getFontSize('h3', isMobile),
                          fontWeight: 600,
                          color: designSystem.colors.text.primary,
                          lineHeight: 1.3,
                        }}>
                          {coach.name}
                        </div>
                        {price ? (
                          <>
                            <div style={{
                              marginTop: '4px',
                              fontSize: getFontSize('bodyLarge', isMobile),
                              fontWeight: 600,
                              color: designSystem.colors.text.primary,
                            }}>
                              ${price}
                              <span style={{
                                marginLeft: '8px',
                                fontSize: getFontSize('caption', isMobile),
                                fontWeight: 500,
                                color: designSystem.colors.text.disabled,
                              }}>
                                / 30 分
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={{
                            marginTop: '4px',
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.disabled,
                          }}>
                            未設定價格
                          </div>
                        )}
                      </div>
                      <Button
                        variant={price ? 'outline' : 'primary'}
                        size="small"
                        onClick={() => openPricingDialog(coach)}
                        style={{ alignSelf: isMobile ? 'stretch' : 'center' }}
                      >
                        {price ? '修改價格' : '設定價格'}
                      </Button>
                    </div>
                  )
                })
              })()}
            </div>
          </>
        )}

        {/* 權限管理 Tab */}
        {activeTab === 'permissions' && (
          <>
            <div style={{
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              padding: isMobile ? '16px' : '20px',
              boxShadow: cardShadow,
              border: cardBorder,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '8px 12px',
                marginBottom: designSystem.spacing.sm,
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: getFontSize('h3', isMobile),
                  fontWeight: 600,
                  color: designSystem.colors.text.primary,
                }}>
                  人員權限
                </h3>
                <span style={{
                  fontSize: '15px',
                  color: designSystem.colors.text.disabled,
                }}>
                  {permissionMatrixRows.length} 帳號
                  {matrixMissingLoginCount > 0 && (
                    <> · {matrixMissingLoginCount} 筆缺登入</>
                  )}
                </span>
              </div>
              <div style={{
                display: 'flex',
                gap: '10px',
                flexDirection: isMobile ? 'column' : 'row',
                marginBottom: designSystem.spacing.md,
                alignItems: isMobile ? 'stretch' : 'flex-end',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: getFontSize('caption', isMobile),
                    color: designSystem.colors.text.disabled,
                    marginBottom: '4px',
                  }}>
                    Email（小寫）
                  </div>
                  <input
                    type="email"
                    value={newAllowedEmail}
                    onChange={(e) => setNewAllowedEmail(e.target.value)}
                    placeholder="例：name@gmail.com"
                    style={{
                      ...adminTextInputStyle,
                      padding: '10px 12px',
                      borderRadius: designSystem.borderRadius.lg,
                      fontSize: '16px',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: getFontSize('caption', isMobile),
                    color: designSystem.colors.text.disabled,
                    marginBottom: '4px',
                  }}>
                    名稱（選填）
                  </div>
                  <input
                    type="text"
                    value={newAllowedNotes}
                    onChange={(e) => setNewAllowedNotes(e.target.value)}
                    placeholder=""
                    style={{
                      ...adminTextInputStyle,
                      padding: '10px 12px',
                      borderRadius: designSystem.borderRadius.lg,
                      fontSize: '16px',
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
                >
                  {addingAllowed ? '新增中...' : '加入'}
                </Button>
              </div>

              <div
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  border: cardBorder,
                  borderRadius: designSystem.borderRadius.lg,
                  background: designSystem.colors.background.card,
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    fontSize: getFontSize('bodySmall', isMobile),
                    minWidth: isMobile ? '560px' : '620px',
                  }}
                >
                  <thead>
                    <tr style={{ background: designSystem.colors.secondary[50] }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '11px 12px',
                          color: designSystem.colors.text.secondary,
                          fontWeight: 600,
                          fontSize: getFontSize('caption', isMobile),
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          minWidth: '200px',
                        }}
                      >
                        帳號＋顯示名稱
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '11px 8px',
                          color: designSystem.colors.text.secondary,
                          fontWeight: 600,
                          fontSize: getFontSize('caption', isMobile),
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          whiteSpace: 'nowrap',
                          width: 52,
                        }}
                        title="allowed_users，可登入"
                      >
                        登入
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '11px 8px',
                          color: designSystem.colors.text.secondary,
                          fontWeight: 600,
                          fontSize: getFontSize('caption', isMobile),
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          whiteSpace: 'nowrap',
                          width: 52,
                        }}
                        title="view_users"
                      >
                        一般
                      </th>
                      {MATRIX_SINGLE_FEATURE_KEYS.map((key, i) => (
                        <th
                          key={key}
                          style={{
                            textAlign: 'center',
                            padding: '11px 6px',
                            color: designSystem.colors.text.secondary,
                            maxWidth: '96px',
                            lineHeight: 1.25,
                            fontWeight: 600,
                            fontSize: getFontSize('caption', true),
                            borderBottom: `1px solid ${designSystem.colors.border.light}`,
                            borderLeft: i === 0 ? `1px solid ${designSystem.colors.border.light}` : undefined,
                          }}
                          title={EDITOR_FEATURE_LABELS[key]}
                        >
                          {EDITOR_FEATURE_LABELS[key]}
                        </th>
                      ))}
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '11px 6px',
                          color: designSystem.colors.text.secondary,
                          maxWidth: '90px',
                          lineHeight: 1.25,
                          fontWeight: 600,
                          fontSize: getFontSize('caption', true),
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                        }}
                        title="重複預約"
                      >
                        重複預約
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '11px 12px',
                          color: designSystem.colors.text.secondary,
                          fontWeight: 600,
                          fontSize: getFontSize('caption', isMobile),
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          width: 88,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionMatrixRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3 + matrixFeatureColumnCount + 1}
                          style={{
                            padding: '32px 12px',
                            textAlign: 'center',
                            color: designSystem.colors.text.disabled,
                            borderBottom: 'none',
                            fontSize: getFontSize('body', isMobile),
                          }}
                        >
                          尚無可列帳號。請在上方新增 Email，或於資料庫有 view／editor 列者會自動出現。
                        </td>
                      </tr>
                    ) : (
                      permissionMatrixRows.map((row) => {
                        const busy = savingMatrixEmail === row.email
                        const f = getMatrixEditorFlags(row.editor)
                        const hasEd = hasAnyEditorFeature(f)
                        const needsLogin = matrixRowMissingLogin(row)
                        const loginImplied = !!row.view || hasEd
                        const loginChecked = !!row.allowed || loginImplied
                        const loginDisabled = busy || loginImplied
                        const viewChecked = !!row.view || hasEd
                        const viewDisabled = busy || hasEd
                        const displayName = getMatrixRowDisplayName(row)
                        const rowBorder = `1px solid ${designSystem.colors.border.light}`
                        return (
                          <tr
                            key={row.email}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = needsLogin
                                ? designSystem.colors.warning[50]
                                : designSystem.colors.secondary[50]
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = needsLogin
                                ? designSystem.colors.warning[50]
                                : designSystem.colors.background.card
                            }}
                            style={{
                              background: needsLogin
                                ? designSystem.colors.warning[50]
                                : designSystem.colors.background.card,
                            }}
                          >
                            <td
                              style={{
                                padding: '12px',
                                wordBreak: 'break-word',
                                verticalAlign: 'top',
                                borderBottom: rowBorder,
                                minWidth: 0,
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '6px 8px',
                              }}>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: designSystem.colors.text.primary,
                                    fontSize: '15px',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {row.email}
                                </span>
                                {needsLogin && (
                                  <span
                                    style={{
                                      fontSize: getFontSize('caption', isMobile),
                                      color: designSystem.colors.warning[700],
                                      fontWeight: 500,
                                    }}
                                    title="有一般或小編，但此帳未在登入名單"
                                  >
                                    缺登入
                                  </span>
                                )}
                              </div>
                              {editingMatrixNameForEmail === row.email ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    alignItems: 'center',
                                    marginTop: '8px',
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={editMatrixName}
                                    onChange={(e) => setEditMatrixName(e.target.value)}
                                    placeholder="顯示名稱"
                                    style={{
                                      flex: 1,
                                      minWidth: '120px',
                                      padding: '7px 10px',
                                      border: cardBorder,
                                      borderRadius: designSystem.borderRadius.md,
                                      fontSize: getFontSize('bodySmall', isMobile),
                                      boxSizing: 'border-box',
                                    }}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) { void handleSaveMatrixName(row) }
                                      if (e.key === 'Escape') { setEditingMatrixNameForEmail(null); setEditMatrixName('') }
                                    }}
                                  />
                                  <Button variant="primary" size="small" onClick={() => { void handleSaveMatrixName(row) }}>
                                    儲存
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="small"
                                    onClick={() => { setEditingMatrixNameForEmail(null); setEditMatrixName('') }}
                                  >
                                    取消
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginTop: '6px',
                                  }}
                                >
                                  <span
                                    style={{
                                      color: displayName
                                        ? designSystem.colors.text.secondary
                                        : designSystem.colors.text.disabled,
                                      fontSize: getFontSize('caption', isMobile),
                                      lineHeight: 1.4,
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                  >
                                    {displayName || '未設定顯示名稱'}
                                  </span>
                                  <button
                                    type="button"
                                    title="編輯顯示名稱"
                                    aria-label="編輯顯示名稱"
                                    onClick={() => {
                                      setEditingMatrixNameForEmail(row.email)
                                      setEditMatrixName(getMatrixRowDisplayName(row))
                                    }}
                                    disabled={busy}
                                    style={{
                                      width: 30,
                                      height: 30,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: cardBorder,
                                      borderRadius: designSystem.borderRadius.md,
                                      background: designSystem.colors.background.card,
                                      cursor: busy ? 'not-allowed' : 'pointer',
                                      fontSize: getFontSize('bodySmall', isMobile),
                                      lineHeight: 1,
                                      color: busy
                                        ? designSystem.colors.text.disabled
                                        : designSystem.colors.text.secondary,
                                      padding: 0,
                                      flexShrink: 0,
                                      opacity: busy ? 0.5 : 1,
                                    }}
                                  >
                                    ✎
                                  </button>
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: '8px 6px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                borderBottom: rowBorder,
                                opacity: loginImplied && !needsLogin ? 0.6 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={loginChecked}
                                disabled={loginDisabled}
                                onChange={(e) => { void toggleMatrixLogin(row, e.target.checked) }}
                                title={
                                  loginImplied
                                    ? '有「一般」或功能權限時必須具備登入（可從下層取消以解鎖）'
                                    : '在登入名單內可登入'
                                }
                                aria-label="登入"
                              />
                            </td>
                            <td
                              style={{
                                padding: '10px 6px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                borderBottom: rowBorder,
                                opacity: hasEd ? 0.6 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={viewChecked}
                                disabled={viewDisabled}
                                onChange={(e) => { void toggleMatrixView(row, e.target.checked) }}
                                title={
                                  hasEd
                                    ? '有功能權限時必須具備一般權限（請先關閉所有功能權限）'
                                    : '一般權限（view_users）'
                                }
                                aria-label="一般"
                              />
                            </td>
                            {MATRIX_SINGLE_FEATURE_KEYS.map((key) => {
                              const cellChecked = f[key]
                              const cellDisabled = busy
                              const cellTitle = EDITOR_FEATURE_LABELS[key]
                              const onCellChange = (next: boolean) => {
                                void setMatrixEditorFeature(row, key, next)
                              }
                              return (
                                <td
                                  key={key}
                                  style={{
                                    padding: '10px 6px',
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    borderBottom: rowBorder,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={cellChecked}
                                    disabled={cellDisabled}
                                    onChange={(e) => onCellChange(e.target.checked)}
                                    title={cellTitle}
                                    aria-label={EDITOR_FEATURE_LABELS[key]}
                                  />
                                </td>
                              )
                            })}
                            <td
                              style={{
                                padding: '10px 6px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                borderBottom: rowBorder,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={f.can_repeat_booking && f.can_search_batch}
                                disabled={busy}
                                onChange={(e) => { void setMatrixRepeatAndSearchBatch(row, e.target.checked) }}
                                title="重複預約＋預約查詢·批次"
                                aria-label="重複預約"
                              />
                            </td>
                            <td
                              style={{
                                padding: '8px 12px',
                                textAlign: 'right',
                                verticalAlign: 'middle',
                                borderBottom: rowBorder,
                              }}
                            >
                              {editingMatrixNameForEmail !== row.email && (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={() => { setPermissionMatrixConfirm({ kind: 'deleteRow', row }) }}
                                  disabled={busy}
                                  style={{ color: designSystem.colors.danger[700] }}
                                >
                                  刪除
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        <Footer />
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
                style={{ flex: 1 }}
              >
                {addLoading ? '新增中...' : '確定'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 休假設定彈窗 */}
      {timeOffDialogOpen && selectedCoach && (
        <AdminModal
          isMobile={isMobile}
          maxWidth={editingTimeOffIds?.length ? 440 : 520}
          onClose={() => { if (!timeOffLoading) resetTimeOffDialog() }}
        >
          <AdminModalHeader
            title={editingTimeOffIds?.length ? '編輯休假' : '新增休假'}
            subtitle={selectedCoach.name}
            accent="amber"
          />

          {editingTimeOffIds?.length ? (
            <>
              <DateRangeFields
                startDate={timeOffStartDate}
                endDate={timeOffEndDate}
                onStartChange={handleTimeOffStartChange}
                onEndChange={handleTimeOffEndChange}
                multiDay={timeOffMultiDay}
                onMultiDayChange={handleTimeOffMultiDayChange}
                trackPrefix="staff_time_off"
              />
              {timeOffPreviewText && (
                <PreviewBanner>
                  <strong>預覽：</strong>{timeOffPreviewText}
                </PreviewBanner>
              )}
            </>
          ) : null}

          <div style={{ marginBottom: '16px' }}>
            <FormFieldLabel>時段</FormFieldLabel>
            <SegmentedControl
              options={timeOffModeOptions}
              value={timeOffMode}
              onChange={setTimeOffMode}
              accent="amber"
            />
            {editingTimeOffIds?.length && isTimeOffCrossDay && (
              <HintBox>跨多日僅支援「整天」或「自訂時間」</HintBox>
            )}
          </div>

          {timeOffMode === 'custom' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <TimeSelectField
                  value={timeOffCustomStartTime}
                  onChange={setTimeOffCustomStartTime}
                  label={editingTimeOffIds?.length && !isTimeOffSingleDay ? '第一天時間' : '開始時間'}
                />
                <TimeSelectField
                  value={timeOffCustomEndTime}
                  onChange={setTimeOffCustomEndTime}
                  label={editingTimeOffIds?.length && !isTimeOffSingleDay ? '最後一天時間' : '結束時間'}
                />
              </div>
              <HintBox>
                {editingTimeOffIds?.length && !isTimeOffSingleDay
                  ? '時間留空表示該端為整天；中間日期視為整天休假。'
                  : '時間留空表示該端為整天。'}
              </HintBox>
            </div>
          )}

          {!editingTimeOffIds?.length && (
            <TimeOffBatchCalendar
              month={timeOffCalendarMonth}
              onMonthChange={month => {
                setTimeOffCalendarMonth(month)
                setDraftTimeOffDates(new Map())
              }}
              draftDateLabels={draftTimeOffDateLabels}
              existingDateLabels={existingTimeOffDateLabels}
              onToggleDate={toggleDraftTimeOffDate}
            />
          )}

          <div style={{ marginBottom: '20px' }}>
            <FormFieldLabel optional>原因 / 事項</FormFieldLabel>
            <input
              type="text"
              value={timeOffReason}
              onChange={(e) => setTimeOffReason(e.target.value)}
              placeholder="例如：出國、個人事假…"
              style={adminTextInputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              variant="outline"
              data-track="staff_time_off_cancel"
              onClick={resetTimeOffDialog}
              disabled={timeOffLoading}
              style={{ flex: 1 }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              data-track={editingTimeOffIds?.length
                ? `staff_time_off_edit_confirm_${timeOffMode}`
                : `staff_time_off_confirm_${timeOffMode}`}
              onClick={handleSaveTimeOff}
              disabled={timeOffLoading}
              style={{ flex: 1 }}
            >
              {timeOffLoading
                ? (editingTimeOffIds?.length ? '儲存中…' : '新增中…')
                : editingTimeOffIds?.length
                  ? '儲存'
                  : draftTimeOffDates.size > 0
                    ? `新增 ${draftTimeOffDates.size} 天`
                    : '新增'}
            </Button>
          </div>
        </AdminModal>
      )}

      {/* 設定帳號彈窗 */}
      {accountDialogOpen && selectedAccountCoach && (
        <AdminModal
          isMobile={isMobile}
          maxWidth={450}
          onClose={() => {
            if (accountLoading) return
            setAccountDialogOpen(false)
            setSelectedAccountCoach(null)
            setAccountEmail('')
          }}
        >
          <AdminModalHeader title="設定帳號" subtitle={selectedAccountCoach.name} accent="blue" />

          <div style={{ marginBottom: '20px' }}>
            <FormFieldLabel>登入帳號 Email</FormFieldLabel>
            <input
              type="text"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="例如：coach@example.com"
              style={adminTextInputStyle}
            />
            <HintBox>設定後，該教練可以使用此帳號登入並查看自己的回報。</HintBox>
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
              style={{ flex: 1 }}
            >
              {accountLoading ? '設定中…' : '確定'}
            </Button>
          </div>

          {/* 清除帳號按鈕 */}
          {selectedAccountCoach.user_email && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
              <button
                onClick={() => { setAccountClearConfirmOpen(true) }}
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
        </AdminModal>
      )}

      {/* 設定指定課價格彈窗 */}
      {pricingDialogOpen && selectedPricingCoach && (
        <AdminModal
          isMobile={isMobile}
          maxWidth={450}
          onClose={() => {
            if (pricingLoading) return
            setPricingDialogOpen(false)
            setSelectedPricingCoach(null)
            setLessonPrice('')
          }}
        >
          <AdminModalHeader title="設定指定課價格" subtitle={selectedPricingCoach.name} accent="blue" />

          <div style={{ marginBottom: '20px' }}>
            <FormFieldLabel>30分鐘指定課價格（元）</FormFieldLabel>
            <input
              type="text"
              inputMode="numeric"
              value={lessonPrice}
              onChange={(e) => {
                const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                setLessonPrice(numValue)
              }}
              placeholder="例如：1000"
              style={adminTextInputStyle}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSetPrice()
              }}
            />
            <HintBox>其他時長會自動按比例換算（無條件進位：20分、40分、60分、90分）。</HintBox>
            {lessonPrice && !isNaN(Number(lessonPrice)) && Number(lessonPrice) > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '12px 14px',
                background: '#fff8e1',
                borderRadius: '10px',
                border: '1px solid #ffe0b2',
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
              style={{ flex: 1 }}
            >
              {pricingLoading ? '設定中…' : '確定'}
            </Button>
          </div>

          {/* 清除價格按鈕 */}
          {selectedPricingCoach.designated_lesson_price_30min && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
              <button
                onClick={() => { setPriceClearConfirmOpen(true) }}
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
        </AdminModal>
      )}

      {selectedAccountCoach && (
        <ConfirmModal
          isOpen={accountClearConfirmOpen}
          onClose={() => setAccountClearConfirmOpen(false)}
          onConfirm={() => {
            setAccountClearConfirmOpen(false)
            void handleSetAccount('')
          }}
          title="清除帳號配對"
          message={`確定要清除「${selectedAccountCoach.name}」的帳號配對？該教練將與此登入帳號解除連結。`}
          confirmText="清除"
          cancelText="取消"
          variant="warning"
          isLoading={accountLoading}
        />
      )}

      {selectedPricingCoach && (
        <ConfirmModal
          isOpen={priceClearConfirmOpen}
          onClose={() => setPriceClearConfirmOpen(false)}
          onConfirm={() => {
            setPriceClearConfirmOpen(false)
            void saveDesignatedLessonPrice('')
          }}
          title="清除指定課價格"
          message={`確定要清除「${selectedPricingCoach.name}」的指定課價格？若未再設定，扣款時將不再自動帶入專屬單價。`}
          confirmText="清除"
          cancelText="取消"
          variant="warning"
          isLoading={pricingLoading}
        />
      )}

      {permissionMatrixConfirm && (
        <ConfirmModal
          isOpen
          onClose={() => {
            if (savingMatrixEmail) return
            setPermissionMatrixConfirm(null)
          }}
          onConfirm={() => {
            const a = permissionMatrixConfirm
            setPermissionMatrixConfirm(null)
            if (a.kind === 'removeLogin') void runRemoveFromLoginList(a.allowedUserId, a.email)
            else if (a.kind === 'removeView') void runRemoveViewUserRow(a.row)
            else void runDeleteMatrixRow(a.row)
          }}
          {...getPermissionMatrixConfirmCopy(permissionMatrixConfirm)}
          cancelText="取消"
          variant="danger"
          isLoading={
            !!permissionMatrixConfirm &&
            savingMatrixEmail === getPermissionMatrixConfirmEmail(permissionMatrixConfirm)
          }
        />
      )}

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
