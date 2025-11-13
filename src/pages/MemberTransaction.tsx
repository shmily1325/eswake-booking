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
  nickname: string | null
  phone: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
  free_hours: number
  free_hours_used: number
  membership_type: string
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
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  // 載入會員列表
  const loadMembers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone, balance, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_minutes, free_hours, free_hours_used, membership_type, status')
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
        m.nickname?.toLowerCase().includes(lowerSearch) ||
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

  // 匯出總帳
  const handleExportAll = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('請選擇開始和結束日期')
      return
    }

    if (exportStartDate > exportEndDate) {
      alert('開始日期不能晚於結束日期')
      return
    }

    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          member_id(name, nickname)
        `)
        .gte('created_at', exportStartDate)
        .lte('created_at', exportEndDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        alert('所選時間範圍內沒有交易記錄')
        return
      }

      const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
          charge: '儲值',
          purchase: '購買',
          payment: '付款',
          refund: '退款',
          adjust: '調整',
        }
        return labels[type] || type
      }

      const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
          balance: '餘額',
          designated_lesson: '指定課',
          boat_voucher_g23: 'G23船券',
          boat_voucher_g21: 'G21船券',
          free_hours: '贈送時數',
          membership: '會籍',
          board_storage: '置板',
        }
        return labels[category] || category
      }

      const csv = [
        ['會員', '日期', '交易類型', '類別', '付款方式', '金額', '分鐘數', '說明', '備註', '餘額', '指定課', 'G23船券', 'G21船券'].join(','),
        ...data.map((t: any) => [
          `"${(t.member_id as any)?.nickname || (t.member_id as any)?.name || '未知'}"`,
          t.created_at.split('T')[0],
          getTypeLabel(t.transaction_type),
          getCategoryLabel(t.category),
          t.payment_method || '',
          t.amount || '',
          t.minutes || '',
          `"${t.description || ''}"`,
          `"${t.notes || ''}"`,
          t.balance_after || '',
          t.designated_lesson_minutes_after || '',
          t.boat_voucher_g23_minutes_after || '',
          t.boat_voucher_g21_minutes_after || ''
        ].join(','))
      ].join('\n')

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `總帳_${exportStartDate}_至_${exportEndDate}.csv`
      link.click()

      setShowExportDialog(false)
      setExportStartDate('')
      setExportEndDate('')
    } catch (error) {
      console.error('匯出失敗:', error)
      alert('匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="💳 會員記帳" user={user} showBaoLink={true} />

      {/* 使用說明 */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '20px',
        marginBottom: '16px',
        border: '1px solid #e0e0e0',
      }}>
        <div style={{
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '600',
          marginBottom: '8px',
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          💡 使用說明
        </div>
        <div style={{
          fontSize: isMobile ? '12px' : '13px',
          lineHeight: '1.6',
          color: '#666',
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>儲值 💰</strong>：客人充值到帳戶
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>付款 💸</strong>：預約結帳（現金/匯款/扣儲值/船券/指定課程）
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong style={{ color: '#333' }}>調整 🔧</strong>：修正錯誤、優惠補貼等（需填寫原因）
          </div>
          <div>
            <strong style={{ color: '#333' }}>退款 ↩️</strong>：退還款項給客人
          </div>
        </div>
      </div>

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
            placeholder="輸入會員暱稱/姓名/電話搜尋..."
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
          gap: '8px',
        }}>
          <span>找到 {filteredMembers.length} 位會員</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowExportDialog(true)}
              style={{
                padding: '6px 14px',
                background: 'white',
                color: '#666',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📥 匯出總帳
            </button>
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
                        {member.nickname ? `${member.nickname} (${member.name})` : member.name}
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
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
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

                      <div>
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginBottom: '4px',
                        }}>
                          贈送時數
                        </div>
                        <div style={{
                          fontSize: isMobile ? '16px' : '18px',
                          fontWeight: 'bold',
                          color: (member.free_hours - member.free_hours_used) > 0 ? '#eb2f96' : '#999',
                        }}>
                          {(member.free_hours - member.free_hours_used).toFixed(0)}分
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右側：操作按鈕 */}
                  <div style={{
                    padding: '8px 16px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
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
        background: '#f8f9fa',
        padding: isMobile ? '16px' : '20px',
        borderRadius: '12px',
        marginTop: '20px',
        border: '1px solid #e0e0e0',
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#333',
        }}>
          <span>💡</span>
          <span>使用說明</span>
        </div>
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          fontSize: '14px',
          lineHeight: '1.8',
          color: '#666',
        }}>
          <li>點擊任何會員即可快速進行記帳操作</li>
          <li>支援儲值、購買船券/指定課、付款、退款、調整等操作</li>
          <li>所有交易都會自動記錄到財務系統</li>
          <li>可以搜尋會員暱稱/姓名/電話快速定位</li>
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

      {/* 匯出總帳對話框 */}
      {showExportDialog && (
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
          zIndex: 1001,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                📥 匯出總帳
              </h2>
              <button
                onClick={() => setShowExportDialog(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  開始日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  結束日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#666',
                marginBottom: '16px',
              }}>
                💡 將匯出所選時間範圍內所有會員的交易記錄
              </div>
            </div>

            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowExportDialog(false)}
                disabled={exporting}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#666',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                取消
              </button>
              <button
                onClick={handleExportAll}
                disabled={exporting || !exportStartDate || !exportEndDate}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: (exporting || !exportStartDate || !exportEndDate) ? '#ccc' : '#52c41a',
                  color: 'white',
                  cursor: (exporting || !exportStartDate || !exportEndDate) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {exporting ? '匯出中...' : '確認匯出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
