import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { liffTrack } from '../track'
import { useBookLocale } from './BookLocaleContext'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'
import { buildStaffHelpMessage, openStaffHelp } from './bookStaffHelp'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

const wrap: CSSProperties = {
  textAlign: 'center',
  margin: '14px 0 0',
  fontSize: ty.caption,
  color: T.mutedLight,
  lineHeight: 1.65,
}

const textLinkBtn: CSSProperties = {
  display: 'inline',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'none',
  color: T.lineGreen,
  fontSize: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

interface BookStaffHintProps {
  step: number
  form: LiffBookingFormState
  coaches: CoachOption[]
  pickDate?: string
  pickTimePref?: TimePreference
  lineUserId: string | null
  memberId?: string | null
  track?: boolean
}

export function BookStaffHint({
  step,
  form,
  coaches,
  pickDate,
  pickTimePref,
  lineUserId,
  memberId,
  track = true,
}: BookStaffHintProps) {
  const { locale, s } = useBookLocale()

  const handleAsk = () => {
    triggerHaptic('light')
    if (track && lineUserId) {
      liffTrack({
        icon_id: `liff_book_staff_help:${step}`,
        line_user_id: lineUserId,
        member_id: memberId,
        extras: { step, ...(form.activity ? { activity: form.activity } : {}) },
      })
    }
    const presetQuestion = step === 1 && (form.activity === 'WS' || form.activity === 'WB')
      ? s.staff.splitActivityMsg
      : undefined
    openStaffHelp(buildStaffHelpMessage(step, form, coaches, locale, {
      date: pickDate,
      timePreference: pickTimePref,
    }, presetQuestion))
  }

  if (step === 1) {
    const showSplit = form.activity === 'WS' || form.activity === 'WB'
    if (!showSplit) return null
    return (
      <div style={{ ...wrap, margin: '14px 0 6px' }}>
        <div style={{ fontSize: ty.caption, color: T.mutedLight }}>
          {s.staff.splitActivity}
        </div>
        <button type="button" onClick={handleAsk} style={textLinkBtn}>
          {s.staff.askStaff}
        </button>
      </div>
    )
  }

  if (step === 2 || step === 3) {
    return (
      <div style={{ ...wrap, marginTop: 16 }}>
        <span>{s.staff.needHelp} </span>
        <button type="button" onClick={handleAsk} style={textLinkBtn}>
          {s.staff.askStaff}
        </button>
      </div>
    )
  }

  return null
}
