/**
 * 常見操作者 email 對應的填表人姓名
 * 方便自動填入，但用戶仍可手動修改
 */
const EMAIL_TO_NAME_MAP: Record<string, string> = {
  'minlin1325@gmail.com': 'Ming',
  'stt884142000@gmail.com': '何靜',
  'lynn8046356@gmail.com': 'Lynn',
  'a900802916@gmail.com': 'ED',
  'agou83156411@gmail.com': '義揚',
  'e03412692@gmail.com': 'Kevin',
  'harry11039@gmail.com': '木鳥',
  'hsulittlepang2015@gmail.com': '小胖',
  'jerry9081003@gmail.com': 'Jerry',
  'johnnyz.ee94@gmail.com': '許書源',
  'kt.tin.chang@gmail.com': 'Tin',
  'paulhalo3999@gmail.com': 'Casper',
  'skywang760226@gmail.com': 'Sky',
  'tatawakesurf@gmail.com': 'Anita',
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

/**
 * 寫入資料庫前統一填表人格式（特殊處理：B/b 一律存成 B）
 */
export function normalizeFilledByForSave(value: string | undefined | null): string {
  if (!value || !value.trim()) return ''
  const lower = value.trim().toLowerCase()
  if (lower === 'b') return 'B'
  return value.trim()
}

