import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ES_BRAND } from '../lib/esBrandTokens'

interface EsBrandLockupProps {
  brand?: string
  subtitle?: string
  /** 窄螢幕隱藏副標（例如 Shop 詳情頁有 Back 時） */
  subtitleClassName?: string
  variant?: 'onDark' | 'onLight'
  logoSize?: number
  /** 點擊 logo／字標導向（Shop 首頁等） */
  brandTo?: string
  trailing?: ReactNode
  /** 綁定卡等置中版面 */
  align?: 'start' | 'center'
  style?: CSSProperties
}

/** [logo] ES Wake + 可選副標；LIFF 預約／會員專區／Shop 共用 */
export function EsBrandLockup({
  brand = ES_BRAND.name,
  subtitle,
  subtitleClassName,
  variant = 'onDark',
  logoSize = 32,
  brandTo,
  trailing,
  align = 'start',
  style,
}: EsBrandLockupProps) {
  const onDark = variant === 'onDark'
  const brandColor = onDark ? '#fff' : ES_BRAND.headerBg
  const subtitleColor = onDark ? 'rgba(255,255,255,0.78)' : '#666'
  const logoSrc = onDark ? ES_BRAND.logoWhite : ES_BRAND.logoBlack

  const centered = align === 'center'

  const brandBlock = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
      justifyContent: centered ? 'center' : undefined,
    }}>
      <img
        src={logoSrc}
        alt=""
        width={logoSize}
        height={logoSize}
        style={{ objectFit: 'contain', flexShrink: 0, display: 'block' }}
        draggable={false}
      />
      <div style={{ minWidth: 0, textAlign: centered ? 'center' : undefined }}>
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
            className={subtitleClassName}
            style={{
            fontSize: 13,
            fontWeight: 600,
            color: subtitleColor,
            marginTop: 2,
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
          }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )

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
      {brandTo ? (
        <Link
          to={brandTo}
          className="min-w-0 shrink text-inherit no-underline"
          aria-label={subtitle ? `${brand} ${subtitle}` : brand}
        >
          {brandBlock}
        </Link>
      ) : (
        brandBlock
      )}
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </div>
  )
}
