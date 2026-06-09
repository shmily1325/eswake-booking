import type { BookLocale } from './liffBookingI18n'
import type { ActivityChoice, CoachOption } from './types'

/** LIFF 指定教練：不顯示（客人會用群組聯繫） */
const HIDDEN_COACH_NAME_PARTS = ['火龍', '火隆', '侑曄', '阿寶', 'SKY'] as const

/** 單堂價換算為 20 分鐘參考價 */
function price20From30(price30: number): number {
  return Math.floor(price30 * 20 / 30)
}

function price20From60(price60: number): number {
  return Math.floor(price60 * 20 / 60)
}

interface CoachDesignatedRates {
  /** 名字包含任一關鍵字即匹配 */
  nameParts: readonly string[]
  /** 寬板滑水 20 分鐘；未提供＝此項目不指定 */
  wb?: number
  /** 快艇衝浪 20 分鐘；未提供＝此項目不指定 */
  ws?: number
}

/**
 * 指定教練單堂價（換算 20 分鐘，供 LIFF 顯示／估價）。
 * 來源：小編牌價表（30 分或 60 分單堂價按比例換算）。
 */
const COACH_DESIGNATED_20: readonly CoachDesignatedRates[] = [
  { nameParts: ['Casper'], wb: 400 }, // WB $400/20分
  { nameParts: ['木鳥'], wb: price20From30(900), ws: price20From30(750) }, // WB $900/30、WS $750/30
  { nameParts: ['Jerry'], wb: price20From30(900), ws: price20From30(900) },
  { nameParts: ['ED'], ws: price20From30(900) },
  { nameParts: ['Kevin', '智凱'], ws: price20From30(600) },
  { nameParts: ['Anita'], ws: price20From60(3000) }, // $3000/60分
  { nameParts: ['巨陽尼'], wb: 500 },
  { nameParts: ['小胖'], wb: price20From30(750), ws: price20From30(750) },
  { nameParts: ['SKY'], wb: price20From30(900), ws: price20From30(900) },
  { nameParts: ['義揚'], wb: price20From30(600) },
  { nameParts: ['阿寶'], wb: price20From30(750) }, // 隱藏，保留供估價
]

function matchCoachRates(name: string): CoachDesignatedRates | null {
  return COACH_DESIGNATED_20.find(entry =>
    entry.nameParts.some(part => name.includes(part)),
  ) ?? null
}

function ratesFromDb(coach: CoachOption): { wb: number | null; ws: number | null } | null {
  if (!coach.designated_lesson_price_30min) return null
  const p = price20From30(coach.designated_lesson_price_30min)
  return { wb: p, ws: p }
}

function resolveCoachRates(coach: CoachOption): { wb: number | null; ws: number | null } | null {
  const entry = matchCoachRates(coach.name)
  if (entry) {
    return {
      wb: entry.wb ?? null,
      ws: entry.ws ?? null,
    }
  }
  return ratesFromDb(coach)
}

export function isLiffBookCoachVisible(name: string): boolean {
  return !HIDDEN_COACH_NAME_PARTS.some(part => name.includes(part))
}

export function filterLiffBookCoaches(
  coaches: CoachOption[],
  activity: ActivityChoice | null = null,
): CoachOption[] {
  return coaches
    .filter(c => isLiffBookCoachVisible(c.name))
    .filter(c => !activity || designatedCoachPrice20(c, activity) != null)
}

/** 指定教練參考價（20 分鐘），依目前選擇的活動 */
export function designatedCoachPrice20(
  coach: CoachOption,
  activity: ActivityChoice | null,
): number | null {
  if (!activity) return null

  const rates = resolveCoachRates(coach)
  if (!rates) return null

  if (activity === 'BOTH') {
    const available = [rates.wb, rates.ws].filter((p): p is number => p != null)
    return available.length > 0 ? Math.max(...available) : null
  }

  return activity === 'WB' ? rates.wb : rates.ws
}

function formatCoachPrice(n: number): string {
  return `$${n.toLocaleString()}`
}

/** 教練列表顯示用（BOTH 且兩價不同時顯示 WB · WS） */
export function designatedCoachPriceLabel(
  coach: CoachOption,
  activity: ActivityChoice | null,
  locale: BookLocale = 'zh',
): string | null {
  if (!activity) return null

  const rates = resolveCoachRates(coach)
  if (!rates) return null

  if (activity === 'WB') {
    return rates.wb != null ? formatCoachPrice(rates.wb) : null
  }
  if (activity === 'WS') {
    return rates.ws != null ? formatCoachPrice(rates.ws) : null
  }

  const wb = rates.wb
  const ws = rates.ws
  if (wb == null && ws == null) return null
  if (wb != null && ws == null) return formatCoachPrice(wb)
  if (ws != null && wb == null) return formatCoachPrice(ws)
  if (wb === ws) return formatCoachPrice(wb!)

  const wbTag = locale === 'en' ? 'WB' : '寬板'
  const wsTag = locale === 'en' ? 'WS' : '衝浪'
  return `${wbTag} ${formatCoachPrice(wb!)} · ${wsTag} ${formatCoachPrice(ws!)}`
}

/** BOTH 混合梯次：WB／WS 價格是否不同（估價備註用） */
export function coachHasSplitRates(coach: CoachOption): boolean {
  const rates = resolveCoachRates(coach)
  if (!rates || rates.wb == null || rates.ws == null) return false
  return rates.wb !== rates.ws
}
