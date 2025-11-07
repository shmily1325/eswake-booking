import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { AddMemberDialog } from '../components/AddMemberDialog'
import { MemberDetailDialog } from '../components/MemberDetailDialog'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  email: string | null
  line_id: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_minutes: number
  membership_expires_at: string | null
  has_board_storage: boolean
  board_storage_expires_at: string | null
  notes: string | null
  created_at: string
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
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      setMembers(data || [])
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
    member.phone?.includes(searchTerm) ||
    member.line_id?.toLowerCase().includes(searchTerm.toLowerCase())
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
      {/* 標題列 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: isMobile ? '15px' : '20px',
        background: 'white',
        padding: isMobile ? '12px' : '15px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        gap: isMobile ? '8px' : '10px',
        flexWrap: 'wrap'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '16px' : '18px', 
          fontWeight: '600',
          color: '#000'
        }}>
          👥 會員管理
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setAddDialogOpen(true)}
            style={{
              padding: isMobile ? '8px 12px' : '6px 14px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: isMobile ? '14px' : '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              touchAction: 'manipulation'
            }}
          >
            + 新增會員
          </button>
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
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>總會員數</div>
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
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>置板會員</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50' }}>
            {filteredMembers.filter(m => m.has_board_storage).length}
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
                  
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    {member.phone && <span>📱 {member.phone}</span>}
                    {member.phone && member.line_id && <span style={{ margin: '0 8px' }}>|</span>}
                    {member.line_id && <span>💬 {member.line_id}</span>}
                  </div>

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
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '15px',
                  minWidth: '400px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>儲值</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f44336' }}>
                      ${member.balance.toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>指定課</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                      {member.designated_lesson_minutes} 分
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>船券</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196f3' }}>
                      {member.boat_voucher_minutes} 分
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部：附加資訊 */}
              <div style={{ 
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                gap: '15px',
                fontSize: '13px',
                color: '#666'
              }}>
                {member.has_board_storage && (
                  <span style={{ 
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    🏄 置板中
                    {member.board_storage_expires_at && ` (至 ${member.board_storage_expires_at})`}
                  </span>
                )}
                {member.membership_expires_at && (
                  <span>
                    會員到期：{member.membership_expires_at}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

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

