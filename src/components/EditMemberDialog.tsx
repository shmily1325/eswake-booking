import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  membership_type: string | null
  membership_start_date: string | null
  membership_end_date: string | null
  membership_partner_id: string | null
  gift_boat_hours: number | null
  notes: string | null
  partner?: { id: string, name: string, nickname: string | null } | null
}

interface EditMemberDialogProps {
  open: boolean
  member: Member
  onClose: () => void
  onSuccess: () => void
}

export function EditMemberDialog({ open, member, onClose, onSuccess }: EditMemberDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [allMembers, setAllMembers] = useState<Array<{id: string, name: string, nickname: string | null}>>([])
  const [boardSlots, setBoardSlots] = useState<Array<{id?: number, slot_number: string, start_date: string, expires_at: string}>>([])
  const [formData, setFormData] = useState({
    name: member.name,
    nickname: member.nickname || '',
    birthday: member.birthday || '',
    phone: member.phone || '',
    membership_type: member.membership_type || 'general',
    membership_start_date: member.membership_start_date || '',
    membership_end_date: member.membership_end_date || '',
    membership_partner_id: member.membership_partner_id || '',
    notes: member.notes || '',
  })

  // 載入會員列表（用於配對選擇）
  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname')
      .eq('status', 'active')
      .neq('id', member.id)  // 排除自己
      .order('name')
    if (data) setAllMembers(data)
  }

  // 載入會員的置板格位
  const loadBoardSlots = async () => {
    const { data } = await supabase
      .from('board_storage')
      .select('id, slot_number, start_date, expires_at')
      .eq('member_id', member.id)
      .eq('status', 'active')
      .order('slot_number')
    if (data) {
      setBoardSlots(data.map(slot => ({
        id: slot.id,
        slot_number: String(slot.slot_number),
        start_date: slot.start_date || '',
        expires_at: slot.expires_at || ''
      })))
    }
  }

  useEffect(() => {
    if (!open) {
      // 对话框关闭时重置状态
      setBoardSlots([])
      return
    }

    loadMembers()
    loadBoardSlots()
    
    setFormData({
      name: member.name,
      nickname: member.nickname || '',
      birthday: member.birthday || '',
      phone: member.phone || '',
      membership_type: member.membership_type || 'general',
      membership_start_date: member.membership_start_date || '',
      membership_end_date: member.membership_end_date || '',
      membership_partner_id: member.membership_partner_id || '',
      notes: member.notes || '',
    })
  }, [member, open])

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '12px' : '10px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '14px',
    transition: 'border-color 0.2s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#5a5a5a'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e0e0e0'
  }

  // 添加新置板格位
  const handleAddBoardSlot = () => {
    setBoardSlots([...boardSlots, { slot_number: '', start_date: '', expires_at: '' }])
  }

  // 刪除置板格位
  const handleRemoveBoardSlot = async (index: number) => {
    const slot = boardSlots[index]
    if (slot.id) {
      // 如果有 ID，從資料庫真正刪除
      const { error } = await supabase
        .from('board_storage')
        .delete()
        .eq('id', slot.id)
      
      if (error) {
        toast.error('刪除失敗：' + error.message)
        return
      }
      toast.success(`已刪除格位 #${slot.slot_number}`)
    }
    // 從列表中移除
    setBoardSlots(boardSlots.filter((_, i) => i !== index))
  }

  // 更新置板格位
  const handleUpdateBoardSlot = (index: number, field: 'slot_number' | 'start_date' | 'expires_at', value: string) => {
    const newSlots = [...boardSlots]
    newSlots[index][field] = value
    setBoardSlots(newSlots)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const trimmedPhone = formData.phone.trim()
      if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
        toast.warning('電話需為 09 開頭的 10 位數字')
        setLoading(false)
        return
      }

      // 1. 更新會員資料
      const { error } = await supabase
        .from('members')
        .update({
          name: formData.name,
          nickname: formData.nickname || null,
          birthday: formData.birthday || null,
          phone: formData.phone || null,
          membership_type: formData.membership_type,
          membership_start_date: formData.membership_start_date || null,
          membership_end_date: formData.membership_end_date || null,
          membership_partner_id: formData.membership_partner_id || null,
          notes: formData.notes || null,
        })
        .eq('id', member.id)

      if (error) throw error

      // 處理置板格位
      for (const slot of boardSlots) {
        const slotNumber = parseInt(slot.slot_number)
        if (!slot.slot_number || slot.slot_number.trim() === '') {
          continue // 跳過空的格位
        }
        
        if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
          toast.warning(`格位編號 ${slot.slot_number} 必須是 1-145 之間的數字`)
          setLoading(false)
          return
        }

        if (slot.id) {
          // 更新現有置板
          const { error } = await supabase
            .from('board_storage')
            .update({
              slot_number: slotNumber,
              start_date: slot.start_date || null,
              expires_at: slot.expires_at || null,
              status: 'active'
            })
            .eq('id', slot.id)
          if (error) throw error
        } else {
          // 新增置板
          const { error } = await supabase
            .from('board_storage')
            .insert({
              member_id: member.id,
              slot_number: slotNumber,
              start_date: slot.start_date || null,
              expires_at: slot.expires_at || null,
              status: 'active'
            })
          if (error) {
            if (error.code === '23505') {
              toast.warning(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
              setLoading(false)
              return
            }
            throw error
          }
        }
      }

      // 2. 處理配對變更
      const oldPartnerId = member.membership_partner_id
      const newPartnerId = formData.membership_partner_id || null

      if (oldPartnerId !== newPartnerId) {
        // 如果有舊配對，解除舊配對
        if (oldPartnerId) {
          await supabase
            .from('members')
            .update({ membership_partner_id: null })
            .eq('id', oldPartnerId)
        }

        // 如果有新配對，建立新配對（雙向）
        if (newPartnerId) {
          await supabase
            .from('members')
            .update({ membership_partner_id: member.id })
            .eq('id', newPartnerId)
        }
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('更新失敗:', error)
      toast.error('更新失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
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
      zIndex: 1001,
      padding: isMobile ? '0' : '16px',
      overflowY: isMobile ? 'hidden' : 'auto',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '16px 16px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '600px',
        width: '100%',
        maxHeight: isMobile ? '80vh' : '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        margin: isMobile ? 'auto 0 0 0' : 'auto',
      }}>
        {/* 標題欄 */}
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: 'white',
        }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: 'bold' }}>
            ✏️ 編輯會員資料
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '28px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#666',
              padding: '0 8px',
              opacity: loading ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 內容區域 - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '20px' : '20px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <form onSubmit={handleSubmit} id="edit-member-form">
            {/* 姓名 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                姓名 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              />
            </div>

            {/* 暱稱 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                暱稱 <span style={{ fontSize: '13px', color: '#999' }}>（可輸入多個）</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="請輸入暱稱"
                maxLength={100}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 生日 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                生日
              </label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 電話 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                電話
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="請輸入電話"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 會籍類型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                會籍類型 <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={formData.membership_type}
                onChange={(e) => setFormData({ ...formData, membership_type: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              >
                <option value="general">會員</option>
                <option value="dual">雙人會員</option>
                <option value="guest">非會員</option>
                <option value="es">ES</option>
              </select>
            </div>

            {/* 會員日期 */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {/* 會員開始日期 */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  會員開始日期
                </label>
                <input
                  type="date"
                  value={formData.membership_start_date}
                  onChange={(e) => setFormData({ ...formData, membership_start_date: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* 會員截止日期 */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  會員截止日期
                </label>
                <input
                  type="date"
                  value={formData.membership_end_date}
                  onChange={(e) => setFormData({ ...formData, membership_end_date: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            {/* 配對會員 - 只在選擇「雙人會籍」時顯示 */}
            {formData.membership_type === 'dual' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2196F3' }}>
                  🔗 配對會員
                </label>
                <select
                  value={formData.membership_partner_id}
                  onChange={(e) => setFormData({ ...formData, membership_partner_id: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">請選擇配對會員</option>
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nickname || m.name}
                    </option>
                  ))}
                </select>
                {member.partner && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    目前配對：{member.partner.nickname || member.partner.name}
                  </div>
                )}
              </div>
            )}

            {/* 置板資訊 */}
            <div style={{
              background: '#e8f5e9',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h3 style={{ 
                  margin: 0,
                  fontSize: '15px', 
                  fontWeight: '600',
                  color: '#2e7d32',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🏄 置板資訊
                </h3>
                <button
                  type="button"
                  onClick={handleAddBoardSlot}
                  style={{
                    padding: '6px 12px',
                    background: '#2e7d32',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  + 新增格位
                </button>
              </div>
              
              {boardSlots.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#666', 
                  fontSize: '13px',
                  padding: '20px'
                }}>
                  尚無置板格位，點擊「新增格位」添加
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {boardSlots.map((slot, index) => (
                    <div key={index} style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #c8e6c9'
                    }}>
                      <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px' }}>
                            格位編號 (1-145)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={slot.slot_number}
                            onChange={(e) => {
                              const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                              const num = Number(numValue)
                              if ((num >= 1 && num <= 145) || numValue === '') {
                                handleUpdateBoardSlot(index, 'slot_number', numValue)
                              }
                            }}
                            placeholder="例如：1"
                            style={{...inputStyle, fontSize: '14px'}}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px' }}>
                            開始日期
                          </label>
                          <input
                            type="date"
                            value={slot.start_date}
                            onChange={(e) => handleUpdateBoardSlot(index, 'start_date', e.target.value)}
                            style={{...inputStyle, fontSize: '14px', maxWidth: '100%', boxSizing: 'border-box'}}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px' }}>
                            到期日期
                          </label>
                          <input
                            type="date"
                            value={slot.expires_at}
                            onChange={(e) => handleUpdateBoardSlot(index, 'expires_at', e.target.value)}
                            style={{...inputStyle, fontSize: '14px', maxWidth: '100%', boxSizing: 'border-box'}}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBoardSlot(index)}
                        style={{
                          padding: '4px 10px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 備註 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                備註
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="請輸入備註"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

          </form>
        </div>

        {/* 底部按鈕欄 - 固定底部 */}
        <div style={{
          padding: isMobile ? '12px 20px' : '20px 24px',
          borderTop: '1px solid #e0e0e0',
          background: 'white',
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          paddingBottom: isMobile ? 'max(20px, env(safe-area-inset-bottom))' : '20px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: isMobile ? '14px' : '12px 24px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              color: '#333',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            form="edit-member-form"
            disabled={loading}
            style={{
              flex: 1,
              padding: isMobile ? '14px' : '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
              color: 'white',
              fontSize: isMobile ? '16px' : '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              touchAction: 'manipulation',
              minHeight: isMobile ? '48px' : '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <span style={{ 
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                }} />
                更新中...
              </>
            ) : '✅ 確認更新'}
          </button>
        </div>
      </div>
    </div>
  )
}

