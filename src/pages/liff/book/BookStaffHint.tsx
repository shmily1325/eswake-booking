import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { liffTrack } from '../track'
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
  lineUserId: string | null
  memberId?: string | null
}

export function BookStaffHint({
  step,
  form,
  coaches,
  pickDate,
  pickTimePref,
  lineUserId,
  memberId,
}: BookStaffHintProps) {
  const { locale, s } = useBookLocale()

  const handleAsk = () => {
    triggerHaptic('light')
    liffTrack({
      icon_id: `liff_book_staff_help:${step}`,
      line_user_id: lineUserId,
      member_id: memberId,
      extras: { step, ...(form.activity ? { activity: form.activity } : {}) },
    })
    openStaffHelp(buildStaffHelpMessage(step, form, coaches, locale, {
      date: pickDate,
      timePreference: pickTimePref,
    }))
  }

  if (step === 1) {
    return (
      <div style={{ textAlign: 'center', margin: '14px 0 6px', fontSize: 12, color: '#999', lineHeight: 1.65 }}>
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {s.staff.splitActivity}
        </div>
        <div style={{ marginTop: 6 }}>
          <span>{s.staff.unsure}</span>
          <button type="button" onClick={handleAsk} style={{ ...linkBtn, fontSize: 12, marginLeft: 2 }}>
            {s.staff.askStaff}
          </button>
        </div>
      </div>
    )
  }

  const isMixedSkill = form.beginnerCount != null
    && form.beginnerCount > 0
    && form.beginnerCount < form.headcount

  const contextualNote = step === 2 && isMixedSkill
    ? s.staff.step2MixedNote
    : step === 4
      ? s.staff.step4Hint
      : null

  if (step === 2 || step === 3 || step === 4) {
    return (
      <div style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 12, color: '#999', lineHeight: 1.65 }}>
        {contextualNote ? (
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>
            {contextualNote}
          </div>
        ) : null}
        <div>
          <span>{s.staff.needHelp}</span>
          <button type="button" onClick={handleAsk} style={{ ...linkBtn, fontSize: 12, marginLeft: 2 }}>
            {s.staff.askStaff}
          </button>
        </div>
      </div>
    )
  }

  return null
}
