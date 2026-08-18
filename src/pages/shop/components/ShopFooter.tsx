import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { resolveBookPublicUrl } from '../../liff/book/bookPaths'
import { buildOaHomeUrl } from '../lib/lineDeepLink'

/** Shop 各頁共用 footer（列表／詳情／購物車） */
export function ShopFooter({
  variant = 'light',
}: {
  variant?: 'light' | 'dark'
}) {
  const dark = variant === 'dark'
  const linkClass = dark
    ? 'inline-flex items-center min-h-11 px-3 text-sm font-semibold text-white/75 hover:text-white no-underline'
    : 'inline-flex items-center min-h-11 px-3 text-sm font-semibold text-gray-600 hover:text-gray-900 no-underline'
  const dotClass = dark ? 'text-white/30' : 'text-gray-300'

  return (
    <footer
      className={
        dark
          ? 'mt-8 border-t border-white/10 bg-black'
          : 'mt-8 border-t border-gray-200 bg-white'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-4">
        <EsBrandLockup
          variant={dark ? 'onDark' : 'onLight'}
          align="center"
          logoSize={36}
          style={{ justifyContent: 'center' }}
        />
        <nav aria-label="ES Wake" className="flex items-center justify-center">
          <a
            href={buildOaHomeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            官方 LINE
          </a>
          <span aria-hidden className={dotClass}>
            ·
          </span>
          <a
            href={resolveBookPublicUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {ES_BRAND.bookingAreaLabel}
          </a>
        </nav>
        <BrandCopyrightBlock
          style={{
            fontSize: 11,
            color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af',
          }}
        />
      </div>
    </footer>
  )
}
