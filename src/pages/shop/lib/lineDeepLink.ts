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
 * 只認 `VITE_SHOP_BASE_URL`，不 fallback 到 `window.location.origin`：
 *   - 預期值是「正式網域」，例如 https://shop.eswakeschool.com
 *   - 開發 / Preview 環境若沒設，寧可不附網址，也不要把 *.vercel.app 或 localhost
 *     寫進 LINE 訊息給客人（看了很奇怪、且這些 URL 不會永遠有效）
 *   - 上線前在 Vercel 把這個 env var 設好即可，程式不用改
 */
export function getShopBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_SHOP_BASE_URL as string | undefined
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '')
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

/**
 * 一筆「LINE 詢問」要送出去的完整 payload：URL 與訊息一起算好，保證一致。
 *
 * 為什麼包成一個結構：
 * - URL 跟訊息要嚴格同步（modal 顯示的訊息 = URL 編碼後的內容）
 * - budget 超標時的 fallback（拿掉商品連結）邏輯集中在 build 端，呼叫端不用重做
 */
export interface InquiryPayload {
  /** 完整 LINE deep link URL，給手機 `window.location.href` 用 */
  url: string
  /** 訊息純文字（與 URL 內 encode 的內容相同），給桌機 modal 顯示用 */
  message: string
  /** 為了塞進 LINE URL 上限，是否把每筆品項的「商品頁網址」拿掉了 */
  urlsTrimmed: boolean
  /** 即使拿掉商品連結後仍超過上限：LINE 端可能截斷訊息，UI 應警告使用者 */
  stillTooLong: boolean
}

interface SingleInquiryInput {
  productId: string
  productName: string
  categoryId: string | null | undefined
  attributes: Record<string, unknown>
  quantity: number
  unitPrice: number | null
}

/** 內部：渲染單筆品項詢問的純文字訊息（不負責 URL） */
function renderSingleMessage(
  input: SingleInquiryInput,
  includeUrl: boolean
): string {
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

/** 內部：渲染購物車詢問的純文字訊息（不負責 URL） */
function renderCartMessage(items: CartItem[], includeUrls: boolean): string {
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
 * 把 render 出來的訊息包成 InquiryPayload，並做 budget-aware fallback。
 *
 * - 先試帶網址版；URL 沒超標就用它
 * - 超標就退到不帶網址版，避免訊息被 LINE 截掉
 * - 若不帶網址還超標，標記 `stillTooLong` 讓 UI 警告
 */
function buildPayload(
  renderFn: (includeProductUrl: boolean) => string
): InquiryPayload {
  const fullMsg = renderFn(true)
  const fullUrl = buildOaMessageUrl(fullMsg)
  if (fullUrl.length <= URL_BUDGET) {
    return { url: fullUrl, message: fullMsg, urlsTrimmed: false, stillTooLong: false }
  }
  const slimMsg = renderFn(false)
  const slimUrl = buildOaMessageUrl(slimMsg)
  return {
    url: slimUrl,
    message: slimMsg,
    urlsTrimmed: true,
    stillTooLong: slimUrl.length > URL_BUDGET,
  }
}

/** 詳情頁「直接 LINE 詢問」用 */
export function buildSingleInquiry(input: SingleInquiryInput): InquiryPayload {
  return buildPayload((includeUrl) => renderSingleMessage(input, includeUrl))
}

/** 購物車「LINE 統一詢問購買」用 */
export function buildCartInquiry(items: CartItem[]): InquiryPayload {
  return buildPayload((includeUrls) => renderCartMessage(items, includeUrls))
}

/**
 * 統一的「跳轉到 LINE」入口。
 *
 * - 手機：直接 `window.location.href = payload.url`，喚起 LINE app
 * - 桌機：回傳 `{ mode: 'desktop-fallback', message }` 讓 UI 顯示 modal
 */
export type InquiryResult =
  | { mode: 'mobile-deeplink' }
  | { mode: 'desktop-fallback'; message: string }

export function launchInquiry(payload: InquiryPayload): InquiryResult {
  if (isMobileDevice()) {
    window.location.href = payload.url
    return { mode: 'mobile-deeplink' }
  }
  return { mode: 'desktop-fallback', message: payload.message }
}
