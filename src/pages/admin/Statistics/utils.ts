// Statistics Dashboard 共用工具函數

import { getLocalDateString } from '../../../utils/date'

export type MonthRangeMeta = {
  monthStr: string
  month: number
  startDate: string
  endDateStr: string
}

/**
 * 單一曆月查詢區間：未來月略過；當月只到昨天；過去月到月底。
 */
export function getCalendarMonthRange(
  year: number,
  month: number,
  now: Date = new Date()
): MonthRangeMeta | null {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const startDate = `${monthStr}-01`
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getLocalDateString(yesterday)

  const isFutureMonth =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1)
  if (isFutureMonth) return null

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1
  if (isCurrentMonth) {
    if (yesterdayStr < startDate) return null
    return { monthStr, month, startDate, endDateStr: yesterdayStr }
  }

  return {
    monthStr,
    month,
    startDate,
    endDateStr: `${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`,
  }
}

/** 選年的 1～12 月區間（略過尚無資料／未來月） */
export function getYearMonthRanges(
  year: number,
  now: Date = new Date()
): MonthRangeMeta[] {
  const ranges: MonthRangeMeta[] = []
  for (let month = 1; month <= 12; month++) {
    const range = getCalendarMonthRange(year, month, now)
    if (range) ranges.push(range)
  }
  return ranges
}

/** 整年單一區間：過去年到 12/31；當年到昨天 */
export function getYearDateRange(
  year: number,
  now: Date = new Date()
): { startDate: string; endDateStr: string } | null {
  const startDate = `${year}-01-01`
  if (year > now.getFullYear()) return null

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getLocalDateString(yesterday)

  if (year === now.getFullYear()) {
    if (yesterdayStr < startDate) return null
    return { startDate, endDateStr: yesterdayStr }
  }

  return { startDate, endDateStr: `${year}-12-31` }
}

/**
 * 格式化時間顯示 - 統一使用分鐘
 */
export function formatDuration(minutes: number): string {
  return `${minutes} 分`
}

/**
 * 格式化時間顯示（簡短版）
 */
export function formatDurationShort(minutes: number): string {
  return `${minutes}分`
}

/**
 * 計算百分比變化
 */
export function calculateChange(current: number, previous: number): { 
  value: number
  direction: 'up' | 'down' | 'same'
  percentage: string 
} {
  if (previous === 0) {
    return { value: 0, direction: 'same', percentage: '-' }
  }
  const change = ((current - previous) / previous) * 100
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  return {
    value: Math.abs(change),
    direction,
    percentage: `${change > 0 ? '+' : ''}${Math.round(change)}%`
  }
}

/**
 * 取得月份標籤（跨年時顯示年份）
 */
export function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const now = new Date()
  const monthNum = parseInt(month)
  
  if (parseInt(year) !== now.getFullYear()) {
    return `${year.slice(2)}年${monthNum}月`
  }
  return `${monthNum}月`
}

/**
 * 取得排名圖示
 */
export function getRankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

/**
 * 計算進度條百分比
 */
export function getProgressPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min((value / max) * 100, 100)
}

