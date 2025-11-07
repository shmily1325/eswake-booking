import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
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
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  
  // TODO: Will use user for creating/updating members and permission control
  // Current user email will be logged for debugging
  console.log('Current user:', user.email)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // 載入會員資料
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (membersError) throw membersError

      // 載入每個會員的置板數量
      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map((m: any) => m.id)
        const { data: boardData, error: boardError } = await supabase
          .from('board_storage')
          .select('member_id')
          .in('member_id', memberIds)
          .eq('status', 'active')

        if (boardError) {
          console.error('載入置板資料失敗:', boardError)
        }

        // 計算每個會員的置板數量
        const boardCounts: Record<string, number> = {}
        if (boardData) {
          boardData.forEach((board: any) => {
            boardCounts[board.member_id] = (boardCounts[board.member_id] || 0) + 1
          })
        }

        // 合併資料
        const membersWithBoards = membersData.map((member: any) => ({
          ...member,
          board_count: boardCounts[member.id] || 0
        }))

        setMembers(membersWithBoards)
      } else {
        setMembers([])
      }
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone?.includes(searchTerm)
  )

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

      {/* 搜尋欄 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder="搜尋會員（姓名、暱稱、電話）"
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>總人數</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
            {filteredMembers.length}
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>會員</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1976d2' }}>
            {filteredMembers.filter(m => m.member_type === 'member').length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>置板數</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
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
                border: '2px solid transparent'
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
                      fontStyle: 'italic'
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
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
    </div>
  )
}

