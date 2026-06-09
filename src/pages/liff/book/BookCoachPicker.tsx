import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { chipBtn } from './bookStyles'
import {
  designatedCoachPriceLabel,
  filterLiffBookCoaches,
} from './liffBookingCoaches'
import type { ActivityChoice, CoachOption } from './types'

interface BookCoachPickerProps {
  coaches: CoachOption[]
  activity: ActivityChoice | null
  value: string | null
  onChange: (coachId: string) => void
}

export function BookCoachPicker({
  coaches,
  activity,
  value,
  onChange,
}: BookCoachPickerProps) {
  const { s } = useBookLocale()
  const cp = s.step3.coachPicker
  const visible = filterLiffBookCoaches(coaches, activity)

  if (visible.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
        {cp.empty}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map(coach => {
        const selected = value === coach.id
        const priceLabel = designatedCoachPriceLabel(coach, activity)
        return (
          <button
            key={coach.id}
            type="button"
            className="book-chip-btn"
            style={{
              ...chipBtn(selected),
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: 12,
              textAlign: 'left',
            }}
            onClick={() => {
              triggerHaptic('light')
              onChange(coach.id)
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{coach.name}</span>
            {priceLabel ? (
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                opacity: selected ? 0.9 : 0.85,
              }}>
                {priceLabel}
              </span>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.7 }}>{cp.askStaff}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
