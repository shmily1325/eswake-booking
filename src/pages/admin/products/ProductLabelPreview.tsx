import { useEffect, useMemo, useRef, useState } from 'react'
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
  const effectiveScale = scale ?? (isMobile ? 2.8 : 2.4)
  const [expanded, setExpanded] = useState(false)

  const trimmed = labelCode.trim()
  const formatError = trimmed ? validateLabelCodeFormat(trimmed) : null
  const hasPreview = Boolean(trimmed && !formatError)

  const widthPx = Math.round(widthMm * MM_TO_PX * effectiveScale)

  const preview = (
    <LabelCard labelCode={labelCode} widthPx={widthPx} formatError={formatError} />
  )

  return (
    <>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
              widthPx={Math.round(widthMm * MM_TO_PX * 4.5)}
              formatError={formatError}
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
  widthPx: number
  formatError: string | null
}

/** 依標籤寬度與代碼長度算各元素尺寸（方案 A：logo ~20% 寬 + 粗體一行 + 純條碼） */
function labelMetrics(widthPx: number, codeLen: number) {
  const w = widthPx
  const baseFont = Math.max(12, Math.round(w * 0.068))
  let fontSize = baseFont
  if (codeLen > 16) fontSize = Math.round(baseFont * 0.72)
  else if (codeLen > 12) fontSize = Math.round(baseFont * 0.85)

  return {
    pad: Math.max(7, Math.round(w * 0.045)),
    logo: Math.max(26, Math.round(w * 0.2)),
    fontSize,
    barcodeHeight: Math.max(34, Math.round(w * 0.19)),
    barWidth: Math.max(1.1, w * 0.0046),
  }
}

const labelShellStyle = (widthPx: number): React.CSSProperties => ({
  width: '100%',
  maxWidth: widthPx,
  boxSizing: 'border-box',
})

function LabelCard({ labelCode, widthPx, formatError }: LabelCardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const trimmed = labelCode.trim()
  const displayCode = trimmed.toUpperCase()
  const m = useMemo(() => labelMetrics(widthPx, displayCode.length), [widthPx, displayCode.length])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = ''
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
    } catch {
      // invalid barcode payload
    }
  }, [displayCode, formatError, m.barWidth, m.barcodeHeight, trimmed])

  if (!trimmed) {
    return (
      <div
        style={{
          ...labelShellStyle(widthPx),
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
        style={{
          ...labelShellStyle(widthPx),
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
      style={{
        ...labelShellStyle(widthPx),
        background: '#fff',
        border: '1px solid #999',
        borderRadius: 3,
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        padding: m.pad,
        display: 'flex',
        flexDirection: 'column',
        gap: Math.max(4, Math.round(m.pad * 0.5)),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: Math.round(m.pad * 0.6),
          minWidth: 0,
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
            letterSpacing: '0.015em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#111',
          }}
          title={displayCode}
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
