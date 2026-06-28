import { describe, expect, it } from 'vitest'
import { buildStaffHelpMessage } from '../bookStaffHelp'
import { renderBookingInquiryMessage } from '../liffBookingMessage'
import { renderBookingSubmitMessage } from '../bookingLineContext'
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

const estimate = {
  totalLabel: '$5,100',
  tierLabel: '參考價',
  durationLabel: '約 60 分鐘',
  detailLines: [],
  disclaimer: '',
  durationMin: 60,
  totalMin: 5100,
  totalMax: 5100,
  coachLine: null,
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

  it('submit message uses labeled lines for staff readability', () => {
    const msg = renderBookingInquiryMessage(baseForm, [], estimate, 'zh')

    expect(msg).toBe(
      [
        '【預約】',
        '',
        '預約人數：3 人',
        '預約項目：寬板滑水（小船）',
        '希望預約的日期及時間：6/15（一） 上午',
        '是否指定教練：不指定',
        '是否是第一次滑：2 位第一次、1 位已滑過',
        '',
        '聯絡人：王小明 · 0912345678',
        '參考價：約 $5,100（參考）',
      ].join('\n'),
    )
  })

  it('submit message includes notes when provided', () => {
    const msg = renderBookingSubmitMessage(
      { ...baseForm, notes: '希望指定 ED' },
      [],
      'zh',
      estimate,
    )
    expect(msg).toContain('備註：希望指定 ED')
  })

  it('prefills split-activity question on step 1', () => {
    const msg = buildStaffHelpMessage(1, { ...baseForm, activity: 'WS' }, [], 'zh', undefined, '有人寬板、有人衝浪')
    expect(msg).toContain('想請教：有人寬板、有人衝浪')
    expect(msg).not.toContain('進度')
  })
})
