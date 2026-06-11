import type { CSSProperties, ReactNode } from 'react'
import { ES_BRAND } from '../../lib/esBrandTokens'

/** 公開預約／行前須知：桌機置中欄寬（接近手機操作寬度） */
export const BOOK_PUBLIC_COLUMN_MAX_WIDTH = 480

const columnStyle: CSSProperties = {
  width: '100%',
  maxWidth: BOOK_PUBLIC_COLUMN_MAX_WIDTH,
  margin: '0 auto',
  minHeight: '100vh',
}

/** /book、/book/guide 共用外殼：灰底 + 置中欄寬 */
export function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: ES_BRAND.pageBg }}>
      <div style={columnStyle}>{children}</div>
    </div>
  )
}
