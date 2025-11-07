import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddMemberDialog({ open, onClose, onSuccess }: AddMemberDialogProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    birthday: '',
    phone: '',
    member_type: 'guest',  // 預設為客人
    notes: '',
    membership_expires_at: '',
    // 置板相關
    add_board_storage: false,
    board_slot_number: '',
    board_expires_at: '',
    board_notes: '',
  })

  // 统一的输入框样式
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
    
    if (!formData.name.trim()) {
      alert('请输入姓名')
      return
    }

    setLoading(true)
    try {
      // 1. 新增會員
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert([{
          name: formData.name.trim(),
          nickname: formData.nickname.trim() || null,
          birthday: formData.birthday || null,
          phone: formData.phone.trim() || null,
          member_type: formData.member_type,
          notes: formData.notes.trim() || null,
          balance: 0,
          designated_lesson_minutes: 0,
          boat_voucher_minutes: 0,
          membership_expires_at: formData.member_type === 'member' ? (formData.membership_expires_at || null) : null,
          status: 'active',
        }])
        .select()
        .single()

      if (memberError) throw memberError

      // 2. 如果要新增置板，插入置板記錄
      if (formData.add_board_storage && formData.board_slot_number) {
        const slotNumber = parseInt(formData.board_slot_number)
        if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
          throw new Error('格位編號必須是 1-145 之間的數字')
        }

        const { error: boardError } = await supabase
          .from('board_storage')
          .insert([{
            member_id: newMember.id,
            slot_number: slotNumber,
            expires_at: formData.board_expires_at || null,
            notes: formData.board_notes.trim() || null,
            status: 'active',
          }])

        if (boardError) {
          // 如果格位已被佔用
          if (boardError.code === '23505') {
            throw new Error(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
          }
          throw boardError
        }
      }

      alert('新增成功！')
      onSuccess()
      onClose()
      
      // 重置表單
      setFormData({
        name: '',
        nickname: '',
        birthday: '',
        phone: '',
        member_type: 'guest',
        notes: '',
        membership_expires_at: '',
        add_board_storage: false,
        board_slot_number: '',
        board_expires_at: '',
        board_notes: '',
      })
    } catch (error) {
      console.error('新增會員失敗:', error)
      alert('新增會員失敗')
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
      zIndex: 1000,
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
            新增會員
          </h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                暱稱 <span style={{ fontSize: '13px' }}>（選填）</span>
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                生日 <span style={{ fontSize: '13px' }}>（選填）</span>
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                電話 <span style={{ fontSize: '13px' }}>（選填）</span>
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

            {/* 類型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                類型 <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={formData.member_type}
                onChange={(e) => setFormData({ ...formData, member_type: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              >
                <option value="guest">客人</option>
                <option value="member">會員</option>
              </select>
            </div>

            {/* 會員到期 - 只在選擇「會員」時顯示 */}
            {formData.member_type === 'member' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  會員到期 <span style={{ fontSize: '13px' }}>（選填）</span>
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
            )}

            {/* 置板服務 */}
            <div style={{ 
              marginBottom: '16px',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '2px solid #e0e0e0'
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer',
                marginBottom: formData.add_board_storage ? '16px' : '0'
              }}>
                <input
                  type="checkbox"
                  checked={formData.add_board_storage}
                  onChange={(e) => setFormData({ ...formData, add_board_storage: e.target.checked })}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: '500', fontSize: '15px' }}>🏄 新增置板服務</span>
              </label>

              {/* 置板詳細資訊 - 只在勾選時顯示 */}
              {formData.add_board_storage && (
                <div style={{ marginTop: '12px' }}>
                  {/* 格位編號 */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      格位編號 <span style={{ color: 'red' }}>*</span>
                      <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（1-145）</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="145"
                      value={formData.board_slot_number}
                      onChange={(e) => setFormData({ ...formData, board_slot_number: e.target.value })}
                      placeholder="請輸入格位編號"
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>

                  {/* 置板到期 */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                      置板到期 <span style={{ fontSize: '13px' }}>（選填）</span>
                    </label>
                    <input
                      type="date"
                      value={formData.board_expires_at}
                      onChange={(e) => setFormData({ ...formData, board_expires_at: e.target.value })}
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>

                  {/* 置板備註 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                      置板備註 <span style={{ fontSize: '13px' }}>（選填）</span>
                    </label>
                    <input
                      type="text"
                      value={formData.board_notes}
                      onChange={(e) => setFormData({ ...formData, board_notes: e.target.value })}
                      placeholder="例如：藍色長板"
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 備註 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                備註 <span style={{ fontSize: '13px' }}>（選填）</span>
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
              {loading ? '新增中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

