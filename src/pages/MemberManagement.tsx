import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { AddMemberDialog } from '../components/AddMemberDialog'
import { MemberDetailDialog } from '../components/MemberDetailDialog'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
  membership_expires_at: string | null
  member_type: string  // 'guest' or 'member'
  notes: string | null
  status: string
  created_at: string
  board_count?: number  // 置板數量（從 board_storage 計算）
}

interface MemberManagementProps {
  user: User
}

export function MemberManagement({ user }: MemberManagementProps) {
  const { isMobile } = useResponsive()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  
  // TODO: Will use user for creating/updating members and permission control
  // Current user email will be logged for debugging
  console.log('Current user:', user.email)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // 並行查詢會員資料和置板資料（重要：從串行改為並行，提升載入速度）
      const [membersResult, boardResult] = await Promise.all([
        supabase
          .from('members')
          .select('id, name, nickname, phone, notes, member_type, balance, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_minutes, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false})
          .limit(200),  // 限制最多 200 筆，避免一次載入太多
        
        supabase
          .from('board_storage')
          .select('member_id')
          .eq('status', 'active')
      ])

      if (membersResult.error) throw membersResult.error

      const membersData = membersResult.data || []
      const boardData = boardResult.data || []

      // 計算每個會員的置板數量
      const boardCounts: Record<string, number> = {}
      boardData.forEach((board: any) => {
        boardCounts[board.member_id] = (boardCounts[board.member_id] || 0) + 1
      })

      // 合併資料
      const membersWithBoards = membersData.map((member: any) => ({
        ...member,
        board_count: boardCounts[member.id] || 0
      }))

      setMembers(membersWithBoards)
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!memberToDelete) return
    
    setDeleting(true)
    setDeleteError('')
    
    try {
      // 檢查該會員是否有預約記錄
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('member_id', memberToDelete.id)
        .limit(1)
      
      if (bookingsError) throw bookingsError
      
      if (bookings && bookings.length > 0) {
        setDeleteError('❌ 無法刪除：此會員有預約記錄。請先刪除相關預約，或使用「標記為無效」功能來隱藏會員。')
        setDeleting(false)
        return
      }
      
      // 沒有預約記錄，可以安全刪除
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberToDelete.id)
      
      if (deleteError) throw deleteError
      
      // 刪除成功，重新載入會員列表
      await loadMembers()
      setDeleteDialogOpen(false)
      setMemberToDelete(null)
    } catch (err: any) {
      setDeleteError('刪除失敗: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // 使用 useMemo 快取過濾結果，避免不必要的重複計算
  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members
    
    const lowerSearch = searchTerm.toLowerCase()
    return members.filter(member => 
      member.name.toLowerCase().includes(lowerSearch) ||
      member.nickname?.toLowerCase().includes(lowerSearch)
    )
  }, [members, searchTerm])

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
      <PageHeader title="👥 會員管理" user={user} showBaoLink={true} />

      {/* 快捷功能按鈕 */}
      <div style={{ 
        display: 'flex', 
        gap: isMobile ? '8px' : '12px', 
        marginBottom: isMobile ? '15px' : '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => navigate('/member-import')}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: '#5a5a5a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          <span>📥</span>
          <span>批量導入</span>
        </button>

        <button
          onClick={() => navigate('/boards')}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: '#5a5a5a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          <span>🏄</span>
          <span>置板管理</span>
        </button>
      </div>

      {/* 搜尋欄 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder="搜尋會員（姓名、暱稱）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '10px 14px' : '12px 16px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#dee2e6'}
        />
      </div>

      {/* 統計資訊 */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
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
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>總人數</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.length}
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: isMobile ? '16px 12px' : '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>會員</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.filter(m => m.member_type === 'member').length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: isMobile ? '16px 12px' : '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>置板數</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.reduce((sum, m) => sum + (m.board_count || 0), 0)}
          </div>
        </div>
      </div>

      {/* 會員列表 */}
      <div style={{ 
        display: 'grid',
        gap: '15px'
      }}>
        {filteredMembers.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#999',
            fontSize: '16px'
          }}>
            {searchTerm ? '找不到符合的會員' : '尚無會員資料'}
          </div>
        ) : (
          filteredMembers.map(member => (
            <div
              key={member.id}
              style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: '2px solid transparent',
                position: 'relative'
              }}
              onClick={() => {
                setSelectedMemberId(member.id)
                setDetailDialogOpen(true)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {/* 刪除按鈕 */}
              <button
                onClick={(e) => {
                  e.stopPropagation() // 防止觸發卡片的 onClick
                  setMemberToDelete(member)
                  setDeleteDialogOpen(true)
                  setDeleteError('')
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#cc0000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ff4444'
                }}
              >
                🗑️ 刪除
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                {/* 左側：基本資訊 */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                      {member.name}
                    </h3>
                    {member.nickname && (
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#666',
                        background: '#f0f0f0',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {member.nickname}
                      </span>
                    )}
                  </div>
                  
                  {member.phone && (
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                      📱 {member.phone}
                    </div>
                  )}

                  {member.notes && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#999',
                      marginTop: '8px',
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: isMobile ? '250px' : '400px'
                    }}>
                      備註：{member.notes}
                    </div>
                  )}
                </div>

                {/* 右側：權益資訊 */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                  gap: '12px',
                  minWidth: isMobile ? 'auto' : '500px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>儲值</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#f44336' }}>
                      ${member.balance.toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>指定課</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#ff9800' }}>
                      {member.designated_lesson_minutes} 分
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>G23券</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#4caf50' }}>
                      {member.boat_voucher_g23_minutes} 分
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>G21券</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#13c2c2' }}>
                      {member.boat_voucher_g21_minutes} 分
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部：到期資訊 */}
              <div style={{ 
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px'
              }}>
                {/* 會員類型 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    background: member.member_type === 'member' ? '#e3f2fd' : '#f5f5f5',
                    color: member.member_type === 'member' ? '#1976d2' : '#666',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    {member.member_type === 'member' ? '👤 會員' : '👋 客人'}
                  </span>
                  {member.member_type === 'member' && member.membership_expires_at && (
                    <span style={{ color: '#666' }}>
                      到期：{member.membership_expires_at}
                    </span>
                  )}
                </div>
                
                {/* 置板資訊 */}
                {member.board_count && member.board_count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      🏄 置板
                    </span>
                    <span style={{ color: '#666' }}>
                      {member.board_count} 格
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增會員按鈕 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={() => setAddDialogOpen(true)}
          style={{
            padding: isMobile ? '12px 24px' : '14px 28px',
            background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(90, 90, 90, 0.3)'
          }}
        >
          + 新增會員
        </button>
      </div>

      {/* Footer */}
      <Footer />

      {/* 新增會員彈窗 */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={loadMembers}
      />

      {/* 會員詳情彈窗 */}
      <MemberDetailDialog
        open={detailDialogOpen}
        memberId={selectedMemberId}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedMemberId(null)
        }}
        onUpdate={loadMembers}
      />

      {/* 刪除確認對話框 */}
      {deleteDialogOpen && memberToDelete && (
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
            maxWidth: '450px',
            width: '100%',
            padding: '24px'
          }}>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#ff4444'
            }}>
              ⚠️ 確認刪除會員
            </h2>
            
            <div style={{ 
              background: '#f5f5f5',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                {memberToDelete.name}
              </div>
              {memberToDelete.phone && (
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                  📱 {memberToDelete.phone}
                </div>
              )}
              {memberToDelete.notes && (
                <div style={{ fontSize: '13px', color: '#999', marginTop: '8px', fontStyle: 'italic' }}>
                  {memberToDelete.notes}
                </div>
              )}
            </div>

            <p style={{ 
              fontSize: '14px', 
              color: '#666', 
              marginBottom: '20px',
              lineHeight: '1.6'
            }}>
              此操作會<strong>永久刪除</strong>此會員資料。<br/>
              如果此會員有預約記錄，將無法刪除。<br/>
              此操作<strong>無法復原</strong>，請確認是否繼續？
            </p>

            {deleteError && (
              <div style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setMemberToDelete(null)
                  setDeleteError('')
                }}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: deleting ? '#e0e0e0' : 'white',
                  color: deleting ? '#999' : '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteMember}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: deleting ? '#ffcccb' : '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

