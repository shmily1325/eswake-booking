import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { normalizeLabelCode, validateLabelCodeFormat } from './labelCode'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_FONT,
  fitTextFontSize,
  formatLabelPrice,
  measureTextWidth,
  mmToPx,
  retailLabelMetrics,
} from './labelLayout'

/** 熱感標籤機解析度；Niimbot 精臣 K3 為 203 DPI（標籤寬 20–82mm、高 15–300mm） */
export const LABEL_PRINT_DPI = 203

export interface LabelImageExportOptions {
  widthMm?: number
  heightMm?: number
  dpi?: number
  /** 商品名（品牌 + 型號） */
  productName?: string
  /** 價格（字串或數字） */
  price?: string | number | null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法載入標籤圖示'))
    img.src = src
  })
}

function renderBarcodeCanvas(
  displayCode: string,
  barcodeHeight: number,
  barWidth: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, displayCode, {
    format: 'CODE128',
    displayValue: false,
    height: barcodeHeight,
    margin: 0,
    width: barWidth,
    background: '#ffffff',
    lineColor: '#000000',
  })
  return canvas
}

/** 依目前 ctx 字型，把文字截斷到指定寬度內（超過補「…」） */
function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '…'
  let out = text
  while (out.length > 1 && ctx.measureText(out + ellipsis).width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + ellipsis
}

/** 依標籤紙尺寸輸出 PNG（白底、適合熱感標籤機） */
export async function renderLabelPngBlob(
  labelCode: string,
  options: LabelImageExportOptions = {},
): Promise<Blob> {
  const trimmed = labelCode.trim()
  const formatError = validateLabelCodeFormat(trimmed)
  if (!trimmed || formatError) throw new Error(formatError ?? '標籤代碼為空')

  const displayCode = normalizeLabelCode(trimmed) ?? trimmed.toUpperCase()
  const widthMm = options.widthMm ?? DEFAULT_LABEL_WIDTH_MM
  const heightMm = options.heightMm ?? DEFAULT_LABEL_HEIGHT_MM
  const dpi = options.dpi ?? LABEL_PRINT_DPI
  const nameText = (options.productName ?? '').trim()
  const priceText = formatLabelPrice(options.price)

  const widthPx = mmToPx(widthMm, dpi)
  const heightPx = mmToPx(heightMm, dpi)
  const m = retailLabelMetrics(widthPx)

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立標籤圖片')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  const logoImg = await loadImage(ES_BRAND.logoBlack)
  const barcodeCanvas = renderBarcodeCanvas(displayCode, m.barcodeHeight, m.barWidth)

  const innerW = widthPx - m.pad * 2
  const rowGap = Math.max(4, Math.round(m.pad * 0.5))
  const headerHeight = Math.max(m.logo, m.priceFont * 1.15, m.nameFont * 1.2)
  const codeLineHeight = Math.round(m.codeFont * 1.25)
  // 版面：header（logo + 名稱｜價格）→ 條碼 → 代碼文字
  const contentHeight = headerHeight + rowGap + barcodeCanvas.height + rowGap + codeLineHeight
  let y = Math.max(m.pad, Math.round((heightPx - contentHeight) / 2))
  if (contentHeight + m.pad > heightPx) y = m.pad

  // 價格（右上，先量寬度好保留給名稱的空間）
  let priceWidth = 0
  if (priceText) {
    const priceX = widthPx - m.pad
    priceWidth = measureTextWidth(priceText, m.priceFont, 800)
    ctx.fillStyle = '#111111'
    ctx.font = `800 ${m.priceFont}px ${LABEL_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(priceText, priceX, y + headerHeight / 2)
  }

  // logo（左上）
  const logoY = y + Math.round((headerHeight - m.logo) / 2)
  ctx.drawImage(logoImg, m.pad, logoY, m.logo, m.logo)

  // 商品名（logo 右側；縮字或截斷以塞入剩餘寬度）
  const nameX = m.pad + m.logo + m.gap
  const nameMaxW = Math.max(20, innerW - m.logo - m.gap - (priceWidth ? priceWidth + m.gap : 0))
  const nameDisplay = nameText || '（未命名商品）'
  const nameFont = fitTextFontSize(nameDisplay, nameMaxW, m.nameFont, 9, 700)
  ctx.fillStyle = '#111111'
  ctx.font = `700 ${nameFont}px ${LABEL_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncateToWidth(ctx, nameDisplay, nameMaxW), nameX, y + headerHeight / 2)

  // 條碼撐滿內容寬度、左緣對齊 logo
  const barcodeY = y + headerHeight + rowGap
  ctx.drawImage(barcodeCanvas, m.pad, barcodeY, innerW, barcodeCanvas.height)

  // 代碼文字（條碼下方置中）
  const codeY = barcodeY + barcodeCanvas.height + rowGap + codeLineHeight / 2
  ctx.fillStyle = '#111111'
  ctx.font = `700 ${m.codeFont}px ${LABEL_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const prevSpacing = (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing
  try {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(m.codeFont * 0.08)}px`
  } catch {
    // 部分瀏覽器不支援 canvas letterSpacing，忽略
  }
  ctx.fillText(displayCode, widthPx / 2, codeY)
  if (prevSpacing !== undefined) {
    try {
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = prevSpacing
    } catch {
      // 略
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('無法產生 PNG'))
      },
      'image/png',
      1,
    )
  })
}

export type SaveLabelPngResult = 'shared' | 'downloaded' | 'cancelled'

export function buildLabelPngFilename(labelCode: string): string {
  const displayCode = normalizeLabelCode(labelCode) ?? labelCode.trim().toUpperCase()
  return `ES-label-${displayCode}.png`
}

export function canSharePngFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare?.({ files: [file] }) === true
  } catch {
    return false
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * 手機優先走系統分享（iOS 可選「儲存圖片」到相簿）；桌機則下載 PNG。
 */
export async function saveLabelPng(
  labelCode: string,
  options: LabelImageExportOptions = {},
): Promise<SaveLabelPngResult> {
  const blob = await renderLabelPngBlob(labelCode, options)
  const filename = buildLabelPngFilename(labelCode)
  const file = new File([blob], filename, { type: 'image/png' })

  if (canSharePngFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: `標籤 ${normalizeLabelCode(labelCode) ?? labelCode.trim().toUpperCase()}`,
      })
      return 'shared'
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      // 分享失敗時改走下載
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}

/** @deprecated 請改用 saveLabelPng */
export async function downloadLabelPng(
  labelCode: string,
  options: LabelImageExportOptions = {},
): Promise<void> {
  const result = await saveLabelPng(labelCode, options)
  if (result === 'cancelled') return
}
