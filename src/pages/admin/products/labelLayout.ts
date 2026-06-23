export const LABEL_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** 預設標籤紙尺寸（mm）；實際紙張確認後可改設定 */
export const DEFAULT_LABEL_WIDTH_MM = 40
export const DEFAULT_LABEL_HEIGHT_MM = 30

let measureCanvas: HTMLCanvasElement | null = null

function measureTextWidth(text: string, fontSize: number): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.58
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.58
  ctx.font = `700 ${fontSize}px ${LABEL_FONT}`
  return ctx.measureText(text).width
}

function fitFontSize(displayCode: string, maxWidth: number, preferred: number): number {
  const max = Math.max(preferred, 7)
  for (let size = max; size >= 7; size--) {
    if (measureTextWidth(displayCode, size) <= maxWidth) return size
  }
  return 7
}

/** 依實際渲染寬度算各元素尺寸；代碼自動縮字，不截斷 */
export function labelMetrics(widthPx: number, displayCode: string) {
  const w = Math.max(widthPx, 120)
  const codeLen = displayCode.length
  const pad = Math.max(6, Math.round(w * 0.04))
  const gap = Math.max(4, Math.round(pad * 0.55))
  const logo = Math.max(18, Math.round(w * (codeLen > 14 ? 0.14 : 0.16)))

  const textAreaWidth = Math.max(40, w - pad * 2 - logo - gap)
  let preferredFont = Math.max(9, Math.round(w * 0.065))
  if (codeLen > 16) preferredFont = Math.round(preferredFont * 0.78)
  else if (codeLen > 12) preferredFont = Math.round(preferredFont * 0.88)

  const fontSize = fitFontSize(displayCode, textAreaWidth, preferredFont)

  return {
    pad,
    gap,
    logo,
    fontSize,
    barcodeHeight: Math.max(28, Math.round(w * 0.16)),
    barWidth: Math.max(0.9, w * 0.0038),
  }
}

/** mm → px（依 DPI，標籤機常用 203） */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4)
}
