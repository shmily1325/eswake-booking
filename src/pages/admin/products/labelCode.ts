/** 標籤代碼：店員自訂英數字串，印在標籤並 encode 為 Code128 條碼 */

export const LABEL_CODE_MAX_LEN = 30

/** 儲存前正規化：去空白、轉大寫；空字串 → null */
export function normalizeLabelCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase()
  return trimmed === '' ? null : trimmed
}

/** 驗證格式；空值合法（尚未設定標籤） */
export function validateLabelCodeFormat(raw: string): string | null {
  const normalized = normalizeLabelCode(raw)
  if (normalized === null) return null
  if (normalized.length > LABEL_CODE_MAX_LEN) {
    return `標籤代碼最多 ${LABEL_CODE_MAX_LEN} 字`
  }
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return '標籤代碼只能使用英文與數字'
  }
  return null
}

/** 同一商品內不可重複（比對正規化後的值） */
export function findDuplicateLabelCodes(
  entries: ReadonlyArray<{ label_code: string; pendingDelete?: boolean }>,
): string | null {
  const seen = new Set<string>()
  for (const e of entries) {
    if (e.pendingDelete) continue
    const code = normalizeLabelCode(e.label_code)
    if (code === null) continue
    if (seen.has(code)) return code
    seen.add(code)
  }
  return null
}
