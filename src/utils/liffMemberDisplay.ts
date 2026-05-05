/**
 * LIFF 上對會員顯示的稱呼（與明日提醒 Safin→「你好李伯」同一人物辨識）。
 * 僅影響顯示字串，不寫回資料庫。
 */
const SAFIN_MEMBER_PRIMARY = 'Safin' as const
const SAFIN_LIFF_DISPLAY_NAME = '李伯' as const

function isSafinMember(member: { name: string; nickname: string | null }): boolean {
  const n = member.name?.trim()
  const nick = member.nickname?.trim()
  return n === SAFIN_MEMBER_PRIMARY || nick === SAFIN_MEMBER_PRIMARY
}

/**
 * 頁首問候等：暱稱優先，與原 `nickname || name` 一致；Safin 時改顯示「李伯」。
 */
export function displayNameForLiff(member: { name: string; nickname: string | null }): string {
  if (isSafinMember(member)) return SAFIN_LIFF_DISPLAY_NAME
  return (member.nickname?.trim() || member.name?.trim() || '')
}
