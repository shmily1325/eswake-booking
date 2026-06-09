import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'
import { buildStaffHelpMessage, openStaffHelp } from './bookStaffHelp'

const linkBtn: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: '#00b900',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
}

interface BookStaffHintProps {
  step: number
  form: LiffBookingFormState
  coaches: CoachOption[]
  pickDate?: string
  pickTimePref?: TimePreference
}

export function BookStaffHint({ step, form, coaches, pickDate, pickTimePref }: BookStaffHintProps) {
  const { locale, s } = useBookLocale()

  const handleAsk = () => {
    triggerHaptic('light')
    openStaffHelp(buildStaffHelpMessage(step, form, coaches, locale, {
      date: pickDate,
      timePreference: pickTimePref,
    }))
  }

  if (step === 1) {
    return (
      <div style={{ textAlign: 'center', margin: '14px 0 6px', fontSize: 12, color: '#999', lineHeight: 1.65 }}>
        <div>
          <span>{s.staff.unsure}</span>
          <button type="button" onClick={handleAsk} style={{ ...linkBtn, fontSize: 12, marginLeft: 2 }}>
            {s.staff.askStaff}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>
          {s.staff.splitActivity}
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', margin: '14px 0 6px', fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
      {step === 4 ? <div style={{ marginBottom: 4, color: '#999' }}>{s.staff.step4Hint}</div> : null}
      <span>{s.staff.formHelp}</span>
      <button type="button" onClick={handleAsk} style={linkBtn}>
        {s.staff.askStaff}
      </button>
    </div>
  )
}
