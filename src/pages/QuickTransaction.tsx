import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { TransactionDialog } from '../components/TransactionDialog'
import { UserMenu } from '../components/UserMenu'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
  member_type: string
}

interface QuickTransactionProps {
  user: User
}

export function QuickTransaction({ user }: QuickTransactionProps) {
  const { isMobile } = useResponsive()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)

  console.log('Current user:', user.email)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone, balance, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_minutes, member_type')
        .eq('status', 'active')
        .order('name', { ascending: true })

      if (error) throw error
      setMembers(data || [])
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionSuccess = () => {
    loadMembers()
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
      {/* 頂部導航列 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
        gap: '10px'
      }}>
        <Link
          to="/"
          style={{
            padding: isMobile ? '8px 14px' : '8px 16px',
            background: 'white',
            color: '#333',
            textDecoration: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '14px',
            border: '1px solid #e0e0e0',
            fontWeight: '500',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ← HOME
        </Link>
        <UserMenu user={user} />
      </div>

      {/* 標題區 */}
      <div style={{
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        marginBottom: isMobile ? '15px' : '20px'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 'bold',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          💳 快速記帳
        </h1>
        <p style={{
          margin: '6px 0 0 0',
          fontSize: isMobile ? '13px' : '14px',
          color: 'rgba(255,255,255,0.85)'
        }}>
          搜尋會員，點擊即可快速記帳
        </p>
      </div>

      {/* 搜尋欄 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder="搜尋會員姓名、暱稱或電話..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '14px' : '12px',
            border: '2px solid #e0e0e0',
            borderRadius: '10px',
            fontSize: isMobile ? '16px' : '15px',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
        />
      </div>

      {/* 統計卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '15px',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>總人數</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>
            {filteredMembers.length}
          </div>
        </div>
      </div>

      {/* 會員列表 */}
      <div style={{
        display: 'grid',
        gap: '12px'
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
                padding: isMobile ? '16px' : '18px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '2px solid transparent'
              }}
              onClick={() => {
                setSelectedMember(member)
                setTransactionDialogOpen(true)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '15px' }}>
                {/* 左側：會員資訊 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '17px' : '18px', fontWeight: 'bold' }}>
                      {member.name}
                    </h3>
                    {member.nickname && (
                      <span style={{
                        fontSize: '13px',
                        color: '#666',
                        background: '#f0f0f0',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {member.nickname}
                      </span>
                    )}
                    <span style={{
                      fontSize: '12px',
                      background: member.member_type === 'member' ? '#e3f2fd' : '#f5f5f5',
                      color: member.member_type === 'member' ? '#1976d2' : '#666',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {member.member_type === 'member' ? '會員' : '客人'}
                    </span>
                  </div>

                  {member.phone && (
                    <div style={{ fontSize: '13px', color: '#999', marginBottom: '10px' }}>
                      📱 {member.phone}
                    </div>
                  )}

                  {/* 財務資訊 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                    gap: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#fff5f5', borderRadius: '6px' }}>
                      <div style={{ color: '#666', marginBottom: '2px' }}>儲值</div>
                      <div style={{ fontWeight: 'bold', color: '#f44336', fontSize: '14px' }}>
                        ${member.balance.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#fff8e1', borderRadius: '6px' }}>
                      <div style={{ color: '#666', marginBottom: '2px' }}>指定課</div>
                      <div style={{ fontWeight: 'bold', color: '#ff9800', fontSize: '14px' }}>
                        {member.designated_lesson_minutes}分
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#e8f5e9', borderRadius: '6px' }}>
                      <div style={{ color: '#666', marginBottom: '2px' }}>G23券</div>
                      <div style={{ fontWeight: 'bold', color: '#4caf50', fontSize: '14px' }}>
                        {member.boat_voucher_g23_minutes}分
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px', background: '#e0f7fa', borderRadius: '6px' }}>
                      <div style={{ color: '#666', marginBottom: '2px' }}>G21券</div>
                      <div style={{ fontWeight: 'bold', color: '#13c2c2', fontSize: '14px' }}>
                        {member.boat_voucher_g21_minutes}分
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右側：記帳按鈕圖示 */}
                <div style={{
                  fontSize: '24px',
                  opacity: 0.5,
                  transition: 'opacity 0.2s'
                }}>
                  💳
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 記帳對話框 */}
      {selectedMember && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={selectedMember}
          onClose={() => {
            setTransactionDialogOpen(false)
            setSelectedMember(null)
          }}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {/* Footer */}
      <Footer />
    </div>
  )
}

