import { describe, expect, it } from 'vitest'
import { buildStaffHelpMessage } from '../bookStaffHelp'
import { renderBookingInquiryMessage } from '../liffBookingMessage'
import type { LiffBookingFormState } from '../types'

const baseForm: LiffBookingFormState = {
  activity: 'WB',
  headcount: 3,
  beginnerCount: 2,
  boatPreference: 'small',
  followBoatCount: 0,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [{ date: '2026-06-15', timePreference: 'morning' }],
  contactName: '王小明',
  contactPhone: '0912345678',
  notes: '',
}

describe('booking LINE messages share compact format', () => {
  it('staff help uses short opener and dot-separated party line', () => {
    const msg = buildStaffHelpMessage(2, baseForm, [], 'zh')
    expect(msg).toBe(
      '嗨，預約想請教～\n寬板滑水 · 3 人 · 2 位體驗 · 1 位已滑過 · 小船\n\n想請教：',
    )
  })

  it('staff help adds dates on step 3', () => {
    const msg = buildStaffHelpMessage(3, baseForm, [], 'zh')
    expect(msg).toContain('6/15（')
    expect(msg).toContain('上午')
    expect(msg).toContain('教練 不指定')
  })

  it('submit message uses same party line with contact and estimate', () => {
    const msg = renderBookingInquiryMessage(baseForm, [], {
      totalLabel: '$5,100',
      tierLabel: '參考價',
      durationLabel: '約 60 分鐘',
      detailLines: [],
      disclaimer: '',
    }, 'zh')

    expect(msg).toBe(
      [
        '【預約】',
        '寬板滑水 · 3 人 · 2 位體驗 · 1 位已滑過 · 小船',
        '6/15（一） 上午',
        '教練 不指定',
        '王小明 · 0912345678',
        '約 $5,100（參考）',
      ].join('\n'),
    )
  })

  it('prefills split-activity question on step 1', () => {
    const msg = buildStaffHelpMessage(1, { ...baseForm, activity: 'WS' }, [], 'zh', undefined, '有人寬板、有人衝浪')
    expect(msg).toContain('想請教：有人寬板、有人衝浪')
    expect(msg).not.toContain('進度')
  })
})
