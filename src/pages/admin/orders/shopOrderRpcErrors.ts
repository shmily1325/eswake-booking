/** 商品訂單 RPC 錯誤 → 簡短白話 */

const EXACT_MESSAGES: Record<string, string> = {
  找不到訂單: '找不到訂單，請重整。',
  訂單已作廢: '訂單已作廢。',
  找不到商品規格: '規格不存在或已下架。',
  未指定送結帳品項: '請選要送結帳的品項。',
  未指定撤回品項: '請指定撤回品項。',
  未指定結帳品項: '請勾選要結帳的品項。',
  品項或數量無效: '品項或數量有誤。',
  品項不屬於此訂單: '品項不屬於此訂單。',
  撤回數量超過待結帳數量: '撤回量超過待結帳量。',
  付款方式無效: '付款方式無效。',
  扣儲值需指定會員: '扣儲值請選會員。',
  金額無效: '金額有誤。',
  '保留庫存異常，請聯絡管理員': '保留庫存異常，請找管理員。',
  '庫存異常，請聯絡管理員': '庫存異常，請找管理員。',
  找不到結帳紀錄: '找不到結帳紀錄。',
  'items_snapshot 須為陣列': '結帳資料錯誤。',
  找不到扣款會員: '找不到扣款會員。',
  操作失敗: '操作失敗。',
}

const SUBMIT_STOCK_RE =
  /現貨不足，無法送結帳（品項\s*[^，]+，可售\s*(\d+)）/

const SUBMIT_QTY_OVER_RE = /送結帳數量超過未送出的訂量/

const SETTLE_FULL_PENDING_RE = /v1 需整批結清待結帳數量（品項\s*[^：]+：待結帳\s*(\d+)，傳入\s*(\d+)）/

const RESERVED_LOW_RE = /保留庫存不足/

export function formatShopOrderRpcError(
  raw: string | null | undefined,
  fallback = '操作失敗',
): string {
  const msg = (raw ?? '').trim()
  if (!msg) return fallback

  if (EXACT_MESSAGES[msg]) return EXACT_MESSAGES[msg]

  if (msg.includes('找不到扣款會員')) {
    return EXACT_MESSAGES['找不到扣款會員']
  }

  let m = msg.match(SUBMIT_STOCK_RE)
  if (m) {
    return `現貨不足，最多可送 ${m[1]} 件。`
  }

  if (SUBMIT_QTY_OVER_RE.test(msg)) {
    return '送結帳量超過未送出訂量。'
  }

  m = msg.match(SETTLE_FULL_PENDING_RE)
  if (m) {
    return `須一次結清待結 ${m[1]} 件。`
  }

  if (RESERVED_LOW_RE.test(msg)) {
    return '保留庫存異常，請找管理員。'
  }

  if (/insufficient|餘額不足|balance/i.test(msg)) {
    return '儲值餘額不足。'
  }

  if (/permission|權限|denied|JWT/i.test(msg)) {
    return '沒有權限。'
  }

  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return '連線失敗。'
  }

  if (/[\u4e00-\u9fff]/.test(msg) && msg.length <= 80 && !msg.includes('SQLSTATE')) {
    return msg
  }

  return fallback
}
