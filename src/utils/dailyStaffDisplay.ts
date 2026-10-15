/**
 * 每日人員列與今日公告：依名字關鍵字隱藏
 * - DailyStaffDisplay：👥 可上班（休假列顯示所有有休假紀錄的人員）
 * - DailyAnnouncement：🏖️ 休假
 * - offline.html：內嵌同名規則，改此檔時請一併對齊
 */
import { STANDARD_COACH_LIST_EXCLUDED_NAMES } from './coachSelection'

const WORKING_DISPLAY_HIDDEN_NAME_PARTS = STANDARD_COACH_LIST_EXCLUDED_NAMES
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
