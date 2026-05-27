/**
 * 產生 LINE 官方帳號的「預填訊息」deep link。
 *
 * 格式參考：https://developers.line.biz/en/docs/messaging-api/using-other-apis/
 *   https://line.me/R/oaMessage/{lineId}/?{text}
 *
 * - 不依賴 LINE Messaging API，純前端網址
 * - 點下去：手機跳 LINE app、桌機跳 LINE 桌面版／web LINE
 * - 客人按送出後，店家在既有官方帳號收到訊息（跟現有客服流程一致）
 *
 * 環境變數：
 *   VITE_SHOP_LINE_OA_ID — 官方帳號 ID（含 @ 前綴，例如「@eswake」）
 *   未設定時 fallback 為下方 DEFAULT_OA_ID（測試帳號）
 */

import type { CartItem } from '../types'
import { formatPrice, formatVariantAttributes } from './shopFormat'

/** demo / 測試用的官方帳號 ID。正式環境請用 env var 覆蓋。 */
const DEFAULT_OA_ID = '@785eqymb'

/** URL 大小上限保守值（含整段 URL 編碼後字元數，> 此值就警告） */
export const URL_BUDGET = 1900

function getOaId(): string {
  const fromEnv = import.meta.env.VITE_SHOP_LINE_OA_ID as string | undefined
  return (fromEnv && fromEnv.trim()) || DEFAULT_OA_ID
}

/**
 * 用官方帳號 ID + 預填訊息組出 deep link URL。
 * 把 OA ID 跟訊息分別 encode（注意 `@` 要變 `%40`）。
 */
function buildOaMessageUrl(message: string): string {
  const oaId = getOaId()
  const encodedId = encodeURIComponent(oaId)
  const encodedMsg = encodeURIComponent(message)
  return `https://line.me/R/oaMessage/${encodedId}/?${encodedMsg}`
}

/**
 * 從詳情頁的「直接 LINE 詢問」按鈕產生網址。
 * 包含單一品項的完整資訊。
 */
export function buildSingleInquiryMessage(input: {
  productName: string
  categoryId: string | null | undefined
  attributes: Record<string, unknown>
  quantity: number
  unitPrice: number | null
}): string {
  const attrsText = formatVariantAttributes(input.categoryId, input.attributes)
  const lines: string[] = [
    '我想詢問以下商品：',
    '',
    `品項：${input.productName}`,
  ]
  if (attrsText) lines.push(`規格：${attrsText}`)
  lines.push(`數量：${input.quantity}`)
  lines.push(
    `單價：${input.unitPrice != null ? formatPrice(input.unitPrice) : '洽詢'}`
  )
  lines.push('', '請聯絡我，謝謝！')
  return lines.join('\n')
}

/**
 * 從購物車「LINE 統一詢問購買」按鈕產生網址。
 * 列出多個品項與小計。
 */
export function buildCartInquiryMessage(items: CartItem[]): string {
  if (items.length === 0) return ''

  const totalCount = items.reduce((s, it) => s + it.quantity, 0)
  const totalAmount = items.reduce(
    (s, it) => s + (it.unitPrice ?? 0) * it.quantity,
    0
  )
  const hasUnknownPrice = items.some((it) => it.unitPrice == null)

  const lines: string[] = [
    `我想詢問以下商品（共 ${totalCount} 件）：`,
    '',
  ]

  items.forEach((it, idx) => {
    const attrsText = formatVariantAttributes(it.categoryId, it.attributes)
    lines.push(`【${idx + 1}】${it.productName}`)
    if (attrsText) lines.push(`　規格：${attrsText}`)
    lines.push(`　數量：${it.quantity}`)
    lines.push(
      `　單價：${it.unitPrice != null ? formatPrice(it.unitPrice) : '洽詢'}`
    )
    lines.push('')
  })

  lines.push(`預估金額：${formatPrice(totalAmount)}`)
  if (hasUnknownPrice) {
    lines.push('（部分品項為洽詢價，最終以店家報價為準）')
  }
  lines.push('', '請聯絡我，謝謝！')
  return lines.join('\n')
}

/** 完整 URL（含 base + encode），給 `window.location.href` 用 */
export function buildSingleInquiryUrl(
  input: Parameters<typeof buildSingleInquiryMessage>[0]
): string {
  return buildOaMessageUrl(buildSingleInquiryMessage(input))
}

export function buildCartInquiryUrl(items: CartItem[]): string {
  return buildOaMessageUrl(buildCartInquiryMessage(items))
}

/** 估算 URL 長度，回 true 代表「太長，建議客人分批詢問」 */
export function isInquiryTooLong(url: string): boolean {
  return url.length > URL_BUDGET
}
