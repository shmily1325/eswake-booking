import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { addDaysToDate, getLocalDateString, getWeekdayText } from '../../utils/date'
import { getEventStartDate, getEventDateLabel, parseForEdit, formatDateShort, computeDisplayDate } from '../../utils/announcement'
import { useAsyncOperation } from '../../hooks/useAsyncOperation'
import { validateRequired } from '../../utils/errorHandler'
import { useToast, ToastContainer } from '../../components/ui'
import { isAdmin } from '../../utils/auth'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getPageContentShellStyle,
  PAGE_MAX_WIDTHS,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const checkboxAccent = designSystem.colors.primary[500]

interface Announcement {
  id: number
  content: string
  display_date: string
  end_date: string | null
  show_one_day_early?: boolean | null
  created_at: string | null
}

type RestrictionScope = 'all' | 'coaches'

interface CoachOption {
  id: string
  name: string
}

function RestrictionScopePicker({
  scope,
  coachIds,
  coaches,
  isMobile,
  onScopeChange,
  onCoachIdsChange,
}: {
  scope: RestrictionScope
  coachIds: string[]
  coaches: CoachOption[]
  isMobile: boolean
  onScopeChange: (scope: RestrictionScope) => void
  onCoachIdsChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const selected = new Set(coachIds)
  const visibleCoaches = coaches.filter((coach) =>
    coach.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {([
          ['all', '全部預約'],
          ['coaches', '指定教練'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onScopeChange(value)}
            style={{
              ...getButtonStyle(scope === value ? 'primary' : 'outline', 'small', isMobile),
              minHeight: isMobile ? 42 : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === 'coaches' && (
        <div style={{
          padding: '10px',
          border: `1px solid ${designSystem.colors.border.light}`,
          borderRadius: designSystem.borderRadius.md,
          display: 'grid',
          gap: '8px',
        }}>
          {coaches.length > 8 && (
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜尋教練"
              style={getInputStyle(isMobile)}
            />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {visibleCoaches.map((coach) => {
              const active = selected.has(coach.id)
              return (
                <button
                  key={coach.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const next = new Set(coachIds)
                    if (active) next.delete(coach.id)
                    else next.add(coach.id)
                    onCoachIdsChange([...next])
                  }}
                  style={{
                    ...getButtonStyle(active ? 'primary' : 'outline', 'small', isMobile),
                    minHeight: isMobile ? 42 : undefined,
                  }}
                >
                  {coach.name}{active ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
          }}>
            <span>已選 {coachIds.length} 位</span>
            {coachIds.length > 0 && (
              <button
                type="button"
                onClick={() => onCoachIdsChange([])}
                style={getButtonStyle('ghost', 'small', isMobile)}
              >
                清除全部
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AnnouncementManagement() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !isAdmin(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])
  const [editingId, setEditingId] = useState<number | null>(null)
  const editRestrictionRequestRef = useRef(0)
  const [newContent, setNewContent] = useState('')
  const [newStartDate, setNewStartDate] = useState(getLocalDateString())
  const [newEndDate, setNewEndDate] = useState(getLocalDateString())
  const [newShowOneDayEarly, setNewShowOneDayEarly] = useState(false)
  const [showNewAdvanced, setShowNewAdvanced] = useState(false)
  const [showNewRestrictionCustom, setShowNewRestrictionCustom] = useState(false)
  // 預約限制（新增）
  const [newRestrictEnabled, setNewRestrictEnabled] = useState(false)
  const [newRestrictAllDay, setNewRestrictAllDay] = useState(true)
  const [newRestrictStartDate, setNewRestrictStartDate] = useState(newStartDate)
  const [newRestrictStartTime, setNewRestrictStartTime] = useState('13:00')
  const [newRestrictEndDate, setNewRestrictEndDate] = useState(newEndDate)
  const [newRestrictEndTime, setNewRestrictEndTime] = useState('14:00')
  const [newRestrictScope, setNewRestrictScope] = useState<RestrictionScope>('all')
  const [newRestrictedCoachIds, setNewRestrictedCoachIds] = useState<string[]>([])
  const [editContent, setEditContent] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editShowOneDayEarly, setEditShowOneDayEarly] = useState(false)
  // 預約限制（編輯）
  const [editRestrictEnabled, setEditRestrictEnabled] = useState(false)
  const [editRestrictAllDay, setEditRestrictAllDay] = useState(true)
  const [editRestrictStartDate, setEditRestrictStartDate] = useState('')
  const [editRestrictStartTime, setEditRestrictStartTime] = useState('13:00')
  const [editRestrictEndDate, setEditRestrictEndDate] = useState('')
  const [editRestrictEndTime, setEditRestrictEndTime] = useState('14:00')
  const [editRestrictScope, setEditRestrictScope] = useState<RestrictionScope>('all')
  const [editRestrictedCoachIds, setEditRestrictedCoachIds] = useState<string[]>([])
  const [editRestrictionLoading, setEditRestrictionLoading] = useState(false)
  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([])
  
  // 搜尋和過濾
  const [searchText, setSearchText] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // desc = 新→舊
  
  const { execute: executeAsync } = useAsyncOperation()
  
  // 月份篩選（格式：YYYY-MM）
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  // 限制資料快取（announcement_id -> restriction row）
  const [restrictionsMap, setRestrictionsMap] = useState<Record<number, {
    id: number
    start_date: string
    start_time: string | null
    end_date: string
    end_time: string | null
    is_active: boolean
    scope: RestrictionScope
    coach_ids: string[]
  }>>({})

  useEffect(() => {
    void supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('載入教練失敗:', error)
          return
        }
        setCoachOptions((data ?? []) as CoachOption[])
      })
  }, [])

  useEffect(() => {
    // 換月/換排序時先清空，避免新資料載入前畫面殘留前條件的清單
    setAnnouncements([])
    setRestrictionsMap({})
    loadAnnouncements()
  }, [selectedMonth, sortOrder])

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      // 計算選定月份的開始和結束日期
      const [year, month] = selectedMonth.split('-').map(Number)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      // 三個查詢條件互相獨立、合併後再去重排序，並行送出可節省兩輪 RTT
      const [result1, result2, result3] = await Promise.all([
        // 查詢 1：display_date 在選定月份內
        supabase
          .from('daily_announcements')
          .select('*')
          .gte('display_date', startDate)
          .lte('display_date', endDate)
          .order('display_date', { ascending: sortOrder === 'asc' })
          .order('created_at', { ascending: sortOrder === 'asc' }),
        // 查詢 2：display_date 在月初前，但 end_date 在選定月份內（提前顯示的公告）
        supabase
          .from('daily_announcements')
          .select('*')
          .lt('display_date', startDate)
          .gte('end_date', startDate)
          .lte('end_date', endDate)
          .order('display_date', { ascending: sortOrder === 'asc' })
          .order('created_at', { ascending: sortOrder === 'asc' }),
        // 查詢 3：橫跨整個月（display_date 在月初前，end_date 在月底後）
        supabase
          .from('daily_announcements')
          .select('*')
          .lt('display_date', startDate)
          .gt('end_date', endDate)
          .order('display_date', { ascending: sortOrder === 'asc' })
          .order('created_at', { ascending: sortOrder === 'asc' })
      ])

      const { data: data1 } = result1
      const { data: data2 } = result2
      const { data: data3 } = result3

      // 合併並去重（以 id 為準）
      const seen = new Set<number>()
      const merged = [...(data1 || []), ...(data2 || []), ...(data3 || [])]
        .filter((a: Announcement) => {
          if (seen.has(a.id)) return false
          seen.add(a.id)
          return true
        })
        .sort((a: Announcement, b: Announcement) => {
          const cmp = sortOrder === 'asc'
            ? a.display_date.localeCompare(b.display_date)
            : b.display_date.localeCompare(a.display_date)
          return cmp !== 0 ? cmp : (a.created_at || '').localeCompare(b.created_at || '')
        })

      setAnnouncements(merged as Announcement[])

      // 同步讀取限制（僅當前月的公告即可）
      const ids = (merged || []).map((a: any) => a.id)
      if (ids.length > 0) {
        const { data: rData } = await supabase
          .from('reservation_restrictions')
          .select('id, announcement_id, start_date, start_time, end_date, end_time, is_active, scope, reservation_restriction_coaches(coach_id)')
          .in('announcement_id', ids)
          .eq('is_active', true)
        const map: Record<number, any> = {}
        ;(rData || []).forEach((r: any) => {
          map[r.announcement_id] = {
            ...r,
            scope: r.scope === 'coaches' ? 'coaches' : 'all',
            coach_ids: (r.reservation_restriction_coaches ?? [])
              .map((item: any) => item.coach_id)
              .filter(Boolean),
          }
        })
        setRestrictionsMap(map)
      } else {
        setRestrictionsMap({})
      }
    } catch (error) {
      console.error('載入公告失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveRestriction = async (
    announcementId: number,
    input: {
      allDay: boolean
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      scope: RestrictionScope
      coachIds: string[]
    },
  ) => {
    const { error } = await supabase.rpc('save_reservation_restriction', {
      p_announcement_id: announcementId,
      p_start_date: input.startDate,
      p_start_time: input.allDay ? null : input.startTime,
      p_end_date: input.endDate,
      p_end_time: input.allDay ? null : input.endTime,
      p_scope: input.scope,
      p_coach_ids: input.scope === 'coaches' ? input.coachIds : [],
    })
    if (error) throw error
  }

  const confirmExistingAssignments = async (input: {
    allDay: boolean
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    scope: RestrictionScope
    coachIds: string[]
  }): Promise<boolean> => {
    if (input.scope !== 'coaches' || input.coachIds.length === 0) return true

    const rangeStart = new Date(`${input.startDate}T${input.allDay ? '00:00' : input.startTime}:00`)
    const rangeEnd = input.allDay
      ? new Date(`${input.endDate}T00:00:00`)
      : new Date(`${input.endDate}T${input.endTime}:00`)
    if (input.allDay) rangeEnd.setDate(rangeEnd.getDate() + 1)

    const [coachResult, driverResult] = await Promise.all([
      supabase
        .from('booking_coaches')
        .select('coach_id, coaches:coach_id(name), bookings!inner(id, contact_name, start_at, duration_min, status)')
        .in('coach_id', input.coachIds)
        .neq('bookings.status', 'cancelled')
        .gte('bookings.start_at', `${addDaysToDate(input.startDate, -1)}T00:00:00`)
        .lte('bookings.start_at', `${input.endDate}T23:59:59`),
      supabase
        .from('booking_drivers')
        .select('driver_id, coaches:driver_id(name), bookings!inner(id, contact_name, start_at, duration_min, status)')
        .in('driver_id', input.coachIds)
        .neq('bookings.status', 'cancelled')
        .gte('bookings.start_at', `${addDaysToDate(input.startDate, -1)}T00:00:00`)
        .lte('bookings.start_at', `${input.endDate}T23:59:59`),
    ])
    const queryError = coachResult.error || driverResult.error
    if (queryError) {
      console.error('檢查既有排班失敗:', queryError)
      toast.error('無法確認既有排班，請稍後再試')
      return false
    }

    const conflicts = new Map<string, string>()
    for (const row of [...(coachResult.data ?? []), ...(driverResult.data ?? [])] as any[]) {
      const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      if (!booking) continue
      const bookingStart = new Date(booking.start_at)
      const bookingEnd = new Date(bookingStart.getTime() + booking.duration_min * 60_000)
      if (bookingEnd <= rangeStart || bookingStart >= rangeEnd) continue
      const personName = row.coaches?.name || '人員'
      const key = `${booking.id}:${row.coach_id || row.driver_id}`
      conflicts.set(
        key,
        `${personName}｜${booking.start_at.slice(5, 16).replace('T', ' ')}｜${booking.contact_name}`,
      )
    }
    if (conflicts.size === 0) return true
    return window.confirm(
      `下列既有排班與限制時段重疊，儲存後會標示衝突，但不會自動移除：\n\n${[
        ...conflicts.values(),
      ].join('\n')}\n\n仍要儲存嗎？`,
    )
  }

  const handleAdd = async () => {
    if (!user) {
      toast.error('請先登入')
      return
    }
    const validation = validateRequired(newContent, '公告內容')
    if (!validation.valid) {
      toast.warning(validation.error || '請填寫公告內容')
      return
    }

    if (newEndDate < newStartDate) {
      toast.warning('結束日期不能早於開始日期')
      return
    }
    if (
      newRestrictEnabled &&
      newRestrictScope === 'coaches' &&
      newRestrictedCoachIds.length === 0
    ) {
      toast.warning('請至少選擇一位限制教練')
      return
    }
    if (
      newRestrictEnabled &&
      !newRestrictAllDay &&
      newRestrictStartDate === newRestrictEndDate &&
      newRestrictEndTime <= newRestrictStartTime
    ) {
      toast.warning('限制結束時間必須晚於開始時間')
      return
    }
    if (
      newRestrictEnabled &&
      !(await confirmExistingAssignments({
        allDay: newRestrictAllDay,
        startDate: newRestrictStartDate,
        startTime: newRestrictStartTime,
        endDate: newRestrictEndDate,
        endTime: newRestrictEndTime,
        scope: newRestrictScope,
        coachIds: newRestrictedCoachIds,
      }))
    ) {
      return
    }

    await executeAsync(
      async () => {
        const { data, error } = await supabase
          .from('daily_announcements')
          .insert({
            content: newContent.trim(),
            display_date: computeDisplayDate(newStartDate, newShowOneDayEarly),
            end_date: newEndDate,
            show_one_day_early: newShowOneDayEarly,
            created_by: user.id
          })
          .select()

        if (error) throw error

        // 若啟用預約限制，同步建立 restriction（與公告關聯）
        const inserted = Array.isArray(data) ? (data[0] as any) : null
        if (inserted && newRestrictEnabled) {
          try {
            await saveRestriction(inserted.id, {
              allDay: newRestrictAllDay,
              startDate: newRestrictStartDate,
              startTime: newRestrictStartTime,
              endDate: newRestrictEndDate,
              endTime: newRestrictEndTime,
              scope: newRestrictScope,
              coachIds: newRestrictedCoachIds,
            })
          } catch (restrictionError) {
            await supabase.from('daily_announcements').delete().eq('id', inserted.id)
            throw restrictionError
          }
        }
      },
      {
        successMessage: '新增成功',
        errorContext: '新增公告',
        onComplete: () => {
          setNewContent('')
          const today = getLocalDateString()
          setNewStartDate(today)
          setNewEndDate(today)
          setNewShowOneDayEarly(false)
          setShowNewAdvanced(false)
          setShowNewRestrictionCustom(false)
          // reset 限制欄位
          setNewRestrictEnabled(false)
          setNewRestrictAllDay(true)
          setNewRestrictScope('all')
          setNewRestrictedCoachIds([])
          setNewRestrictStartDate(today)
          setNewRestrictEndDate(today)
          loadAnnouncements()
        }
      }
    )
  }

  const handleEdit = async (id: number) => {
    if (editRestrictionLoading) {
      toast.info('限制設定仍在載入，請稍候')
      return
    }
    if (editEndDate < editStartDate) {
      toast.warning('結束日期不能早於開始日期')
      return
    }
    if (
      editRestrictEnabled &&
      editRestrictScope === 'coaches' &&
      editRestrictedCoachIds.length === 0
    ) {
      toast.warning('請至少選擇一位限制教練')
      return
    }
    if (
      editRestrictEnabled &&
      !editRestrictAllDay &&
      (editRestrictStartDate || editStartDate) === (editRestrictEndDate || editEndDate) &&
      editRestrictEndTime <= editRestrictStartTime
    ) {
      toast.warning('限制結束時間必須晚於開始時間')
      return
    }
    if (
      editRestrictEnabled &&
      !(await confirmExistingAssignments({
        allDay: editRestrictAllDay,
        startDate: editRestrictStartDate || editStartDate,
        startTime: editRestrictStartTime,
        endDate: editRestrictEndDate || editEndDate,
        endTime: editRestrictEndTime,
        scope: editRestrictScope,
        coachIds: editRestrictedCoachIds,
      }))
    ) {
      return
    }

    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .update({
            content: editContent.trim(),
            display_date: computeDisplayDate(editStartDate, editShowOneDayEarly),
            end_date: editEndDate,
            show_one_day_early: editShowOneDayEarly
          })
          .eq('id', id)

        if (error) throw error

        // 同步更新或刪除限制
        if (editRestrictEnabled) {
          await saveRestriction(id, {
            allDay: editRestrictAllDay,
            startDate: editRestrictStartDate || editStartDate,
            startTime: editRestrictStartTime,
            endDate: editRestrictEndDate || editEndDate,
            endTime: editRestrictEndTime,
            scope: editRestrictScope,
            coachIds: editRestrictedCoachIds,
          })
        } else {
          // 若關閉限制，直接刪除綁定
          await supabase
            .from('reservation_restrictions')
            .delete()
            .eq('announcement_id', id)
        }
      },
      {
        successMessage: '更新成功',
        errorContext: '更新公告',
        onComplete: () => {
          setEditingId(null)
          loadAnnouncements()
        }
      }
    )
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這則公告嗎？')) return

    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .delete()
          .eq('id', id)

        if (error) throw error
      },
      {
        successMessage: '刪除成功',
        errorContext: '刪除公告',
        onComplete: () => {
          loadAnnouncements()
        }
      }
    )
  }

  const startEdit = (announcement: Announcement) => {
    const requestId = ++editRestrictionRequestRef.current
    setEditingId(announcement.id)
    setEditContent(announcement.content)
    const { eventStartDate, eventEndDate, showOneDayEarly } = parseForEdit(announcement)
    setEditStartDate(eventStartDate)
    setEditEndDate(eventEndDate)
    setEditShowOneDayEarly(showOneDayEarly)
    setEditRestrictEnabled(false)
    setEditRestrictAllDay(true)
    setEditRestrictStartDate(eventStartDate)
    setEditRestrictStartTime('13:00')
    setEditRestrictEndDate(eventEndDate)
    setEditRestrictEndTime('14:00')
    setEditRestrictScope('all')
    setEditRestrictedCoachIds([])
    setEditRestrictionLoading(true)
    // 載入限制（若有）
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('reservation_restrictions')
          .select('*, reservation_restriction_coaches(coach_id)')
          .eq('announcement_id', announcement.id)
          .limit(1)
          .maybeSingle()
        if (requestId !== editRestrictionRequestRef.current) return
        if (error) {
          toast.error('載入限制設定失敗')
          return
        }
        if (data) {
          setEditRestrictEnabled(true)
          setEditRestrictAllDay(!data.start_time && !data.end_time)
          setEditRestrictStartDate(data.start_date)
          setEditRestrictStartTime(data.start_time || '00:00')
          setEditRestrictEndDate(data.end_date)
          setEditRestrictEndTime(data.end_time || '23:59')
          setEditRestrictScope(data.scope === 'coaches' ? 'coaches' : 'all')
          setEditRestrictedCoachIds(
            ((data as any).reservation_restriction_coaches ?? [])
              .map((item: any) => item.coach_id)
              .filter(Boolean),
          )
        }
      } finally {
        if (requestId === editRestrictionRequestRef.current) {
          setEditRestrictionLoading(false)
        }
      }
    })()
  }

  const cancelEdit = () => {
    editRestrictionRequestRef.current += 1
    setEditRestrictionLoading(false)
    setEditingId(null)
  }

  // 按事項開始日分組
  const groupAnnouncementsByDate = (announcements: Announcement[]) => {
    const grouped = new Map<string, Announcement[]>()
    
    announcements.forEach(announcement => {
      const date = getEventStartDate(announcement)
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(announcement)
    })

    // 轉換為數組並排序日期
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
      return sortOrder === 'desc' 
        ? b[0].localeCompare(a[0])  // 新→舊
        : a[0].localeCompare(b[0])  // 舊→新
    })

    return sortedGroups
  }

  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${year}/${parseInt(month)}/${parseInt(day)}`
  }

  const getAnnouncementDateLabel = (a: Announcement) => {
    const label = getEventDateLabel(a)
    if (!label) return { text: `單日 ${formatDateShort(a.display_date)}`, isRange: false }
    const isRange = label.includes(' - ')
    return { text: isRange ? label : `單日 ${label}`, isRange }
  }

  // 格式化限制小字
  const formatRestrictionNote = (todayStr: string, r: {
    start_date: string
    start_time: string | null
    end_date: string
    end_time: string | null
    scope?: RestrictionScope
    coach_ids?: string[]
  }): string => {
    const sameDay = r.start_date === r.end_date
    const fmtDate = (d: string) => {
      const [, m, dd] = d.split('-')
      return `${parseInt(m)}/${parseInt(dd)}`
    }
    const fmtTime = (t: string | null, fallback: string) => {
      if (!t) return fallback
      const [h, m] = t.split(':')
      return `${parseInt(h)}:${m}`
    }
    let period: string
    if (!sameDay) {
      const left = `${fmtDate(r.start_date)} ${fmtTime(r.start_time, '0:00')}`
      const right = `${fmtDate(r.end_date)} ${fmtTime(r.end_time, '23:59')}`
      period = `${left} – ${right}`
    } else if (todayStr === r.start_date) {
      period = !r.start_time && !r.end_time
        ? '全天'
        : `${fmtTime(r.start_time, '0:00')}–${fmtTime(r.end_time, '23:59')}`
    } else {
      period = !r.start_time && !r.end_time
        ? `${fmtDate(r.start_date)} 全天`
        : `${fmtDate(r.start_date)} ${fmtTime(r.start_time, '0:00')}–${fmtTime(r.end_time, '23:59')}`
    }
    if (r.scope === 'coaches') {
      const selected = new Set(r.coach_ids ?? [])
      const names = coachOptions
        .filter((coach) => selected.has(coach.id))
        .map((coach) => coach.name)
      return `${period} 限制教練：${names.join('、') || '未指定'}`
    }
    return `${period} 不約船`
  }

  return (
    <div style={{
      padding: isMobile ? '12px 16px' : '20px',
      minHeight: '100dvh',
      background: pageBg,
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    }}>
      <div style={getPageContentShellStyle(isMobile, PAGE_MAX_WIDTHS.focused)}>
        <PageHeader title="公告" user={user} showBaoLink={isAdmin(user)} />

        {/* 新增表單 */}
        <div style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          padding: isMobile ? '16px' : '20px',
          marginBottom: designSystem.spacing.lg,
          border: cardBorder,
          boxShadow: cardShadow,
          overflow: 'visible',
        }}>
          <h2 style={{
            margin: `0 0 ${designSystem.spacing.md}`,
            fontSize: getFontSize('h3', isMobile),
            fontWeight: 600,
            color: designSystem.colors.text.primary,
          }}>
            新增公告
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.secondary,
              marginBottom: '6px',
              fontWeight: '500',
            }}>
              公告內容
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="輸入公告內容..."
              rows={3}
              style={{
                ...getInputStyle(isMobile),
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.secondary,
              marginBottom: '8px',
              fontWeight: '500',
            }}>
              顯示日期
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '1fr'
                  : showNewAdvanced
                    ? 'minmax(0, 1fr) auto minmax(0, 1fr)'
                    : 'minmax(0, 1fr) auto',
                alignItems: 'end',
                gap: '8px',
              }}
            >
              <label style={{ display: 'grid', gap: isMobile ? '5px' : 0, minWidth: 0 }}>
                {isMobile && (
                  <span style={{ fontSize: getFontSize('bodySmall', true), color: designSystem.colors.text.secondary }}>
                    {showNewAdvanced ? '開始日期' : '日期'}
                  </span>
                )}
                <input
                  type="date"
                  data-track="announcement_start_date"
                  value={newStartDate}
                  onChange={(e) => {
                    setNewStartDate(e.target.value)
                    if (!showNewAdvanced || e.target.value > newEndDate) setNewEndDate(e.target.value)
                    if (newRestrictEnabled && !showNewRestrictionCustom) {
                      setNewRestrictStartDate(e.target.value)
                      setNewRestrictEndDate(e.target.value)
                    }
                  }}
                  style={{ ...getInputStyle(isMobile), minWidth: 0, width: '100%' }}
                />
              </label>
              {showNewAdvanced && !isMobile && (
                <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('body', false), paddingBottom: 13 }}>
                  ～
                </span>
              )}
              {showNewAdvanced && (
                <label style={{ display: 'grid', gap: isMobile ? '5px' : 0, minWidth: 0 }}>
                {isMobile && (
                  <span style={{ fontSize: getFontSize('bodySmall', true), color: designSystem.colors.text.secondary }}>
                    結束日期
                  </span>
                )}
                <input
                  type="date"
                  data-track="announcement_end_date"
                  value={newEndDate}
                  onChange={(e) => {
                    setNewEndDate(e.target.value)
                    if (newRestrictEnabled && !showNewRestrictionCustom) {
                      setNewRestrictEndDate(e.target.value)
                    }
                  }}
                  min={newStartDate}
                  style={{ ...getInputStyle(isMobile), minWidth: 0, width: '100%' }}
                />
              </label>
              )}
              <span style={{
                gridColumn: showNewAdvanced || isMobile ? '1 / -1' : undefined,
                width: showNewAdvanced || isMobile ? '100%' : 'auto',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: designSystem.borderRadius.md,
                background: designSystem.colors.background.main,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textAlign: showNewAdvanced ? 'center' : 'left',
              }}>
                {newStartDate === newEndDate 
                  ? getWeekdayText(newStartDate)
                  : `${getWeekdayText(newStartDate)} ~ ${getWeekdayText(newEndDate)}`
                }
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: getFontSize('body', isMobile),
              color: designSystem.colors.text.secondary,
              padding: isMobile ? '8px 0' : 0,
              minHeight: isMobile ? 44 : undefined
            }}>
              <input
                type="checkbox"
                data-track="announcement_one_day_early"
                checked={newShowOneDayEarly}
                onChange={(e) => setNewShowOneDayEarly(e.target.checked)}
                style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0, accentColor: checkboxAccent }}
              />
              <span>提前一天顯示</span>
            </label>
          </div>

          <button
            type="button"
            data-track="announcement_advanced_toggle"
            aria-expanded={showNewAdvanced}
            onClick={() => setShowNewAdvanced((current) => !current)}
            style={{
              ...getButtonStyle('outline', 'small', isMobile),
              width: isMobile ? '100%' : 'auto',
              marginBottom: showNewAdvanced ? '12px' : '16px',
            }}
          >
            {showNewAdvanced
              ? '收起更多設定'
              : newEndDate !== newStartDate || newRestrictEnabled
                ? '更多設定（已設定）'
                : '更多設定'}
          </button>

          {showNewAdvanced && (
            <>
          {/* 預約限制（簡易） */}
          <div style={{ marginBottom: '12px', borderTop: `1px dashed ${designSystem.colors.border.light}`, paddingTop: '12px' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: getFontSize('body', isMobile),
                color: designSystem.colors.text.primary,
                padding: isMobile ? '8px 0' : 0,
                minHeight: isMobile ? 44 : undefined,
                fontWeight: 600
              }}>
                <input
                  type="checkbox"
                  data-track="announcement_restriction_toggle"
                  checked={newRestrictEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    setNewRestrictEnabled(enabled)
                    setShowNewRestrictionCustom(false)
                    if (enabled) {
                      // 預設直接帶入公告日期
                      setNewRestrictStartDate(newStartDate)
                      setNewRestrictEndDate(newEndDate)
                    }
                  }}
                  style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0, accentColor: checkboxAccent }}
                />
                <span>啟用預約限制</span>
              </label>
            </div>

            {newRestrictEnabled && (
              <div style={{ marginTop: '8px' }}>
                <RestrictionScopePicker
                  scope={newRestrictScope}
                  coachIds={newRestrictedCoachIds}
                  coaches={coachOptions}
                  isMobile={isMobile}
                  onScopeChange={setNewRestrictScope}
                  onCoachIdsChange={setNewRestrictedCoachIds}
                />
              </div>
            )}

            {newRestrictEnabled && (
              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px',
                background: designSystem.colors.background.main,
                borderRadius: designSystem.borderRadius.md,
              }}>
                <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                  {newRestrictAllDay ? '全天' : '指定時段'} · {newRestrictStartDate}
                  {newRestrictStartDate !== newRestrictEndDate ? ` ～ ${newRestrictEndDate}` : ''}
                </span>
                <button
                  type="button"
                  data-track="announcement_restriction_custom_toggle"
                  onClick={() => setShowNewRestrictionCustom((current) => !current)}
                  style={getButtonStyle('outline', 'small', isMobile)}
                >
                  {showNewRestrictionCustom ? '收起自訂時段' : '自訂限制時段'}
                </button>
              </div>
            )}

            {newRestrictEnabled && showNewRestrictionCustom && (
              <div style={{ marginTop: '8px', display: 'grid', gap: '10px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : newRestrictAllDay
                      ? 'minmax(0, 1fr) auto minmax(0, 1fr)'
                      : 'minmax(0, 1fr) 120px auto minmax(0, 1fr) 120px',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <input
                    type="date"
                    value={newRestrictStartDate}
                    onChange={(e) => {
                      setNewRestrictStartDate(e.target.value)
                      if (e.target.value > newRestrictEndDate) setNewRestrictEndDate(e.target.value)
                    }}
                    style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                  />
                  {!newRestrictAllDay && (
                    <input
                      type="time"
                      value={newRestrictStartTime}
                      onChange={(e) => setNewRestrictStartTime(e.target.value)}
                      style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                    />
                  )}
                  {!isMobile && (
                    <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('body', false) }}>～</span>
                  )}
                  <input
                    type="date"
                    value={newRestrictEndDate}
                    onChange={(e) => setNewRestrictEndDate(e.target.value)}
                    min={newRestrictStartDate}
                    style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                  />
                  {!newRestrictAllDay && (
                    <input
                      type="time"
                      value={newRestrictEndTime}
                      onChange={(e) => setNewRestrictEndTime(e.target.value)}
                      style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: getFontSize('body', isMobile),
                    color: designSystem.colors.text.secondary,
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={newRestrictAllDay}
                      onChange={(e) => setNewRestrictAllDay(e.target.checked)}
                      style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', accentColor: checkboxAccent }}
                    />
                    <span>全天</span>
                  </label>
                </div>

                {/* 即時摘要 */}
                <div style={{ width: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere', background: designSystem.colors.background.main, color: designSystem.colors.text.primary, padding: '8px 10px', borderRadius: designSystem.borderRadius.md, fontSize: getFontSize('bodySmall', isMobile) }}>
                  限制時段：{newRestrictStartDate}
                  {!newRestrictAllDay && ` ${newRestrictStartTime}`} ～ {newRestrictEndDate}
                  {!newRestrictAllDay && ` ${newRestrictEndTime}`}{newRestrictAllDay && ' 全天'}
                </div>
              </div>
            )}
          </div>

            </>
          )}

          <button
            data-track="announcement_add"
            onClick={handleAdd}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              width: '100%',
              minHeight: isMobile ? 48 : undefined,
            }}
          >
            建立公告
          </button>
        </div>

        {/* 列表 */}
        <div style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          padding: isMobile ? '16px' : '20px',
          border: cardBorder,
          boxShadow: cardShadow,
          minHeight: '200px',
          overflow: 'visible',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(160px, 220px)',
            alignItems: isMobile ? 'stretch' : 'center',
            marginBottom: designSystem.spacing.md,
            gap: '8px',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: getFontSize('h3', isMobile),
              fontWeight: '600',
              color: designSystem.colors.text.primary,
              flexShrink: 0,
            }}>
              公告列表 ({announcements.filter(a =>
                searchText ? a.content.toLowerCase().includes(searchText.toLowerCase()) : true
              ).length})
            </h2>
            <input
              type="month"
              data-track="announcement_month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                minWidth: 0,
                ...getInputStyle(isMobile),
                width: '100%',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* 搜尋和排序控制 */}
          <div style={{
            marginBottom: designSystem.spacing.md,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr) auto' : 'minmax(200px, 1fr) auto',
            gap: '10px',
          }}>
            {/* 搜尋框 */}
            <div style={{ minWidth: 0 }}>
              <input
                type="text"
                placeholder="搜尋內容..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  ...getInputStyle(isMobile),
                }}
              />
            </div>

            {/* 排序按鈕 */}
            <button
              data-track="announcement_sort"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={{
                ...getButtonStyle('secondary', 'medium', isMobile),
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              {sortOrder === 'desc' ? '新→舊' : '舊→新'}
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary, fontSize: getFontSize('body', isMobile) }}>
              載入中...
            </div>
          )}

          {!loading && announcements.length === 0 && !searchText && (
            <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled, fontSize: getFontSize('body', isMobile) }}>
              目前沒有公告
            </div>
          )}

          {!loading && searchText && announcements.filter(a => 
            a.content.toLowerCase().includes(searchText.toLowerCase())
          ).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled, fontSize: getFontSize('body', isMobile) }}>
              沒有符合「{searchText}」的搜尋結果
            </div>
          )}

          {!loading && (() => {
            const filtered = announcements.filter(announcement => 
              searchText ? announcement.content.toLowerCase().includes(searchText.toLowerCase()) : true
            )
            const grouped = groupAnnouncementsByDate(filtered)

            return grouped.map(([date, dateAnnouncements]) => (
              <div key={date} style={{ marginBottom: '24px' }}>
                {/* 日期標題 */}
                <div style={{
                  padding: isMobile ? '10px 14px' : '8px 12px',
                  background: designSystem.colors.background.main,
                  borderRadius: designSystem.borderRadius.md,
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    fontSize: getFontSize('body', isMobile),
                    fontWeight: '600',
                    color: designSystem.colors.text.secondary,
                  }}>
                    {formatDateHeader(date)}
                  </span>
                  <span style={{
                    fontSize: getFontSize('bodySmall', isMobile),
                    color: designSystem.colors.text.disabled,
                  }}>
                    ({dateAnnouncements.length} 條)
                  </span>
                </div>

                {/* 該日期的所有事項 */}
                {dateAnnouncements.map((announcement) => {
                  const dateLabel = getAnnouncementDateLabel(announcement)
                  return (
                  <div
                    key={announcement.id}
                    style={{
                      padding: isMobile ? '16px' : '12px',
                      background: designSystem.colors.background.main,
                      borderRadius: designSystem.borderRadius.md,
                      marginBottom: '8px',
                      border: cardBorder,
                    }}
                  >
                    {editingId === announcement.id ? (
                      // 編輯模式
                      <>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          style={{
                            ...getInputStyle(isMobile),
                            marginBottom: '10px',
                            fontFamily: 'inherit',
                          }}
                        />
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: '6px' }}>事項日期</div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
                              alignItems: 'end',
                              gap: '8px',
                            }}
                          >
                            <label style={{ display: 'grid', gap: isMobile ? '5px' : 0, minWidth: 0 }}>
                              {isMobile && (
                                <span style={{ fontSize: getFontSize('bodySmall', true), color: designSystem.colors.text.secondary }}>
                                  開始日期
                                </span>
                              )}
                              <input
                                type="date"
                                data-track="announcement_edit_start_date"
                                value={editStartDate}
                                onChange={(e) => {
                                  setEditStartDate(e.target.value)
                                  if (e.target.value > editEndDate) setEditEndDate(e.target.value)
                                }}
                                style={{ ...getInputStyle(isMobile), minWidth: 0, width: '100%' }}
                              />
                            </label>
                            {!isMobile && (
                              <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('body', false), paddingBottom: 13 }}>
                                ～
                              </span>
                            )}
                            <label style={{ display: 'grid', gap: isMobile ? '5px' : 0, minWidth: 0 }}>
                              {isMobile && (
                                <span style={{ fontSize: getFontSize('bodySmall', true), color: designSystem.colors.text.secondary }}>
                                  結束日期
                                </span>
                              )}
                              <input
                                type="date"
                                data-track="announcement_edit_end_date"
                                value={editEndDate}
                                onChange={(e) => setEditEndDate(e.target.value)}
                                min={editStartDate}
                                style={{ ...getInputStyle(isMobile), minWidth: 0, width: '100%' }}
                              />
                            </label>
                            <span style={{
                              gridColumn: '1 / -1',
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '8px 12px',
                              borderRadius: designSystem.borderRadius.md,
                              background: designSystem.colors.background.card,
                              color: designSystem.colors.text.secondary,
                              fontSize: getFontSize('bodySmall', isMobile),
                              fontWeight: 600,
                              textAlign: isMobile ? 'left' : 'center',
                            }}>
                              {editStartDate === editEndDate
                                ? getWeekdayText(editStartDate)
                                : `${getWeekdayText(editStartDate)} ~ ${getWeekdayText(editEndDate)}`}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.secondary,
                            padding: isMobile ? '8px 0' : 0,
                            minHeight: isMobile ? 44 : undefined
                          }}>
                            <input
                              type="checkbox"
                              checked={editShowOneDayEarly}
                              onChange={(e) => setEditShowOneDayEarly(e.target.checked)}
                              style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0, accentColor: checkboxAccent }}
                            />
                            <span>提前一天顯示</span>
                          </label>
                        </div>
                        <details
                          open={editRestrictEnabled ? true : undefined}
                          style={{ marginBottom: '10px' }}
                        >
                          <summary
                            style={{
                              cursor: 'pointer',
                              fontSize: getFontSize('bodySmall', isMobile),
                              fontWeight: 600,
                              color: designSystem.colors.text.secondary,
                              padding: '8px 0',
                            }}
                          >
                            預約限制
                          </summary>
                        {/* 預約限制（編輯） */}
                        <div style={{ marginBottom: '10px', borderTop: `1px dashed ${designSystem.colors.border.light}`, paddingTop: '10px' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.primary,
                            fontWeight: 600
                          }}>
                            <input
                              type="checkbox"
                              checked={editRestrictEnabled}
                              onChange={(e) => setEditRestrictEnabled(e.target.checked)}
                              style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0, accentColor: checkboxAccent }}
                            />
                            <span>啟用預約限制</span>
                          </label>
                          {editRestrictEnabled && (
                            <div style={{ marginTop: '8px', display: 'grid', gap: '10px' }}>
                              <RestrictionScopePicker
                                scope={editRestrictScope}
                                coachIds={editRestrictedCoachIds}
                                coaches={coachOptions}
                                isMobile={isMobile}
                                onScopeChange={setEditRestrictScope}
                                onCoachIdsChange={setEditRestrictedCoachIds}
                              />
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile
                                  ? '1fr'
                                  : editRestrictAllDay
                                    ? 'minmax(0, 1fr) auto minmax(0, 1fr)'
                                    : 'minmax(0, 1fr) 120px auto minmax(0, 1fr) 120px',
                                alignItems: 'center',
                                gap: '8px',
                              }}>
                                <input
                                  type="date"
                                  value={editRestrictStartDate || editStartDate}
                                  onChange={(e) => setEditRestrictStartDate(e.target.value)}
                                  style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                                />
                                {!editRestrictAllDay && (
                                  <input
                                    type="time"
                                    value={editRestrictStartTime}
                                    onChange={(e) => setEditRestrictStartTime(e.target.value)}
                                    style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                                  />
                                )}
                                {!isMobile && (
                                  <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('body', false) }}>～</span>
                                )}
                                <input
                                  type="date"
                                  value={editRestrictEndDate || editEndDate}
                                  onChange={(e) => setEditRestrictEndDate(e.target.value)}
                                  style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                                />
                                {!editRestrictAllDay && (
                                  <input
                                    type="time"
                                    value={editRestrictEndTime}
                                    onChange={(e) => setEditRestrictEndTime(e.target.value)}
                                    style={{ ...getInputStyle(isMobile), width: '100%', minWidth: 0 }}
                                  />
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.secondary, whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={editRestrictAllDay}
                                    onChange={(e) => setEditRestrictAllDay(e.target.checked)}
                                    style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', accentColor: checkboxAccent }}
                                  />
                                  <span>全天</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                        </details>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            data-track="announcement_edit"
                            onClick={() => handleEdit(announcement.id)}
                            disabled={editRestrictionLoading}
                            style={{
                              ...getButtonStyle('primary', 'medium', isMobile),
                              flex: 1,
                              minHeight: isMobile ? 44 : undefined,
                              opacity: editRestrictionLoading ? 0.6 : 1,
                            }}
                          >
                            {editRestrictionLoading ? '載入限制中…' : '儲存'}
                          </button>
                          <button
                            data-track="announcement_edit_cancel"
                            onClick={cancelEdit}
                            style={{
                              ...getButtonStyle('secondary', 'medium', isMobile),
                              flex: 1,
                              minHeight: isMobile ? 44 : undefined,
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      // 顯示模式
                      <>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          justifyContent: 'space-between',
                          alignItems: isMobile ? 'stretch' : 'start',
                          gap: isMobile ? '10px' : '12px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {dateLabel.isRange && (
                              <div style={{
                                fontSize: getFontSize('caption', isMobile),
                                color: designSystem.colors.text.secondary,
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <span style={{
                                  padding: isMobile ? '3px 8px' : '2px 8px',
                                  borderRadius: '4px',
                                  background: designSystem.colors.info[50],
                                  color: designSystem.colors.info[700],
                                  fontWeight: '500'
                                }}>
                                  {dateLabel.text}
                                </span>
                              </div>
                            )}
                            <div style={{ 
                              fontSize: getFontSize('body', isMobile),
                              color: designSystem.colors.text.primary,
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              display: 'block',
                            }}>
                              <span style={{ display: 'block' }}>{announcement.content}</span>
                              {/* 若此公告有啟用中的限制，顯示小字 */}
                              {restrictionsMap[announcement.id] && (
                                <span style={{
                                  display: 'block',
                                  marginTop: '6px',
                                  fontSize: getFontSize('bodySmall', isMobile),
                                  color: designSystem.colors.text.secondary,
                                }}>
                                  {formatRestrictionNote(getLocalDateString(), restrictionsMap[announcement.id])}
                                </span>
                              )}
                              {parseForEdit(announcement).showOneDayEarly && (
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: '6px',
                                  fontSize: getFontSize('bodySmall', isMobile),
                                  padding: isMobile ? '3px 8px' : '2px 6px',
                                  borderRadius: '3px',
                                  background: designSystem.colors.warning[50],
                                  color: designSystem.colors.warning[700],
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}>
                                  [提前一天顯示]
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            alignSelf: isMobile ? 'stretch' : 'flex-end',
                            width: isMobile ? '100%' : undefined,
                            gap: '8px', 
                            flexWrap: 'nowrap',
                            flexShrink: 0
                          }}>
                            <button
                              data-track="announcement_edit"
                              onClick={() => startEdit(announcement)}
                              style={{
                                ...getButtonStyle('secondary', 'small', isMobile),
                                minHeight: isMobile ? 44 : undefined,
                                flex: isMobile ? 1 : undefined,
                              }}
                            >
                              編輯
                            </button>
                            <button
                              data-track="announcement_delete"
                              onClick={() => handleDelete(announcement.id)}
                              style={{
                                ...getButtonStyle('outline', 'small', isMobile),
                                color: designSystem.colors.danger[500],
                                borderColor: designSystem.colors.danger[500],
                                minHeight: isMobile ? 44 : undefined,
                                flex: isMobile ? 1 : undefined,
                              }}
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>

        {/* Footer */}
        <Footer />
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
