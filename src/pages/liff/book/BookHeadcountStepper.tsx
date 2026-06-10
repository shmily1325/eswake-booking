import { triggerHaptic } from '../../../utils/haptic'
import { BOOKING_HEADCOUNT_MAX } from './liffBookingBoats'
import { stepperBtn, stepperRow, stepperValue } from './bookStyles'

interface BookHeadcountStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (count: number) => void
}

export function BookHeadcountStepper({
  value,
  min = 1,
  max = BOOKING_HEADCOUNT_MAX,
  onChange,
}: BookHeadcountStepperProps) {
  const dec = () => {
    if (value <= min) return
    triggerHaptic('light')
    onChange(value - 1)
  }

  const inc = () => {
    if (value >= max) return
    triggerHaptic('light')
    onChange(value + 1)
  }

  return (
    <div style={stepperRow}>
      <button
        type="button"
        className="book-chip-btn"
        style={{ ...stepperBtn, opacity: value <= min ? 0.35 : 1 }}
        onClick={dec}
        disabled={value <= min}
        aria-label="減少人數"
      >
        −
      </button>
      <div style={stepperValue} aria-live="polite">{value}</div>
      <button
        type="button"
        className="book-chip-btn"
        style={{ ...stepperBtn, opacity: value >= max ? 0.35 : 1 }}
        onClick={inc}
        disabled={value >= max}
        aria-label="增加人數"
      >
        +
      </button>
    </div>
  )
}
