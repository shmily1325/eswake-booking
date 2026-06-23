import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { validateLabelCodeFormat } from './labelCode'
import { saveLabelPng } from './labelImageExport'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  LABEL_FONT,
  labelMetrics,
} from './labelLayout'

const MM_TO_PX = 3.7795275591
const MODAL_Z_INDEX = 99999

export { DEFAULT_LABEL_HEIGHT_MM, DEFAULT_LABEL_WIDTH_MM } from './labelLayout'

interface ProductLabelPreviewProps {
  labelCode: string
  scale?: number
  widthMm?: number
  heightMm?: number
  isMobile?: boolean
}

export function ProductLabelPreview({
  labelCode,
  scale,
  widthMm = DEFAULT_LABEL_WIDTH_MM,
  heightMm = DEFAULT_LABEL_HEIGHT_MM,
  isMobile = false,
}: ProductLabelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [expanded, setExpanded] = useState(false)

  const trimmed = labelCode.trim()
  const formatError = trimmed ? validateLabelCodeFormat(trimmed) : null
  const hasPreview = Boolean(trimmed && !formatError)

  const baseWidthPx = widthMm * MM_TO_PX
  const desktopWidthPx = Math.round(baseWidthPx * (scale ?? 2.4))
  const fallbackWidthPx = Math.round(baseWidthPx * (isMobile ? 1.35 : 2.4))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const inlineWidthPx =
    isMobile && containerWidth > 0
      ? containerWidth
      : isMobile
        ? fallbackWidthPx
        : desktopWidthPx

  const handleExpand = useCallback(() => {
    if (isMobile && hasPreview) setExpanded(true)
  }, [hasPreview, isMobile])

  const expandOverlay =
    expanded && hasPreview
      ? createPortal(
          <LabelExpandModal
            labelCode={labelCode}
            formatError={formatError}
            widthMm={widthMm}
            heightMm={heightMm}
            isMobile={isMobile}
            onClose={() => setExpanded(false)}
          />,
          document.body,
        )
      : null

  return (
    <>
      <div
        ref={containerRef}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {hasPreview && isMobile ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="點一下放大標籤預覽"
            onClick={handleExpand}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleExpand()
              }
            }}
            style={{
              display: 'block',
              width: '100%',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <LabelCard
              labelCode={labelCode}
              widthPx={inlineWidthPx}
              formatError={formatError}
            />
          </div>
        ) : (
          <LabelCard
            labelCode={labelCode}
            widthPx={inlineWidthPx}
            formatError={formatError}
          />
        )}
        {hasPreview && (
          <>
            <p style={{ ...hintStyle, textAlign: isMobile ? 'center' : 'left' }}>
              標籤約 {widthMm}×{heightMm} mm
              {isMobile && <span style={{ marginLeft: 6, color: '#2563eb' }}>· 點預覽放大</span>}
            </p>
            <LabelDownloadButton labelCode={labelCode} widthMm={widthMm} heightMm={heightMm} isMobile={isMobile} />
          </>
        )}
      </div>
      {expandOverlay}
    </>
  )
}

interface LabelExpandModalProps {
  labelCode: string
  formatError: string | null
  widthMm: number
  heightMm: number
  isMobile: boolean
  onClose: () => void
}

function LabelExpandModal({
  labelCode,
  formatError,
  widthMm,
  heightMm,
  isMobile,
  onClose,
}: LabelExpandModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [sheetInnerWidth, setSheetInnerWidth] = useState(0)

  useEffect(() => {
    const scrollY = window.scrollY
    const html = document.documentElement
    const { body } = document
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyWidth = body.style.width

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.width = prevBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const update = () => setSheetInnerWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const expandWidthPx = useMemo(() => {
    if (isMobile && sheetInnerWidth > 0) return sheetInnerWidth
    const vw = typeof window !== 'undefined' ? window.innerWidth : 360
    return Math.round(Math.min(vw * 0.88, widthMm * MM_TO_PX * 3.2))
  }, [isMobile, sheetInnerWidth, widthMm])

  const backdrop = (
    <div
      aria-hidden
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
      }}
    />
  )

  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="標籤預覽放大"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '-webkit-fill-available',
          zIndex: MODAL_Z_INDEX,
          isolation: 'isolate',
        }}
      >
        {backdrop}
        <div
          ref={sheetRef}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: 'min(88dvh, calc(100dvh - env(safe-area-inset-top) - 12px))',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.28)',
            paddingTop: 12,
            paddingLeft: 'max(16px, env(safe-area-inset-left))',
            paddingRight: 'max(16px, env(safe-area-inset-right))',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>標籤預覽</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              style={{
                border: 'none',
                background: '#f3f4f6',
                color: '#333',
                width: 36,
                height: 36,
                borderRadius: 18,
                fontSize: 18,
                lineHeight: 1,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              ×
            </button>
          </div>
          <LabelCard
            labelCode={labelCode}
            widthPx={expandWidthPx || Math.round(widthMm * MM_TO_PX * 2.8)}
            formatError={formatError}
          />
          <LabelDownloadButton
            labelCode={labelCode}
            widthMm={widthMm}
            heightMm={heightMm}
            isMobile
            fullWidth
          />
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 16,
              padding: '14px 16px',
              border: 'none',
              borderRadius: 12,
              background: '#111',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              touchAction: 'manipulation',
              flexShrink: 0,
            }}
          >
            關閉
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="標籤預覽放大"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: MODAL_Z_INDEX,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: expandWidthPx }}
      >
        <LabelCard labelCode={labelCode} widthPx={expandWidthPx} formatError={formatError} />
        <LabelDownloadButton
          labelCode={labelCode}
          widthMm={widthMm}
          heightMm={heightMm}
          isMobile={false}
          fullWidth
        />
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 16,
            padding: '14px 16px',
            border: 'none',
            borderRadius: 12,
            background: '#fff',
            color: '#111',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          關閉
        </button>
      </div>
    </div>
  )
}

interface LabelCardProps {
  labelCode: string
  widthPx: number
  formatError: string | null
}

function LabelDownloadButton({
  labelCode,
  widthMm,
  heightMm,
  isMobile,
  fullWidth = false,
}: {
  labelCode: string
  widthMm: number
  heightMm: number
  isMobile: boolean
  fullWidth?: boolean
}) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successHint, setSuccessHint] = useState<string | null>(null)

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    setSuccessHint(null)
    try {
      const result = await saveLabelPng(labelCode, { widthMm, heightMm })
      if (result === 'shared') {
        setSuccessHint('請在分享選單點「儲存圖片」存入相簿')
      } else if (result === 'downloaded') {
        setSuccessHint(isMobile ? '已下載；若未看到檔案，請改點「儲存標籤圖」用分享選單存相簿' : '已下載 PNG')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setDownloading(false)
    }
  }

  const buttonLabel = isMobile ? '儲存標籤圖' : '下載標籤圖（PNG）'
  const hintText = isMobile
    ? `${widthMm}×${heightMm} mm · 點擊後選「儲存圖片」可存入相簿，再匯入標籤機`
    : `${widthMm}×${heightMm} mm · 203 DPI，可匯入標籤機或列印軟體`

  return (
    <div style={{ marginTop: fullWidth ? 12 : 8 }}>
      <button
        type="button"
        data-track="product_label_download"
        onClick={() => void handleDownload()}
        disabled={downloading}
        style={{
          display: fullWidth ? 'block' : 'inline-block',
          width: fullWidth ? '100%' : undefined,
          padding: isMobile ? '10px 14px' : '8px 12px',
          borderRadius: 8,
          border: '1px solid #333',
          background: '#fff',
          color: '#111',
          fontSize: isMobile ? 14 : 13,
          fontWeight: 600,
          cursor: downloading ? 'wait' : 'pointer',
          minHeight: isMobile ? 44 : undefined,
        }}
      >
        {downloading ? '產生圖片中…' : buttonLabel}
      </button>
      {successHint && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#2e7d32', lineHeight: 1.4 }}>{successHint}</p>
      )}
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#c62828', lineHeight: 1.4 }}>{error}</p>
      )}
      <p style={{ ...hintStyle, marginTop: 6, textAlign: fullWidth && isMobile ? 'center' : 'left' }}>
        {hintText}
      </p>
    </div>
  )
}

function LabelCard({ labelCode, widthPx, formatError }: LabelCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(widthPx)
  const [barcodeOk, setBarcodeOk] = useState<boolean | null>(null)

  const trimmed = labelCode.trim()
  const displayCode = trimmed.toUpperCase()

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setMeasuredWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setMeasuredWidth(widthPx)
  }, [widthPx])

  const m = useMemo(
    () => labelMetrics(measuredWidth, displayCode),
    [displayCode, measuredWidth],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = ''
    setBarcodeOk(null)
    if (!trimmed || formatError) return
    try {
      JsBarcode(svg, displayCode, {
        format: 'CODE128',
        displayValue: false,
        height: m.barcodeHeight,
        margin: 0,
        width: m.barWidth,
        background: '#ffffff',
        lineColor: '#000000',
      })
      setBarcodeOk(svg.childElementCount > 0)
    } catch {
      setBarcodeOk(false)
    }
  }, [displayCode, formatError, m.barWidth, m.barcodeHeight, trimmed])

  const shellStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: widthPx,
    boxSizing: 'border-box',
  }

  if (!trimmed) {
    return (
      <div
        ref={cardRef}
        style={{
          ...shellStyle,
          padding: `${m.pad}px`,
          borderRadius: 6,
          border: '1px solid #e5e7eb',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <EsLogo size={m.logo} faded />
        <span style={{ fontSize: 13, color: '#aaa', lineHeight: 1.35, fontFamily: LABEL_FONT }}>
          輸入代碼後顯示標籤預覽
        </span>
      </div>
    )
  }

  if (formatError) {
    return (
      <div
        ref={cardRef}
        style={{
          ...shellStyle,
          padding: m.pad,
          borderRadius: 6,
          border: '1px solid #fecaca',
          background: '#fef2f2',
        }}
      >
        <span style={{ fontSize: 13, color: '#b91c1c', fontFamily: LABEL_FONT }}>{formatError}</span>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      style={{
        ...shellStyle,
        background: '#fff',
        border: '1px solid #999',
        borderRadius: 3,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        padding: m.pad,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.max(4, Math.round(m.pad * 0.45)),
        overflow: 'visible',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: m.gap,
        }}
      >
        <EsLogo size={m.logo} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: LABEL_FONT,
            fontWeight: 700,
            fontSize: m.fontSize,
            letterSpacing: '0.005em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            color: '#111',
          }}
        >
          {displayCode}
        </div>
      </div>
      <div
        style={{
          width: '100%',
          minHeight: m.barcodeHeight,
          position: 'relative',
          lineHeight: 0,
        }}
      >
        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: 'auto',
            display: barcodeOk ? 'block' : 'none',
            minHeight: barcodeOk ? m.barcodeHeight : 0,
          }}
          aria-hidden
        />
        {barcodeOk !== true && (
          <div
            style={{
              height: m.barcodeHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: barcodeOk === false ? '#b91c1c' : '#999',
              fontFamily: LABEL_FONT,
              border: '1px dashed #ddd',
              borderRadius: 2,
            }}
          >
            {barcodeOk === false ? '條碼無法產生' : '條碼產生中…'}
          </div>
        )}
      </div>
    </div>
  )
}

function EsLogo({ size, faded = false }: { size: number; faded?: boolean }) {
  return (
    <img
      src={ES_BRAND.logoBlack}
      alt="ES"
      width={size}
      height={size}
      draggable={false}
      style={{
        display: 'block',
        objectFit: 'contain',
        flexShrink: 0,
        opacity: faded ? 0.3 : 1,
      }}
    />
  )
}

const hintStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 11,
  color: '#999',
}
