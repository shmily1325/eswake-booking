import type { ActivityChoice, ActivityCode, LiffBookingFormState, SkillLevel, TimePreference } from './types'
import { ACTIVITY_COMPARISON_INTRO } from './liffBookingContent'

export interface ActivityInfo {
  code: ActivityCode
  label: string
  labelZh: string
  emoji: string
  tagline: string
  /** 小編原文摘要 */
  summary: string
  bullets: string[]
  bestFor: string
  youtubeVideoId: string
}

/**
 * 項目說明（小編提供 + 常見 QA 原文）
 */
export const ACTIVITY_OPTIONS: ActivityInfo[] = [
  {
    code: 'WS',
    label: 'Wakesurf',
    labelZh: '快艇衝浪',
    tagline: '腳不固定 · 類似衝浪',
    emoji: '🌊',
    summary:
      '藉由專業造浪快艇的尾浪滑行，雙腳未固定在板上，穩定後無需抓繩，船速較緩慢，與海洋衝浪極為相似。',
    bullets: [
      '腳未固定在板上，穩定後可放開繩子',
      '船速較緩慢，節奏接近衝浪',
      '初學較容易有「站在浪上」的成就感',
    ],
    bestFor: '第一次體驗、喜歡衝浪感、不想腳被綁住',
    youtubeVideoId: 'esgwXR0ikOU',
  },
  {
    code: 'WB',
    label: 'Wakeboard',
    labelZh: '寬板滑水',
    tagline: '雙腳固定 · 速度與跳躍',
    emoji: '🏄',
    summary:
      '使用單板，雙腳固定在板上，全程需依靠繩子滑行，速度較快，適合喜歡追求速度與跳躍高度的人，與單板滑雪較為相似。',
    bullets: [
      '雙腳固定在板上（類似滑雪）',
      '全程抓繩，速度較快',
      '適合挑戰跳躍、轉體等動作',
    ],
    bestFor: '追求速度與高度、不怕摔、想練技巧',
    youtubeVideoId: 'oHp8IeOvbdk',
  },
]

export { ACTIVITY_COMPARISON_INTRO }

export const SKILL_OPTIONS = [
  { value: 'first_time' as const, label: '第一次體驗', hint: '從未滑過或僅試過一兩次' },
  { value: 'experienced' as const, label: '已經滑過', hint: '能穩定起滑或想進階' },
]

export const HEADCOUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** 依人數產生 0初～N初 選項 */
export function beginnerCountOptions(headcount: number): number[] {
  return Array.from({ length: headcount + 1 }, (_, i) => i)
}

export function formatBeginnerCount(n: number): string {
  return `${n} 初`
}

/** 依「幾初」自動對應 LINE 表單的「是否第一次滑」 */
export function skillLevelFromBeginners(headcount: number, beginnerCount: number): SkillLevel {
  return beginnerCount >= headcount ? 'first_time' : 'experienced'
}

/** 更新人數／初學時同步 skillLevel（預設全部初學） */
export function syncBookingPeople(
  prev: LiffBookingFormState,
  patch: { headcount?: number; beginnerCount?: number },
): Pick<LiffBookingFormState, 'headcount' | 'beginnerCount' | 'skillLevel'> {
  const headcount = patch.headcount ?? prev.headcount
  let beginnerCount = patch.beginnerCount ?? prev.beginnerCount ?? headcount
  if (beginnerCount > headcount) beginnerCount = headcount
  return {
    headcount,
    beginnerCount,
    skillLevel: skillLevelFromBeginners(headcount, beginnerCount),
  }
}

export const TIME_PREFERENCE_OPTIONS: { value: TimePreference; label: string }[] = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
]

/** 初學體驗時數說明（小編指定文案） */
export const BEGINNER_LESSON_NOTE = '岸上 10 分＋水上 20 分'

export const PRICING_EDUCATION = {
  title: '費用怎麼算？',
  intro: '不同船型收費不同。實際以現場排班為準。',
  coachNote: '指定教練額外加價；不指定依當日排班。',
  earlyMorningNote: '✨ 8 點前需指定教練',
  disclaimer: '估算僅供參考',
}

export const MAX_PREFERRED_DATES = 3

export const BOTH_ACTIVITY_SHORT = '兩個一起'
export const BOTH_ACTIVITY_LABEL = `${BOTH_ACTIVITY_SHORT}（快艇衝浪 + 寬板滑水）`

export function isBothActivities(code: ActivityChoice | null | undefined): code is 'BOTH' {
  return code === 'BOTH'
}

export function getActivityInfo(code: ActivityCode): ActivityInfo {
  return ACTIVITY_OPTIONS.find(a => a.code === code)!
}

export function formatTimePreference(pref: TimePreference): string {
  return TIME_PREFERENCE_OPTIONS.find(o => o.value === pref)?.label ?? pref
}

export function isLiffBookEnabled(): boolean {
  const flag = import.meta.env.VITE_LIFF_BOOK_ENABLED as string | undefined
  if (flag === 'false') return false
  return true
}

export function activityDisplayName(code: ActivityChoice): string {
  if (code === 'BOTH') return BOTH_ACTIVITY_LABEL
  const a = getActivityInfo(code)
  return `${a.labelZh}（${a.label}）`
}
