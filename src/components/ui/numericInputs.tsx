import { useState, type CSSProperties, type KeyboardEventHandler, type ReactNode } from 'react'
import { getInputStyle } from '../../styles/designSystem'

/** 與 PendingDeductionItem／PendingOrderSettleItem 扣款金額欄一致 */
export const amountInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '12px 14px',
  border: '2px solid #667eea',
  borderRadius: 8,
  fontSize: 18,
  fontWeight: 600,
  background: '#f8f9ff',
  boxSizing: 'border-box',
  outline: 'none',
}

export interface PrimaryNumericInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  placeholder?: string
  /** 例：件、分鐘 */
  suffix?: ReactNode
  prefix?: ReactNode
  min?: number
  style?: CSSProperties
}

/**
 * 課程扣款同款數字框（紫框 18px；用於件數、庫存、分鐘等）
 * 對齊 PendingDeductionItem 扣款時數欄，不用 type=number、不用 ± stepper
 */
export function PrimaryNumericInput({
  value,
  onChange,
  disabled,
  placeholder,
  suffix,
  prefix,
  min = 0,
  style,
}: PrimaryNumericInputProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
      {prefix}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          const n = digits === '' ? min : parseInt(digits, 10)
          onChange(Number.isFinite(n) ? Math.max(min, n) : min)
        }}
        style={{ ...amountInputStyle, ...style }}
      />
      {suffix}
    </div>
  )
}

export interface MoneyInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  placeholder?: string
  prefix?: ReactNode
  style?: CSSProperties
}

/** 金額輸入（聚焦裸數字、失焦千分位；同課程扣款 UI） */
export function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder = '請輸入金額',
  prefix = '$',
  style,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false)

  const display = focused
    ? value > 0
      ? String(value)
      : ''
    : value.toLocaleString()

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
      {prefix != null && (
        <span style={{ fontSize: 16, color: '#666', fontWeight: 500, flexShrink: 0 }}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? 0 : parseInt(digits, 10))
        }}
        style={{ ...amountInputStyle, ...style }}
      />
    </div>
  )
}

export interface NumericTextInputProps {
  value: string
  onChange: (digits: string) => void
  disabled?: boolean
  placeholder?: string
  isMobile?: boolean
  style?: CSSProperties
  /** 小欄位（折數等） */
  compact?: boolean
}

/** 純數字文字框；course 變體用紫框（同課程） */
export function NumericTextInput({
  value,
  onChange,
  disabled,
  placeholder,
  isMobile = false,
  style,
  compact,
  variant = 'default',
}: NumericTextInputProps & { variant?: 'default' | 'course' }) {
  const base =
    variant === 'course'
      ? { ...amountInputStyle, width: '100%' }
      : compact
        ? {
            width: 72,
            padding: '10px 8px',
            fontSize: 16,
            minHeight: 44,
            textAlign: 'center' as const,
            border: '1px solid #ddd',
            borderRadius: 8,
            boxSizing: 'border-box' as const,
            outline: 'none',
          }
        : {
            ...getInputStyle(isMobile),
            width: '100%',
            boxSizing: 'border-box' as const,
            background: '#fff',
          }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      style={{ ...base, ...style }}
    />
  )
}

export interface DecimalTextInputProps {
  value: string
  onChange: (raw: string) => void
  disabled?: boolean
  placeholder?: string
  compact?: boolean
  style?: CSSProperties
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
}

/** 折數等小數（例 9、85、0.9） */
export function DecimalTextInput({
  value,
  onChange,
  disabled,
  placeholder,
  compact,
  style,
  onKeyDown,
}: DecimalTextInputProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      style={{
        width: compact ? 72 : '100%',
        padding: compact ? '10px 8px' : '12px 14px',
        fontSize: 16,
        minHeight: compact ? 44 : undefined,
        textAlign: compact ? 'center' : undefined,
        border: '1px solid #ddd',
        borderRadius: 8,
        boxSizing: 'border-box',
        outline: 'none',
        ...style,
      }}
    />
  )
}
