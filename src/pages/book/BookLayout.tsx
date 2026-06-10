import type { ReactNode } from 'react'
import { ES_BRAND } from '../../lib/esBrandTokens'

/** /book 外殼：灰底 + 置中寬度（與 Shop 系列一致） */
export function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: ES_BRAND.pageBg }}>
      <div className="mx-auto w-full max-w-lg md:max-w-xl">
        {children}
      </div>
    </div>
  )
}
