export const LABEL_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** 預設標籤紙尺寸（mm）；配合 Niimbot 精臣 K3 的 80×50mm 貼紙（支援寬 20–82mm、高 15–300mm） */
export const DEFAULT_LABEL_WIDTH_MM = 80
export const DEFAULT_LABEL_HEIGHT_MM = 50

let measureCanvas: HTMLCanvasElement | null = null

function measureTextWidth(text: string, fontSize: number, weight = 700): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.58
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.58
  ctx.font = `${weight} ${fontSize}px ${LABEL_FONT}`
  return ctx.measureText(text).width
}

/** 把價格字串格式化成「NT$ 1,200」；空值或非數字回 null */
export function formatLabelPrice(price: string | number | null | undefined): string | null {
  if (price === null || price === undefined || price === '') return null
  const n = typeof price === 'number' ? price : Number(String(price).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return null
  return `NT$ ${Math.round(n).toLocaleString('en-US')}`
}

/**
 * 橫式零售吊牌版型尺寸（依實際渲染寬度計算）。
 * 版面：上排 logo + 商品名（左）／價格（右）→ 條碼滿版 → 代碼文字置中。
 */
export function retailLabelMetrics(widthPx: number) {
  const w = Math.max(widthPx, 160)
  const pad = Math.max(8, Math.round(w * 0.045))
  const gap = Math.max(4, Math.round(pad * 0.5))
  const logo = Math.max(16, Math.round(w * 0.1))
  const nameFont = Math.max(10, Math.round(w * 0.052))
  const priceFont = Math.max(12, Math.round(w * 0.08))
  const codeFont = Math.max(9, Math.round(w * 0.05))
  const barcodeHeight = Math.max(30, Math.round(w * 0.2))
  const barWidth = Math.max(1, w * 0.004)
  return { w, pad, gap, logo, nameFont, priceFont, codeFont, barcodeHeight, barWidth }
}

/**
 * 讓文字在給定寬度內縮字（不截斷），回傳可用的字級。
 * 若最小字級仍放不下，回傳最小字級（呼叫端可自行做 ellipsis）。
 */
export function fitTextFontSize(
  text: string,
  maxWidth: number,
  preferred: number,
  min = 8,
  weight = 700,
): number {
  const max = Math.max(preferred, min)
  for (let size = max; size >= min; size--) {
    if (measureTextWidth(text, size, weight) <= maxWidth) return size
  }
  return min
}

export { measureTextWidth }

/** mm → px（依 DPI，標籤機常用 203） */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4)
}
