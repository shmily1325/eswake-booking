import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { getEventStartDate, getEventDateLabel, parseForEdit, formatDateShort, computeDisplayDate } from '../../utils/announcement'
import { useAsyncOperation } from '../../hooks/useAsyncOperation'
import { validateRequired } from '../../utils/errorHandler'
import { useToast, ToastContainer } from '../../components/ui'
import { isAdmin } from '../../utils/auth'

interface Announcement {
  id: number
  content: string
  display_date: string
  end_date: string | null
  show_one_day_early?: boolean | null
  created_at: string | null
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
  const [newContent, setNewContent] = useState('')
  const [newStartDate, setNewStartDate] = useState(getLocalDateString())
  const [newEndDate, setNewEndDate] = useState(getLocalDateString())
  const [newShowOneDayEarly, setNewShowOneDayEarly] = useState(false)
  // 預約限制（新增）
  const [newRestrictEnabled, setNewRestrictEnabled] = useState(false)
  const [newRestrictAllDay, setNewRestrictAllDay] = useState(true)
  const [newRestrictStartDate, setNewRestrictStartDate] = useState(getLocalDateString())
  const [newRestrictStartTime, setNewRestrictStartTime] = useState('13:00')
  const [newRestrictEndDate, setNewRestrictEndDate] = useState(getLocalDateString())
  const [newRestrictEndTime, setNewRestrictEndTime] = useState('14:00')
  // 受影響清單（新增表單用試算）
  const [impactLoading, setImpactLoading] = useState(false)
  const [impactedBookings, setImpactedBookings] = useState<Array<{
    id: number
    start_at: string
    duration_min: number
    contact_name: string
    boat_name?: string
    coach_names?: string
  }>>([])
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
  
  // 搜尋和過濾
  const [searchText, setSearchText] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // desc = 新→舊
  
  const { execute: executeAsync } = useAsyncOperation()
  
  // 月份篩選（格式：YYYY-MM）
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  useEffect(() => {
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
      
      // 查詢 1：display_date 在選定月份內
      const { data: data1 } = await supabase
        .from('daily_announcements')
        .select('*')
        .gte('display_date', startDate)
        .lte('display_date', endDate)
        .order('display_date', { ascending: sortOrder === 'asc' })
        .order('created_at', { ascending: sortOrder === 'asc' })

      // 查詢 2：display_date 在月初前，但 end_date 在選定月份內（提前顯示的公告）
      const { data: data2 } = await supabase
        .from('daily_announcements')
        .select('*')
        .lt('display_date', startDate)
        .gte('end_date', startDate)
        .lte('end_date', endDate)
        .order('display_date', { ascending: sortOrder === 'asc' })
        .order('created_at', { ascending: sortOrder === 'asc' })

      // 查詢 3：橫跨整個月（display_date 在月初前，end_date 在月底後）
      const { data: data3 } = await supabase
        .from('daily_announcements')
        .select('*')
        .lt('display_date', startDate)
        .gt('end_date', endDate)
        .order('display_date', { ascending: sortOrder === 'asc' })
        .order('created_at', { ascending: sortOrder === 'asc' })

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
    } catch (error) {
      console.error('載入公告失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!user) {
      toast.error('請先登入')
      return
    }
    const validation = validateRequired(newContent, '交辦事項內容')
    if (!validation.valid) {
      toast.warning(validation.error || '請填寫交辦事項內容')
      return
    }

    if (newEndDate < newStartDate) {
      toast.warning('結束日期不能早於開始日期')
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
          const { error: rerr } = await supabase
            .from('reservation_restrictions')
            .upsert({
              announcement_id: inserted.id,
              start_date: newRestrictStartDate,
              start_time: newRestrictAllDay ? null : newRestrictStartTime,
              end_date: newRestrictEndDate,
              end_time: newRestrictAllDay ? null : newRestrictEndTime,
              is_active: true
            }, { onConflict: 'announcement_id' })
          if (rerr) throw rerr
        }
      },
      {
        successMessage: '新增成功',
        errorContext: '新增交辦事項',
        onComplete: () => {
          setNewContent('')
          const today = getLocalDateString()
          setNewStartDate(today)
          setNewEndDate(today)
          setNewShowOneDayEarly(false)
          // reset 限制欄位
          setNewRestrictEnabled(false)
          setNewRestrictAllDay(true)
          setNewRestrictStartDate(today)
          setNewRestrictEndDate(today)
          loadAnnouncements()
        }
      }
    )
  }

  const handleEdit = async (id: number) => {
    if (editEndDate < editStartDate) {
      toast.warning('結束日期不能早於開始日期')
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
          const { error: rerr } = await supabase
            .from('reservation_restrictions')
            .upsert({
              announcement_id: id,
              start_date: editRestrictStartDate || editStartDate,
              start_time: editRestrictAllDay ? null : editRestrictStartTime,
              end_date: editRestrictEndDate || editEndDate,
              end_time: editRestrictAllDay ? null : editRestrictEndTime,
              is_active: true
            }, { onConflict: 'announcement_id' })
          if (rerr) throw rerr
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
        errorContext: '更新交辦事項',
        onComplete: () => {
          setEditingId(null)
          loadAnnouncements()
        }
      }
    )
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這個交辦事項嗎？')) return

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
        errorContext: '刪除交辦事項',
        onComplete: () => {
          loadAnnouncements()
        }
      }
    )
  }

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setEditContent(announcement.content)
    const { eventStartDate, eventEndDate, showOneDayEarly } = parseForEdit(announcement)
    setEditStartDate(eventStartDate)
    setEditEndDate(eventEndDate)
    setEditShowOneDayEarly(showOneDayEarly)
    // 載入限制（若有）
    ;(async () => {
      const { data } = await supabase
        .from('reservation_restrictions')
        .select('*')
        .eq('announcement_id', announcement.id)
        .limit(1)
        .maybeSingle()
      if (data) {
        setEditRestrictEnabled(true)
        setEditRestrictAllDay(!data.start_time && !data.end_time)
        setEditRestrictStartDate(data.start_date)
        setEditRestrictStartTime(data.start_time || '00:00')
        setEditRestrictEndDate(data.end_date)
        setEditRestrictEndTime(data.end_time || '23:59')
      } else {
        setEditRestrictEnabled(false)
        setEditRestrictAllDay(true)
        setEditRestrictStartDate(eventStartDate)
        setEditRestrictStartTime('13:00')
        setEditRestrictEndDate(eventEndDate)
        setEditRestrictEndTime('14:00')
      }
    })()
  }

  const cancelEdit = () => setEditingId(null)

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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: isMobile ? '16px' : '20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PageHeader title="📢 公告" user={user} showBaoLink={true} />

        {/* 新增表單 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: '#666',
              marginBottom: '6px',
              fontWeight: '500'
            }}>
              內容
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="輸入交辦事項..."
              rows={3}
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: isMobile ? '16px' : '14px',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: '#666',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              事項日期
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => {
                  setNewStartDate(e.target.value)
                  if (e.target.value > newEndDate) setNewEndDate(e.target.value)
                }}
                style={{
                  flex: '1 1 120px',
                  minWidth: 0,
                  padding: isMobile ? '12px' : '10px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ color: '#999', fontSize: '14px', flexShrink: 0 }}>～</span>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={newStartDate}
                style={{
                  flex: '1 1 120px',
                  minWidth: 0,
                  padding: isMobile ? '12px' : '10px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#5a5a5a',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                {newStartDate === newEndDate 
                  ? getWeekdayText(newStartDate)
                  : `${getWeekdayText(newStartDate)} ~ ${getWeekdayText(newEndDate)}`
                }
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '14px',
              color: '#555',
              padding: isMobile ? '8px 0' : 0,
              minHeight: isMobile ? 44 : undefined
            }}>
              <input
                type="checkbox"
                checked={newShowOneDayEarly}
                onChange={(e) => setNewShowOneDayEarly(e.target.checked)}
                style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0 }}
              />
              <span>提前一天顯示</span>
            </label>
          </div>

          {/* 預約限制（簡易） */}
          <div style={{ marginBottom: '12px', borderTop: '1px dashed #eee', paddingTop: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '14px',
              color: '#333',
              padding: isMobile ? '8px 0' : 0,
              minHeight: isMobile ? 44 : undefined,
              fontWeight: 600
            }}>
              <input
                type="checkbox"
                checked={newRestrictEnabled}
                onChange={(e) => setNewRestrictEnabled(e.target.checked)}
                style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0 }}
              />
              <span>啟用預約限制（與公告內容一起顯示）</span>
            </label>

            {newRestrictEnabled && (
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={newRestrictStartDate}
                    onChange={(e) => {
                      setNewRestrictStartDate(e.target.value)
                      if (e.target.value > newRestrictEndDate) setNewRestrictEndDate(e.target.value)
                    }}
                    style={{ flex: '1 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                  />
                  {!newRestrictAllDay && (
                    <input
                      type="time"
                      value={newRestrictStartTime}
                      onChange={(e) => setNewRestrictStartTime(e.target.value)}
                      style={{ flex: '0 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                    />
                  )}
                  <span style={{ color: '#999', fontSize: '14px', flexShrink: 0 }}>～</span>
                  <input
                    type="date"
                    value={newRestrictEndDate}
                    onChange={(e) => setNewRestrictEndDate(e.target.value)}
                    min={newRestrictStartDate}
                    style={{ flex: '1 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                  />
                  {!newRestrictAllDay && (
                    <input
                      type="time"
                      value={newRestrictEndTime}
                      onChange={(e) => setNewRestrictEndTime(e.target.value)}
                      style={{ flex: '0 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                    />
                  )}
                </div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '15px' : '14px',
                  color: '#555'
                }}>
                  <input
                    type="checkbox"
                    checked={newRestrictAllDay}
                    onChange={(e) => setNewRestrictAllDay(e.target.checked)}
                    style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer' }}
                  />
                  <span>全天</span>
                </label>
              </div>
            )}
          </div>

          {newRestrictEnabled && (
            <div style={{ marginBottom: '12px' }}>
              <button
                data-track="announcement_restriction_preview"
                onClick={async () => {
                  try {
                    setImpactLoading(true)
                    setImpactedBookings([])
                    // 組合限制起訖時間（ISO 字串）
                    const startIso = `${newRestrictStartDate}T${newRestrictAllDay ? '00:00:00' : `${newRestrictStartTime}:00`}`
                    const endIso = `${newRestrictEndDate}T${newRestrictAllDay ? '23:59:59' : `${newRestrictEndTime}:00`}`

                    // 取回這段日期內的候選預約（粗範圍，交由前端計算重疊）
                    const { data } = await supabase
                      .from('bookings')
                      .select('id, start_at, duration_min, contact_name, boats:boat_id(name), booking_coaches ( coaches(name) )')
                      .gte('start_at', `${newRestrictStartDate}T00:00:00`)
                      .lte('start_at', `${newRestrictEndDate}T23:59:59`)

                    const overlaps = (bk: any) => {
                      const bkStart = new Date(bk.start_at).getTime()
                      const bkEnd = bkStart + (bk.duration_min || 0) * 60 * 1000
                      const rStart = new Date(startIso).getTime()
                      const rEnd = new Date(endIso).getTime()
                      return !(bkEnd <= rStart || bkStart >= rEnd)
                    }

                    const list = (data || [])
                      .filter(overlaps)
                      .map((bk: any) => ({
                        id: bk.id,
                        start_at: bk.start_at,
                        duration_min: bk.duration_min,
                        contact_name: bk.contact_name,
                        boat_name: bk.boats?.name,
                        coach_names: Array.isArray(bk.booking_coaches)
                          ? bk.booking_coaches.map((c: any) => c.coaches?.name).filter(Boolean).join('、')
                          : undefined
                      }))
                      .sort((a: any, b: any) => a.start_at.localeCompare(b.start_at))

                    setImpactedBookings(list)
                  } finally {
                    setImpactLoading(false)
                  }
                }}
                style={{
                  padding: isMobile ? '12px' : '10px',
                  minHeight: isMobile ? 44 : undefined,
                  background: '#fff',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: isMobile ? '15px' : '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                試算受影響預約
              </button>

              {/* 清單 */}
              <div style={{
                marginTop: '10px',
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: '6px',
                padding: '10px'
              }}>
                <div style={{ fontSize: '13px', color: '#333', fontWeight: 600, marginBottom: '6px' }}>
                  受影響預約 {impactLoading ? '（載入中…）' : `（${impactedBookings.length} 筆）`}
                </div>
                {impactedBookings.length === 0 && !impactLoading && (
                  <div style={{ fontSize: '13px', color: '#888' }}>無</div>
                )}
                {impactedBookings.length > 0 && (
                  <div style={{ display: 'grid', rowGap: '6px' }}>
                    {impactedBookings.map(item => (
                      <div key={item.id} style={{ fontSize: '13px', color: '#555' }}>
                        <span style={{ color: '#1976d2', fontWeight: 600 }}>
                          {new Date(item.start_at).toLocaleString()}
                        </span>
                        {' · '}{item.contact_name}
                        {item.boat_name ? ` · 船：${item.boat_name}` : ''}
                        {item.coach_names ? ` · 教練：${item.coach_names}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            data-track="announcement_add"
            onClick={handleAdd}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '12px',
              minHeight: isMobile ? 48 : undefined,
              background: 'white',
              color: '#666',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            新增
          </button>
        </div>

        {/* 列表 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          minHeight: '200px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#333',
              flexShrink: 0
            }}>
              所有交辦事項 ({announcements.filter(a => 
                searchText ? a.content.toLowerCase().includes(searchText.toLowerCase()) : true
              ).length})
            </h2>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                flex: '1 1 140px',
                minWidth: 0,
                padding: isMobile ? '12px' : '10px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                background: 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 搜尋和排序控制 */}
          <div style={{
            marginBottom: '15px',
            display: 'flex',
            gap: '10px',
            flexWrap: isMobile ? 'wrap' : 'nowrap'
          }}>
            {/* 搜尋框 */}
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
              <input
                type="text"
                placeholder="搜尋內容..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 14px' : '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: isMobile ? '16px' : '14px',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#2196F3'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </div>

            {/* 排序按鈕 */}
            <button
              data-track="announcement_sort"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={{
                padding: isMobile ? '12px 18px' : '10px 16px',
                minHeight: isMobile ? 44 : undefined,
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: isMobile ? '15px' : '14px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e8e8e8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f5f5f5'
              }}
            >
              {sortOrder === 'desc' ? '新→舊' : '舊→新'}
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              載入中...
            </div>
          )}

          {!loading && announcements.length === 0 && !searchText && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              目前沒有交辦事項
            </div>
          )}

          {!loading && searchText && announcements.filter(a => 
            a.content.toLowerCase().includes(searchText.toLowerCase())
          ).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
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
                  background: '#f5f5f5',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '15px' : '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    {formatDateHeader(date)}
                  </span>
                  <span style={{
                    fontSize: isMobile ? '13px' : '12px',
                    color: '#999'
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
                      background: 'white',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      border: '1px solid #e0e0e0'
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
                            width: '100%',
                            padding: isMobile ? '12px' : '8px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: isMobile ? '16px' : '14px',
                            marginBottom: '10px',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box'
                          }}
                        />
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>事項日期</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => {
                                setEditStartDate(e.target.value)
                                if (e.target.value > editEndDate) setEditEndDate(e.target.value)
                              }}
                              style={{
                                flex: '1 1 120px',
                                minWidth: 0,
                                padding: isMobile ? '12px' : '10px',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                fontSize: '16px',
                                boxSizing: 'border-box'
                              }}
                            />
                            <span style={{ color: '#999', fontSize: '14px', flexShrink: 0 }}>～</span>
                            <input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              min={editStartDate}
                              style={{
                                flex: '1 1 120px',
                                minWidth: 0,
                                padding: isMobile ? '12px' : '10px',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                fontSize: '16px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: isMobile ? '15px' : '14px',
                            color: '#555',
                            padding: isMobile ? '8px 0' : 0,
                            minHeight: isMobile ? 44 : undefined
                          }}>
                            <input
                              type="checkbox"
                              checked={editShowOneDayEarly}
                              onChange={(e) => setEditShowOneDayEarly(e.target.checked)}
                              style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span>提前一天顯示</span>
                          </label>
                        </div>
                        {/* 預約限制（編輯） */}
                        <div style={{ marginBottom: '10px', borderTop: '1px dashed #eee', paddingTop: '10px' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: isMobile ? '15px' : '14px',
                            color: '#333',
                            fontWeight: 600
                          }}>
                            <input
                              type="checkbox"
                              checked={editRestrictEnabled}
                              onChange={(e) => setEditRestrictEnabled(e.target.checked)}
                              style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span>啟用預約限制</span>
                          </label>
                          {editRestrictEnabled && (
                            <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <input
                                  type="date"
                                  value={editRestrictStartDate || editStartDate}
                                  onChange={(e) => setEditRestrictStartDate(e.target.value)}
                                  style={{ flex: '1 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                                />
                                {!editRestrictAllDay && (
                                  <input
                                    type="time"
                                    value={editRestrictStartTime}
                                    onChange={(e) => setEditRestrictStartTime(e.target.value)}
                                    style={{ flex: '0 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                                  />
                                )}
                                <span style={{ color: '#999', fontSize: '14px', flexShrink: 0 }}>～</span>
                                <input
                                  type="date"
                                  value={editRestrictEndDate || editEndDate}
                                  onChange={(e) => setEditRestrictEndDate(e.target.value)}
                                  style={{ flex: '1 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                                />
                                {!editRestrictAllDay && (
                                  <input
                                    type="time"
                                    value={editRestrictEndTime}
                                    onChange={(e) => setEditRestrictEndTime(e.target.value)}
                                    style={{ flex: '0 1 120px', minWidth: 0, padding: isMobile ? '12px' : '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: isMobile ? '16px' : '14px' }}
                                  />
                                )}
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: isMobile ? '15px' : '14px', color: '#555' }}>
                                <input
                                  type="checkbox"
                                  checked={editRestrictAllDay}
                                  onChange={(e) => setEditRestrictAllDay(e.target.checked)}
                                  style={{ width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px', cursor: 'pointer' }}
                                />
                                <span>全天</span>
                              </label>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            data-track="announcement_edit"
                            onClick={() => handleEdit(announcement.id)}
                            style={{
                              flex: 1,
                              padding: isMobile ? '12px' : '8px',
                              minHeight: isMobile ? 44 : undefined,
                              background: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: isMobile ? '15px' : '13px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            儲存
                          </button>
                          <button
                            data-track="announcement_edit_cancel"
                            onClick={cancelEdit}
                            style={{
                              flex: 1,
                              padding: isMobile ? '12px' : '8px',
                              minHeight: isMobile ? 44 : undefined,
                              background: '#f5f5f5',
                              color: '#666',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: isMobile ? '15px' : '13px',
                              fontWeight: '600',
                              cursor: 'pointer'
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
                                fontSize: isMobile ? '12px' : '11px',
                                color: '#888',
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <span style={{
                                  padding: isMobile ? '3px 8px' : '2px 8px',
                                  borderRadius: '4px',
                                  background: '#e3f2fd',
                                  color: '#1976d2',
                                  fontWeight: '500'
                                }}>
                                  {dateLabel.text}
                                </span>
                              </div>
                            )}
                            <div style={{ 
                              fontSize: isMobile ? '15px' : '14px',
                              color: '#333',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: '8px',
                              flexWrap: 'wrap'
                            }}>
                              <span>{announcement.content}</span>
                              {parseForEdit(announcement).showOneDayEarly && (
                                <span style={{
                                  fontSize: isMobile ? '12px' : '11px',
                                  padding: isMobile ? '3px 8px' : '2px 6px',
                                  borderRadius: '3px',
                                  background: '#fff3e0',
                                  color: '#e65100',
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
                            gap: '8px', 
                            flexWrap: 'wrap',
                            flexShrink: 0
                          }}>
                            <button
                              data-track="announcement_edit"
                              onClick={() => startEdit(announcement)}
                              style={{
                                padding: isMobile ? '12px 16px' : '5px 10px',
                                minHeight: isMobile ? 44 : undefined,
                                background: '#f5f5f5',
                                color: '#666',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: isMobile ? '15px' : '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              編輯
                            </button>
                            <button
                              data-track="announcement_delete"
                              onClick={() => handleDelete(announcement.id)}
                              style={{
                                padding: isMobile ? '12px 16px' : '5px 10px',
                                minHeight: isMobile ? 44 : undefined,
                                background: '#fff',
                                color: '#f44336',
                                border: '1px solid #f44336',
                                borderRadius: '6px',
                                fontSize: isMobile ? '15px' : '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
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
