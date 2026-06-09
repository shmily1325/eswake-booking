import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
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

function step4Hint(): string {
  return '特殊需求可寫備註；表單沒涵蓋的情況再問小編。'
}

/** 全頁低調協助入口；跳 LINE 時帶目前步驟與已選項目 */
export function BookStaffHint({ step, form, coaches, pickDate, pickTimePref }: BookStaffHintProps) {
  const handleAsk = () => {
    triggerHaptic('light')
    openStaffHelp(buildStaffHelpMessage(step, form, coaches, {
      date: pickDate,
      timePreference: pickTimePref,
    }))
  }

  if (step === 1) {
    return (
      <div style={{ textAlign: 'center', margin: '14px 0 6px', fontSize: 12, color: '#999', lineHeight: 1.6 }}>
        <span>還是不確定選哪個？</span>
        <button type="button" onClick={handleAsk} style={{ ...linkBtn, fontSize: 12, marginLeft: 2 }}>
          問小編
        </button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', margin: '14px 0 6px', fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
      {step === 4 ? <div style={{ marginBottom: 4, color: '#999' }}>{step4Hint()}</div> : null}
      <span>填表有問題？</span>
      <button type="button" onClick={handleAsk} style={linkBtn}>
        小編可協助
      </button>
    </div>
  )
}
