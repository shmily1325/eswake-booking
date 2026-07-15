import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { getFontSize } from '../../styles/designSystem'

let modalKeyframesInjected = false

function ensureModalKeyframes() {
  if (modalKeyframesInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.dataset.adminModal = 'true'
  style.textContent =
    '@keyframes adminModalOverlayIn{from{opacity:0}to{opacity:1}}' +
    '@keyframes adminModalCardIn{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:none}}'
  document.head.appendChild(style)
  modalKeyframesInjected = true
}

export function AdminModal({
  children,
  isMobile,
  maxWidth = 440,
  onClose,
}: {
  children: ReactNode
  isMobile?: boolean
  maxWidth?: number
  /** 提供時才顯示 X、可點遮罩與按 Esc 關閉 */
  onClose?: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [closeHover, setCloseHover] = useState(false)

  useEffect(() => {
    ensureModalKeyframes()
  }, [])

  // 鎖住背景捲動，關閉時還原
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc 關閉
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 桌面自動聚焦第一個欄位（手機不 focus，避免鍵盤彈出）
  useEffect(() => {
    if (isMobile) return
    const first = cardRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-admin-modal-close])'
    )
    first?.focus()
  }, [isMobile])

  return (
    <div
      onMouseDown={
        onClose
          ? e => {
              if (e.target === e.currentTarget) onClose()
            }
          : undefined
      }
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 27, 23, 0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '16px' : '24px',
        animation: 'adminModalOverlayIn 0.18s ease',
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: '24px',
          padding: isMobile ? '20px' : '28px',
          maxWidth,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 28px 90px rgba(31, 27, 23, 0.18)',
          animation: 'adminModalCardIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {onClose && (
          <button
            type="button"
            data-admin-modal-close
            aria-label="關閉"
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: '999px',
              background: closeHover ? '#eef0f3' : 'transparent',
              color: '#a1a5b0',
              fontSize: getFontSize('h2', Boolean(isMobile)),
              lineHeight: 1,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            ×
          </button>
        )}
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
  const { isMobile } = useResponsive()
  const colors = { blue: '#365d66', amber: '#7d5521', orange: '#7d5521' }
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ margin: 0, fontSize: getFontSize('h2', isMobile), fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em' }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: '6px 0 0', fontSize: getFontSize('body', isMobile), color: colors[accent], fontWeight: 600 }}>
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
  const { isMobile } = useResponsive()

  return (
    <label style={{
      display: 'block',
      marginBottom: '8px',
      fontWeight: 600,
      fontSize: getFontSize('bodySmall', isMobile),
      color: '#1d1d1f',
    }}>
      {children}
      {optional && (
        <span style={{ color: '#a1a5b0', fontWeight: 400, fontSize: getFontSize('caption', isMobile), marginLeft: '6px' }}>
          （選填）
        </span>
      )}
    </label>
  )
}

export const adminTextInputStyle: CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  border: '1px solid #eceef2',
  borderRadius: '16px',
  fontSize: '16px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(31, 27, 23, 0.03)',
}

export function PreviewBanner({ children }: { children: ReactNode }) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px 16px',
      background: '#edf3f5',
      borderRadius: '16px',
      border: '1px solid rgba(95, 135, 145, 0.22)',
      fontSize: getFontSize('body', isMobile),
      color: '#365d66',
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
  const { isMobile } = useResponsive()

  return (
    <label
      data-track={trackId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        cursor: 'pointer',
        fontSize: getFontSize('body', isMobile),
        color: '#6b6f7a',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: '16px', height: '16px', accentColor: '#1d1d1f' }}
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
  const { isMobile } = useResponsive()
  const activeBg = accent === 'amber' ? '#fbf3e5' : '#edf3f5'
  const activeBorder = accent === 'amber' ? 'rgba(184, 132, 63, 0.28)' : 'rgba(95, 135, 145, 0.28)'
  const activeColor = accent === 'amber' ? '#7d5521' : '#365d66'

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
              borderRadius: '16px',
              border: `1px solid ${selected ? activeBorder : '#eceef2'}`,
              background: selected ? activeBg : disabled ? '#f4f5f7' : 'white',
              color: selected ? activeColor : disabled ? '#a1a5b0' : '#1d1d1f',
              fontWeight: selected ? 700 : 500,
              fontSize: getFontSize('body', isMobile),
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              textAlign: 'center',
              lineHeight: 1.3,
              boxShadow: selected ? '0 4px 16px rgba(31, 27, 23, 0.05)' : 'none',
              transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
            }}
          >
            {opt.label}
            {opt.hint && (
              <div style={{ fontSize: getFontSize('caption', isMobile), fontWeight: 400, marginTop: '2px', opacity: 0.85 }}>
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
  optional = true,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  optional?: boolean
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <FormFieldLabel optional={optional}>{label}</FormFieldLabel>
      <input
        type="time"
        step={900}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={adminTextInputStyle}
      />
    </div>
  )
}

export function HintBox({ children }: { children: ReactNode }) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      fontSize: getFontSize('caption', isMobile),
      color: '#6b6f7a',
      marginTop: '8px',
      lineHeight: 1.55,
      padding: '10px 12px',
      background: '#f7f8fa',
      borderRadius: '14px',
      border: '1px solid #eceef2',
    }}>
      {children}
    </div>
  )
}
