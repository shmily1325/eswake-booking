import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'

interface BoardSlot {
  id?: number
  slot_number: number
  member_id?: string
  member_name?: string
  member_nickname?: string
  expires_at?: string | null
  notes?: string | null
  status?: string
}

interface BoardManagementProps {
  user: User
}

// 置板區配置
const BOARD_SECTIONS = [
  { name: '第1排', start: 1, end: 34 },
  { name: '第2排', start: 35, end: 62 },
  { name: '第3排', start: 63, end: 100 },
  { name: '第4排', start: 101, end: 136 },
  { name: '第5排', start: 137, end: 145, upperOnly: true },
]

export function BoardManagement({ user }: BoardManagementProps) {
  const { isMobile } = useResponsive()
  const [boardSlots, setBoardSlots] = useState<BoardSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<BoardSlot | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    expires_at: '',
    notes: ''
  })

  useEffect(() => {
    loadBoardData()
  }, [])

  const loadBoardData = async () => {
    setLoading(true)
    try {
      // 載入所有置板資料及會員資訊
      const { data, error } = await supabase
        .from('board_storage')
        .select(`
          id,
          slot_number,
          member_id,
          expires_at,
          notes,
          status,
          members:member_id (
            name,
            nickname
          )
        `)
        .eq('status', 'active')
        .order('slot_number', { ascending: true })

      if (error) throw error

      const slots: BoardSlot[] = (data || []).map((item: any) => ({
        id: item.id,
        slot_number: item.slot_number,
        member_id: item.member_id,
        member_name: item.members?.name,
        member_nickname: item.members?.nickname,
        expires_at: item.expires_at,
        notes: item.notes,
        status: item.status,
      }))

      setBoardSlots(slots)
    } catch (error) {
      console.error('載入置板資料失敗:', error)
      alert('載入置板資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const getSlotInfo = (slotNumber: number): BoardSlot | null => {
    return boardSlots.find(s => s.slot_number === slotNumber) || null
  }

  const handleSlotClick = (slotInfo: BoardSlot | null, slotNumber: number) => {
    const slot = slotInfo || { slot_number: slotNumber }
    setSelectedSlot(slot)
    setEditing(false)
    if (slotInfo) {
      setEditForm({
        expires_at: slotInfo.expires_at || '',
        notes: slotInfo.notes || ''
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSlot?.id) return

    try {
      const { error } = await supabase
        .from('board_storage')
        .update({
          expires_at: editForm.expires_at || null,
          notes: editForm.notes.trim() || null,
        })
        .eq('id', selectedSlot.id)

      if (error) throw error

      alert('更新成功！')
      setEditing(false)
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('更新失敗:', error)
      alert('更新失敗')
    }
  }

  const handleDeleteBoard = async () => {
    if (!selectedSlot?.id) return
    
    if (!confirm(`確定要刪除格位 ${selectedSlot.slot_number} 嗎？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .update({ status: 'cancelled' })
        .eq('id', selectedSlot.id)

      if (error) throw error

      alert('刪除成功！')
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗')
    }
  }

  const renderSection = (section: typeof BOARD_SECTIONS[0]) => {
    // 上層（雙數）
    const upperSlots = []
    for (let i = section.start; i <= section.end; i++) {
      if (i % 2 === 0) {
        upperSlots.push(i)
      }
    }
    
    // 下層（單數）
    const lowerSlots = []
    if (!section.upperOnly) {
      for (let i = section.start; i <= section.end; i++) {
        if (i % 2 === 1) {
          lowerSlots.push(i)
        }
      }
    }

    return (
      <div key={section.name} style={{ marginBottom: '30px' }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: 'white',
          background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
          padding: '12px',
          borderRadius: '8px'
        }}>
          {section.name} ({section.start}-{section.end})
        </h3>
        
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* 上層 */}
          <div style={{ marginBottom: section.upperOnly ? 0 : '10px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              上層（雙數）
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '60px' : '70px'}, 1fr))`,
              gap: '8px'
            }}>
              {upperSlots.map(num => {
                const slotInfo = getSlotInfo(num)
                return (
                  <div
                    key={num}
                    onClick={() => handleSlotClick(slotInfo, num)}
                    style={{
                      padding: isMobile ? '10px 5px' : '12px 8px',
                      background: slotInfo ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#f0f0f0',
                      color: slotInfo ? 'white' : '#666',
                      borderRadius: '8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: 'bold',
                      border: slotInfo ? '2px solid #2e7d32' : '2px solid #ddd',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {num}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 下層 */}
          {!section.upperOnly && (
            <div>
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                marginBottom: '8px',
                fontWeight: 'bold'
              }}>
                下層（單數）
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(auto-fill, minmin(${isMobile ? '60px' : '70px'}, 1fr))`,
                gap: '8px'
              }}>
                {lowerSlots.map(num => {
                  const slotInfo = getSlotInfo(num)
                  return (
                    <div
                      key={num}
                      onClick={() => handleSlotClick(slotInfo, num)}
                      style={{
                        padding: isMobile ? '10px 5px' : '12px 8px',
                        background: slotInfo ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#f0f0f0',
                        color: slotInfo ? 'white' : '#666',
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: 'bold',
                        border: slotInfo ? '2px solid #2e7d32' : '2px solid #ddd',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)'
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    >
                      {num}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* 標題列 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: isMobile ? '15px' : '20px',
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        gap: isMobile ? '8px' : '10px',
        flexWrap: 'wrap'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '18px' : '20px', 
          fontWeight: 'bold',
          color: 'white'
        }}>
          🏄 置板區管理
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            to="/"
            style={{
              padding: isMobile ? '8px 12px' : '6px 12px',
              background: '#f8f9fa',
              color: '#333',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: isMobile ? '14px' : '13px',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation'
            }}
          >
            ← 回主頁
          </Link>
          <UserMenu user={user} />
        </div>
      </div>

      {/* 統計資訊 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>總格位數</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            145
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>已使用</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
            {boardSlots.length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>空位</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff9800' }}>
            {145 - boardSlots.length}
          </div>
        </div>
      </div>

      {/* 置板區域 */}
      {BOARD_SECTIONS.map(section => renderSection(section))}

      {/* 格位詳情彈窗 */}
      {selectedSlot && (
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
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* 標題 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                格位 {selectedSlot.slot_number}
              </h2>
              <button
                onClick={() => setSelectedSlot(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                &times;
              </button>
            </div>

            {/* 內容 */}
            <div style={{ padding: '20px' }}>
              {selectedSlot.member_name ? (
                <>
                  {/* 會員資訊 */}
                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>會員</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {selectedSlot.member_name}
                      {selectedSlot.member_nickname && (
                        <span style={{ 
                          fontSize: '14px', 
                          color: '#666', 
                          marginLeft: '8px',
                          fontWeight: 'normal'
                        }}>
                          ({selectedSlot.member_nickname})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 編輯模式 */}
                  {editing ? (
                    <>
                      {/* 到期日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          到期日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.expires_at}
                          onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 備註 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          備註 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="例如：藍色長板"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 編輯按鈕 */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => setEditing(false)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          儲存
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 檢視模式 */}
                      {selectedSlot.expires_at && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>到期日</div>
                          <div style={{ fontSize: '16px' }}>{selectedSlot.expires_at}</div>
                        </div>
                      )}

                      {selectedSlot.notes && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>備註</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic', color: '#999' }}>
                            {selectedSlot.notes}
                          </div>
                        </div>
                      )}

                      {/* 操作按鈕 */}
                      <div style={{ 
                        display: 'flex',
                        gap: '10px',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e0e0e0'
                      }}>
                        <button
                          onClick={() => setEditing(true)}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          onClick={handleDeleteBoard}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ 
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏄</div>
                  <div style={{ fontSize: '16px', marginBottom: '20px' }}>此格位尚未使用</div>
                  <Link
                    to="/members"
                    style={{
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    前往會員管理新增
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

