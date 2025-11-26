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
  balance: number | null
  vip_voucher_amount: number | null
  designated_lesson_minutes: number | null
  boat_voucher_g23_minutes: number | null
  boat_voucher_g21_panther_minutes: number | null
  boat_voucher_g21_minutes: number | null
  gift_boat_hours: number | null
  free_hours: number | null
  free_hours_notes: string | null
  free_hours_used: number | null
  membership_end_date: string | null
  membership_start_date: string | null
  membership_type: string | null
  membership_partner_id: string | null
  board_slot_number: string | null
  board_expiry_date: string | null
  notes: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  partner?: { id: string, name: string, nickname: string | null } | null
}

interface BoardStorage {
  id: number
  slot_number: number
  expires_at: string | null
  notes: string | null
  status: string | null
}

interface Transaction {
  id: number
  transaction_type: string
  category: string
  amount: number | null
  minutes: number | null
  description: string
  created_at: string | null
  transaction_date?: string | null
  notes?: string | null
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
  const [boardStorage, setBoardStorage] = useState<BoardStorage[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'boards'>('info')
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false)
  const [boardFormData, setBoardFormData] = useState({
    slot_number: '',
    expires_at: '',
    notes: ''
  })

  useEffect(() => {
    if (!open) {
      setEditDialogOpen(false)
      setTransactionDialogOpen(false)
      setAddBoardDialogOpen(false)
      setActiveTab('info')
    }
  }, [open])

  useEffect(() => {
    if (open && memberId) {
      loadMemberData()
    }
  }, [open, memberId])

  const loadMemberData = async () => {
    if (!memberId) return
    
    setLoading(true)
    try {
      // 優化：只載入會員和置板資料，交易記錄延遲載入
      const [memberResult, boardResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('id', memberId)
          .single(),
        supabase
          .from('board_storage')
          .select('*')
          .eq('member_id', memberId)
          .eq('status', 'active')
          .order('slot_number', { ascending: true })
      ])

      if (memberResult.error) throw memberResult.error
      
      const memberData = memberResult.data
      
      // 如果有配對會員，載入配對會員資料
      let partnerData = null
      if (memberData.membership_partner_id) {
        const { data: partner } = await supabase
          .from('members')
          .select('id, name, nickname')
          .eq('id', memberData.membership_partner_id)
          .single()
        partnerData = partner
      }
      
      setMember({ ...memberData, partner: partnerData })

      if (boardResult.error) throw boardResult.error
      setBoardStorage(boardResult.data || [])
      
      // 交易記錄延遲載入（在需要時才載入）
      loadTransactions()
    } catch (error) {
      console.error('載入會員資料失敗:', error)
      alert('載入會員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  // 延遲載入交易記錄（僅預覽用，完整記錄請至「儲值」頁面查看）
  const loadTransactions = async () => {
    if (!memberId) return
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', memberId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20)  // 只顯示最近 20 筆作為快速預覽

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('載入交易記錄失敗:', error)
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

  const handleAddBoard = async () => {
    if (!memberId || !boardFormData.slot_number) {
      alert('請輸入格位編號')
      return
    }

    const slotNumber = parseInt(boardFormData.slot_number)
    if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
      alert('格位編號必須是 1-145 之間的數字')
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .insert([{
          member_id: memberId,
          slot_number: slotNumber,
          expires_at: boardFormData.expires_at || null,
          notes: boardFormData.notes.trim() || null,
          status: 'active'
        }])

      if (error) {
        if (error.code === '23505') {
          alert(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
        } else {
          throw error
        }
        return
      }
      setBoardFormData({ slot_number: '', expires_at: '', notes: '' })
      setAddBoardDialogOpen(false)
      loadMemberData()
      onUpdate()
    } catch (error) {
      console.error('新增置板失敗:', error)
      alert('新增置板失敗')
    }
  }

  const handleDeleteBoard = async (boardId: number, slotNumber: number) => {
    if (!confirm(`確定要刪除格位 ${slotNumber} 嗎？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .update({ status: 'cancelled' })
        .eq('id', boardId)

      if (error) throw error
      loadMemberData()
      onUpdate()
    } catch (error) {
      console.error('刪除置板失敗:', error)
      alert('刪除置板失敗')
    }
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
          WebkitOverflowScrolling: 'touch',
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
                {/* 暫時隱藏交易記錄功能 */}
                {/* <button
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
                </button> */}
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
                        <InfoRow label="會籍類型" value={getMembershipTypeLabel(member.membership_type || 'personal')} />
                        {member.notes && <InfoRow label="備註" value={member.notes} />}
                      </div>
                    </div>

                    {/* 儲值資訊 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>💰 儲值資訊</h3>
                      <div style={{ 
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        padding: '15px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <InfoRow label="💵 儲值" value={`$${(member.balance ?? 0).toFixed(0)}`} />
                        <InfoRow label="🎁 VIP 票券" value={`$${(member.vip_voucher_amount ?? 0).toFixed(0)}`} />
                        <InfoRow label="🚤 G23 船券" value={`${member.boat_voucher_g23_minutes ?? 0} 分鐘`} />
                        <InfoRow label="⛵ G21/黑豹共通船券" value={`${member.boat_voucher_g21_panther_minutes ?? 0} 分鐘`} />
                        <InfoRow label="⏱️ 贈送大船時數" value={`${member.gift_boat_hours ?? 0} 分鐘`} />
                        <InfoRow label="📚 指定課時數" value={`${member.designated_lesson_minutes ?? 0} 分鐘`} />
                      </div>
                    </div>

                    {/* 置板資訊 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>🏄 置板服務</h3>
                      <div style={{ 
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        padding: '15px',
                        border: '1px solid #e0e0e0'
                      }}>
                        {boardStorage.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#999', fontSize: '14px' }}>
                            尚無置板記錄
                          </div>
                        ) : (
                          <div>
                            {boardStorage.map((board, index) => (
                              <div key={board.id}>
                                {index > 0 && <div style={{ height: '1px', background: '#dee2e6', margin: '10px 0' }} />}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 'bold' }}>#{board.slot_number}</span>
                                    {board.expires_at && <span style={{ color: '#666', marginLeft: '10px', fontSize: '13px' }}>({board.expires_at})</span>}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteBoard(board.id, board.slot_number)}
                                    style={{
                                      padding: '4px 12px',
                                      background: '#f44336',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#d32f2f'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f44336'}
                                  >
                                    移除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 會員服務 */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>🎫 會員服務</h3>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {member.membership_start_date && (
                          <InfoRow label="會籍開始" value={member.membership_start_date} />
                        )}
                        {member.membership_end_date && (
                          <InfoRow 
                            label="會籍到期" 
                            value={member.membership_end_date}
                            highlight={isExpiringSoon(member.membership_end_date)}
                          />
                        )}
                        {member.membership_type === 'dual' && member.partner && (
                          <InfoRow 
                            label="🔗 配對會員" 
                            value={member.partner.nickname || member.partner.name} 
                          />
                        )}
                      </div>
                    </div>

                    {/* 最近交易記錄（預覽） */}
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px', color: '#333' }}>📜 最近交易記錄</h3>
                      
                      {/* 提示訊息 */}
                      <div style={{
                        background: '#f0f7ff',
                        border: '1px solid #d0e5ff',
                        borderRadius: '6px',
                        padding: '10px 15px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: '#1976d2'
                      }}>
                        💡 僅顯示最近 20 筆記錄，完整交易記錄請至「儲值」頁面查看
                      </div>

                      {/* 交易記錄列表 */}
                      <div style={{ 
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        padding: '15px',
                        border: '1px solid #e0e0e0',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        {transactions.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#999', fontSize: '14px', padding: '20px 0' }}>
                            尚無交易記錄
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {transactions.slice(0, 20).map((transaction) => {
                              const isIncrease = transaction.transaction_type === 'charge'
                              return (
                                <div key={transaction.id} style={{
                                  padding: '10px',
                                  background: 'white',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  borderLeft: '3px solid ' + (transaction.transaction_type === 'charge' ? '#4caf50' : transaction.transaction_type === 'consume' ? '#f44336' : '#ff9800')
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                        {transaction.category === 'balance' ? '💰 儲值' :
                                         transaction.category === 'vip_voucher' ? '💎 VIP票券' :
                                         transaction.category === 'designated_lesson' ? '📚 指定課' :
                                         transaction.category === 'boat_voucher_g23' ? '🚤 G23船券' :
                                         transaction.category === 'boat_voucher_g21_panther' ? '⛵ G21/黑豹船券' :
                                         transaction.category === 'gift_boat_hours' ? '🎁 贈送大船' :
                                         transaction.transaction_type === 'charge' ? '💰 儲值' : 
                                         transaction.transaction_type === 'consume' ? '💳 消費' : 
                                         transaction.transaction_type === 'refund' ? '↩️ 退款' : '🔧 調整'}
                                      </div>
                                      <div style={{ color: '#999', fontSize: '11px' }}>
                                        {transaction.transaction_date || (transaction.created_at ? transaction.created_at.substring(0, 10) : '-')}
                                      </div>
                                    </div>
                                    <div style={{
                                      fontSize: '16px',
                                      fontWeight: 'bold',
                                      color: isIncrease ? '#4caf50' : '#f44336',
                                      whiteSpace: 'nowrap',
                                      marginLeft: '10px'
                                    }}>
                                      {isIncrease ? '+' : '-'}
                                      {transaction.amount !== null && transaction.amount !== undefined 
                                        ? `$${Math.abs(transaction.amount).toLocaleString()}`
                                        : `${Math.abs(transaction.minutes || 0)}分`}
                                    </div>
                                  </div>
                                  <div style={{ color: '#666', fontSize: '12px', lineHeight: '1.4' }}>
                                    {transaction.description || '-'}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
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
                        type="button"
                        onClick={() => setEditDialogOpen(true)}
                        style={{
                          flex: isMobile ? '1 1 100%' : '1',
                          padding: '12px 20px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        ✏️ 編輯資料
                      </button>
                      {/* 暫時隱藏記帳功能 */}
                      {/* <button
                        onClick={() => setTransactionDialogOpen(true)}
                        style={{
                          flex: isMobile ? '1 1 100%' : '1',
                          padding: '12px 20px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        💳 記帳
                      </button> */}
                    </div>

                    {isMobile && (
                      <div style={{ height: '80px' }} />
                    )}
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
                    {isMobile && (
                      <div style={{ height: '80px' }} />
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

      {/* 記帳對話框 */}
      {member && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={member}
          onClose={() => setTransactionDialogOpen(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {/* 新增置板對話框 */}
      {addBoardDialogOpen && (
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
          zIndex: 2000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
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
                新增置板
              </h2>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', expires_at: '', notes: '' })
                }}
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

            {/* 表單 */}
            <div style={{ padding: '20px' }}>
              {/* 格位編號 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  格位編號 <span style={{ color: 'red' }}>*</span>
                  <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（1-145）</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={boardFormData.slot_number}
                  onChange={(e) => {
                    const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                    const num = Number(numValue)
                    if (num >= 1 && num <= 145) {
                      setBoardFormData({ ...boardFormData, slot_number: numValue })
                    } else if (numValue === '') {
                      setBoardFormData({ ...boardFormData, slot_number: '' })
                    }
                  }}
                  placeholder="請輸入格位編號"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* 置板到期 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板到期 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={boardFormData.expires_at}
                  onChange={(e) => setBoardFormData({ ...boardFormData, expires_at: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* 置板備註 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板備註 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="text"
                  value={boardFormData.notes}
                  onChange={(e) => setBoardFormData({ ...boardFormData, notes: e.target.value })}
                  placeholder="例如：有三格"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* 按鈕 */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', expires_at: '', notes: '' })
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddBoard}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
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
      case 'balance': return '儲值'
      case 'vip_voucher': return 'VIP票券'
      case 'designated_lesson': return '指定課'
      case 'boat_voucher': return '船券'
      case 'boat_voucher_g23': return 'G23船券'
      case 'boat_voucher_g21': return 'G21船券'
      case 'boat_voucher_g21_panther': return 'G21/黑豹船券'
      case 'gift_boat_hours': return '贈送大船'
      case 'membership': return '會籍'
      case 'board_storage': return '置板'
      case 'lesson': return '教練課程'
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
          {transaction.created_at ? new Date(transaction.created_at).toLocaleString('zh-TW') : '-'}
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
function getMembershipTypeLabel(type: string): string {
  switch (type) {
    case 'general': return '會員'
    case 'dual': return '雙人會員'
    case 'guest': return '非會員'
    default: return type || '會員'
  }
}

function isExpiringSoon(dateString: string): boolean {
  const expiryDate = new Date(dateString)
  const today = new Date()
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
}

