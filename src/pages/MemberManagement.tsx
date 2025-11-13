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
  membership_end_date: string | null
  membership_start_date: string | null
  membership_type: string  // 'general', 'dual', 'board'
  membership_partner_id: string | null
  member_type: string  // 'guest' or 'member'
  board_slot_number: string | null
  board_expiry_date: string | null
  free_hours: number
  free_hours_used: number
  free_hours_notes: string | null
  notes: string | null
  status: string
  created_at: string
  board_count?: number  // 置板數量（從 board_storage 計算）
  partner?: Member | null  // 配對會員資料
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
  const [showInactive, setShowInactive] = useState(false)
  
  // TODO: Will use user for creating/updating members and permission control
  // Current user email will be logged for debugging
  console.log('Current user:', user.email)

  useEffect(() => {
    loadMembers()
  }, [showInactive])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // 並行查詢會員資料和置板資料（重要：從串行改為並行，提升載入速度）
      const [membersResult, boardResult] = await Promise.all([
        supabase
          .from('members')
          .select(`
            id, name, nickname, phone, birthday, notes, member_type, 
            balance, designated_lesson_minutes, boat_voucher_g23_minutes, 
            boat_voucher_g21_minutes, membership_end_date, membership_start_date,
            membership_type, membership_partner_id,
            board_slot_number, board_expiry_date,
            free_hours, free_hours_used, free_hours_notes,
            status, created_at
          `)
          .eq('status', showInactive ? 'inactive' : 'active')
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

      // 載入配對會員資料
      const partnerIds = membersData
        .map((m: any) => m.membership_partner_id)
        .filter(Boolean)
      
      let partnersData: any[] = []
      if (partnerIds.length > 0) {
        const { data } = await supabase
          .from('members')
          .select('id, name, nickname')
          .in('id', partnerIds)
        partnersData = data || []
      }

      const partnersMap: Record<string, any> = {}
      partnersData.forEach(p => {
        partnersMap[p.id] = p
      })

      // 合併資料
      const membersWithBoards = membersData.map((member: any) => ({
        ...member,
        board_count: boardCounts[member.id] || 0,
        partner: member.membership_partner_id ? partnersMap[member.membership_partner_id] : null
      }))

      setMembers(membersWithBoards)
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleArchiveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: 'inactive' })
        .eq('id', memberId)
      
      if (error) throw error
      await loadMembers()
    } catch (err: any) {
      console.error('隱藏會員失敗:', err)
      alert('隱藏會員失敗')
    }
  }

  const handleRestoreMember = async (memberId: string) => {
    try {
      const { error} = await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('id', memberId)
      
      if (error) throw error
      await loadMembers()
    } catch (err: any) {
      console.error('恢復會員失敗:', err)
      alert('恢復會員失敗')
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
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
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
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
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

      {/* 顯示已隱藏的切換開關 */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '8px'
        }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ 
            fontSize: '14px', 
            color: '#666',
            fontWeight: '500'
          }}>
            顯示已隱藏的會員
          </span>
        </label>
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
              {/* 隱藏/恢復按鈕 */}
              <button
                onClick={(e) => {
                  e.stopPropagation() // 防止觸發卡片的 onClick
                  if (member.status === 'inactive') {
                    handleRestoreMember(member.id)
                  } else {
                    handleArchiveMember(member.id)
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: member.status === 'inactive' ? '#4caf50' : '#f5f5f5',
                  color: member.status === 'inactive' ? 'white' : '#999',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
              >
                {member.status === 'inactive' ? '恢復' : '隱藏'}
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                {/* 左側：基本資訊 */}
                <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '500px', paddingRight: '80px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
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
                    {member.membership_type === 'dual' && (
                      <span style={{ 
                        fontSize: '13px', 
                        color: '#fff',
                        background: '#2196F3',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        雙人會籍
                      </span>
                    )}
                    {member.membership_type === 'board' && (
                      <span style={{ 
                        fontSize: '13px', 
                        color: '#fff',
                        background: '#4caf50',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        置板
                      </span>
                    )}
                  </div>
                  
                  {member.partner && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#2196F3',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      🔗 與 <strong>{member.partner.nickname || member.partner.name}</strong> 共享會籍
                    </div>
                  )}

                  {member.board_slot_number && (
                    <div style={{ fontSize: '13px', color: '#4caf50', marginBottom: '4px' }}>
                      🏄 置板位：{member.board_slot_number}
                      {member.board_expiry_date && ` (至 ${member.board_expiry_date})`}
                    </div>
                  )}
                  
                  {member.phone && (
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                      📱 {member.phone}
                    </div>
                  )}

                  {member.membership_end_date && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: new Date(member.membership_end_date) < new Date() ? '#f44336' : '#666',
                      marginBottom: '4px'
                    }}>
                      📅 會籍至 {member.membership_end_date}
                      {new Date(member.membership_end_date) < new Date() && ' (已過期)'}
                    </div>
                  )}

                  {(member.free_hours || 0) > 0 && (
                    <div style={{ fontSize: '13px', color: '#ff9800', marginBottom: '4px' }}>
                      ⏱️ 贈送時數：{member.free_hours}分 (已用 {member.free_hours_used || 0}分)
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
                      ${(member.balance || 0).toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>指定課</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#ff9800' }}>
                      {member.designated_lesson_minutes || 0} 分
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>G23券</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#4caf50' }}>
                      {member.boat_voucher_g23_minutes || 0} 分
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>G21券</div>
                    <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', color: '#13c2c2' }}>
                      {member.boat_voucher_g21_minutes || 0} 分
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
                  {member.member_type === 'member' && member.membership_end_date && (
                    <span style={{ color: '#666' }}>
                      到期：{member.membership_end_date}
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

    </div>
  )
}

