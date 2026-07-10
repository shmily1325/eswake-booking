import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { normalizeLabelCode, validateLabelCodeFormat } from './labelCode'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_FONT,
  formatLabelPrice,
  formatLabelSize,
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
  /** 尺寸（已含單位後綴，如 M、26cm） */
  size?: string
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

/**
 * 依目前 ctx 字型把文字換行：優先在空白斷行（保留英文單字），
 * 單一 token 過長時改逐字斷（支援中文）。
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  const flush = () => {
    if (cur) {
      lines.push(cur)
      cur = ''
    }
  }
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      flush()
      let chunk = ''
      for (const ch of word) {
        if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
          lines.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      cur = chunk
      continue
    }
    const trial = cur ? `${cur} ${word}` : word
    if (ctx.measureText(trial).width <= maxWidth) cur = trial
    else {
      flush()
      cur = word
    }
  }
  flush()
  return lines
}

/**
 * 商品名版面：從 preferred 字級往下縮，找出能在 maxLines 行內放完整的字級。
 * 都放不下時用最小字級並把最後一行截斷補「…」。
 */
function layoutNameLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredFont: number,
  minFont: number,
  maxLines: number,
): { font: number; lines: string[] } {
  for (let font = preferredFont; font >= minFont; font--) {
    ctx.font = `700 ${font}px ${LABEL_FONT}`
    const lines = wrapText(ctx, text, maxWidth)
    if (lines.length <= maxLines) return { font, lines }
  }
  ctx.font = `700 ${minFont}px ${LABEL_FONT}`
  const all = wrapText(ctx, text, maxWidth)
  const kept = all.slice(0, maxLines)
  if (all.length > maxLines && kept.length > 0) {
    kept[kept.length - 1] = truncateToWidth(ctx, `${kept[kept.length - 1]}…`, maxWidth)
  }
  return { font: minFont, lines: kept }
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
  const sizeText = formatLabelSize(options.size)

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
  const headerHeight = Math.round(Math.max(m.logo, m.priceFont * 1.15))
  const codeLineHeight = Math.round(m.codeFont * 1.25)

  // 商品名獨佔整行（最多兩行、自動縮字），避免與價格擠在同一行被截斷
  const nameDisplay = (nameText || '（未命名商品）').trim()
  const nameLineHeight = Math.round(m.nameFont * 1.22)
  const { font: nameFont, lines: nameLines } = layoutNameLines(
    ctx,
    nameDisplay,
    innerW,
    m.nameFont,
    Math.max(9, Math.round(m.nameFont * 0.62)),
    2,
  )

  // 尺寸接在商品名後面：同一行放得下就接著，放不下就換下一行
  let sizeInline = false
  let sizeNewLine = false
  if (sizeText) {
    const lastLine = nameLines[nameLines.length - 1] ?? ''
    const lastLineW = measureTextWidth(lastLine, nameFont, 700)
    const sizeW = measureTextWidth(sizeText, nameFont, 800)
    if (lastLineW + m.gap + sizeW <= innerW) sizeInline = true
    else sizeNewLine = true
  }
  const nameBlockLines = nameLines.length + (sizeNewLine ? 1 : 0)
  const nameBlockHeight = nameBlockLines * nameLineHeight

  // 版面：header（logo｜價格）→ 商品名(+尺寸) → 條碼 → 代碼文字
  const contentHeight =
    headerHeight + rowGap + nameBlockHeight + rowGap + barcodeCanvas.height + rowGap + codeLineHeight
  let y = Math.max(m.pad, Math.round((heightPx - contentHeight) / 2))
  if (contentHeight + m.pad > heightPx) y = m.pad

  // 價格（右上）
  if (priceText) {
    ctx.fillStyle = '#111111'
    ctx.font = `800 ${m.priceFont}px ${LABEL_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(priceText, widthPx - m.pad, y + headerHeight / 2)
  }

  // logo（左上）
  const logoY = y + Math.round((headerHeight - m.logo) / 2)
  ctx.drawImage(logoImg, m.pad, logoY, m.logo, m.logo)

  // 商品名（整行，左對齊）
  ctx.fillStyle = '#111111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const nameTop = y + headerHeight + rowGap
  ctx.font = `700 ${nameFont}px ${LABEL_FONT}`
  nameLines.forEach((line, i) => {
    ctx.fillText(line, m.pad, nameTop + nameLineHeight * i + nameLineHeight / 2)
  })

  // 尺寸（商品名後面，稍加粗）
  if (sizeText) {
    ctx.font = `800 ${nameFont}px ${LABEL_FONT}`
    if (sizeInline) {
      const lastIdx = nameLines.length - 1
      const lastLine = nameLines[lastIdx] ?? ''
      const lastLineW = measureTextWidth(lastLine, nameFont, 700)
      const sizeMidY = nameTop + nameLineHeight * lastIdx + nameLineHeight / 2
      ctx.fillText(sizeText, m.pad + lastLineW + m.gap, sizeMidY)
    } else if (sizeNewLine) {
      const sizeMidY = nameTop + nameLineHeight * nameLines.length + nameLineHeight / 2
      ctx.fillText(sizeText, m.pad, sizeMidY)
    }
  }

  // 條碼撐滿內容寬度、左緣對齊 logo
  const barcodeY = nameTop + nameBlockHeight + rowGap
  ctx.drawImage(barcodeCanvas, m.pad, barcodeY, innerW, barcodeCanvas.height)

  // 代碼文字（條碼下方置中）
  const codeY = barcodeY + barcodeCanvas.height + rowGap + codeLineHeight / 2
  ctx.fillStyle = '#333333'
  ctx.font = `600 ${m.codeFont}px ${LABEL_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const prevSpacing = (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing
  try {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(m.codeFont * 0.06)}px`
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
