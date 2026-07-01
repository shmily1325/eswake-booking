/**
 * 每日「可上班／休假」列與今日公告休假：依名字關鍵字隱藏
 * （非教練或另計，仍可在排班／預約／教練休假頁使用）
 * - DailyStaffDisplay：👥 可上班、🏖️ 休假
 * - DailyAnnouncement：🏖️ 休假
 * - offline.html：內嵌同名規則，改此檔時請一併對齊
 */

const WORKING_DISPLAY_HIDDEN_NAME_PARTS = ['火隆', '侑曄'] as const
const TIMEOFF_DISPLAY_HIDDEN_NAME_PARTS = ['義揚', '許書源'] as const

function nameMatchesAny(name: string, parts: readonly string[]): boolean {
  return parts.some(part => name.includes(part))
}

export function isHiddenFromWorkingStaffDisplay(name: string): boolean {
  return nameMatchesAny(name, WORKING_DISPLAY_HIDDEN_NAME_PARTS)
}

export function isHiddenFromTimeOffStaffDisplay(name: string): boolean {
  return nameMatchesAny(name, TIMEOFF_DISPLAY_HIDDEN_NAME_PARTS)
}

export function filterWorkingStaffDisplay<T extends { name: string }>(staff: T[]): T[] {
  return staff.filter(s => !isHiddenFromWorkingStaffDisplay(s.name))
}

export function filterTimeOffStaffDisplay<T extends { name: string }>(staff: T[]): T[] {
  return staff.filter(s => !isHiddenFromTimeOffStaffDisplay(s.name))
}
