import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { normalizeLabelCode, validateLabelCodeFormat } from './labelCode'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_FONT,
  labelMetrics,
  mmToPx,
} from './labelLayout'

/** 常見熱感標籤機解析度（Brother / 芯燁等） */
export const LABEL_PRINT_DPI = 203

export interface LabelImageExportOptions {
  widthMm?: number
  heightMm?: number
  dpi?: number
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

  const widthPx = mmToPx(widthMm, dpi)
  const heightPx = mmToPx(heightMm, dpi)
  const m = labelMetrics(widthPx, displayCode)

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立標籤圖片')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  const logoImg = await loadImage(ES_BRAND.logoBlack)
  const barcodeCanvas = renderBarcodeCanvas(displayCode, m.barcodeHeight, m.barWidth)

  const rowGap = Math.max(4, Math.round(m.pad * 0.45))
  const headerHeight = Math.max(m.logo, m.fontSize * 1.15)
  const contentHeight = headerHeight + rowGap + barcodeCanvas.height
  let y = m.pad
  if (contentHeight + m.pad * 2 > heightPx) {
    y = Math.max(0, Math.round((heightPx - contentHeight) / 2))
  }

  const logoY = y + Math.round((headerHeight - m.logo) / 2)
  ctx.drawImage(logoImg, m.pad, logoY, m.logo, m.logo)

  ctx.fillStyle = '#111111'
  ctx.font = `700 ${m.fontSize}px ${LABEL_FONT}`
  ctx.textBaseline = 'middle'
  const textX = m.pad + m.logo + m.gap
  const textY = y + headerHeight / 2
  ctx.fillText(displayCode, textX, textY)

  const barcodeY = y + headerHeight + rowGap
  const scale = Math.min(1, (widthPx - m.pad * 2) / barcodeCanvas.width)
  const drawW = Math.round(barcodeCanvas.width * scale)
  const drawH = Math.round(barcodeCanvas.height * scale)
  const barcodeX = m.pad + Math.round((widthPx - m.pad * 2 - drawW) / 2)
  ctx.drawImage(barcodeCanvas, barcodeX, barcodeY, drawW, drawH)

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

export async function downloadLabelPng(
  labelCode: string,
  options: LabelImageExportOptions = {},
): Promise<void> {
  const displayCode = normalizeLabelCode(labelCode) ?? labelCode.trim().toUpperCase()
  const blob = await renderLabelPngBlob(labelCode, options)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ES-label-${displayCode}.png`
  anchor.click()
  URL.revokeObjectURL(url)
}
