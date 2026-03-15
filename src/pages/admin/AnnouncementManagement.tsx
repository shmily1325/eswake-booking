import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getWeekdayText, addDaysToDate } from '../../utils/date'
import { useAsyncOperation } from '../../hooks/useAsyncOperation'
import { validateRequired } from '../../utils/errorHandler'
import { useToast, ToastContainer } from '../../components/ui'
import { isAdmin } from '../../utils/auth'

interface Announcement {
  id: number
  content: string
  display_date: string
  end_date: string | null
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
  const [editContent, setEditContent] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editShowOneDayEarly, setEditShowOneDayEarly] = useState(false)
  
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

    const displayDate = newShowOneDayEarly ? addDaysToDate(newStartDate, -1) : newStartDate

    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .insert({
            content: newContent.trim(),
            display_date: displayDate,
            end_date: newEndDate,
            created_by: user.id
          })

        if (error) throw error
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

    const displayDate = editShowOneDayEarly ? addDaysToDate(editStartDate, -1) : editStartDate

    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .update({
            content: editContent.trim(),
            display_date: displayDate,
            end_date: editEndDate
          })
          .eq('id', id)

        if (error) throw error
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
    const end = announcement.end_date || announcement.display_date
    const nextDay = addDaysToDate(announcement.display_date, 1)
    const isEarly = announcement.display_date < end && nextDay === end  // 僅差1天=提前單日
    setEditStartDate(isEarly ? end : announcement.display_date)
    setEditEndDate(end)
    setEditShowOneDayEarly(isEarly)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  // 取得事項開始日（用於分組）
  // 僅「提前一天單日」時 display_date+1=end；區間時 事項開始=display_date
  const getEventStartDate = (a: Announcement) => {
    const end = a.end_date || a.display_date
    if (a.display_date === end) return a.display_date
    const nextDay = addDaysToDate(a.display_date, 1)
    return nextDay === end ? end : a.display_date  // 差1天=提前單日，否則=區間
  }

  // 按事項開始日分組（而非 display_date，更直覺）
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

  // 格式化日期顯示
  const formatDateHeader = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${year}/${parseInt(month)}/${parseInt(day)}`
  }

  // 取得每則公告的日期標籤（單日 vs 區間，顯示事項日期）
  const getAnnouncementDateLabel = (a: Announcement) => {
    const toShort = (d: string) => {
      const [, m, day] = d.split('-')
      return `${parseInt(m)}/${parseInt(day)}`
    }
    const end = a.end_date || a.display_date
    if (a.display_date === end) {
      return { text: `單日 ${toShort(a.display_date)}`, isRange: false }
    }
    const nextDay = addDaysToDate(a.display_date, 1)
    const eventStart = nextDay === end ? end : a.display_date  // 差1天=提前單日，否則=區間
    if (eventStart === end) {
      return { text: `單日 ${toShort(eventStart)}`, isRange: false }
    }
    return { text: `${toShort(eventStart)} - ${toShort(end)}`, isRange: true }
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

          <button
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
                  padding: '8px 12px',
                  background: '#f5f5f5',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    {formatDateHeader(date)}
                  </span>
                  <span style={{
                    fontSize: '12px',
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
                      padding: isMobile ? '14px' : '12px',
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
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
                                fontSize: '11px',
                                color: '#888',
                                marginBottom: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <span style={{
                                  padding: '2px 8px',
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
                              fontSize: '14px',
                              color: '#333',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word'
                            }}>
                              {announcement.content}
                            </div>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            flexWrap: 'wrap',
                            flexShrink: 0
                          }}>
                            <button
                              onClick={() => startEdit(announcement)}
                              style={{
                                padding: isMobile ? '10px 14px' : '5px 10px',
                                minHeight: isMobile ? 44 : undefined,
                                background: '#f5f5f5',
                                color: '#666',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: isMobile ? '14px' : '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDelete(announcement.id)}
                              style={{
                                padding: isMobile ? '10px 14px' : '5px 10px',
                                minHeight: isMobile ? 44 : undefined,
                                background: '#fff',
                                color: '#f44336',
                                border: '1px solid #f44336',
                                borderRadius: '6px',
                                fontSize: isMobile ? '14px' : '12px',
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
