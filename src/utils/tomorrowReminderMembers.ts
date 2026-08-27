/**
 * 明日提醒：把預約的 contact_name 對上 booking_members，
 * 產出顯示用姓名（會員取最新暱稱、訪客保留原名），並回傳姓名對應的會員 id。
 *
 * /tomorrow 以此保持預約顯示名稱與 member_id 對應一致，
 * 才能正確判斷 LINE 綁定與推播資格。
 */

export type ReminderMemberRow = {
  id: string
  name: string | null
  nickname?: string | null
}

export type ResolvedContactNames = {
  /** 重組後的 contact_name（逗號分隔） */
  contactName: string
  /** 顯示名 → 會員 id；訪客不會出現在此表 */
  memberIdByDisplayName: Map<string, string>
}

function displayNameOf(member: ReminderMemberRow): string {
  return member.nickname || member.name || ''
}

export function resolveContactNamesWithMembers(
  contactName: string,
  members: ReminderMemberRow[]
): ResolvedContactNames {
  const memberIdByDisplayName = new Map<string, string>()

  if (members.length === 0) {
    return { contactName, memberIdByDisplayName }
  }

  const originalNames = contactName.split(',').map((n) => n.trim())

  // 純會員預約：名字數量與會員數量相同，直接全部替換
  if (members.length === originalNames.length) {
    const names = members.map((member) => {
      const display = displayNameOf(member)
      memberIdByDisplayName.set(display, member.id)
      return display
    })
    return { contactName: names.join(', '), memberIdByDisplayName }
  }

  // 混合預約：逐一比對，會員換成最新暱稱，訪客保留原名
  const updatedNames: string[] = []
  const processedMemberIds = new Set<string>()

  originalNames.forEach((name) => {
    const matchedMember = members.find((member) => {
      if (name === member.name || name === member.nickname) return true
      // 部分匹配：處理 "Ingrid/Joanna" 這種複合名稱
      const nameParts = name.split('/').map((part) => part.trim())
      return nameParts.some((part) => part === member.name || part === member.nickname)
    })

    if (matchedMember && !processedMemberIds.has(matchedMember.id)) {
      const display = displayNameOf(matchedMember)
      updatedNames.push(display)
      memberIdByDisplayName.set(display, matchedMember.id)
      processedMemberIds.add(matchedMember.id)
      return
    }

    if (!matchedMember) {
      updatedNames.push(name)
    }
  })

  // 確保所有會員都出現（防止遺漏）
  members.forEach((member) => {
    if (processedMemberIds.has(member.id)) return
    const display = displayNameOf(member)
    updatedNames.push(display)
    memberIdByDisplayName.set(display, member.id)
  })

  return {
    contactName: updatedNames.length > 0 ? updatedNames.join(', ') : contactName,
    memberIdByDisplayName,
  }
}
