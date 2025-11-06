import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

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
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // TODO: Will use user for creating/updating members and permission control
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
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* 標題列 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
          👥 會員管理
        </h1>
        <button
          onClick={() => alert('新增會員功能開發中...')}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)'
          }}
        >
          + 新增會員
        </button>
      </div>

      {/* 搜尋欄 */}
      <div style={{ 
        marginBottom: '20px',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <input
          type="text"
          placeholder="搜尋會員（姓名、電話、LINE ID）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
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
              onClick={() => alert(`查看會員詳情功能開發中...\n\n會員: ${member.name}`)}
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
    </div>
  )
}

