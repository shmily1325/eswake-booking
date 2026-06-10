import { useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { BookHeadcountStepper } from './BookHeadcountStepper'
import { useBookLocale } from './BookLocaleContext'
import { FOLLOW_BOAT_MAX } from './liffBookingConfig'
import { followBoatFee } from './liffBookingPrices'
import { fieldLabel, optionalPanel } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

interface BookFollowBoatPanelProps {
  riders: number
  value: number
  onChange: (count: number) => void
}

export function BookFollowBoatPanel({ riders, value, onChange }: BookFollowBoatPanelProps) {
  const { s } = useBookLocale()
  const [open, setOpen] = useState(value > 0)

  const toggle = () => {
    triggerHaptic('light')
    setOpen(v => !v)
  }

  const setCount = (n: number) => {
    triggerHaptic('light')
    onChange(n)
    if (n > 0) setOpen(true)
  }

  const fee = followBoatFee(value)

  return (
    <div style={optionalPanel}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          border: 'none',
          background: open ? T.surfaceMuted : T.cardBg,
          textAlign: 'left',
          fontSize: ty.body,
          fontWeight: 600,
          color: T.inkSoft,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>
          {s.step2.followBoat.toggle}
          {value > 0 ? (
            <span style={{ fontWeight: 500, color: T.muted, marginLeft: 6 }}>
              · {s.step2.followBoat.selected(value)}
            </span>
          ) : null}
        </span>
        <span style={{ color: T.mutedLight, fontSize: 18, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div
          style={{
            padding: '14px 16px 16px',
            borderTop: `1px solid ${T.borderSubtle}`,
            background: T.surfaceMuted,
          }}
        >
          <div style={{ fontSize: ty.caption, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>
            {s.step2.followBoat.rule}
          </div>
          <div style={fieldLabel}>{s.step2.followBoat.countLabel}</div>
          <BookHeadcountStepper
            value={value}
            min={0}
            max={FOLLOW_BOAT_MAX}
            onChange={setCount}
          />
          {value > 0 ? (
            <div style={{ fontSize: ty.caption, color: T.muted, marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
              {s.step2.followBoat.aboardLine(
                riders,
                value,
                fee > 0 ? `+$${fee.toLocaleString()}` : null,
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
