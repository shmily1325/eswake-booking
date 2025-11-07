import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  email: string | null
  line_id: string | null
  member_type: string
  notes: string | null
  has_board_storage: boolean
  board_storage_location: string | null
  board_storage_expires_at: string | null
  membership_expires_at: string | null
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
  const [formData, setFormData] = useState({
    name: member.name,
    nickname: member.nickname || '',
    birthday: member.birthday || '',
    phone: member.phone || '',
    email: member.email || '',
    line_id: member.line_id || '',
    member_type: member.member_type,
    notes: member.notes || '',
    has_board_storage: member.has_board_storage,
    board_storage_location: member.board_storage_location || '',
    board_storage_expires_at: member.board_storage_expires_at || '',
    membership_expires_at: member.membership_expires_at || '',
  })

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
      const { error } = await supabase
        .from('members')
        .update({
          name: formData.name,
          nickname: formData.nickname || null,
          birthday: formData.birthday || null,
          phone: formData.phone || null,
          email: formData.email || null,
          line_id: formData.line_id || null,
          member_type: formData.member_type,
          notes: formData.notes || null,
          has_board_storage: formData.has_board_storage,
          board_storage_location: formData.board_storage_location || null,
          board_storage_expires_at: formData.board_storage_expires_at || null,
          membership_expires_at: formData.membership_expires_at || null,
        })
        .eq('id', member.id)

      if (error) throw error

      alert('更新會員資料成功！')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('更新會員資料失敗:', error)
      alert('更新會員資料失敗')
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
                暱稱
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="請輸入暱稱"
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

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="請輸入 Email"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* LINE ID */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                LINE ID
              </label>
              <input
                type="text"
                value={formData.line_id}
                onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                placeholder="請輸入 LINE ID"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 會員類型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                會員類型
              </label>
              <select
                value={formData.member_type}
                onChange={(e) => setFormData({ ...formData, member_type: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                <option value="regular">一般會員</option>
                <option value="vip">VIP 會員</option>
                <option value="board_only">僅置板會員</option>
              </select>
            </div>

            {/* 會籍到期 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                會籍到期
              </label>
              <input
                type="date"
                value={formData.membership_expires_at}
                onChange={(e) => setFormData({ ...formData, membership_expires_at: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 置板服務 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.has_board_storage}
                  onChange={(e) => setFormData({ ...formData, has_board_storage: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '500' }}>開通置板服務</span>
              </label>
            </div>

            {formData.has_board_storage && (
              <>
                {/* 置板位置 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    置板位置
                  </label>
                  <input
                    type="text"
                    value={formData.board_storage_location}
                    onChange={(e) => setFormData({ ...formData, board_storage_location: e.target.value })}
                    placeholder="例如：A-01"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                {/* 置板到期 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    置板到期
                  </label>
                  <input
                    type="date"
                    value={formData.board_storage_expires_at}
                    onChange={(e) => setFormData({ ...formData, board_storage_expires_at: e.target.value })}
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </>
            )}

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
          </div>

          {/* 底部按鈕 */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            position: 'sticky',
            bottom: 0,
            background: 'white',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
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

