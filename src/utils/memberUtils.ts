/**
 * 會員相關的共用工具函數
 * 用於減少代碼重複，保持邏輯一致性
 */

/**
 * 基本會員介面（只包含搜尋和顯示所需的欄位）
 * 這是一個通用型別，適用於各種簡化的會員資料查詢
 */
export interface BasicMember {
  id: string
  name: string
  nickname: string | null
  phone?: string | null
}

/**
 * 過濾會員列表（用於搜尋功能）
 * 支援按姓名、暱稱、電話號碼搜尋
 * 
 * @param members 完整的會員列表
 * @param searchTerm 搜尋關鍵字
 * @param maxResults 最大返回結果數量（預設 10）
 * @returns 過濾後的會員列表
 * 
 * @example
 * ```typescript
 * const filtered = filterMembers(allMembers, '王小明', 10)
 * ```
 */
export function filterMembers<T extends BasicMember>(
  members: T[],
  searchTerm: string,
  maxResults: number = 10
): T[] {
  if (!searchTerm.trim()) return []
  
  const searchLower = searchTerm.toLowerCase()
  return members.filter(member => 
    member.name.toLowerCase().includes(searchLower) ||
    (member.nickname && member.nickname.toLowerCase().includes(searchLower)) ||
    (member.phone && member.phone.includes(searchLower))
  ).slice(0, maxResults)
}

/**
 * 組合最終的學生姓名字串
 * 從選中的會員 ID 和手動輸入的名字組合成完整字串
 * 
 * @param members 完整的會員列表
 * @param selectedMemberIds 選中的會員 ID 列表
 * @param manualNames 手動輸入的非會員名字列表
 * @returns 組合後的姓名字串（用逗號分隔）
 * 
 * @example
 * ```typescript
 * const finalName = composeFinalStudentName(
 *   allMembers, 
 *   ['member-1', 'member-2'], 
 *   ['訪客A']
 * )
 * // 返回: "王小明, 李大華, 訪客A"
 * ```
 */
export function composeFinalStudentName<T extends BasicMember>(
  members: T[],
  selectedMemberIds: string[],
  manualNames: string[]
): string {
  const memberNames = selectedMemberIds.length > 0
    ? members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.nickname || m.name)
    : []
  
  const allNames = [...memberNames, ...manualNames]
  
  return allNames.join(', ')
}

/**
 * 切換項目選擇狀態（用於多選）
 * 如果項目已選中則移除，否則添加
 * 
 * @param currentList 當前選中的項目列表
 * @param itemId 要切換的項目 ID
 * @returns 更新後的項目列表
 * 
 * @example
 * ```typescript
 * const newCoaches = toggleSelection(['coach-1', 'coach-2'], 'coach-2')
 * // 返回: ['coach-1'] (移除了 coach-2)
 * 
 * const newCoaches = toggleSelection(['coach-1'], 'coach-2')
 * // 返回: ['coach-1', 'coach-2'] (添加了 coach-2)
 * ```
 */
export function toggleSelection(currentList: string[], itemId: string): string[] {
  return currentList.includes(itemId)
    ? currentList.filter(id => id !== itemId)
    : [...currentList, itemId]
}

