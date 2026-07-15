import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { chipBtn } from './bookStyles'
import {
  designatedCoachPriceLabel,
  filterLiffBookCoaches,
} from './liffBookingCoaches'
import type { ActivityChoice, CoachOption } from './types'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

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
  const { locale, s } = useBookLocale()
  const cp = s.step3.coachPicker
  const visible = filterLiffBookCoaches(coaches, activity)

  if (visible.length === 0) {
    return (
      <div style={{ fontSize: ty.body, color: T.muted, lineHeight: 1.5 }}>
        {cp.empty}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map(coach => {
        const selected = value === coach.id
        const priceLabel = designatedCoachPriceLabel(coach, activity, locale)
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
              borderRadius: T.controlRadius,
              textAlign: 'left',
            }}
            onClick={() => {
              triggerHaptic('light')
              onChange(coach.id)
            }}
          >
            <span style={{ fontSize: ty.body, fontWeight: 600 }}>{coach.name}</span>
            {priceLabel ? (
              <span style={{
                fontSize: ty.body,
                fontWeight: 600,
                opacity: selected ? 0.9 : 0.85,
              }}>
                {priceLabel}
              </span>
            ) : (
              <span style={{ fontSize: ty.caption, opacity: 0.7 }}>{cp.askStaff}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
