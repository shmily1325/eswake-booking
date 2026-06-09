import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { liffTrack } from '../track'
import { useBookLocale } from './BookLocaleContext'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'
import { buildStaffHelpMessage, openStaffHelp } from './bookStaffHelp'
import { BOOK_TYPE as ty } from './bookTheme'

const wrap: CSSProperties = {
  textAlign: 'center',
  margin: '14px 0 0',
  fontSize: ty.caption,
  color: '#999',
  lineHeight: 1.65,
}

const pillBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 8,
  padding: '8px 18px',
  borderRadius: 999,
  border: '1px solid rgba(0,185,0,0.35)',
  background: 'rgba(0,185,0,0.08)',
  color: '#009900',
  fontSize: ty.body,
  fontWeight: 600,
  cursor: 'pointer',
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
      <div style={{ ...wrap, margin: '14px 0 6px' }}>
        <div style={{ fontSize: ty.caption, color: '#aaa' }}>
          {s.staff.splitActivity}
        </div>
        <div style={{ marginTop: 6 }}>{s.staff.unsure}</div>
        <button type="button" onClick={handleAsk} style={pillBtn}>
          {s.staff.askStaff}
        </button>
      </div>
    )
  }

  const contextualNote = step === 4 ? s.staff.step4Hint : null

  if (step === 2 || step === 3 || step === 4) {
    return (
      <div style={wrap}>
        {contextualNote ? (
          <div style={{ fontSize: ty.caption, color: '#aaa', marginBottom: 6 }}>
            {contextualNote}
          </div>
        ) : null}
        <div>{s.staff.needHelp}</div>
        <button type="button" onClick={handleAsk} style={pillBtn}>
          {s.staff.askStaff}
        </button>
      </div>
    )
  }

  return null
}
