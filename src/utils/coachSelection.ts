/** 不出現在一般教練選單的人員；特殊提醒功能仍可獨立使用他們。 */
export const STANDARD_COACH_LIST_EXCLUDED_NAMES = ['火隆', '侑曄'] as const

const excludedNameSet = new Set<string>(STANDARD_COACH_LIST_EXCLUDED_NAMES)

export function isExcludedFromStandardCoachList(name: string): boolean {
  return excludedNameSet.has(name.trim())
}

export function filterStandardCoachList<T extends { name: string }>(
  coaches: T[],
): T[] {
  return coaches.filter((coach) => !isExcludedFromStandardCoachList(coach.name))
}
