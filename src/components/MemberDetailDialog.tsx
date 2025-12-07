import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { EditMemberDialog } from './EditMemberDialog'
import { TransactionDialog } from './TransactionDialog'
import { useToast } from './ui'

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
  start_date: string | null
  expires_at: string | null
  notes: string | null
  status: string | null
}

interface MemberNote {
  id: number
  member_id: string
  event_date: string
  event_type: string
  description: string
  created_at: string | null
  updated_at: string | null
}

// 事件類型選項
const EVENT_TYPES = [
  { value: '續約', label: '續約', color: '#4caf50' },
  { value: '購買', label: '購買', color: '#2196f3' },
  { value: '贈送', label: '贈送', color: '#9c27b0' },
  { value: '使用', label: '使用', color: '#ff9800' },
  { value: '入會', label: '入會', color: '#e91e63' },
  { value: '備註', label: '備註', color: '#607d8b' },
]

interface MemberDetailDialogProps {
  open: boolean
  memberId: string | null
  onClose: () => void
  onUpdate: () => void
}

export function MemberDetailDialog({ open, memberId, onClose, onUpdate }: MemberDetailDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [member, setMember] = useState<Member | null>(null)
  const [boardStorage, setBoardStorage] = useState<BoardStorage[]>([])
  const [memberNotes, setMemberNotes] = useState<MemberNote[]>([])
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false)
  const [boardFormData, setBoardFormData] = useState({
    slot_number: '',
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  // 備忘錄相關狀態
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<MemberNote | null>(null)
  const [noteFormData, setNoteFormData] = useState({
    event_date: '',
    event_type: '備註',
    description: ''
  })

  useEffect(() => {
    if (!open) {
      setEditDialogOpen(false)
      setTransactionDialogOpen(false)
      setAddBoardDialogOpen(false)
      setNoteDialogOpen(false)
      setEditingNote(null)
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
      
      // 載入備忘錄
      loadMemberNotes()
    } catch (error) {
      console.error('載入會員資料失敗:', error)
      toast.error('載入會員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  // 載入會員備忘錄
  const loadMemberNotes = async () => {
    if (!memberId) return
    
    try {
      // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
      const { data, error } = await supabase
        .from('member_notes')
        .select('*')
        .eq('member_id', memberId)
        .order('event_date', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setMemberNotes(data || [])
    } catch (error) {
      console.error('載入備忘錄失敗:', error)
    }
  }

  // 新增/編輯備忘錄
  const handleSaveNote = async () => {
    if (!memberId || !noteFormData.event_date || !noteFormData.description.trim()) {
      toast.warning('請填寫日期和說明')
      return
    }

    try {
      if (editingNote) {
        // 編輯
        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        const { error } = await supabase
          .from('member_notes')
          .update({
            event_date: noteFormData.event_date,
            event_type: noteFormData.event_type,
            description: noteFormData.description.trim()
          })
          .eq('id', editingNote.id)

        if (error) throw error
        toast.success('備忘錄已更新')
      } else {
        // 新增
        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        const { error } = await supabase
          .from('member_notes')
          .insert([{
            member_id: memberId,
            event_date: noteFormData.event_date,
            event_type: noteFormData.event_type,
            description: noteFormData.description.trim()
          }])

        if (error) throw error
        toast.success('備忘錄已新增')
      }

      setNoteDialogOpen(false)
      setEditingNote(null)
      setNoteFormData({ event_date: '', event_type: '備註', description: '' })
      loadMemberNotes()
    } catch (error) {
      console.error('儲存備忘錄失敗:', error)
      toast.error('儲存失敗')
    }
  }

  // 刪除備忘錄
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('確定要刪除這則備忘錄嗎？')) return

    try {
      // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
      const { error } = await supabase
        .from('member_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      toast.success('備忘錄已刪除')
      loadMemberNotes()
    } catch (error) {
      console.error('刪除備忘錄失敗:', error)
      toast.error('刪除失敗')
    }
  }

  // 開啟編輯備忘錄
  const handleEditNote = (note: MemberNote) => {
    setEditingNote(note)
    setNoteFormData({
      event_date: note.event_date,
      event_type: note.event_type,
      description: note.description
    })
    setNoteDialogOpen(true)
  }

  // 開啟新增備忘錄
  const handleAddNote = () => {
    setEditingNote(null)
    setNoteFormData({ 
      event_date: new Date().toISOString().split('T')[0], 
      event_type: '備註', 
      description: '' 
    })
    setNoteDialogOpen(true)
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
      toast.warning('請輸入格位編號')
      return
    }

    const slotNumber = parseInt(boardFormData.slot_number)
    if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
      toast.warning('格位編號必須是 1-145 之間的數字')
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .insert([{
          member_id: memberId,
          slot_number: slotNumber,
          start_date: boardFormData.start_date || null,
          expires_at: boardFormData.expires_at || null,
          notes: boardFormData.notes.trim() || null,
          status: 'active'
        }])

      if (error) {
        if (error.code === '23505') {
          toast.warning(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
        } else {
          throw error
        }
        return
      }
      setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
      setAddBoardDialogOpen(false)
      loadMemberData()
      onUpdate()
    } catch (error) {
      console.error('新增置板失敗:', error)
      toast.error('新增置板失敗')
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
      toast.error('刪除置板失敗')
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
              {/* 內容區 */}
              <div style={{ padding: isMobile ? '16px' : '20px' }}>
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
                        {(member.membership_start_date || member.membership_end_date) && (
                          <InfoRow 
                            label="📅 會籍" 
                            value={`${member.membership_start_date ? `開始：${member.membership_start_date}` : ''}${member.membership_start_date && member.membership_end_date ? '　' : ''}${member.membership_end_date ? `到期：${member.membership_end_date}${isExpired(member.membership_end_date) ? ' (已過期)' : ''}` : ''}`}
                            highlight={member.membership_end_date ? (isExpired(member.membership_end_date) || isExpiringSoon(member.membership_end_date)) : false}
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

                    {/* 備忘錄 */}
                    <div style={{ marginBottom: '30px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '15px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
                          📝 備忘錄 {memberNotes.length > 0 && `(${memberNotes.length})`}
                        </h3>
                        <button
                          onClick={handleAddNote}
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          ➕ 新增
                        </button>
                      </div>
                      
                      {memberNotes.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '30px 20px', 
                          color: '#999',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                          <div style={{ fontSize: '14px' }}>尚無備忘錄</div>
                        </div>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '10px',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {memberNotes.map((note) => {
                            const eventType = EVENT_TYPES.find(t => t.value === note.event_type) || EVENT_TYPES[5]
                            return (
                              <div
                                key={note.id}
                                style={{
                                  background: '#f8f9fa',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  borderLeft: `4px solid ${eventType.color}`,
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px',
                                      marginBottom: '4px',
                                    }}>
                                      <span style={{
                                        background: eventType.color,
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                      }}>
                                        {eventType.label}
                                      </span>
                                      <span style={{ color: '#666', fontSize: '12px' }}>
                                        {note.event_date || ''}
                                      </span>
                                    </div>
                                    <div style={{ 
                                      fontSize: '13px', 
                                      color: '#333',
                                      lineHeight: '1.4',
                                    }}>
                                      {note.description}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                    <button
                                      onClick={() => handleEditNote(note)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#e3f2fd',
                                        color: '#1976d2',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteNote(note.id)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#ffebee',
                                        color: '#d32f2f',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
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
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
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

              {/* 置板開始 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板開始 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={boardFormData.start_date}
                  onChange={(e) => setBoardFormData({ ...boardFormData, start_date: e.target.value })}
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
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
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

      {/* 新增/編輯備忘錄對話框 */}
      {noteDialogOpen && (
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
                {editingNote ? '✏️ 編輯備忘錄' : '➕ 新增備忘錄'}
              </h2>
              <button
                onClick={() => {
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
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
              {/* 事件日期 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  事件日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={noteFormData.event_date}
                  onChange={(e) => setNoteFormData({ ...noteFormData, event_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* 事件類型 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  事件類型
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNoteFormData({ ...noteFormData, event_type: type.value })}
                      style={{
                        padding: '8px 14px',
                        border: noteFormData.event_type === type.value 
                          ? `2px solid ${type.color}` 
                          : '2px solid #e0e0e0',
                        borderRadius: '20px',
                        background: noteFormData.event_type === type.value 
                          ? type.color 
                          : 'white',
                        color: noteFormData.event_type === type.value 
                          ? 'white' 
                          : '#666',
                        fontSize: '13px',
                        fontWeight: noteFormData.event_type === type.value ? '600' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 說明 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  說明 <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea
                  value={noteFormData.description}
                  onChange={(e) => setNoteFormData({ ...noteFormData, description: e.target.value })}
                  placeholder="請輸入備忘錄內容..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
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
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
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
                onClick={handleSaveNote}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {editingNote ? '儲存變更' : '確認新增'}
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

// 輔助函數
function getMembershipTypeLabel(type: string): string {
  switch (type) {
    case 'general': return '會員'
    case 'dual': return '雙人會員'
    case 'guest': return '非會員'
    default: return type || '會員'
  }
}

function isExpired(dateString: string): boolean {
  const expiryDate = new Date(dateString)
  const today = new Date()
  return expiryDate < today
}

function isExpiringSoon(dateString: string): boolean {
  const expiryDate = new Date(dateString)
  const today = new Date()
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
}

