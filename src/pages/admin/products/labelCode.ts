/** 標籤代碼：店員自訂英數字串，印在標籤並 encode 為 Code128 條碼 */

/** 小標籤好掃的建議字數（僅提示，不強制下限） */
export const LABEL_CODE_IDEAL_MIN = 10
export const LABEL_CODE_IDEAL_MAX = 18
/** 硬上限：小標籤仍可掃的實務上限 */
export const LABEL_CODE_MAX_LEN = 20

export const LABEL_CODE_RULE_HINT = `英文＋數字，建議 ${LABEL_CODE_IDEAL_MIN}～${LABEL_CODE_IDEAL_MAX} 字，最多 ${LABEL_CODE_MAX_LEN} 字`

/** 輸入時即時過濾：大寫、去非法字元、截斷至上限 */
export function sanitizeLabelCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LABEL_CODE_MAX_LEN)
}

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

/** 標籤代碼是否與 DB 已存值不同 */
export function isLabelCodeDirty(current: string, saved: string): boolean {
  return (normalizeLabelCode(current) ?? '') !== (normalizeLabelCode(saved) ?? '')
}

/** SKU 是否尚未設定標籤代碼（庫存列表「缺標籤」篩選用） */
export function isMissingLabelCode(labelCode: string | null | undefined): boolean {
  return normalizeLabelCode(labelCode ?? '') === null
}
