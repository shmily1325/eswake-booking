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

/** 註解搜尋：空白分隔多個關鍵字（全部都要出現） */
export function parseNotesSearchKeywords(input: string): string[] {
  return input
    .trim()
    .split(/\s+/)
    .map(k => k.trim())
    .filter(Boolean)
}

/** 跳脫 ILIKE 萬用字元，避免使用者輸入 % / _ 擴大匹配 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** 註解是否同時包含所有關鍵字（不分大小寫） */
export function notesContainAllKeywords(
  notes: string | null | undefined,
  keywords: string[],
): boolean {
  if (keywords.length === 0) return true
  if (!notes) return false
  const lower = notes.toLowerCase()
  return keywords.every(k => lower.includes(k.toLowerCase()))
}

/** 將文字依關鍵字切段，供結果區高亮（不分大小寫；較長關鍵字優先） */
export function splitTextByKeywords(
  text: string,
  keywords: string[],
): Array<{ text: string; match: boolean }> {
  if (!text || keywords.length === 0) return [{ text, match: false }]

  const unique = [...new Set(keywords.map(k => k.toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  if (unique.length === 0) return [{ text, match: false }]

  const escaped = unique.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return parts
    .filter(part => part !== '')
    .map(part => ({
      text: part,
      match: unique.includes(part.toLowerCase()),
    }))
}
