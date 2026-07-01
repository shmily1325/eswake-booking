import type { CSSProperties, ReactNode } from 'react'

export function AdminModal({
  children,
  isMobile,
  maxWidth = 440,
}: {
  children: ReactNode
  isMobile?: boolean
  maxWidth?: number
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: isMobile ? '16px' : '24px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: isMobile ? '20px' : '28px',
        maxWidth,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
      }}>
        {children}
      </div>
    </div>
  )
}

export function AdminModalHeader({
  title,
  subtitle,
  accent = 'blue',
}: {
  title: string
  subtitle?: string
  accent?: 'blue' | 'amber' | 'orange'
}) {
  const colors = { blue: '#1565c0', amber: '#f57c00', orange: '#e65100' }
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: colors[accent], fontWeight: 600 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function FormFieldLabel({
  children,
  optional,
}: {
  children: ReactNode
  optional?: boolean
}) {
  return (
    <label style={{
      display: 'block',
      marginBottom: '8px',
      fontWeight: 600,
      fontSize: '14px',
      color: '#374151',
    }}>
      {children}
      {optional && (
        <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '13px', marginLeft: '6px' }}>
          （選填）
        </span>
      )}
    </label>
  )
}

export const adminTextInputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '16px',
  boxSizing: 'border-box',
  background: '#fafafa',
}

export function PreviewBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      borderRadius: '10px',
      border: '1px solid #93c5fd',
      fontSize: '14px',
      color: '#1e40af',
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

export function CrossDayToggle({
  checked,
  onChange,
  trackId,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  trackId?: string
}) {
  return (
    <label
      data-track={trackId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#4b5563',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
      />
      跨多日
    </label>
  )
}

export function DateRangeFields({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  multiDay,
  onMultiDayChange,
  trackPrefix,
}: {
  startDate: string
  endDate: string
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
  multiDay: boolean
  onMultiDayChange: (v: boolean) => void
  trackPrefix?: string
}) {
  const handleStart = (v: string) => {
    onStartChange(v)
    if (!multiDay) onEndChange(v)
  }

  const handleMultiDay = (v: boolean) => {
    onMultiDayChange(v)
    if (!v && startDate) onEndChange(startDate)
  }

  return (
    <>
      <CrossDayToggle
        checked={multiDay}
        onChange={handleMultiDay}
        trackId={trackPrefix ? `${trackPrefix}_multi_day` : undefined}
      />
      <div style={{ marginBottom: multiDay ? '12px' : '16px' }}>
        <FormFieldLabel>{multiDay ? '開始日期' : '日期'}</FormFieldLabel>
        <input
          type="date"
          value={startDate}
          onChange={e => handleStart(e.target.value)}
          style={adminTextInputStyle}
          data-track={trackPrefix ? `${trackPrefix}_start_date` : undefined}
        />
      </div>
      {multiDay && (
        <div style={{ marginBottom: '16px' }}>
          <FormFieldLabel>結束日期</FormFieldLabel>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={e => onEndChange(e.target.value)}
            style={adminTextInputStyle}
            data-track={trackPrefix ? `${trackPrefix}_end_date` : undefined}
          />
        </div>
      )}
    </>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent = 'amber',
}: {
  options: { value: T; label: string; hint?: string; disabled?: boolean; trackId?: string }[]
  value: T
  onChange: (v: T) => void
  accent?: 'blue' | 'amber'
}) {
  const activeBg = accent === 'amber' ? '#fff8e1' : '#eff6ff'
  const activeBorder = accent === 'amber' ? '#ffb300' : '#3b82f6'
  const activeColor = accent === 'amber' ? '#e65100' : '#1565c0'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
      {options.map(opt => {
        const selected = value === opt.value
        const disabled = opt.disabled
        return (
          <button
            key={opt.value}
            type="button"
            data-track={opt.trackId}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '12px 10px',
              borderRadius: '10px',
              border: `2px solid ${selected ? activeBorder : '#e5e7eb'}`,
              background: selected ? activeBg : disabled ? '#f9fafb' : 'white',
              color: selected ? activeColor : disabled ? '#9ca3af' : '#374151',
              fontWeight: selected ? 700 : 500,
              fontSize: '14px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              textAlign: 'center',
              lineHeight: 1.3,
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {opt.label}
            {opt.hint && (
              <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '2px', opacity: 0.85 }}>
                {opt.hint}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TimeSelectField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <FormFieldLabel optional>{label}</FormFieldLabel>
      <div style={{ display: 'flex', gap: '6px' }}>
        <select
          value={value ? value.split(':')[0] : ''}
          onChange={e => {
            const hour = e.target.value
            if (!hour) onChange('')
            else onChange(`${hour}:${value ? value.split(':')[1] : '00'}`)
          }}
          style={{ ...adminTextInputStyle, flex: 1, padding: '10px 8px' }}
        >
          <option value="">--</option>
          {Array.from({ length: 24 }, (_, i) => {
            const hour = String(i).padStart(2, '0')
            return <option key={hour} value={hour}>{hour}</option>
          })}
        </select>
        <select
          value={value ? value.split(':')[1] : ''}
          onChange={e => {
            const minute = e.target.value
            if (!minute) onChange('')
            else onChange(`${value ? value.split(':')[0] : '08'}:${minute}`)
          }}
          style={{ ...adminTextInputStyle, flex: 1, padding: '10px 8px' }}
        >
          <option value="">--</option>
          {['00', '15', '30', '45'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function HintBox({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '8px',
      lineHeight: 1.55,
      padding: '10px 12px',
      background: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #f3f4f6',
    }}>
      {children}
    </div>
  )
}
