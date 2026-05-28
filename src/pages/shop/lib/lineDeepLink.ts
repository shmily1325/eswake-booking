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

export function getOaId(): string {
  const fromEnv = import.meta.env.VITE_SHOP_LINE_OA_ID as string | undefined
  return (fromEnv && fromEnv.trim()) || DEFAULT_OA_ID
}

/**
 * 商城對外的 base URL（用來組商品頁連結放進 LINE 詢問訊息）。
 *
 * 解析順序：
 *   1. VITE_SHOP_BASE_URL（部署環境變數，正式應設成 https://shop.eswakeschool.com）
 *   2. window.location.origin（SSR/build 時拿不到，所以保留 env var）
 *   3. 兩者都沒 → 回空字串（訊息就不附連結）
 */
export function getShopBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SHOP_BASE_URL as string | undefined
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** 組商品頁網址（給 LINE 訊息用）。沒有 base URL 時回空字串。 */
export function buildProductUrl(productId: string): string {
  const base = getShopBaseUrl()
  if (!base) return ''
  return `${base}/shop/${productId}`
}

/**
 * OA 主頁（加好友 / 開對話）。
 * 桌機 fallback 用：oaMessage deep link 在桌機未裝 LINE 時會跳到 LINE 行銷首頁，
 * 改跳這個至少能讓客人看到 OA 帳號並選擇加為好友或開啟對話。
 */
export function buildOaHomeUrl(): string {
  const oaId = getOaId()
  const encodedId = encodeURIComponent(oaId)
  return `https://line.me/R/ti/p/${encodedId}`
}

/** 判斷裝置是否是手機（粗略 UA sniff，給「跳 LINE 行為」分流用） */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
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

interface SingleInquiryInput {
  productId: string
  productName: string
  categoryId: string | null | undefined
  attributes: Record<string, unknown>
  quantity: number
  unitPrice: number | null
}

/**
 * 從詳情頁的「直接 LINE 詢問」按鈕產生網址。
 * 包含單一品項的完整資訊。
 */
export function buildSingleInquiryMessage(
  input: SingleInquiryInput,
  opts: { includeUrl?: boolean } = {}
): string {
  const includeUrl = opts.includeUrl ?? true
  const attrsText = formatVariantAttributes(input.categoryId, input.attributes)
  const productUrl = includeUrl ? buildProductUrl(input.productId) : ''
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
  if (productUrl) lines.push(`商品頁：${productUrl}`)
  lines.push('', '請聯絡我，謝謝！')
  return lines.join('\n')
}

/**
 * 從購物車「LINE 統一詢問購買」按鈕產生網址。
 * 列出多個品項與小計。
 *
 * `includeUrls`: 是否在每筆品項後面加商品頁網址。
 *   - 預設 true；budget 超標時 `buildCartInquiryUrl` 會 fallback 成 false 再產一次。
 */
export function buildCartInquiryMessage(
  items: CartItem[],
  opts: { includeUrls?: boolean } = {}
): string {
  if (items.length === 0) return ''
  const includeUrls = opts.includeUrls ?? true

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
    const productUrl = includeUrls ? buildProductUrl(it.productId) : ''
    lines.push(`【${idx + 1}】${it.productName}`)
    if (attrsText) lines.push(`　規格：${attrsText}`)
    lines.push(`　數量：${it.quantity}`)
    lines.push(
      `　單價：${it.unitPrice != null ? formatPrice(it.unitPrice) : '洽詢'}`
    )
    if (productUrl) lines.push(`　商品頁：${productUrl}`)
    lines.push('')
  })

  lines.push(`預估金額：${formatPrice(totalAmount)}`)
  if (hasUnknownPrice) {
    lines.push('（部分品項為洽詢價，最終以店家報價為準）')
  }
  lines.push('', '請聯絡我，謝謝！')
  return lines.join('\n')
}

/**
 * 完整 URL（含 base + encode），給 `window.location.href` 用。
 *
 * 策略：預設帶商品頁網址；如果整段 URL 超過 LINE 限制，自動退掉網址再產一次。
 * 仍超標的話呼叫端會看到 `isInquiryTooLong()` 為 true 並出警告。
 */
export function buildSingleInquiryUrl(input: SingleInquiryInput): string {
  const withUrl = buildOaMessageUrl(buildSingleInquiryMessage(input, { includeUrl: true }))
  if (!isInquiryTooLong(withUrl)) return withUrl
  return buildOaMessageUrl(buildSingleInquiryMessage(input, { includeUrl: false }))
}

export function buildCartInquiryUrl(items: CartItem[]): string {
  const withUrls = buildOaMessageUrl(buildCartInquiryMessage(items, { includeUrls: true }))
  if (!isInquiryTooLong(withUrls)) return withUrls
  return buildOaMessageUrl(buildCartInquiryMessage(items, { includeUrls: false }))
}

/**
 * 配合 `buildCartInquiryUrl` 的 fallback 行為，把實際送出的訊息（去掉 URL 與否）拿出來。
 * UI 上的 desktop fallback modal 需要顯示「跟 URL 帶的同一份」訊息才合理。
 */
export function buildCartInquiryMessageForUrl(items: CartItem[]): string {
  const withUrls = buildCartInquiryMessage(items, { includeUrls: true })
  if (!isInquiryTooLong(buildOaMessageUrl(withUrls))) return withUrls
  return buildCartInquiryMessage(items, { includeUrls: false })
}

export function buildSingleInquiryMessageForUrl(input: SingleInquiryInput): string {
  const withUrl = buildSingleInquiryMessage(input, { includeUrl: true })
  if (!isInquiryTooLong(buildOaMessageUrl(withUrl))) return withUrl
  return buildSingleInquiryMessage(input, { includeUrl: false })
}

/** 估算 URL 長度，回 true 代表「太長，建議客人分批詢問」 */
export function isInquiryTooLong(url: string): boolean {
  return url.length > URL_BUDGET
}

/**
 * 統一的「跳轉到 LINE」入口。
 *
 * - 手機：直接 `window.location.href = deepLink`，喚起 LINE app
 * - 桌機：回傳 `{ mode: 'desktop-fallback', message }` 讓 UI 顯示 modal
 *
 * 這樣呼叫端只要判斷 mode 即可，平台分流邏輯集中在這。
 */
export type InquiryResult =
  | { mode: 'mobile-deeplink' }
  | { mode: 'desktop-fallback'; message: string }

export function launchInquiry(message: string): InquiryResult {
  if (isMobileDevice()) {
    window.location.href = buildOaMessageUrl(message)
    return { mode: 'mobile-deeplink' }
  }
  return { mode: 'desktop-fallback', message }
}
