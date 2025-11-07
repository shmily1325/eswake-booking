import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'

interface Announcement {
  id: string
  content: string
  display_date: string
  created_at: string
}

interface AnnouncementManagementProps {
  user: User
}

export function AnnouncementManagement({ user }: AnnouncementManagementProps) {
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [newDisplayDate, setNewDisplayDate] = useState(getLocalDateString())
  const [editContent, setEditContent] = useState('')
  const [editDisplayDate, setEditDisplayDate] = useState('')

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('daily_announcements')
        .select('*')
        .order('display_date', { ascending: true })
        .order('created_at', { ascending: false })

      if (data) setAnnouncements(data)
    } catch (error) {
      console.error('載入公告失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newContent.trim()) {
      alert('請輸入交辦事項內容')
      return
    }

    try {
      const { error } = await supabase
        .from('daily_announcements')
        .insert({
          content: newContent.trim(),
          display_date: newDisplayDate,
          created_by: user.email
        })

      if (error) throw error

      setNewContent('')
      setNewDisplayDate(getLocalDateString())
      loadAnnouncements()
      alert('✅ 新增成功！')
    } catch (error) {
      console.error('新增失敗:', error)
      alert('❌ 新增失敗，請重試')
    }
  }

  const handleEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('daily_announcements')
        .update({
          content: editContent.trim(),
          display_date: editDisplayDate
        })
        .eq('id', id)

      if (error) throw error

      setEditingId(null)
      loadAnnouncements()
      alert('✅ 更新成功！')
    } catch (error) {
      console.error('更新失敗:', error)
      alert('❌ 更新失敗，請重試')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個交辦事項嗎？')) return

    try {
      const { error } = await supabase
        .from('daily_announcements')
        .delete()
        .eq('id', id)

      if (error) throw error

      loadAnnouncements()
      alert('✅ 刪除成功！')
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('❌ 刪除失敗，請重試')
    }
  }

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setEditContent(announcement.content)
    setEditDisplayDate(announcement.display_date)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: isMobile ? '12px' : '20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PageHeader title="📢 公告管理" user={user} showBaoLink={true} />

        {/* 新增表單 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
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
              marginBottom: '6px',
              fontWeight: '500'
            }}>
              顯示日期
            </label>
            <input
              type="date"
              value={newDisplayDate}
              onChange={(e) => setNewDisplayDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={handleAdd}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer'
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
          minHeight: '200px'
        }}>
          <h2 style={{
            margin: '0 0 15px 0',
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '600'
          }}>
            📋 所有交辦事項 ({announcements.length})
          </h2>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              載入中...
            </div>
          )}

          {!loading && announcements.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              😊 目前沒有交辦事項
            </div>
          )}

          {!loading && announcements.map((announcement) => (
            <div
              key={announcement.id}
              style={{
                padding: '15px',
                background: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '12px',
                border: '2px solid #e0e0e0'
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
                      border: '1px solid #ccc',
                      borderRadius: '6px',
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
                      border: '1px solid #ccc',
                      borderRadius: '6px',
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
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ 儲存
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ 取消
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
                    marginBottom: '10px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        {announcement.content}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        📅 {announcement.display_date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => startEdit(announcement)}
                      style={{
                        padding: '6px 12px',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✎ 編輯
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🗑 刪除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
