import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { TransactionDialog } from '../components/TransactionDialog'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  phone: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
  member_type: string
  status: string
}

interface MemberTransactionProps {
  user: User
}

export function MemberTransaction({ user }: MemberTransactionProps) {
  const { isMobile } = useResponsive()
  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // 載入會員列表
  const loadMembers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('member_type', 'member')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setMembers(data || [])
      setFilteredMembers(data || [])
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員列表失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  // 搜尋過濾
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(members)
    } else {
      const lowerSearch = searchTerm.toLowerCase()
      const filtered = members.filter(m =>
        m.name.toLowerCase().includes(lowerSearch) ||
        m.phone?.includes(searchTerm)
      )
      setFilteredMembers(filtered)
    }
  }, [searchTerm, members])

  const handleMemberClick = (member: Member) => {
    setSelectedMember(member)
    setShowTransactionDialog(true)
  }

  const handleTransactionSuccess = () => {
    loadMembers()
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="💳 會員記帳" user={user} showBaoLink={true} />

      {/* 搜尋欄 */}
      <div style={{
        background: 'white',
        padding: isMobile ? '16px' : '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '8px',
          }}>
            🔍 搜尋會員
          </div>
          <input
            type="text"
            placeholder="輸入會員姓名或電話搜尋..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '14px' : '12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: isMobile ? '16px' : '14px',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
          />
        </div>

        <div style={{
          fontSize: '13px',
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>找到 {filteredMembers.length} 位會員</span>
          <button
            onClick={() => setSearchTerm('')}
            style={{
              padding: '4px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            清除搜尋
          </button>
        </div>
      </div>

      {/* 會員列表 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999',
          }}>
            載入中...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999',
          }}>
            {searchTerm ? '沒有找到符合條件的會員' : '暫無會員資料'}
          </div>
        ) : (
          <div style={{
            maxHeight: isMobile ? 'calc(100vh - 280px)' : 'calc(100vh - 240px)',
            overflowY: 'auto',
          }}>
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                style={{
                  padding: isMobile ? '16px' : '20px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8f9fa'
                  e.currentTarget.style.borderLeftColor = '#667eea'
                  e.currentTarget.style.borderLeftWidth = '4px'
                  e.currentTarget.style.paddingLeft = isMobile ? '12px' : '16px'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderLeftWidth = '0'
                  e.currentTarget.style.paddingLeft = isMobile ? '16px' : '20px'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}>
                  {/* 左側：會員資訊 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <span style={{
                        fontSize: isMobile ? '16px' : '18px',
                        fontWeight: 'bold',
                        color: '#333',
                      }}>
                        {member.name}
                      </span>
                      {member.phone && (
                        <span style={{
                          fontSize: '13px',
                          color: '#999',
                        }}>
                          {member.phone}
                        </span>
                      )}
                    </div>

                    {/* 財務資訊 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                      gap: '12px',
                      marginTop: '10px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          餘額
                        </div>
                        <div style={{
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: member.balance > 0 ? '#52c41a' : '#999',
                        }}>
                          ${member.balance.toFixed(0)}
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          指定課
                        </div>
                        <div style={{
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: member.designated_lesson_minutes > 0 ? '#faad14' : '#999',
                        }}>
                          {member.designated_lesson_minutes}分
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          G23船券
                        </div>
                        <div style={{
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: member.boat_voucher_g23_minutes > 0 ? '#1890ff' : '#999',
                        }}>
                          {member.boat_voucher_g23_minutes}分
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          G21船券
                        </div>
                        <div style={{
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: member.boat_voucher_g21_minutes > 0 ? '#13c2c2' : '#999',
                        }}>
                          {member.boat_voucher_g21_minutes}分
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右側：操作按鈕 */}
                  <div style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                  }}>
                    記帳 →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 說明卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: isMobile ? '16px' : '20px',
        borderRadius: '12px',
        marginTop: '20px',
        color: 'white',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>💡</span>
          <span>使用說明</span>
        </div>
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          fontSize: '14px',
          lineHeight: '1.8',
        }}>
          <li>點擊任何會員即可快速進行記帳操作</li>
          <li>支援儲值、購買船券/指定課、消耗、退款等操作</li>
          <li>所有交易都會自動記錄到財務系統</li>
          <li>可以搜尋會員姓名或電話快速定位</li>
        </ul>
      </div>

      <Footer />

      {/* 交易對話框 */}
      {selectedMember && (
        <TransactionDialog
          open={showTransactionDialog}
          member={selectedMember}
          onClose={() => {
            setShowTransactionDialog(false)
            setSelectedMember(null)
          }}
          onSuccess={handleTransactionSuccess}
        />
      )}
    </div>
  )
}
