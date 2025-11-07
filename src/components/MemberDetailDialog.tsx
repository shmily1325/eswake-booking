import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { EditMemberDialog } from './EditMemberDialog'
import { TransactionDialog } from './TransactionDialog'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  email: string | null
  line_id: string | null
  balance: number
  designated_lesson_minutes: number
  boat_voucher_minutes: number
  membership_expires_at: string | null
  has_board_storage: boolean
  board_storage_expires_at: string | null
  board_storage_location: string | null
  member_type: string
  notes: string | null
  status: string
  created_at: string
}

interface Transaction {
  id: number
  transaction_type: string
  category: string
  amount: number | null
  minutes: number | null
  description: string
  created_at: string
}

interface MemberDetailDialogProps {
  open: boolean
  memberId: string | null
  onClose: () => void
  onUpdate: () => void
}

export function MemberDetailDialog({ open, memberId, onClose, onUpdate }: MemberDetailDialogProps) {
  const { isMobile } = useResponsive()
  const [member, setMember] = useState<Member | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'transactions'>('info')

  useEffect(() => {
    if (open && memberId) {
      loadMemberData()
    }
  }, [open, memberId])

  const loadMemberData = async () => {
    if (!memberId) return
    
    setLoading(true)
    try {
      // 載入會員資料
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single()

      if (memberError) throw memberError
      setMember(memberData)

      // 載入交易記錄
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('member_transactions')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (transactionsError) throw transactionsError
      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('載入會員資料失敗:', error)
      alert('載入會員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleEditSuccess = () => {
    loadMemberData()
    onUpdate()
  }

  const handleTransactionSuccess = () => {
    loadMemberData()
    onUpdate()
  }

  if (!open || !memberId) return null

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: isMobile ? '12px 12px 0 0' : '12px',
          maxWidth: isMobile ? '100%' : '800px',
          width: '100%',
          maxHeight: isMobile ? '95vh' : '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          margin: isMobile ? 'auto 0 0 0' : 'auto',
        }}>
          {/* 標題欄 */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              會員詳情
            </h2>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '0 8px',
              }}
            >
              ×
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>載入中...</div>
          ) : !member ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>找不到會員資料</div>
          ) : (
            <>
              {/* 標籤切換 */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #e0e0e0',
                background: '#f8f9fa',
              }}>
                <button
                  onClick={() => setActiveTab('info')}
                  style={{
                    flex: 1,
                    padding: '15px',
                    border: 'none',
                    background: activeTab === 'info' ? 'white' : 'transparent',
                    borderBottom: activeTab === 'info' ? '2px solid #667eea' : 'none',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'info' ? 'bold' : 'normal',
                    color: activeTab === 'info' ? '#667eea' : '#666',
                  }}
                >
                  基本資料
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  style={{
                    flex: 1,
                    padding: '15px',
                    border: 'none',
                    background: activeTab === 'transactions' ? 'white' : 'transparent',
                    borderBottom: activeTab === 'transactions' ? '2px solid #667eea' : 'none',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'transactions' ? 'bold' : 'normal',
                    color: activeTab === 'transactions' ? '#667eea' : '#666',
                  }}
                >
                  交易記錄 ({transactions.length})
                </button>
              </div>

              {/* 內容區 */}
              <div style={{ padding: isMobile ? '16px' : '20px' }}>
                {activeTab === 'info' ? (
                  <>
                    {/* 基本資料 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>👤 基本資料</h3>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <InfoRow label="姓名" value={member.name} />
                        <InfoRow label="暱稱" value={member.nickname || '-'} />
                        <InfoRow label="生日" value={member.birthday || '-'} />
                        <InfoRow label="電話" value={member.phone || '-'} />
                        <InfoRow label="Email" value={member.email || '-'} />
                        <InfoRow label="LINE ID" value={member.line_id || '-'} />
                        <InfoRow label="會員類型" value={getMemberTypeLabel(member.member_type)} />
                        {member.notes && <InfoRow label="備註" value={member.notes} />}
                      </div>
                    </div>

                    {/* 財務資訊 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>💰 財務資訊</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '15px' }}>
                        <BalanceCard
                          icon="💵"
                          label="餘額"
                          value={`$${member.balance.toFixed(0)}`}
                          color="#1890ff"
                        />
                        <BalanceCard
                          icon="⏱️"
                          label="指定課"
                          value={`${member.designated_lesson_minutes} 分鐘`}
                          color="#faad14"
                        />
                        <BalanceCard
                          icon="🚤"
                          label="船券"
                          value={`${member.boat_voucher_minutes} 分鐘`}
                          color="#52c41a"
                        />
                      </div>
                    </div>

                    {/* 服務資訊 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>🎫 服務資訊</h3>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <InfoRow 
                          label="會籍到期" 
                          value={member.membership_expires_at || '無會籍'}
                          highlight={member.membership_expires_at ? isExpiringSoon(member.membership_expires_at) : false}
                        />
                        <InfoRow 
                          label="置板服務" 
                          value={member.has_board_storage ? '已開通' : '未開通'}
                        />
                        {member.has_board_storage && (
                          <>
                            <InfoRow 
                              label="置板到期" 
                              value={member.board_storage_expires_at || '-'}
                              highlight={member.board_storage_expires_at ? isExpiringSoon(member.board_storage_expires_at) : false}
                            />
                            <InfoRow 
                              label="置板位置" 
                              value={member.board_storage_location || '-'}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* 操作按鈕 */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginTop: '30px',
                    }}>
                      <button
                        onClick={() => setEditDialogOpen(true)}
                        style={{
                          flex: isMobile ? '1 1 100%' : '1',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                        }}
                      >
                        ✏️ 編輯資料
                      </button>
                      <button
                        onClick={() => setTransactionDialogOpen(true)}
                        style={{
                          flex: isMobile ? '1 1 100%' : '1',
                          padding: '12px 20px',
                          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(17, 153, 142, 0.3)',
                        }}
                      >
                        💳 記賬
                      </button>
                    </div>
                  </>
                ) : (
                  // 交易記錄標籤
                  <div>
                    {transactions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                        尚無交易記錄
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {transactions.map((transaction) => (
                          <TransactionCard key={transaction.id} transaction={transaction} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 編輯會員對話框 */}
      {member && (
        <EditMemberDialog
          open={editDialogOpen}
          member={member}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* 記賬對話框 */}
      {member && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={member}
          onClose={() => setTransactionDialogOpen(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}
    </>
  )
}

// 輔助組件
function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <span style={{ color: '#666', fontWeight: '500' }}>{label}</span>
      <span style={{ 
        color: highlight ? '#ff4d4f' : '#333',
        fontWeight: highlight ? 'bold' : 'normal',
      }}>
        {value}
      </span>
    </div>
  )
}

function BalanceCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      background: `${color}10`,
      border: `2px solid ${color}30`,
      borderRadius: '10px',
      padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>{label}</div>
      <div style={{ color: color, fontSize: '20px', fontWeight: 'bold' }}>{value}</div>
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: Transaction }) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'charge': return '💰'
      case 'purchase': return '🛒'
      case 'consume': return '💸'
      case 'refund': return '↩️'
      case 'expire': return '⏰'
      case 'adjust': return '🔧'
      default: return '📝'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'balance': return '餘額'
      case 'designated_lesson': return '指定課'
      case 'boat_voucher': return '船券'
      case 'membership': return '會籍'
      case 'board_storage': return '置板'
      default: return category
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'charge': return '儲值'
      case 'purchase': return '購買'
      case 'consume': return '消耗'
      case 'refund': return '退款'
      case 'expire': return '過期'
      case 'adjust': return '調整'
      default: return type
    }
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '15px',
      display: 'flex',
      gap: '15px',
      alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: '24px' }}>{getTransactionIcon(transaction.transaction_type)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {getTypeLabel(transaction.transaction_type)} - {getCategoryLabel(transaction.category)}
        </div>
        <div style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>
          {transaction.description}
        </div>
        <div style={{ fontSize: '13px', color: '#999' }}>
          {new Date(transaction.created_at).toLocaleString('zh-TW')}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {transaction.amount !== null && (
          <div style={{
            color: transaction.amount > 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: 'bold',
            fontSize: '16px',
          }}>
            {transaction.amount > 0 ? '+' : ''}{transaction.amount}
          </div>
        )}
        {transaction.minutes !== null && (
          <div style={{
            color: transaction.minutes > 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: 'bold',
            fontSize: '16px',
          }}>
            {transaction.minutes > 0 ? '+' : ''}{transaction.minutes} 分鐘
          </div>
        )}
      </div>
    </div>
  )
}

// 輔助函數
function getMemberTypeLabel(type: string): string {
  switch (type) {
    case 'regular': return '一般會員'
    case 'vip': return 'VIP 會員'
    case 'board_only': return '僅置板會員'
    default: return type
  }
}

function isExpiringSoon(dateString: string): boolean {
  const expiryDate = new Date(dateString)
  const today = new Date()
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
}

