import { useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { FOLLOW_BOAT_OPTIONS } from './liffBookingConfig'
import { followBoatFee } from './liffBookingPrices'
import { chipBtn, fieldLabel } from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'

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

  const pick = (n: number) => {
    triggerHaptic('light')
    onChange(n)
    if (n > 0) setOpen(true)
  }

  const fee = followBoatFee(value)

  return (
    <div
      style={{
        border: '1px dashed #ddd',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#fafafa',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          border: 'none',
          background: open ? '#fafafa' : 'white',
          textAlign: 'left',
          fontSize: ty.body,
          fontWeight: 600,
          color: '#333',
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
            <span style={{ fontWeight: 500, color: '#666', marginLeft: 6 }}>
              · {s.step2.followBoat.selected(value)}
            </span>
          ) : null}
        </span>
        <span style={{ color: '#999', fontSize: 18, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div
          style={{
            padding: '14px 16px 16px',
            borderTop: '1px solid #eee',
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: ty.caption, color: '#666', lineHeight: 1.6, marginBottom: 12 }}>
            {s.step2.followBoat.rule}
          </div>
          <div style={fieldLabel}>{s.step2.followBoat.countLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FOLLOW_BOAT_OPTIONS.map(n => (
              <button
                key={n}
                type="button"
                className="book-chip-btn"
                style={chipBtn(value === n)}
                onClick={() => pick(n)}
              >
                {n === 0 ? s.step2.followBoat.none : s.step2.followBoat.nFollowers(n)}
              </button>
            ))}
          </div>
          {value > 0 ? (
            <>
              <div
                style={{
                  fontSize: ty.body,
                  fontWeight: 600,
                  color: '#444',
                  marginTop: 12,
                  padding: '10px 12px',
                  background: '#f5f8fc',
                  borderRadius: 8,
                  lineHeight: 1.5,
                }}
              >
                {s.step2.followBoat.onBoatSummary(riders, value)}
              </div>
              <div style={{ fontSize: ty.caption, color: '#888', marginTop: 8, lineHeight: 1.5 }}>
                {fee > 0
                  ? s.step2.followBoat.feeHint(value, `$${fee.toLocaleString()}`)
                  : s.step2.followBoat.freeHint}
              </div>
            </>
          ) : null}
          <div style={{ fontSize: ty.caption, color: '#aaa', marginTop: 8, lineHeight: 1.5 }}>
            {s.step2.followBoat.capacityNote}
          </div>
        </div>
      )}
    </div>
  )
}
