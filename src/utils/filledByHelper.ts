/**
 * 常見操作者 email 對應的填表人姓名
 * 方便自動填入，但用戶仍可手動修改
 */
const EMAIL_TO_NAME_MAP: Record<string, string> = {
  'minlin1325@gmail.com': 'Ming',
  'stt884142000@gmail.com': '何靜',
  'lynn8046356@gmail.com': 'L',
  // 可以在這裡新增更多常見的 email -> 姓名對應
}

/**
 * 根據 email 取得對應的填表人姓名
 * 如果 email 不在對應表中，回傳空字串
 */
export function getFilledByName(email: string | undefined | null): string {
  if (!email) return ''
  return EMAIL_TO_NAME_MAP[email] || ''
}

