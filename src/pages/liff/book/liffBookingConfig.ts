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
    label: 'Wakesurfing',
    labelZh: '快艇衝浪',
    tagline: '腳不固定 · 類似衝浪',
    emoji: '🌊',
    summary:
      '藉由專業造浪快艇的尾浪滑行，雙腳未固定在板上，穩定後無需抓繩，船速較緩慢，與海洋衝浪極為相似。',
    bullets: [
      '腳未固定在板上，穩定後可放開繩子',
      '船速較緩慢，節奏接近衝浪',
      '體驗較容易有「站在浪上」的成就感',
    ],
    bestFor: '第一次體驗、喜歡衝浪感、不想腳被綁住',
    youtubeVideoId: 'esgwXR0ikOU',
  },
  {
    code: 'WB',
    label: 'Wakeboarding',
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

export const HEADCOUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** 跟船人數選項（不計入滑水人數） */
export const FOLLOW_BOAT_OPTIONS = [0, 1, 2, 3, 4, 5] as const

/** 依人數產生 0初～N初 選項 */
export function beginnerCountOptions(headcount: number): number[] {
  return Array.from({ length: headcount + 1 }, (_, i) => i)
}

export function formatBeginnerCount(n: number): string {
  return `${n} 位體驗`
}

/** Step 2／確認頁：體驗人數摘要 */
export function formatExperienceSummary(headcount: number, beginnerCount: number | null): string {
  if (beginnerCount == null) return '—'
  if (beginnerCount === headcount) return '全部體驗'
  if (beginnerCount === 0) return '無體驗'
  return formatBeginnerCount(beginnerCount)
}

/** 依「幾初」自動對應 LINE 表單的「是否第一次滑」 */
export function skillLevelFromBeginners(headcount: number, beginnerCount: number): SkillLevel {
  return beginnerCount >= headcount ? 'first_time' : 'experienced'
}

/** 更新人數／初學時同步 skillLevel（預設全部體驗） */
export function syncBookingPeople(
  prev: LiffBookingFormState,
  patch: { headcount?: number; beginnerCount?: number },
): Pick<LiffBookingFormState, 'headcount' | 'beginnerCount' | 'skillLevel'> {
  const headcount = patch.headcount ?? prev.headcount
  let beginnerCount: number
  if (patch.beginnerCount != null) {
    beginnerCount = patch.beginnerCount
  } else if (patch.headcount != null) {
    beginnerCount = headcount
  } else {
    beginnerCount = prev.beginnerCount ?? headcount
  }
  if (beginnerCount > headcount) beginnerCount = headcount
  return {
    headcount,
    beginnerCount,
    skillLevel: skillLevelFromBeginners(headcount, beginnerCount),
  }
}

/** 選項目時同步船型（寬板需再選小船／大船） */
export function syncActivityChoice(code: ActivityChoice): Pick<LiffBookingFormState, 'activity' | 'boatPreference'> {
  if (code === 'WB') return { activity: code, boatPreference: null }
  return { activity: code, boatPreference: 'big' }
}

export function clearActivityChoice(): Pick<LiffBookingFormState, 'activity' | 'boatPreference'> {
  return { activity: null, boatPreference: null }
}

/** Step 1 複選：目前勾了哪些單項 */
export function selectedActivityCodes(activity: ActivityChoice | null): ActivityCode[] {
  if (!activity) return []
  if (activity === 'BOTH') return ['WS', 'WB']
  return [activity]
}

export function isActivityCodeSelected(activity: ActivityChoice | null, code: ActivityCode): boolean {
  return selectedActivityCodes(activity).includes(code)
}

/** 點選切換單項；兩項皆選 → BOTH；全不選 → null */
export function toggleActivitySelection(
  activity: ActivityChoice | null,
  code: ActivityCode,
): ActivityChoice | null {
  const set = new Set(selectedActivityCodes(activity))
  if (set.has(code)) set.delete(code)
  else set.add(code)
  if (set.size === 0) return null
  if (set.size === 2) return 'BOTH'
  return [...set][0]!
}

export const TIME_PREFERENCE_OPTIONS: { value: TimePreference; label: string }[] = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
]

/** 水上計時：每人 20 分（陸上一起上課，不計入時數） */
export const WATER_MIN_PER_PERSON = 20

/** 初學體驗說明（小編指定文案） */
export const BEGINNER_LESSON_NOTE = '陸上教學 10 分鐘 · 水上每人 20 分鐘'

/** Step 1 價格面板：非初學價先以非會員顯示供審核（初學不分會員） */
export const LIFF_BOOK_GUEST_PRICING_ONLY = true

export const MAX_PREFERRED_DATES = 3

export const BOTH_ACTIVITY_SHORT = '快艇衝浪＋寬板滑水'
export const BOTH_ACTIVITY_EN = 'Wakesurf + wakeboard'
export const BOTH_ACTIVITY_LABEL = '同一梯次有人寬板滑水、有人快艇衝浪'

/** Step 1 三選一（完整品牌用字，不縮寫） */
export const STEP1_ACTIVITY_CHOICES: {
  code: ActivityChoice
  labelZh: string
  labelEn: string
}[] = [
  { code: 'WS', labelZh: '快艇衝浪', labelEn: 'Wakesurfing' },
  { code: 'WB', labelZh: '寬板滑水', labelEn: 'Wakeboarding' },
  { code: 'BOTH', labelZh: BOTH_ACTIVITY_SHORT, labelEn: BOTH_ACTIVITY_EN },
]

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

/** 預約頁 LIFF App ID（Rich Menu「我要預約」用）；未設則 fallback VITE_LIFF_ID */
export function resolveLiffBookId(): string | undefined {
  const bookId = (import.meta.env.VITE_LIFF_BOOK_ID as string | undefined)?.trim()
  const fallback = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim()
  return bookId || fallback || undefined
}

/** Rich Menu / 分享用 LIFF 連結 */
export function liffBookShareUrl(): string | null {
  const id = resolveLiffBookId()
  return id ? `https://liff.line.me/${id}` : null
}

/** LINE Developers 後台 Endpoint URL 路徑 */
export const LIFF_BOOK_ENDPOINT_PATH = '/liff/book'

export function activityDisplayName(code: ActivityChoice): string {
  if (code === 'BOTH') return BOTH_ACTIVITY_LABEL
  const a = getActivityInfo(code)
  return `${a.labelZh}（${a.label}）`
}
