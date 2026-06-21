import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { validateLabelCodeFormat } from './labelCode'

/** 預設標籤紙尺寸（mm）；實際紙張確認後可改設定 */
export const DEFAULT_LABEL_WIDTH_MM = 40
export const DEFAULT_LABEL_HEIGHT_MM = 30

const MM_TO_PX = 3.7795275591

interface ProductLabelPreviewProps {
  labelCode: string
  /** 螢幕預覽倍率（實際標籤 40×30mm × scale）；未指定時依 isMobile 自動 */
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
  const effectiveScale = scale ?? (isMobile ? 3.2 : 2.4)
  const [expanded, setExpanded] = useState(false)

  const trimmed = labelCode.trim()
  const formatError = trimmed ? validateLabelCodeFormat(trimmed) : null

  const wPx = Math.round(widthMm * MM_TO_PX * effectiveScale)
  const hPx = Math.round(heightMm * MM_TO_PX * effectiveScale)

  const preview = (
    <LabelCard
      labelCode={labelCode}
      scale={effectiveScale}
      widthPx={wPx}
      minHeightPx={hPx}
      formatError={formatError}
    />
  )

  return (
    <>
      <div style={{ ...wrapStyle, alignItems: isMobile ? 'center' : 'flex-start', width: '100%' }}>
        <button
          type="button"
          onClick={() => isMobile && trimmed && !formatError && setExpanded(true)}
          disabled={!isMobile || !trimmed || !!formatError}
          aria-label={isMobile && trimmed && !formatError ? '點一下放大標籤預覽' : undefined}
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: isMobile && trimmed && !formatError ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {preview}
        </button>
        <p style={{ ...hintStyle, textAlign: isMobile ? 'center' : 'left', width: '100%' }}>
          標籤預覽 · 約 {widthMm}×{heightMm} mm
          {isMobile && trimmed && !formatError ? (
            <span style={{ marginLeft: 6, color: '#2563eb' }}>點一下放大</span>
          ) : (
            <span style={{ marginLeft: 6, color: '#bbb' }}>(demo)</span>
          )}
        </p>
      </div>

      {expanded && (
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
              scale={4.5}
              widthPx={Math.round(widthMm * MM_TO_PX * 4.5)}
              minHeightPx={Math.round(heightMm * MM_TO_PX * 4.5)}
              formatError={formatError}
            />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 16,
                padding: '12px 16px',
                border: 'none',
                borderRadius: 10,
                background: '#fff',
                color: '#111',
                fontSize: 15,
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
}

function LabelCard({ labelCode, scale, widthPx, minHeightPx, formatError }: LabelCardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const trimmed = labelCode.trim()
  const displayCode = trimmed.toUpperCase()
  const logoPx = Math.max(14, Math.round(11 * scale * 0.42))

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = ''
    if (!trimmed || formatError) return
    try {
      JsBarcode(svg, displayCode, {
        format: 'CODE128',
        displayValue: true,
        font: 'monospace',
        fontSize: Math.max(9, Math.round(8 * scale * 0.45)),
        textMargin: 1,
        height: Math.max(22, Math.round(12 * scale * 0.85)),
        margin: Math.round(2 * scale * 0.35),
        width: Math.max(1, 1.1 * scale * 0.45),
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
          ...placeholderStyle,
          width: widthPx,
          minHeight: minHeightPx,
          flexDirection: 'row',
          gap: Math.round(6 * scale * 0.35),
          padding: Math.round(6 * scale * 0.35),
        }}
      >
        <EsLogo size={logoPx} faded />
        <span style={{ fontSize: 11, color: '#999', lineHeight: 1.4, flex: 1 }}>
          輸入標籤代碼即可預覽
        </span>
      </div>
    )
  }

  if (formatError) {
    return (
      <div
        style={{
          ...placeholderStyle,
          width: widthPx,
          minHeight: minHeightPx,
          borderColor: '#fecaca',
          background: '#fef2f2',
        }}
      >
        <span style={{ fontSize: 11, color: '#b91c1c', textAlign: 'center', padding: 8 }}>{formatError}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: widthPx,
        minHeight: minHeightPx,
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        padding: Math.round(5 * scale * 0.35),
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.round(4 * scale * 0.35),
        overflow: 'hidden',
      }}
    >
      <EsLogo size={logoPx} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: Math.round(2 * scale * 0.25),
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: Math.max(8, Math.round(8 * scale * 0.48)),
            letterSpacing: '0.02em',
            textAlign: 'left',
            wordBreak: 'break-all',
            lineHeight: 1.15,
          }}
        >
          {displayCode}
        </div>
        <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden />
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
        opacity: faded ? 0.35 : 1,
      }}
    />
  )
}

const hintStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 11,
  color: '#888',
}

const wrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const placeholderStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  background: '#fafafa',
  border: '2px dashed #ddd',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}
