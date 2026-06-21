import type { BasicMember } from './memberUtils'

/** 關鍵字模式下，從會員列表找出所有匹配的 member id */
export function memberIdsMatchingKeyword(
  members: BasicMember[],
  searchTerm: string,
): string[] {
  const term = searchTerm.trim()
  if (!term) return []

  const lower = term.toLowerCase()
  return members
    .filter(m =>
      m.name.toLowerCase().includes(lower) ||
      (m.nickname?.toLowerCase().includes(lower) ?? false) ||
      (m.phone?.includes(term) ?? false),
    )
    .map(m => m.id)
}

/** 已選會員的提示文字 */
export function formatSelectedMemberHint(member: BasicMember): string {
  const label = member.nickname || member.name
  if (member.nickname && member.nickname !== member.name) {
    return `${member.nickname}（${member.name}）`
  }
  return label
}
