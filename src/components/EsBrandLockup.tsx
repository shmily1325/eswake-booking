import type { CSSProperties, ReactNode } from 'react'
import { ES_BRAND } from '../lib/esBrandTokens'

interface EsBrandLockupProps {
  brand?: string
  subtitle?: string
  variant?: 'onDark' | 'onLight'
  logoSize?: number
  trailing?: ReactNode
  style?: CSSProperties
}

/** [logo] ES WAKE + 可選副標；LIFF 預約／會員專區共用 */
export function EsBrandLockup({
  brand = ES_BRAND.name,
  subtitle,
  variant = 'onDark',
  logoSize = 32,
  trailing,
  style,
}: EsBrandLockupProps) {
  const onDark = variant === 'onDark'
  const brandColor = onDark ? '#fff' : ES_BRAND.headerBg
  const subtitleColor = onDark ? 'rgba(255,255,255,0.78)' : '#666'
  const logoSrc = onDark ? ES_BRAND.logoWhite : ES_BRAND.logoBlack

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img
          src={logoSrc}
          alt=""
          width={logoSize}
          height={logoSize}
          style={{ objectFit: 'contain', flexShrink: 0, display: 'block' }}
          draggable={false}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: brandColor,
              lineHeight: 1.2,
              letterSpacing: '0.04em',
            }}
          >
            {brand}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: subtitleColor,
                marginTop: 2,
                lineHeight: 1.25,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </div>
  )
}
