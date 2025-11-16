import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  member_type: string
  membership_type: string
  membership_start_date: string | null
  membership_end_date: string | null
  membership_partner_id: string | null
  board_slot_number: string | null
  board_expiry_date: string | null
  gift_boat_hours: number
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
  const [loading, setLoading] = useState(false)
  const [allMembers, setAllMembers] = useState<Array<{id: string, name: string, nickname: string | null}>>([])
  const [formData, setFormData] = useState({
    name: member.name,
    nickname: member.nickname || '',
    birthday: member.birthday || '',
    phone: member.phone || '',
    membership_type: member.membership_type || 'general',
    membership_start_date: member.membership_start_date || '',
    membership_end_date: member.membership_end_date || '',
    membership_partner_id: member.membership_partner_id || '',
    board_slot_number: member.board_slot_number || '',
    board_expiry_date: member.board_expiry_date || '',
    gift_boat_hours: member.gift_boat_hours || 0,
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

  useEffect(() => {
    if (!open) return

    loadMembers()
    
    setFormData({
      name: member.name,
      nickname: member.nickname || '',
      birthday: member.birthday || '',
      phone: member.phone || '',
      membership_type: member.membership_type || 'general',
      membership_start_date: member.membership_start_date || '',
      membership_end_date: member.membership_end_date || '',
      membership_partner_id: member.membership_partner_id || '',
      board_slot_number: member.board_slot_number || '',
      board_expiry_date: member.board_expiry_date || '',
      gift_boat_hours: member.gift_boat_hours || 0,
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
    e.currentTarget.style.borderColor = '#667eea'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e0e0e0'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const trimmedPhone = formData.phone.trim()
      if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
        alert('電話需為 09 開頭的 10 位數字')
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
          member_type: 'member',
          membership_type: formData.membership_type,
          membership_start_date: formData.membership_start_date || null,
          membership_end_date: formData.membership_end_date || null,
          membership_partner_id: formData.membership_partner_id || null,
          board_slot_number: formData.board_slot_number || null,
          board_expiry_date: formData.board_expiry_date || null,
          gift_boat_hours: formData.gift_boat_hours || 0,
          notes: formData.notes || null,
        })
        .eq('id', member.id)

      if (error) throw error

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
      alert('更新失敗')
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
      padding: isMobile ? '0' : '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '12px 12px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '600px',
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
            編輯會員資料
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

        {/* 表單 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: isMobile ? '16px' : '20px' }}>
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
                placeholder="例如：阿明+那個男人 或 阿明/辣個男人"
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
                <option value="board">置板</option>
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
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '15px', 
                fontWeight: '600',
                color: '#2e7d32',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🏄 置板資訊
              </h3>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '12px'
              }}>
                {/* 置板位號碼 */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                    置板位號碼
                  </label>
                  <input
                    type="text"
                    value={formData.board_slot_number}
                    onChange={(e) => setFormData({ ...formData, board_slot_number: e.target.value })}
                    placeholder="例如：1"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                {/* 置板截止日期 */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                    置板截止日期
                  </label>
                  <input
                    type="date"
                    value={formData.board_expiry_date}
                    onChange={(e) => setFormData({ ...formData, board_expiry_date: e.target.value })}
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>
            </div>

            {/* 贈送大船時數 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#ff9800' }}>
                ⏱️ 贈送大船時數（分鐘）
              </label>
              <input
                type="number"
                min="0"
                value={formData.gift_boat_hours}
                onChange={(e) => setFormData({ ...formData, gift_boat_hours: parseInt(e.target.value) || 0 })}
                placeholder="0"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
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

            {isMobile && (
              <div style={{ height: '80px' }} />
            )}
          </div>

          {/* 底部按鈕 */}
          <div style={{
            padding: isMobile ? '24px 20px calc(40px + env(safe-area-inset-bottom))' : '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: isMobile ? '12px' : '12px',
            justifyContent: 'flex-end',
            flexDirection: isMobile ? 'column' : 'row',
            position: 'sticky',
            bottom: 0,
            background: 'white',
            zIndex: 10,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: isMobile ? '16px 24px' : '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? '17px' : '14px',
                minHeight: isMobile ? '52px' : '44px',
                flex: isMobile ? '1' : '0',
                fontWeight: isMobile ? '600' : 'normal',
                touchAction: 'manipulation',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: isMobile ? '16px 24px' : '10px 20px',
                border: 'none',
                borderRadius: '8px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? '17px' : '14px',
                fontWeight: 'bold',
                minHeight: isMobile ? '52px' : '44px',
                flex: isMobile ? '1' : '0',
                touchAction: 'manipulation',
              }}
            >
              {loading ? '更新中...' : '確認更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

