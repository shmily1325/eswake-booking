import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { useAsyncOperation } from '../../hooks/useAsyncOperation'
import { validateRequired } from '../../utils/errorHandler'
import { useToast, ToastContainer } from '../../components/ui'

interface Announcement {
  id: number
  content: string
  display_date: string
  created_at: string | null
}

export function AnnouncementManagement() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newContent, setNewContent] = useState('')
  const [newDisplayDate, setNewDisplayDate] = useState(getLocalDateString())
  const [editContent, setEditContent] = useState('')
  const [editDisplayDate, setEditDisplayDate] = useState('')
  
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
      
      const { data } = await supabase
        .from('daily_announcements')
        .select('*')
        .gte('display_date', startDate)
        .lte('display_date', endDate)
        .order('display_date', { ascending: sortOrder === 'asc' })
        .order('created_at', { ascending: sortOrder === 'asc' })

      if (data) setAnnouncements(data)
    } catch (error) {
      console.error('載入公告失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    const validation = validateRequired(newContent, '交辦事項內容')
    if (!validation.valid) {
      toast.warning(validation.error || '請填寫交辦事項內容')
      return
    }

    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .insert({
            content: newContent.trim(),
            display_date: newDisplayDate,
            created_by: user.id
          })

        if (error) throw error
      },
      {
        successMessage: '新增成功',
        errorContext: '新增交辦事項',
        onComplete: () => {
          setNewContent('')
          setNewDisplayDate(getLocalDateString())
          loadAnnouncements()
        }
      }
    )
  }

  const handleEdit = async (id: number) => {
    await executeAsync(
      async () => {
        const { error } = await supabase
          .from('daily_announcements')
          .update({
            content: editContent.trim(),
            display_date: editDisplayDate
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
    setEditDisplayDate(announcement.display_date)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  // 按日期分組公告
  const groupAnnouncementsByDate = (announcements: Announcement[]) => {
    const grouped = new Map<string, Announcement[]>()
    
    announcements.forEach(announcement => {
      const date = announcement.display_date
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: isMobile ? '12px' : '20px'
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
                padding: '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              color: '#666',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              顯示日期
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={newDisplayDate}
                onChange={(e) => setNewDisplayDate(e.target.value)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  minWidth: 0,
                  padding: '10px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  boxSizing: 'border-box'
                }}
              />
              {/* 星期幾徽章 */}
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
                {getWeekdayText(newDisplayDate)}
              </span>
            </div>
          </div>

          <button
            onClick={handleAdd}
            style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#666',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '15px',
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
          padding: isMobile ? '12px' : '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          minHeight: '200px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px',
            gap: '8px',
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  width: '100%',
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
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#2196F3'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </div>

            {/* 排序按鈕 */}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={{
                padding: '10px 16px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
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
                {dateAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    style={{
                      padding: '12px',
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
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                            marginBottom: '10px',
                            fontFamily: 'inherit'
                          }}
                        />
                        <input
                          type="date"
                          value={editDisplayDate}
                          onChange={(e) => setEditDisplayDate(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                            marginBottom: '10px'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEdit(announcement.id)}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
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
                              padding: '8px',
                              background: '#f5f5f5',
                              color: '#666',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '13px',
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
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          gap: '12px'
                        }}>
                          <div style={{ 
                            flex: 1,
                            fontSize: '14px',
                            color: '#333',
                            lineHeight: '1.5'
                          }}>
                            {announcement.content}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                            <button
                              onClick={() => startEdit(announcement)}
                              style={{
                                padding: '5px 10px',
                                background: '#f5f5f5',
                                color: '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '12px',
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
                                padding: '5px 10px',
                                background: '#fff',
                                color: '#f44336',
                                border: '1px solid #f44336',
                                borderRadius: '4px',
                                fontSize: '12px',
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
                ))}
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
