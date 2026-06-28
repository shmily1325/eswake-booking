import type { CSSProperties } from 'react'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

export interface BookCopyrightFooterLink {
  href: string
  label: string
}

/** 預約／行前須知頁底部版權（可選 LINE 連結） */
export function BookCopyrightFooter({
  subtitle = ES_BRAND.bookingAreaLabel,
  link,
}: {
  subtitle?: string
  link?: BookCopyrightFooterLink
}) {
  const wrapStyle: CSSProperties = {
    padding: '16px 16px 8px',
    textAlign: 'center',
    color: T.mutedLight,
    fontSize: ty.caption,
    lineHeight: 1.55,
  }

  return (
    <div style={wrapStyle}>
      {link ? (
        <p style={{ margin: '0 0 12px' }}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.estimateAccent, fontWeight: 600, textDecoration: 'none' }}
          >
            {link.label}
          </a>
        </p>
      ) : null}
      <BrandCopyrightBlock
        subtitle={subtitle}
        style={{ padding: 0, color: 'inherit', fontSize: 'inherit' }}
      />
    </div>
  )
}
