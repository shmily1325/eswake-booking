import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { validateLabelCodeFormat } from './labelCode'

/** 預設標籤紙尺寸（mm）；實際紙張確認後可改設定 */
export const DEFAULT_LABEL_WIDTH_MM = 40
export const DEFAULT_LABEL_HEIGHT_MM = 30

const LABEL_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

const MM_TO_PX = 3.7795275591

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
  const effectiveScale = scale ?? (isMobile ? 2.5 : 2.2)
  const [expanded, setExpanded] = useState(false)

  const trimmed = labelCode.trim()
  const formatError = trimmed ? validateLabelCodeFormat(trimmed) : null
  const hasPreview = Boolean(trimmed && !formatError)

  const wPx = Math.round(widthMm * MM_TO_PX * effectiveScale)
  const hPx = Math.round(heightMm * MM_TO_PX * effectiveScale)

  const preview = (
    <LabelCard
      labelCode={labelCode}
      scale={effectiveScale}
      widthPx={wPx}
      minHeightPx={hPx}
      formatError={formatError}
      isMobile={isMobile}
    />
  )

  return (
    <>
      <div style={{ width: '100%' }}>
        {hasPreview ? (
          <button
            type="button"
            onClick={() => isMobile && setExpanded(true)}
            disabled={!isMobile}
            aria-label={isMobile ? '點一下放大標籤預覽' : undefined}
            style={{
              margin: 0,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: isMobile ? 'pointer' : 'default',
              WebkitTapHighlightColor: 'transparent',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {preview}
          </button>
        ) : (
          preview
        )}
        {hasPreview && (
          <p style={{ ...hintStyle, textAlign: 'center' }}>
            標籤約 {widthMm}×{heightMm} mm
            {isMobile && <span style={{ marginLeft: 6, color: '#2563eb' }}>· 點預覽放大</span>}
          </p>
        )}
      </div>

      {expanded && hasPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="標籤預覽放大"
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <LabelCard
              labelCode={labelCode}
              scale={4.2}
              widthPx={Math.round(widthMm * MM_TO_PX * 4.2)}
              minHeightPx={Math.round(heightMm * MM_TO_PX * 4.2)}
              formatError={formatError}
              isMobile={isMobile}
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
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
      )}
    </>
  )
}

interface LabelCardProps {
  labelCode: string
  scale: number
  widthPx: number
  minHeightPx: number
  formatError: string | null
  isMobile: boolean
}

function LabelCard({
  labelCode,
  scale,
  widthPx,
  minHeightPx,
  formatError,
  isMobile,
}: LabelCardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const trimmed = labelCode.trim()
  const displayCode = trimmed.toUpperCase()
  const logoPx = Math.max(16, Math.round(12 * scale * 0.42))

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = ''
    if (!trimmed || formatError) return
    try {
      JsBarcode(svg, displayCode, {
        format: 'CODE128',
        displayValue: false,
        height: Math.max(24, Math.round(13 * scale * 0.9)),
        margin: 0,
        width: Math.max(1, 1.05 * scale * 0.45),
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      // invalid barcode payload
    }
  }, [displayCode, formatError, scale, trimmed])

  if (!trimmed) {
    return (
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: isMobile ? '14px 12px' : '12px',
          borderRadius: 10,
          border: '1px solid #ececec',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <EsLogo size={28} faded />
        <span style={{ fontSize: 13, color: '#aaa', lineHeight: 1.35, fontFamily: LABEL_FONT }}>
          輸入代碼後顯示標籤預覽
        </span>
      </div>
    )
  }

  if (formatError) {
    return (
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 12,
          borderRadius: 10,
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
      style={{
        width: isMobile ? '100%' : widthPx,
        maxWidth: '100%',
        minHeight: minHeightPx,
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        padding: Math.round(6 * scale * 0.35),
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(5 * scale * 0.28),
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: Math.round(5 * scale * 0.28),
          minWidth: 0,
        }}
      >
        <EsLogo size={logoPx} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: LABEL_FONT,
            fontWeight: 600,
            fontSize: Math.max(10, Math.round(9 * scale * 0.5)),
            letterSpacing: '0.01em',
            lineHeight: 1.2,
            wordBreak: 'break-all',
          }}
        >
          {displayCode}
        </div>
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden />
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
