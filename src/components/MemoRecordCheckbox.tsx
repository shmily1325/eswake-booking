import React from 'react'

interface MemoRecordCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** 輸入框的值（選填功能） */
  inputValue?: string
  /** 輸入框變更事件（選填功能） */
  onInputChange?: (value: string) => void
  /** 輸入框 placeholder */
  inputPlaceholder?: string
  /** 說明文字 */
  hint?: string
  /** 是否顯示輸入框 */
  showInput?: boolean
}

/**
 * 統一的「記錄到歷史紀錄」勾選框元件
 * 用於：
 * - EditMemberDialog（修改會籍日期）
 * - MemberDetailDialog（修改置板日期）
 */
export const MemoRecordCheckbox: React.FC<MemoRecordCheckboxProps> = ({
  checked,
  onChange,
  inputValue = '',
  onInputChange,
  inputPlaceholder = '可輸入說明（選填）',
  hint = '如僅修正錯誤可不勾選',
  showInput = true,
}) => {
  return (
    <div style={{ 
      marginBottom: '16px',
      padding: '12px',
      background: checked ? '#e3f2fd' : '#f5f5f5',
      borderRadius: '8px',
      transition: 'background 0.2s',
    }}>
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        cursor: 'pointer',
        fontSize: '14px',
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <span style={{ fontWeight: '500' }}>📋 記錄到歷史紀錄</span>
      </label>
      
      {checked && showInput && onInputChange && (
        <div style={{ marginTop: '10px', marginLeft: '28px' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={inputPlaceholder}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #90caf9',
              borderRadius: '6px',
              fontSize: '16px',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          />
        </div>
      )}
      
      <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginLeft: '28px' }}>
        {hint}
      </div>
    </div>
  )
}

